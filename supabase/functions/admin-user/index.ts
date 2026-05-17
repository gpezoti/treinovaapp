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

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function assertAdmin(caller: { role: string }) {
  if (caller.role !== "admin") {
    return json({ error: "Apenas admin pode executar esta ação." }, 403);
  }
  return null;
}

async function findAuthUserByEmail(email: string) {
  const target = cleanEmail(email);
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sbAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((user) => cleanEmail(user.email) === target);
    if (match) return match;
    if (users.length < perPage) break;
  }
  return null;
}

async function createAuthUserOrReuseProfile(params: {
  email: string;
  password: string;
  fullName: string;
  role: "student" | "coach";
}) {
  const { email, password, fullName, role } = params;
  const { data: existingProfile } = await sbAdmin
    .from("profiles")
    .select("id,email,role,coach_id")
    .ilike("email", email)
    .maybeSingle();

  if (existingProfile?.id) {
    await sbAdmin.auth.admin.updateUserById(existingProfile.id, {
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });
    return { userId: existingProfile.id, reused: true };
  }

  const { data: created, error: createErr } = await sbAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });
  if (!createErr && created?.user?.id) {
    return { userId: created.user.id, reused: false };
  }

  const message = createErr?.message || "Falha ao criar usuário.";
  if (/already|registered|exists|duplicate/i.test(message)) {
    const orphanAuthUser = await findAuthUserByEmail(email);
    if (orphanAuthUser?.id) {
      const { error: updateErr } = await sbAdmin.auth.admin.updateUserById(orphanAuthUser.id, {
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role },
      });
      if (updateErr) throw new Error(updateErr.message);
      return { userId: orphanAuthUser.id, reused: true };
    }
    throw new Error("Este email já existe no Auth, mas não foi possível localizar o usuário para reaproveitar.");
  }
  throw new Error(message);
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

  if (!action) {
    return json({ error: "action é obrigatório." }, 400);
  }

  // 3. Se for coach, verificar que user_id é aluno do coach
  if (caller.role === "coach" && user_id) {
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
    if (action === "create_student") {
      if (!["coach", "admin"].includes(caller.role)) {
        return json({ error: "Apenas coaches e admins podem criar alunos." }, 403);
      }
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const fullName = String(body.full_name || "").trim();
      const phone = String(body.phone || "").trim();
      const coachId = caller.role === "coach" ? caller.id : (body.coach_id || null);

      if (!fullName || !email.includes("@") || password.length < 8) {
        return json({ error: "Nome, email válido e senha 8+ são obrigatórios." }, 400);
      }
      if (caller.role === "admin" && coachId) {
        const { data: coach } = await sbAdmin
          .from("profiles")
          .select("id, role, status")
          .eq("id", coachId)
          .single();
        if (!coach || coach.role !== "coach" || coach.status !== "approved") {
          return json({ error: "Professor inválido para vincular aluno." }, 400);
        }
      }

      const created = await createAuthUserOrReuseProfile({ email, password, fullName, role: "student" });

      const { error: profileErr } = await sbAdmin
        .from("profiles")
        .upsert({
          id: created.userId,
          email,
          full_name: fullName,
          phone: phone || null,
          role: "student",
          status: "approved",
          coach_id: coachId,
          must_reset_password: true,
        }, { onConflict: "id" });
      if (profileErr) return json({ error: profileErr.message }, 500);

      return json({ ok: true, action: "create_student", user_id: created.userId, reused: created.reused });
    }

    if (action === "create_trainer") {
      if (caller.role !== "admin") {
        return json({ error: "Apenas admin pode criar treinadores." }, 403);
      }
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const fullName = String(body.full_name || "").trim();
      const asaasWalletId = cleanText(body.asaas_wallet_id);
      if (!fullName || !email.includes("@") || password.length < 8) {
        return json({ error: "Nome, email válido e senha 8+ são obrigatórios." }, 400);
      }

      const created = await createAuthUserOrReuseProfile({ email, password, fullName, role: "coach" });

      const { error: profileErr } = await sbAdmin
        .from("profiles")
        .upsert({
          id: created.userId,
          email,
          full_name: fullName,
          role: "coach",
          status: "approved",
          coach_id: null,
          asaas_wallet_id: asaasWalletId || null,
          must_reset_password: true,
        }, { onConflict: "id" });
      if (profileErr) return json({ error: profileErr.message }, 500);

      return json({ ok: true, action: "create_trainer", user_id: created.userId, reused: created.reused });
    }

    if (!user_id) {
      return json({ error: "user_id é obrigatório para esta ação." }, 400);
    }

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

    if (action === "update_trainer") {
      const denied = assertAdmin(caller);
      if (denied) return denied;

      const { data: target } = await sbAdmin
        .from("profiles")
        .select("id,email,role,status")
        .eq("id", user_id)
        .single();

      if (!target) return json({ error: "Treinador não encontrado." }, 404);
      if (target.role === "admin") return json({ error: "Admin Master não pode ser alterado por esta ação." }, 403);

      const fullName = cleanText(body.full_name);
      const email = cleanEmail(body.email);
      const phone = cleanText(body.phone);
      const avatarEmoji = cleanText(body.avatar_emoji);
      const asaasWalletId = cleanText(body.asaas_wallet_id);
      const status = cleanText(body.status || target.status);
      const role = cleanText(body.role || target.role);
      const password = String(body.password || "");

      if (!fullName || !email.includes("@")) {
        return json({ error: "Nome e email válido são obrigatórios." }, 400);
      }
      if (!["approved", "blocked", "pending"].includes(status)) {
        return json({ error: "Status inválido." }, 400);
      }
      if (!["coach", "student"].includes(role)) {
        return json({ error: "Papel inválido." }, 400);
      }
      if (password && password.length < 8) {
        return json({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, 400);
      }

      const authPatch: Record<string, unknown> = {
        email,
        email_confirm: true,
        user_metadata: { full_name: fullName, role },
      };
      if (password) authPatch.password = password;

      const { error: authUpdateErr } = await sbAdmin.auth.admin.updateUserById(user_id, authPatch);
      if (authUpdateErr) return json({ error: authUpdateErr.message }, 500);

      const profilePatch: Record<string, unknown> = {
        email,
        full_name: fullName,
        phone: phone || null,
        avatar_emoji: avatarEmoji || "🎯",
        status,
        role,
        coach_id: role === "coach" ? null : body.coach_id || null,
        asaas_wallet_id: role === "coach" ? (asaasWalletId || null) : null,
      };
      if (password) profilePatch.must_reset_password = false;

      const { error: profileErr } = await sbAdmin
        .from("profiles")
        .update(profilePatch)
        .eq("id", user_id);

      if (profileErr) return json({ error: profileErr.message }, 500);
      return json({ ok: true, action: "update_trainer" });
    }

    if (action === "remove_trainer") {
      const denied = assertAdmin(caller);
      if (denied) return denied;

      const { data: target } = await sbAdmin
        .from("profiles")
        .select("id,email,role")
        .eq("id", user_id)
        .single();

      if (!target) return json({ error: "Treinador não encontrado." }, 404);
      if (target.role === "admin") return json({ error: "Admin Master não pode ser removido." }, 403);

      const { error: detachErr } = await sbAdmin
        .from("profiles")
        .update({ coach_id: null })
        .eq("coach_id", user_id)
        .eq("role", "student");
      if (detachErr) return json({ error: detachErr.message }, 500);

      const { error: profileErr } = await sbAdmin
        .from("profiles")
        .update({
          role: "student",
          status: "blocked",
          coach_id: null,
          asaas_wallet_id: null,
          must_reset_password: true,
        })
        .eq("id", user_id);
      if (profileErr) return json({ error: profileErr.message }, 500);

      await sbAdmin.auth.admin.updateUserById(user_id, {
        ban_duration: "876000h",
        user_metadata: { role: "student", removed_trainer: true },
      });

      return json({ ok: true, action: "remove_trainer" });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);

  } catch (e: any) {
    console.error("[admin-user] Erro inesperado:", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
