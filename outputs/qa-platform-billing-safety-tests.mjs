import assert from "node:assert/strict";
import fs from "node:fs";

const root = process.cwd();
const read = (path) => fs.readFileSync(`${root}/${path}`, "utf8");

const app = read("index.html");
const checkout = read("supabase/functions/platform-create-checkout/index.ts");
const webhook = read("supabase/functions/asaas-webhook/index.ts");

for (const token of [
  "consumePlatformCheckoutReturn",
  "platformCheckoutReturnHTML",
  "refreshPlatformSubscriptionStatus",
  "platform-billing-details",
  "platform-billing-error",
]) {
  assert.ok(app.includes(token), `billing UI: missing ${token}`);
}

assert.ok(!app.includes('showToast(e.message || "Não foi possível abrir o checkout.", "error")'),
  "billing UI: checkout error should stay inside the locked screen instead of overlapping its CTA");
assert.ok(app.includes('STATE.platformCheckoutReturn === "success"'),
  "billing UI: a checkout success return must only offer status refresh, not a duplicate charge");

for (const token of [
  "CHECKOUT_TTL_MS",
  "hasReusableCheckout",
  "reused: true",
  "asaas_checkout_url",
]) {
  assert.ok(checkout.includes(token), `checkout function: missing ${token}`);
}

assert.ok(webhook.includes("O acesso so e liberado pelos eventos de pagamento confirmados."),
  "webhook: subscription creation must not grant access");
assert.ok(webhook.includes('const wasAlreadyActive = row.status === "active";'),
  "webhook: existing active subscription must be preserved when events arrive out of order");
assert.ok(webhook.includes('update.status = wasAlreadyActive ? "active" : "checkout_pending";'),
  "webhook: pending checkout must stay pending until payment confirmation");

console.log("qa-platform-billing-safety-tests: OK");
