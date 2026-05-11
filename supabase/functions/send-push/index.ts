// supabase/functions/send-push/index.ts
// [C-NEW-01 FIX] Adicionado: verificação de JWT + filtro por coach_id (A-03 FIX)
// Apenas coaches e admins autenticados podem enviar push.
// Coach só pode enviar para seus próprios alunos.
//
// Secrets necessários:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT (mailto:suporte@treinovaapp.com)
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const VAPID_PUBLIC_KEY      = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY     = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT         = Deno.env.get("VAPID_SUBJECT") || "mailto:suporte@treinovaapp.com";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Cliente admin — nunca exposto no front; usado apenas para leitura segura
const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // ==========================================================================
  // [C-NEW-01 FIX] 1. Verificar JWT do chamante — sem JWT = 401 imediato
  // ==========================================================================
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Não autenticado. Authorization header ausente." }, 401);
  }

  // Valida o token via Supabase (cliente com o JWT do usuário)
  const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) {
    return json({ error: "Token inválido ou expirado." }, 401);
  }

  // ==========================================================================
  // [C-NEW-01 FIX] 2. Verificar que o chamante é staff (coach ou admin)
  // ==========================================================================
  const { data: caller, error: callerErr } = await sbAdmin
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .single();

  if (callerErr || !caller) {
    return json({ error: "Perfil não encontrado." }, 403);
  }
  if (caller.status !== "approved") {
    return json({ error: "Conta não aprovada." }, 403);
  }
  if (!["coach", "admin"].includes(caller.role)) {
    return json({ error: "Apenas coaches e admins podem enviar push notifications." }, 403);
  }

  try {
    const { user_ids, title, body, url, tag } = await req.json();
    if (!Array.isArray(user_ids) || !user_ids.length) {
      return json({ error: "user_ids deve ser um array não vazio." }, 400);
    }

    // ========================================================================
    // [A-03 FIX] 3. Se for coach, filtrar APENAS os alunos do seu coaching
    //              Admin pode enviar para qualquer user_id da plataforma.
    // ========================================================================
    let allowedIds: string[] = user_ids;
    if (caller.role === "coach") {
      const { data: students, error: studErr } = await sbAdmin
        .from("profiles")
        .select("id")
        .eq("coach_id", caller.id)
        .in("id", user_ids);

      if (studErr) {
        console.error("[send-push] Erro ao validar alunos do coach:", studErr);
        return json({ error: "Erro ao validar permissões." }, 500);
      }
      allowedIds = (students || []).map((s: any) => s.id);

      if (!allowedIds.length) {
        // Nenhum dos user_ids pertence ao coach — possível tentativa de abuso
        console.warn(`[send-push] Coach ${caller.id} tentou enviar push para user_ids que não são seus alunos:`, user_ids);
        return json({ ok: true, sent: 0, reason: "user_ids não pertencem aos seus alunos." });
      }
    }

    // ========================================================================
    // 4. Buscar subscriptions e enviar
    // ========================================================================
    const { data: subs } = await sbAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", allowedIds);

    if (!subs || !subs.length) {
      return json({ ok: true, sent: 0, reason: "Nenhuma subscription encontrada." }, 200, );
    }

    let sent = 0, failed = 0;
    const payload = JSON.stringify({
      title: title || "Treinova",
      body:  body  || "",
      url:   url   || "/",
      tag,
    });

    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e: any) {
        failed++;
        // Subscription expirada — remover automaticamente
        if (e.statusCode === 410 || e.statusCode === 404) {
          await sbAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        } else {
          console.error("[send-push] Falha ao enviar para endpoint:", s.endpoint, e.message);
        }
      }
    }

    return json({ ok: true, sent, failed }, 200);

  } catch (e: any) {
    console.error("[send-push] Erro inesperado:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
