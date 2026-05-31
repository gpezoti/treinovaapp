import fs from "node:fs";
import assert from "node:assert/strict";

const root = process.cwd();
const read = (path) => fs.readFileSync(`${root}/${path}`, "utf8");

const index = read("index.html");
const migration = read("supabase/migrations/20260531143000_platform_trial_subscriptions.sql");
const signupFn = read("supabase/functions/platform-signup/index.ts");
const checkoutFn = read("supabase/functions/platform-create-checkout/index.ts");
const webhookFn = read("supabase/functions/asaas-webhook/index.ts");
const adminFn = read("supabase/functions/admin-user/index.ts");
const appLanding = read("app/index.html");
const landing = read("outputs/landing.html");
const site = read("outputs/treinova-site/index.html");

function includesAll(source, checks, label) {
  for (const check of checks) {
    assert.ok(source.includes(check), `${label}: missing ${check}`);
  }
}

includesAll(index, [
  'id="signup-panel"',
  'id="signup-name"',
  'id="signup-cpf"',
  'id="signup-phone"',
  'id="signup-email"',
  'id="signup-password"',
  'submitCoachTrialSignup',
  'sb.functions.invoke("platform-signup"',
  'getPlatformSubscriptionAccess',
  'renderPlatformLockedScreen',
  'startPlatformUpgradeCheckout',
  'sb.functions.invoke("platform-create-checkout"',
  'platformTrialBannerHTML',
  'R$ 59,90',
  'selectTrainerSubscriptionMode',
  'id="et-trial-start"',
  'id="nt-trial-start"',
  'subscription_mode',
  'trial_start_date',
], "index.html");

assert.ok(index.includes('hasCoachSignupIntent()'), "index.html: signup query param handler missing");
assert.ok(index.includes('subscription_status: "checkout_pending"') || index.includes('checkout_pending'), "index.html: checkout pending status missing");
assert.ok(!index.includes("Login-only: sem signup público"), "index.html: stale login-only comment still present");

includesAll(migration, [
  "create table if not exists public.coach_subscriptions",
  "subscription_status",
  "trial_started_at",
  "trial_ends_at",
  "find_profile_duplicate_signup",
  "profiles_email_lower_unique_if_clean",
  "profiles_cpf_digits_unique_if_clean",
  "profiles_phone_digits_unique_if_clean",
  "profiles_subscription_status_check",
], "migration");

includesAll(signupFn, [
  "platform-signup",
  "find_profile_duplicate_signup",
  "isValidCpf",
  "trial_ends_at",
  "subscription_status: \"trialing\"",
  "coach_subscriptions",
  "deleteUser(createdUserId)",
], "platform-signup");

includesAll(checkoutFn, [
  "platform-create-checkout",
  "ASAAS_API_KEY",
  'asaasFetch("/checkouts"',
  'billingTypes: ["CREDIT_CARD"]',
  'chargeTypes: ["RECURRENT"]',
  "customerData",
  "subscription",
  "coach_subscriptions",
  "checkout_url",
  "59.90",
], "platform-create-checkout");

includesAll(webhookFn, [
  "CHECKOUT_PAID",
  "CHECKOUT_CANCELED",
  "CHECKOUT_EXPIRED",
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_UPDATED",
  "coach_subscriptions",
  "subscription_status",
  "platform:",
], "asaas-webhook");

includesAll(adminFn, [
  "trialDatesFromStartDate",
  "syncCoachSubscription",
  "activate_trial",
  "subscription_mode",
  "trial_start_date",
  "coach_subscriptions",
  "subscription_status: \"trialing\"",
], "admin-user");

assert.equal(appLanding, site, "app/index.html must stay synced with current landing");

for (const [name, html] of [["outputs/landing.html", landing], ["outputs/treinova-site/index.html", site]]) {
  assert.ok(html.includes("https://treinovaapp.com/?signup=coach"), `${name}: public signup CTA missing`);
  assert.ok(html.includes("59,90"), `${name}: updated price missing`);
  assert.ok(html.includes("14 dias"), `${name}: 14-day trial missing`);
  assert.ok(!html.includes("Quero assinar%20o%20Treinova%20Pro%20por%20R%24%2049"), `${name}: stale WhatsApp pricing CTA`);
  assert.ok(!html.includes(">49,90<"), `${name}: stale price amount`);
  assert.ok(html.includes("WhatsApp Vendas"), `${name}: support/sales WhatsApp should remain`);
}

console.log("OK: platform trial/signup/checkout static coverage passed");
