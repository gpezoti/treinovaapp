// supabase/functions/asaas-auto-charge/index.ts
// Gera cobranças Asaas automaticamente para payments pendentes/atrasados.
//
// Secrets necessários:
//   - ASAAS_API_KEY
//   - ASAAS_BASE_URL (produção: https://api.asaas.com/v3)
//   - ASAAS_AUTO_CHARGE_SECRET
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL = (Deno.env.get("ASAAS_BASE_URL") || "https://api.asaas.com/v3").replace(/\/+$/, "");
const ASAAS_AUTO_CHARGE_SECRET = Deno.env.get("ASAAS_AUTO_CHARGE_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-charge-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysIso(baseIso: string, days: number) {
  const d = new Date(`${baseIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function resolveAsaasDueDate(paymentDueDate: unknown) {
  const original = String(paymentDueDate || "");
  const today = todayIso();
  return original && original < today ? today : original;
}

function normalizeCpfCnpj(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

function paymentMethodForDb(billingType: string) {
  if (billingType === "PIX") return "pix";
  if (billingType === "BOLETO") return "boleto";
  if (billingType === "UNDEFINED") return "asaas";
  return String(billingType || "asaas").toLowerCase();
}

function normalizeBillingType(value: unknown) {
  const billingType = String(value || "UNDEFINED").trim().toUpperCase();
  if (!["UNDEFINED", "PIX", "BOLETO"].includes(billingType)) {
    throw new Error("billing_type inválido. Use UNDEFINED, PIX ou BOLETO.");
  }
  return billingType;
}

function resolveStudentTrainerSplit(payment: any, payer: any, receiver: any) {
  const isStudentTrainerCharge = payer?.role === "student"
    && receiver?.role === "coach"
    && payment?.receiver_id === receiver?.id;

  if (!isStudentTrainerCharge) return null;

  const walletId = String(receiver?.asaas_wallet_id || "").trim();
  if (!walletId) {
    return {
      missingTrainerWallet: true,
      trainerId: receiver?.id || null,
      walletId: null,
      percentualValue: null,
    };
  }

  return {
    missingTrainerWallet: false,
    trainerId: receiver?.id || null,
    walletId,
    percentualValue: 100,
  };
}

async function asaasFetch(path: string, init: RequestInit = {}) {
  if (!ASAAS_API_KEY) throw new Error("ASAAS_API_KEY não configurada.");
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "access_token": ASAAS_API_KEY,
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

async function syncCustomerCpfCnpj(customerId: string, profile: any) {
  const cpfCnpj = normalizeCpfCnpj(profile?.cpf_cnpj);
  if (!cpfCnpj) return;
  await asaasFetch(`/customers/${encodeURIComponent(customerId)}`, {
    method: "PUT",
    body: JSON.stringify({
      name: profile.full_name || profile.email || "Cliente",
      email: profile.email || undefined,
      phone: profile.phone || undefined,
      mobilePhone: profile.phone || undefined,
      cpfCnpj,
      externalReference: profile.id,
    }),
  });
}

async function ensureCustomer(profile: any): Promise<string> {
  if (profile.asaas_customer_id) {
    await syncCustomerCpfCnpj(profile.asaas_customer_id, profile);
    return profile.asaas_customer_id;
  }

  if (profile.email) {
    const search = await asaasFetch(`/customers?email=${encodeURIComponent(profile.email)}`);
    if (search.data?.length) {
      const id = search.data[0].id;
      await sb.from("profiles").update({ asaas_customer_id: id }).eq("id", profile.id);
      await syncCustomerCpfCnpj(id, profile);
      return id;
    }
  }

  const cust = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: profile.full_name || profile.email || "Cliente",
      email: profile.email || undefined,
      phone: profile.phone || undefined,
      mobilePhone: profile.phone || undefined,
      cpfCnpj: normalizeCpfCnpj(profile.cpf_cnpj),
      externalReference: profile.id,
    }),
  });
  await sb.from("profiles").update({ asaas_customer_id: cust.id }).eq("id", profile.id);
  return cust.id;
}

async function notifyOnce(userId: string | null | undefined, kind: string, title: string, body: string, relatedId: string, relatedKind = "payment") {
  if (!userId) return;
  const { data: existing } = await sb
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("related_id", relatedId)
    .limit(1);
  if (existing && existing.length > 0) return;

  await sb.from("notifications").insert({
    user_id: userId,
    kind,
    title,
    body,
    related_id: relatedId,
    related_kind: relatedKind,
  });
}

function money(value: unknown) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dateBr(iso: string) {
  return String(iso || "").split("-").reverse().join("/");
}

async function processPayment(payment: any, billingType: string, dryRun: boolean) {
  if (payment.asaas_id) {
    return { id: payment.id, status: "skipped", reason: "already_has_asaas_id" };
  }

  const payerId = payment.user_id || payment.payer_id;
  if (!payerId) {
    return { id: payment.id, status: "skipped", reason: "missing_payer" };
  }

  const { data: payer, error: payerErr } = await sb
    .from("profiles")
    .select("*")
    .eq("id", payerId)
    .maybeSingle();
  if (payerErr || !payer) {
    return { id: payment.id, status: "skipped", reason: "payer_not_found" };
  }

  const { data: receiver, error: receiverErr } = payment.receiver_id
    ? await sb
      .from("profiles")
      .select("*")
      .eq("id", payment.receiver_id)
      .maybeSingle()
    : { data: null, error: null };
  if (receiverErr) {
    return { id: payment.id, status: "skipped", reason: "receiver_not_found" };
  }

  const cpfCnpj = normalizeCpfCnpj(payer.cpf_cnpj);
  if (![11, 14].includes(cpfCnpj.length)) {
    if (!dryRun) {
      await notifyOnce(
        payment.receiver_id || payment.created_by,
        "asaas_missing_tax_id",
        "CPF/CNPJ pendente",
        `Informe CPF/CNPJ de ${payer.full_name || payer.email || "cliente"} para gerar a cobrança Asaas.`,
        payment.id,
      );
    }
    return { id: payment.id, status: "skipped", reason: "missing_tax_id", payer_id: payer.id };
  }

  if (dryRun) {
    return { id: payment.id, status: "dry_run", payer_id: payer.id };
  }

  const split = resolveStudentTrainerSplit(payment, payer, receiver);
  if (split?.missingTrainerWallet) {
    await notifyOnce(
      receiver?.id || payment.receiver_id || payment.created_by,
      "asaas_missing_trainer_wallet",
      "Carteira Asaas pendente",
      "Configure sua carteira Asaas para receber cobranças dos seus alunos diretamente.",
      payment.id,
    );
    return { id: payment.id, status: "skipped", reason: "missing_trainer_wallet", trainer_id: split.trainerId };
  }

  const customerId = await ensureCustomer(payer);
  const asaasDueDate = resolveAsaasDueDate(payment.due_date);
  const chargeBody: any = {
    customer: customerId,
    billingType,
    value: Number(payment.amount),
    dueDate: asaasDueDate,
    description: payment.reference || "Mensalidade Treinova",
    externalReference: payment.id,
  };
  if (split?.walletId) {
    chargeBody.split = [{
      walletId: split.walletId,
      percentualValue: split.percentualValue,
    }];
  }
  const charge = await asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify(chargeBody),
  });

  const updatePayload: any = {
    asaas_id: charge.id,
    invoice_url: charge.invoiceUrl || null,
    boleto_url: charge.bankSlipUrl || null,
    method: paymentMethodForDb(charge.billingType || billingType),
    external_reference: payment.id,
    asaas_split_wallet_id: split?.walletId || null,
    asaas_split_percentual_value: split?.percentualValue || null,
  };

  if ((charge.billingType || billingType) === "PIX") {
    const pix = await asaasFetch(`/payments/${encodeURIComponent(charge.id)}/pixQrCode`);
    updatePayload.pix_qr = pix.encodedImage || null;
    updatePayload.pix_copy_paste = pix.payload || null;
  }

  await sb.from("payments").update(updatePayload).eq("id", payment.id);
  await notifyOnce(
    payer.id,
    "payment_charge_created",
    "Cobrança disponível",
    `Sua cobrança de ${money(payment.amount)} referente ao vencimento de ${dateBr(payment.due_date)} está disponível no Asaas.`,
    payment.id,
  );

  return {
    id: payment.id,
    status: "created",
    asaas_id: charge.id,
    original_due_date: payment.due_date,
    asaas_due_date: asaasDueDate,
    invoice_url: charge.invoiceUrl || null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    if (!ASAAS_AUTO_CHARGE_SECRET) {
      return json({ error: "ASAAS_AUTO_CHARGE_SECRET não configurado." }, 500);
    }
    const got = req.headers.get("x-auto-charge-secret") || "";
    if (got !== ASAAS_AUTO_CHARGE_SECRET) {
      return json({ error: "forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const daysAhead = Math.max(0, Math.min(60, Number(body.days_ahead ?? 7) || 0));
    const limit = Math.max(1, Math.min(100, Number(body.limit ?? 50) || 50));
    const dryRun = Boolean(body.dry_run);
    const billingType = normalizeBillingType(body.billing_type || "UNDEFINED");
    const targetDueDate = addDaysIso(todayIso(), daysAhead);

    let query = sb
      .from("payments")
      .select("*")
      .in("status", ["pending", "overdue"])
      .is("asaas_id", null)
      .lte("due_date", targetDueDate)
      .order("due_date", { ascending: true })
      .limit(limit);

    if (body.payment_id) {
      query = sb
        .from("payments")
        .select("*")
        .eq("id", body.payment_id)
        .limit(1);
    }

    const { data: payments, error } = await query;
    if (error) throw error;

    const results = [];
    for (const payment of payments || []) {
      try {
        const amount = Number(payment.amount);
        if (!Number.isFinite(amount) || amount <= 0 || !payment.due_date) {
          results.push({ id: payment.id, status: "skipped", reason: "invalid_payment" });
          continue;
        }
        if (payment.status === "paid" || payment.status === "cancelled") {
          results.push({ id: payment.id, status: "skipped", reason: "closed_payment" });
          continue;
        }
        results.push(await processPayment(payment, billingType, dryRun));
      } catch (e: any) {
        results.push({ id: payment.id, status: "failed", error: e?.message || String(e) });
      }
    }

    return json({
      ok: true,
      dry_run: dryRun,
      billing_type: billingType,
      target_due_date: targetDueDate,
      processed: results.length,
      created: results.filter((r: any) => r.status === "created").length,
      skipped: results.filter((r: any) => r.status === "skipped").length,
      failed: results.filter((r: any) => r.status === "failed").length,
      results,
    });
  } catch (e: any) {
    console.error("[asaas-auto-charge]", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
