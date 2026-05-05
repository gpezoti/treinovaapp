// supabase/functions/admin-user/index.ts
// [A-04] Edge function para operações admin em auth.users (email, senha, etc.)
// Apenas coaches e admins autenticados podem chamar. Coaches só podem operar
// sobre seus próprios alunos.
//
// Secrets necessários:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_ANON_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL         = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY    = Deno.env.get("SUPABASE_ANON_KEY")!;

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // 1. Verificar JWT do chamante
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Não autenticado." }, 401);
  }

  const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authErr } = await sbUser.auth.getUser();
  if (authErr || !user) return json({ error: "Token inválido." }, 401);

  // 2. Verificar que chamante é staff
  const { data: caller } = await sbAdmin
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .single();

  if (!caller || caller.status !== "approved" || !["coach", "admin"].includes(caller.role)) {
    return json({ error: "Apenas coaches e admins podem executar esta ação." }, 403);
  }

  const body = await req.json();
  const { action, user_id } = body;

  if (!action || !user_id) {
    return json({ error: "action e user_id são obrigatórios." }, 400);
  }

  // 3. Se for coach, verificar que user_id é aluno do coach
  if (caller.role === "coach") {
    const { data: target } = await sbAdmin
      .from("profiles")
      .select("id, coach_id")
      .eq("id", user_id)
      .single();

    if (!target || target.coach_id !== caller.id) {
      return json({ error: "Você não tem permissão para modificar este usuário." }, 403);
    }
  }

  // 4. Executar a ação solicitada
  try {
    if (action === "update_email") {
      const { email } = body;
      if (!email || !email.includes("@")) {
        return json({ error: "Email inválido." }, 400);
      }
      const { error } = await sbAdmin.auth.admin.updateUserById(user_id, { email });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action: "update_email" });
    }

    if (action === "send_password_reset") {
      // Busca o email atual do usuário
      const { data: target } = await sbAdmin
        .from("profiles")
        .select("email")
        .eq("id", user_id)
        .single();

      if (!target?.email) return json({ error: "Email do aluno não encontrado." }, 404);

      const { error } = await sbAdmin.auth.admin.generateLink({
        type: "recovery",
        email: target.email,
      });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, action: "send_password_reset" });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);

  } catch (e: any) {
    console.error("[admin-user] Erro inesperado:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
