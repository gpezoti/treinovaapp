// supabase/functions/rest-timer-push/index.ts
//
// Agenda e processa notificações reais de descanso.
// Por que existe: iOS/PWA pode suspender totalmente o app e o Service Worker,
// então timers locais não disparam enquanto a tela está bloqueada.
//
// Secrets necessários:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY
//   REST_TIMER_CRON_SECRET
//
// Chamada do app:
//   { action: "schedule", timer_id, fire_at, exercise_name }
//   { action: "cancel", timer_id }
//   { action: "test" }
//   { action: "test_delayed" }
//
// Chamada agendada/cron:
//   POST /functions/v1/rest-timer-push
//   header x-cron-secret: REST_TIMER_CRON_SECRET
//   body { action: "process" }

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:suporte@treinovaapp.com";
const REST_TIMER_CRON_SECRET = Deno.env.get("REST_TIMER_CRON_SECRET") || "";
const DIRECT_SEND_MAX_DELAY_MS = 5 * 60 * 1000;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function shortKey(key: string) {
  if (!key) return "";
  return `${key.slice(0, 10)}...${key.slice(-6)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function runAfterResponse(task: Promise<unknown>) {
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime && typeof runtime.waitUntil === "function") {
    runtime.waitUntil(task.catch((e) => console.error("[rest-timer-push waitUntil]", e)));
    return;
  }
  task.catch((e) => console.error("[rest-timer-push background]", e));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await sbUser.auth.getUser();
  return user || null;
}

function isCronAuthorized(req: Request) {
  const secret = req.headers.get("x-cron-secret") || "";
  return Boolean(REST_TIMER_CRON_SECRET && secret === REST_TIMER_CRON_SECRET);
}

function normalizePushSubscription(input: any) {
  if (!input || typeof input !== "object") return null;
  const endpoint = String(input.endpoint || "");
  const p256dh = String(input.keys?.p256dh || "");
  const auth = String(input.keys?.auth || "");
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

async function saveRequestSubscription(userId: string, body: any) {
  const sub = normalizePushSubscription(body?.subscription);
  if (!sub) return false;
  const { error } = await sbAdmin.from("push_subscriptions").upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: sub.p256dh,
    auth: sub.auth,
    user_agent: String(body?.user_agent || "request-subscription").slice(0, 500),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return true;
}

async function requestSubscription(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);
  const saved = await saveRequestSubscription(user.id, body);
  if (!saved) return json({ error: "Assinatura Web Push inválida." }, 400);
  return json({ ok: true });
}

async function scheduleJob(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);
  await saveRequestSubscription(user.id, body);

  const timerId = String(body.timer_id || "");
  const exerciseName = String(body.exercise_name || "Próxima série").slice(0, 160);
  const fireAt = new Date(body.fire_at || "");

  if (!timerId || Number.isNaN(fireAt.getTime())) {
    return json({ error: "timer_id e fire_at são obrigatórios." }, 400);
  }

  const now = Date.now();
  const fireMs = fireAt.getTime();
  if (fireMs < now - 10_000 || fireMs > now + 60 * 60 * 1000) {
    return json({ error: "fire_at fora do intervalo permitido." }, 400);
  }

  await sbAdmin
    .from("rest_timer_push_jobs")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("status", "scheduled");

  const { data: job, error } = await sbAdmin.from("rest_timer_push_jobs").upsert({
    user_id: user.id,
    timer_id: timerId,
    exercise_name: exerciseName,
    fire_at: fireAt.toISOString(),
    status: "scheduled",
    attempts: 0,
    last_error: null,
    sent_at: null,
    cancelled_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,timer_id" })
    .select("id,user_id,timer_id,exercise_name,fire_at,attempts")
    .single();

  if (error) return json({ error: error.message }, 500);
  const delayMs = Math.max(0, fireMs - Date.now());
  if (job?.id && delayMs <= DIRECT_SEND_MAX_DELAY_MS) {
    runAfterResponse(processSingleDueJob(job.id, delayMs));
  }
  return json({ ok: true, direct_send: Boolean(job?.id && delayMs <= DIRECT_SEND_MAX_DELAY_MS) });
}

async function cancelJob(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);
  const timerId = String(body.timer_id || "");
  if (!timerId) return json({ error: "timer_id é obrigatório." }, 400);

  const { error } = await sbAdmin
    .from("rest_timer_push_jobs")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("timer_id", timerId)
    .eq("status", "scheduled");

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function testPush(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);
  await saveRequestSubscription(user.id, body);

  const result = await sendJobNotification({
    id: crypto.randomUUID(),
    user_id: user.id,
    timer_id: `test-${Date.now()}`,
    exercise_name: "Teste do cronômetro",
    attempts: 0,
    _ephemeral: true,
  });

  if (!result.ok) {
    return json({
      error: result.error || "Não foi possível enviar o teste.",
      sent: result.sent,
      subscriptions: result.subscriptions,
    }, 500);
  }
  return json({ ok: true, sent: result.sent, subscriptions: result.subscriptions });
}

async function testDelayedPush(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);
  await saveRequestSubscription(user.id, body);

  const fireAt = new Date(Date.now() + 15_000);
  const timerId = `test-delayed-${Date.now()}`;
  const { data: job, error } = await sbAdmin.from("rest_timer_push_jobs").insert({
    user_id: user.id,
    timer_id: timerId,
    exercise_name: "Teste bloqueado",
    fire_at: fireAt.toISOString(),
    status: "scheduled",
    attempts: 0,
    updated_at: new Date().toISOString(),
  }).select("id,user_id,timer_id,exercise_name,fire_at,attempts").single();

  if (error) return json({ error: error.message }, 500);
  if (job?.id) runAfterResponse(processSingleDueJob(job.id, 15_000));
  return json({ ok: true, timer_id: timerId, fire_at: fireAt.toISOString() });
}

async function diagnosePush(req: Request) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);

  const { data: subs, error: subErr } = await sbAdmin
    .from("push_subscriptions")
    .select("id,endpoint,user_agent,last_seen_at")
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false });
  if (subErr) return json({ error: subErr.message }, 500);

  const { data: jobs, error: jobErr } = await sbAdmin
    .from("rest_timer_push_jobs")
    .select("id,timer_id,fire_at,status,attempts,last_error,sent_at,cancelled_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  if (jobErr) return json({ error: jobErr.message }, 500);

  return json({
    ok: true,
    edge_vapid_public_key: shortKey(VAPID_PUBLIC_KEY),
    edge_vapid_subject: VAPID_SUBJECT,
    subscriptions: (subs || []).map((s: any) => ({
      id: s.id,
      endpoint_host: safeEndpointHost(s.endpoint),
      user_agent: s.user_agent,
      last_seen_at: s.last_seen_at,
    })),
    jobs: jobs || [],
  });
}

async function processDueJobs(req: Request) {
  if (!isCronAuthorized(req)) return json({ error: "Cron não autorizado." }, 401);

  const { data: jobs, error } = await sbAdmin
    .from("rest_timer_push_jobs")
    .select("id,user_id,timer_id,exercise_name,fire_at,attempts")
    .eq("status", "scheduled")
    .lte("fire_at", new Date().toISOString())
    .order("fire_at", { ascending: true })
    .limit(100);

  if (error) return json({ error: error.message }, 500);
  if (!jobs?.length) return json({ ok: true, processed: 0, sent: 0, failed: 0 });

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    const result = await sendJobNotification(job);
    sent += result.sent;
    if (!result.ok) failed++;
  }

  return json({ ok: true, processed: jobs.length, sent, failed });
}

async function processSingleDueJob(jobId: string, delayMs = 0) {
  if (delayMs > 0) await sleep(delayMs);
  const { data: job, error } = await sbAdmin
    .from("rest_timer_push_jobs")
    .select("id,user_id,timer_id,exercise_name,fire_at,attempts,status")
    .eq("id", jobId)
    .eq("status", "scheduled")
    .maybeSingle();

  if (error) throw error;
  if (!job) return;
  if (new Date(job.fire_at).getTime() > Date.now() + 1000) return;
  await sendJobNotification(job);
}

async function sendJobNotification(job: any) {
  const { data: subs } = await sbAdmin
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", job.user_id);

  if (!subs?.length) {
    if (!job._ephemeral) {
      await sbAdmin.from("rest_timer_push_jobs").update({
        status: "failed",
        attempts: (job.attempts || 0) + 1,
        last_error: "Nenhuma subscription encontrada.",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "scheduled");
    }
    return { ok: false, sent: 0, subscriptions: 0, error: "Nenhuma assinatura Web Push encontrada para este usuário." };
  }

  let jobSent = 0;
  let lastError = "";
  const payload = JSON.stringify({
    title: "Descanso finalizado",
    body: `Próximo exercício: ${job.exercise_name || "Próxima série"}`,
    url: "/?view=workout&restTimer=1",
    tag: "treinova-rest-timer",
    silent: false,
    renotify: true,
  });

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        {
          TTL: 60 * 60,
          urgency: "high",
        }
      );
      jobSent++;
    } catch (e: any) {
      lastError = formatWebPushError(e);
      if (e.statusCode === 410 || e.statusCode === 404) {
        await sbAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }

  if (jobSent > 0) {
    if (!job._ephemeral) {
      await sbAdmin.from("rest_timer_push_jobs").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: (job.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id).eq("status", "scheduled");
    }
    return { ok: true, sent: jobSent, subscriptions: subs.length };
  }

  if (!job._ephemeral) {
    await sbAdmin.from("rest_timer_push_jobs").update({
      status: "failed",
      attempts: (job.attempts || 0) + 1,
      last_error: lastError || "Falha ao enviar Web Push.",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id).eq("status", "scheduled");
  }
  return { ok: false, sent: 0, subscriptions: subs.length, error: lastError || "Falha ao enviar Web Push." };
}

function safeEndpointHost(endpoint: string) {
  try { return new URL(endpoint).host; } catch { return "endpoint-invalido"; }
}

function formatWebPushError(e: any) {
  const status = e?.statusCode || e?.status || "";
  const body = typeof e?.body === "string" ? e.body.slice(0, 240) : "";
  const message = e?.message || String(e);
  return [
    status ? `HTTP ${status}` : "",
    message,
    body ? `Body: ${body}` : "",
  ].filter(Boolean).join(" - ").slice(0, 500);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  if (body.action === "schedule") return scheduleJob(req, body);
  if (body.action === "request-subscription") return requestSubscription(req, body);
  if (body.action === "cancel") return cancelJob(req, body);
  if (body.action === "test") return testPush(req, body);
  if (body.action === "test_delayed") return testDelayedPush(req, body);
  if (body.action === "diagnose") return diagnosePush(req);
  if (body.action === "process") return processDueJobs(req);

  return json({ error: "Ação inválida." }, 400);
});
