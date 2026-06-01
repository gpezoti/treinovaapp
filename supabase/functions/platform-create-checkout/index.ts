// supabase/functions/platform-create-checkout/index.ts
// Gera checkout recorrente Asaas para assinatura mensal do treinador.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL = (Deno.env.get("ASAAS_BASE_URL") || "https://api.asaas.com/v3").replace(/\/+$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const APP_SITE_URL = (Deno.env.get("APP_SITE_URL") || "https://treinovaapp.com/").replace(/\/?$/, "/");

const PLAN_AMOUNT = 59.90;
const PLAN_CODE = "coach_monthly";
const ITEM_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

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

function onlyDigits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function asaasFetch(path: string, init: RequestInit = {}) {
  if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada.");
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      access_token: ASAAS_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }
  if (!res.ok) {
    const detail = data?.errors?.[0]?.description || data?.message || raw || res.statusText;
    const err = new Error(`Asaas HTTP ${res.status}: ${detail}`) as Error & { status?: number; payload?: unknown };
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

function normalizeAsaasCheckoutUrl(checkout: any) {
  if (checkout?.link) return checkout.link;
  if (checkout?.id) return `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(checkout.id)}`;
  return null;
}

function asaasErrorResponse(e: any) {
  const message = e?.message || String(e);
  return json({
    error: message,
    code: "ASAAS_PLATFORM_CHECKOUT_FAILED",
  }, e?.status && e.status >= 400 && e.status < 500 ? e.status : 500);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !user?.id) return json({ error: "Sessão inválida." }, 401);

    const { data: profile, error: profileErr } = await sbAdmin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profileErr || !profile) return json({ error: "Perfil não encontrado." }, 404);
    if (profile.role !== "coach") return json({ error: "Assinatura disponível apenas para treinadores." }, 403);

    const cpfCnpj = onlyDigits(profile.cpf_cnpj);
    const phone = onlyDigits(profile.phone);
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
      return json({ error: "Informe CPF/CNPJ válido no perfil antes de assinar." }, 400);
    }
    if (phone.length < 10) {
      return json({ error: "Informe telefone válido no perfil antes de assinar." }, 400);
    }

    const incomingAddress = body?.billing_address || body?.billingAddress || {};
    const postalCode = onlyDigits(incomingAddress.postalCode || incomingAddress.postal_code || incomingAddress.cep);
    const address = cleanText(incomingAddress.address || incomingAddress.street || incomingAddress.logradouro);
    const addressNumber = cleanText(incomingAddress.addressNumber || incomingAddress.address_number || incomingAddress.number || incomingAddress.numero);
    const province = cleanText(incomingAddress.province || incomingAddress.neighborhood || incomingAddress.bairro);
    const complement = cleanText(incomingAddress.complement || incomingAddress.complemento);

    if (postalCode.length !== 8) {
      return json({ error: "Informe CEP válido antes de assinar." }, 400);
    }
    if (!address) {
      return json({ error: "Informe o endereço antes de assinar." }, 400);
    }
    if (!addressNumber) {
      return json({ error: "Informe o número do endereço antes de assinar." }, 400);
    }
    if (!province) {
      return json({ error: "Informe o bairro antes de assinar." }, 400);
    }

    const { data: sub } = await sbAdmin
      .from("coach_subscriptions")
      .select("*")
      .eq("coach_id", profile.id)
      .maybeSingle();

    if (sub?.status === "active" && sub.current_period_ends_at && new Date(sub.current_period_ends_at).getTime() > Date.now()) {
      return json({ ok: true, already_active: true, current_period_ends_at: sub.current_period_ends_at });
    }

    const externalReference = `platform:${profile.id}:${Date.now()}`;
    const successUrl = `${APP_SITE_URL}?billing=success`;
    const cancelUrl = `${APP_SITE_URL}?billing=cancel`;
    const expiredUrl = `${APP_SITE_URL}?billing=expired`;

    const checkout = await asaasFetch("/checkouts", {
      method: "POST",
      body: JSON.stringify({
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        minutesToExpire: 1440,
        externalReference,
        callback: {
          cancelUrl,
          expiredUrl,
          successUrl,
        },
        items: [{
          externalReference: PLAN_CODE,
          name: "Treinova Pro",
          description: "Assinatura mensal da plataforma Treinova",
          quantity: 1,
          value: PLAN_AMOUNT,
          imageBase64: ITEM_IMAGE_BASE64,
        }],
        customerData: {
          name: profile.full_name || profile.email || "Treinador",
          cpfCnpj,
          email: profile.email,
          phone,
          mobilePhone: phone,
          postalCode,
          address,
          addressNumber,
          province,
          ...(complement ? { complement } : {}),
        },
        subscription: {
          cycle: "MONTHLY",
          nextDueDate: todayIso(),
        },
      }),
    });

    const checkoutUrl = normalizeAsaasCheckoutUrl(checkout);
    if (!checkout?.id || !checkoutUrl) {
      throw new Error("Asaas não retornou link de checkout.");
    }

    const subPayload = {
      coach_id: profile.id,
      status: "checkout_pending",
      plan_code: PLAN_CODE,
      amount: PLAN_AMOUNT,
      trial_started_at: profile.trial_started_at || sub?.trial_started_at || null,
      trial_ends_at: profile.trial_ends_at || sub?.trial_ends_at || null,
      current_period_ends_at: sub?.current_period_ends_at || profile.subscription_current_period_ends_at || null,
      asaas_customer_id: checkout.customer || profile.asaas_customer_id || sub?.asaas_customer_id || null,
      asaas_checkout_id: checkout.id,
      asaas_checkout_url: checkoutUrl,
      asaas_external_reference: externalReference,
      last_webhook_event: "CHECKOUT_CREATED_LOCAL",
      last_webhook_at: new Date().toISOString(),
    };

    const { error: subErr } = await sbAdmin
      .from("coach_subscriptions")
      .upsert(subPayload, { onConflict: "coach_id" });
    if (subErr) throw subErr;

    const { error: profileUpdateErr } = await sbAdmin
      .from("profiles")
      .update({
        subscription_status: "checkout_pending",
        subscription_plan: PLAN_CODE,
        subscription_price: PLAN_AMOUNT,
        asaas_checkout_id: checkout.id,
        asaas_checkout_url: checkoutUrl,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    if (profileUpdateErr) throw profileUpdateErr;

    return json({
      ok: true,
      checkout_id: checkout.id,
      checkout_url: checkoutUrl,
      amount: PLAN_AMOUNT,
      status: "checkout_pending",
    });
  } catch (e: any) {
    console.error("[platform-create-checkout]", e);
    return asaasErrorResponse(e);
  }
});
