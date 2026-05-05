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

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
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

async function scheduleJob(req: Request, body: any) {
  const user = await getAuthenticatedUser(req);
  if (!user) return json({ error: "Não autenticado." }, 401);

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

  const { error } = await sbAdmin.from("rest_timer_push_jobs").upsert({
    user_id: user.id,
    timer_id: timerId,
    exercise_name: exerciseName,
    fire_at: fireAt.toISOString(),
    status: "scheduled",
    attempts: 0,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,timer_id" });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
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
    const { data: subs } = await sbAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", job.user_id);

    if (!subs?.length) {
      failed++;
      await sbAdmin.from("rest_timer_push_jobs").update({
        status: "failed",
        attempts: (job.attempts || 0) + 1,
        last_error: "Nenhuma subscription encontrada.",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      continue;
    }

    let jobSent = 0;
    let lastError = "";
    const payload = JSON.stringify({
      title: "Descanso finalizado",
      body: `Próximo exercício: ${job.exercise_name || "Próxima série"}`,
      url: "/",
      tag: "treinova-rest-timer",
    });

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        jobSent++;
      } catch (e: any) {
        lastError = e?.message || String(e);
        if (e.statusCode === 410 || e.statusCode === 404) {
          await sbAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }

    if (jobSent > 0) {
      sent += jobSent;
      await sbAdmin.from("rest_timer_push_jobs").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: (job.attempts || 0) + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
    } else {
      failed++;
      await sbAdmin.from("rest_timer_push_jobs").update({
        status: "failed",
        attempts: (job.attempts || 0) + 1,
        last_error: lastError || "Falha ao enviar Web Push.",
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
    }
  }

  return json({ ok: true, processed: jobs.length, sent, failed });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let body: any = {};
  try { body = await req.json(); } catch { body = {}; }

  if (body.action === "schedule") return scheduleJob(req, body);
  if (body.action === "cancel") return cancelJob(req, body);
  if (body.action === "process") return processDueJobs(req);

  return json({ error: "Ação inválida." }, 400);
});
