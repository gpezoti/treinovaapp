// supabase/functions/asaas-create-charge/index.ts
// Cria uma cobrança no Asaas a partir de um payment_id.
// Secrets necessários:
//   - ASAAS_API_KEY (key do produtor: sandbox ou prod)
//   - ASAAS_BASE_URL (https://sandbox.asaas.com/api/v3 ou https://api.asaas.com/v3)
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//   - SUPABASE_ANON_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY         = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL        = Deno.env.get("ASAAS_BASE_URL") || "https://sandbox.asaas.com/api/v3";
const SUPABASE_URL          = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

// Cliente admin — usado apenas para leituras/writes que exigem service role
const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

async function asaasFetch(path: string, init: RequestInit = {}) {
  if (!ASAAS_API_KEY) {
    throw new Error("ASAAS_API_KEY não configurada na Edge Function.");
  }
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "access_token": ASAAS_API_KEY,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.errors?.[0]?.description || JSON.stringify(data));
  return data;
}

async function ensureCustomer(profile: any): Promise<string> {
  if (profile.asaas_customer_id) return profile.asaas_customer_id;

  // Tenta buscar por email primeiro
  const search = await asaasFetch(`/customers?email=${encodeURIComponent(profile.email || "")}`);
  if (search.data?.length) {
    const id = search.data[0].id;
    await sbAdmin.from("profiles").update({ asaas_customer_id: id }).eq("id", profile.id);
    return id;
  }

  // Cria novo customer no Asaas
  const cust = await asaasFetch(`/customers`, {
    method: "POST",
    body: JSON.stringify({
      name:              profile.full_name || profile.email || "Cliente",
      email:             profile.email,
      phone:             profile.phone || undefined,
      mobilePhone:       profile.phone || undefined,
      cpfCnpj:           profile.cpf_cnpj || undefined,
      externalReference: profile.id,
    }),
  });
  await sbAdmin.from("profiles").update({ asaas_customer_id: cust.id }).eq("id", profile.id);
  return cust.id;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // =========================================================================
    // BUG-004 FIX: Autenticar o chamador e validar ownership do payment
    // =========================================================================

    // 1. Verificar JWT do usuário chamante
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);

    // Cria cliente com o JWT do usuário para validar identidade
    const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await sbUser.auth.getUser();
    if (authErr || !user) return json({ error: "Token inválido ou expirado" }, 401);

    // 2. Buscar perfil do chamador para checar role
    const { data: caller } = await sbAdmin
      .from("profiles")
      .select("id, role, status")
      .eq("id", user.id)
      .single();

    if (!caller || caller.status !== "approved") {
      return json({ error: "Conta não autorizada" }, 403);
    }
    const isStaff = caller.role === "coach" || caller.role === "admin";
    if (!isStaff) {
      return json({ error: "Apenas coaches e admins podem gerar cobranças" }, 403);
    }

    // 3. Ler payload
    const { payment_id, billing_type } = await req.json();
    if (!payment_id) return json({ error: "payment_id obrigatório" }, 400);

    // 4. Buscar payment + perfil do pagador.
    // Evita depender do nome da FK, que pode variar entre payer_id/user_id em ambientes diferentes.
    const { data: payment, error: pErr } = await sbAdmin
      .from("payments")
      .select("*")
      .eq("id", payment_id)
      .single();

    if (pErr || !payment) return json({ error: "Pagamento não encontrado" }, 404);
    const payerId = payment.user_id || payment.payer_id;
    if (!payerId) return json({ error: "Pagamento sem pagador vinculado." }, 400);

    const { data: payer, error: payerErr } = await sbAdmin
      .from("profiles")
      .select("*")
      .eq("id", payerId)
      .single();
    if (payerErr || !payer) return json({ error: "Pagador não encontrado." }, 404);
    payment.user = payer;

    // 5. Validar ownership: o chamador deve ser o receiver_id ou admin
    const isOwner  = payment.receiver_id === caller.id || payment.created_by === caller.id;
    const isAdmin  = caller.role === "admin";
    if (!isOwner && !isAdmin) {
      return json({ error: "Sem permissão para este pagamento" }, 403);
    }

    // =========================================================================
    // Fluxo normal: criar/buscar customer no Asaas e gerar cobrança
    // =========================================================================

    const customerId = await ensureCustomer(payment.user);

    const chargeBody: any = {
      customer:          customerId,
      billingType:       billing_type || "PIX",
      value:             Number(payment.amount),
      dueDate:           payment.due_date,
      description:       payment.reference || "Mensalidade Treinova",
      externalReference: payment.id,
    };

    const charge = await asaasFetch(`/payments`, {
      method: "POST",
      body: JSON.stringify(chargeBody),
    });

    const updatePayload: any = {
      asaas_id:           charge.id,
      invoice_url:        charge.invoiceUrl || null,
      external_reference: payment.id,
    };

    let pixQr = null, pixCopyPaste = null, boletoUrl = null;

    if ((billing_type || "PIX") === "PIX") {
      const pix   = await asaasFetch(`/payments/${charge.id}/pixQrCode`);
      pixQr        = pix.encodedImage;   // base64 do QR
      pixCopyPaste = pix.payload;        // copia e cola
      updatePayload.pix_qr         = pixQr;
      updatePayload.pix_copy_paste = pixCopyPaste;
    } else if ((billing_type || "").toUpperCase() === "BOLETO") {
      boletoUrl                  = charge.bankSlipUrl || null;
      updatePayload.boleto_url   = boletoUrl;
    }

    await sbAdmin.from("payments").update(updatePayload).eq("id", payment.id);

    return json({
      ok:              true,
      asaas_id:        charge.id,
      invoice_url:     charge.invoiceUrl,
      pix_qr:          pixQr,
      pix_copy_paste:  pixCopyPaste,
      boleto_url:      boletoUrl,
    });

  } catch (e: any) {
    console.error("[asaas-create-charge]", e);
    return json({ error: e.message || String(e) }, 500);
  }
});
