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

function paymentMethod(billingType?: string) {
  if (billingType === "PIX") return "pix";
  if (billingType === "BOLETO") return "boleto";
  return (billingType || "asaas").toLowerCase();
}

function addDaysIso(dateValue: unknown, days: number) {
  const raw = String(dateValue || "").slice(0, 10);
  const base = raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00Z`) : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString();
}

async function updatePlatformSubscription(params: {
  event: string;
  checkout?: any;
  subscription?: any;
  payment?: any;
}) {
  const { event, checkout, subscription, payment } = params;
  const checkoutId = checkout?.id || null;
  const subscriptionId = subscription?.id || payment?.subscription || null;
  const externalReference =
    checkout?.externalReference ||
    subscription?.externalReference ||
    payment?.externalReference ||
    null;

  let row: any = null;

  if (checkoutId) {
    const { data } = await sb
      .from("coach_subscriptions")
      .select("*")
      .eq("asaas_checkout_id", checkoutId)
      .maybeSingle();
    row = data;
  }

  if (!row && subscriptionId) {
    const { data } = await sb
      .from("coach_subscriptions")
      .select("*")
      .eq("asaas_subscription_id", subscriptionId)
      .maybeSingle();
    row = data;
  }

  if (!row && externalReference?.startsWith("platform:")) {
    const coachId = externalReference.split(":")[1];
    if (coachId) {
      const { data } = await sb
        .from("coach_subscriptions")
        .select("*")
        .eq("coach_id", coachId)
        .maybeSingle();
      row = data;
    }
  }

  if (!row) return false;

  const update: any = {
    last_webhook_event: event,
    last_webhook_at: new Date().toISOString(),
  };
  const profileUpdate: any = {
    subscription_updated_at: new Date().toISOString(),
  };

  if (checkoutId) {
    update.asaas_checkout_id = checkoutId;
    update.asaas_checkout_url = checkout?.link || row.asaas_checkout_url || null;
    profileUpdate.asaas_checkout_id = checkoutId;
    profileUpdate.asaas_checkout_url = checkout?.link || row.asaas_checkout_url || null;
  }

  if (subscriptionId) {
    update.asaas_subscription_id = subscriptionId;
    profileUpdate.asaas_subscription_id = subscriptionId;
  }

  if (event === "CHECKOUT_PAID" || event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED" || event === "PAYMENT_RECEIVED_IN_CASH") {
    update.status = "active";
    update.current_period_ends_at = subscription?.nextDueDate
      ? addDaysIso(subscription.nextDueDate, 0)
      : addDaysIso(payment?.dueDate || checkout?.subscription?.nextDueDate, 31);
    profileUpdate.subscription_status = "active";
    profileUpdate.subscription_locked_at = null;
    profileUpdate.subscription_current_period_ends_at = update.current_period_ends_at;
  } else if (event === "SUBSCRIPTION_CREATED" || event === "SUBSCRIPTION_UPDATED") {
    update.status = subscription?.status === "ACTIVE" ? "active" : "checkout_pending";
    update.current_period_ends_at = subscription?.nextDueDate ? addDaysIso(subscription.nextDueDate, 0) : row.current_period_ends_at;
    profileUpdate.subscription_status = update.status;
    profileUpdate.subscription_current_period_ends_at = update.current_period_ends_at || null;
    if (update.status === "active") profileUpdate.subscription_locked_at = null;
  } else if (event === "PAYMENT_OVERDUE") {
    update.status = "past_due";
    profileUpdate.subscription_status = "past_due";
    profileUpdate.subscription_locked_at = profileUpdate.subscription_locked_at || new Date().toISOString();
  } else if (event === "CHECKOUT_CANCELED" || event === "CHECKOUT_EXPIRED") {
    update.status = row.status === "active" ? row.status : "expired";
    profileUpdate.subscription_status = row.status === "active" ? "active" : "expired";
    if (row.status !== "active") profileUpdate.subscription_locked_at = new Date().toISOString();
  } else if (event === "SUBSCRIPTION_INACTIVATED" || event === "SUBSCRIPTION_DELETED" || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
    update.status = "canceled";
    profileUpdate.subscription_status = "canceled";
    profileUpdate.subscription_locked_at = new Date().toISOString();
  }

  await sb.from("coach_subscriptions").update(update).eq("id", row.id);
  await sb.from("profiles").update(profileUpdate).eq("id", row.coach_id);
  return true;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response("invalid json", { status: 400 });
    }
    const event = body.event as string;
    const payment = body.payment;
    const checkout = body.checkout;
    const subscription = body.subscription;

    if (checkout || subscription) {
      const handled = await updatePlatformSubscription({ event, checkout, subscription, payment });
      if (handled && !payment) return new Response("ok", { status: 200 });
    }

    if (!payment) return new Response("no payment", { status: 200 });

    if (payment.externalReference?.startsWith("platform:") || payment.subscription) {
      const handled = await updatePlatformSubscription({ event, payment });
      if (handled) return new Response("ok", { status: 200 });
    }

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

    const update: any = {
      asaas_id: payment.id,
      invoice_url: payment.invoiceUrl || our.invoice_url || null,
      boleto_url: payment.bankSlipUrl || our.boleto_url || null,
      external_reference: payment.externalReference || our.external_reference || our.id,
    };

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED" || event === "PAYMENT_RECEIVED_IN_CASH") {
      update.status = "paid";
      update.paid_at = payment.paymentDate ? new Date(`${payment.paymentDate}T12:00:00Z`).toISOString() : new Date().toISOString();
      update.method = paymentMethod(payment.billingType);
    } else if (event === "PAYMENT_CREATED" || event === "PAYMENT_UPDATED" || event === "PAYMENT_PENDING" || event === "PAYMENT_RESTORED") {
      if (our.status !== "paid") update.status = "pending";
      update.method = paymentMethod(payment.billingType);
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
