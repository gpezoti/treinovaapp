// supabase/functions/platform-signup/index.ts
// Cadastro publico de treinador com trial de 14 dias.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
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

function cleanText(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function passwordMeetsPolicy(value: unknown) {
  const password = String(value || "");
  return password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password);
}

function isValidCpf(cpf: string) {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (base: string, factor: number) => {
    let total = 0;
    for (const digit of base) total += Number(digit) * factor--;
    const mod = total % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = calc(cpf.slice(0, 9), 10);
  const d2 = calc(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

function addDaysIso(days: number) {
  const date = new Date(Date.now() + days * 86400000);
  return date.toISOString();
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  let createdUserId: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const fullName = cleanText(body.full_name || body.fullName || body.name);
    const email = cleanEmail(body.email);
    const cpf = onlyDigits(body.cpf || body.cpf_cnpj);
    const phone = onlyDigits(body.phone);
    const password = String(body.password || "");

    if (fullName.length < 3) {
      return json({ error: "Informe seu nome completo." }, 400);
    }
    if (!email.includes("@") || email.length > 160) {
      return json({ error: "Informe um email válido." }, 400);
    }
    if (!isValidCpf(cpf)) {
      return json({ error: "Informe um CPF válido com 11 dígitos." }, 400);
    }
    if (phone.length < 10 || phone.length > 11) {
      return json({ error: "Informe um telefone válido com DDD." }, 400);
    }
    if (!passwordMeetsPolicy(password)) {
      return json({ error: "A senha precisa ter 8+ caracteres, maiúscula, minúscula e número." }, 400);
    }

    const { data: duplicates, error: duplicateErr } = await sbAdmin.rpc("find_profile_duplicate_signup", {
      p_email: email,
      p_cpf: cpf,
      p_phone: phone,
    });
    if (duplicateErr) throw duplicateErr;
    if (duplicates?.length) {
      const field = duplicates[0].field;
      const labels: Record<string, string> = { email: "email", cpf: "CPF", phone: "telefone" };
      return json({ error: `Já existe cadastro com este ${labels[field] || "dado"}.` }, 409);
    }

    const existingAuthUser = await findAuthUserByEmail(email);
    if (existingAuthUser?.id) {
      return json({ error: "Este email já possui login cadastrado." }, 409);
    }

    const now = new Date().toISOString();
    const trialEndsAt = addDaysIso(14);
    const { data: created, error: createErr } = await sbAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "coach", source: "public_trial" },
    });
    if (createErr || !created?.user?.id) {
      throw new Error(createErr?.message || "Não foi possível criar o login.");
    }
    createdUserId = created.user.id;

    const profilePayload = {
      id: createdUserId,
      email,
      full_name: fullName,
      cpf_cnpj: cpf,
      phone,
      role: "coach",
      status: "approved",
      coach_id: null,
      trial_started_at: now,
      trial_ends_at: trialEndsAt,
      subscription_status: "trialing",
      subscription_plan: "coach_monthly",
      subscription_price: 59.90,
      subscription_locked_at: null,
      subscription_updated_at: now,
      onboarded: false,
    };

    const { error: profileErr } = await sbAdmin
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" });
    if (profileErr) throw profileErr;

    const { error: subErr } = await sbAdmin
      .from("coach_subscriptions")
      .upsert({
        coach_id: createdUserId,
        status: "trialing",
        plan_code: "coach_monthly",
        amount: 59.90,
        trial_started_at: now,
        trial_ends_at: trialEndsAt,
        current_period_ends_at: trialEndsAt,
      }, { onConflict: "coach_id" });
    if (subErr) throw subErr;

    return json({
      ok: true,
      user_id: createdUserId,
      email,
      trial_ends_at: trialEndsAt,
      trial_days: 14,
    });
  } catch (e: any) {
    console.error("[platform-signup]", e);
    if (createdUserId) {
      await sbAdmin.auth.admin.deleteUser(createdUserId).catch(() => {});
    }
    return json({ error: e?.message || "Não foi possível concluir o cadastro." }, 500);
  }
});
