// supabase/functions/asaas-webhook/index.ts
// Recebe os webhooks do Asaas (PAYMENT_CONFIRMED, PAYMENT_RECEIVED, etc.)
// e atualiza payments.status no Supabase.
// Configure no Asaas em "Integrações > Webhooks" apontando para
//   https://<project-ref>.supabase.co/functions/v1/asaas-webhook
// Secret OBRIGATÓRIO: ASAAS_WEBHOOK_TOKEN (definir nas variáveis da Edge Function)
// SEGURANÇA: sem token configurado a função rejeita TODOS os requests (fail-closed).

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// C-01 FIX: token é OBRIGATÓRIO. Sem ele, a função recusa todos os POSTs.
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN");

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    // C-01 FIX: fail-closed — se token não estiver configurado, rejeita
    if (!ASAAS_WEBHOOK_TOKEN) {
      console.error("[asaas-webhook] ASAAS_WEBHOOK_TOKEN não configurado — rejeitar request");
      return new Response("misconfigured: webhook token required", { status: 500 });
    }
    const got = req.headers.get("asaas-access-token") || req.headers.get("x-asaas-token") || "";
    if (got !== ASAAS_WEBHOOK_TOKEN) {
      console.warn("[asaas-webhook] token inválido no header");
      return new Response("forbidden", { status: 403 });
    }

    const body = await req.json();
    const event = body.event as string;
    const payment = body.payment;

    if (!payment) return new Response("no payment", { status: 200 });

    // Resolve nosso payment.id via externalReference (preferido) ou asaas_id
    let our: any = null;
    if (payment.externalReference) {
      const { data } = await sb.from("payments").select("*").eq("id", payment.externalReference).maybeSingle();
      our = data;
    }
    if (!our) {
      const { data } = await sb.from("payments").select("*").eq("asaas_id", payment.id).maybeSingle();
      our = data;
    }
    if (!our) return new Response("payment not mapped", { status: 200 });

    const update: any = { asaas_id: payment.id };

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      update.status = "paid";
      update.paid_at = new Date().toISOString();
      update.method = payment.billingType === "PIX" ? "pix" : payment.billingType === "BOLETO" ? "boleto" : (payment.billingType||"asaas").toLowerCase();
    } else if (event === "PAYMENT_OVERDUE") {
      update.status = "overdue";
    } else if (event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
      update.status = "cancelled";
    }

    await sb.from("payments").update(update).eq("id", our.id);

    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("err: " + e.message, { status: 500 });
  }
});
