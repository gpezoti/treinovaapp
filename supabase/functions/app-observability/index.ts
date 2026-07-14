// Recebe apenas eventos tecnicos de uma allowlist. Nenhum dado pessoal ou
// conteudo inserido pelo usuario e persistido neste log.
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const EVENT_NAMES = new Set([
  "app_boot_failed",
  "critical_load_failed",
  "workout_session_started",
  "workout_start_failed",
  "workout_completed",
  "workout_complete_failed",
  "rest_push_scheduled",
  "rest_push_schedule_failed",
  "signup_completed",
  "signup_failed",
  "checkout_started",
  "checkout_failed",
  "student_create_completed",
  "student_create_failed",
  "trainer_create_completed",
  "trainer_create_failed",
]);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function safeText(value: unknown, max = 80) {
  return String(value || "")
    .trim()
    .replace(/[\r\n\t]+/g, " ")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .slice(0, max);
}

function safeDetails(input: unknown) {
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const details: Record<string, string | number> = {};
  for (const key of ["source", "load", "error_kind", "view", "action"]) {
    const value = safeText(raw[key]);
    if (value) details[key] = value;
  }
  const duration = Number(raw.duration_ms);
  if (Number.isFinite(duration) && duration >= 0 && duration <= 300_000) {
    details.duration_ms = Math.round(duration);
  }
  const httpStatus = Number(raw.http_status);
  if (Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) {
    details.http_status = httpStatus;
  }
  return details;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await sbUser.auth.getUser();
    if (userError || !user?.id) return json({ error: "Sessão inválida." }, 401);

    const body = await req.json().catch(() => ({}));
    const eventName = safeText(body?.event, 80);
    const outcome = body?.outcome === "failure" ? "failure" : "success";
    if (!EVENT_NAMES.has(eventName)) return json({ error: "Evento não permitido." }, 400);

    const { data: profile } = await sbAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await sbAdmin
      .from("app_event_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((count || 0) >= 60) return json({ ok: true, dropped: true });

    const { error } = await sbAdmin.from("app_event_log").insert({
      user_id: user.id,
      role: ["admin", "coach", "student"].includes(profile?.role || "") ? profile?.role : null,
      event_name: eventName,
      outcome,
      context: safeDetails(body?.details),
    });
    if (error) throw error;

    return json({ ok: true });
  } catch (error) {
    console.error("[app-observability]", error);
    return json({ error: "Não foi possível registrar o evento." }, 500);
  }
});
