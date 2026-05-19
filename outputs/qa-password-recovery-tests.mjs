import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const edge = fs.readFileSync("supabase/functions/admin-user/index.ts", "utf8");
const submitForgotPasswordBlock = html.match(/async function submitForgotPassword\(\) \{[\s\S]*?\n\}/)?.[0] || "";

assert.match(html, /const APP_PASSWORD_RECOVERY_URL = APP_SITE_URL \+ "\?auth=recovery"/, "Forgot-password emails must redirect to explicit recovery mode.");
assert.match(html, /resetPasswordForEmail\(email, \{ redirectTo \}\)/, "Client reset flow must pass redirectTo.");
assert.match(html, /id="forgot-error"/, "Forgot-password flow must render an inline error area.");
assert.match(html, /function getForgotPasswordFriendlyError\(error\)/, "Forgot-password errors must be mapped to friendly messages.");
assert.match(html, /Limite temporário de envio atingido/, "Rate limit errors must not be shown as raw Supabase text.");
assert.match(html, /FORGOT_PASSWORD_RATE_LIMIT_COOLDOWN_MS = 5 \* 60 \* 1000/, "Rate-limited reset requests must apply a local cooldown.");
assert.doesNotMatch(submitForgotPasswordBlock, /showToast\("Erro: " \+ error\.message/, "Forgot-password flow must not display raw Supabase errors.");
assert.match(html, /function isPasswordRecoveryRedirect\(\)/, "App must detect recovery redirects directly from URL.");
assert.match(html, /auth === "recovery"/, "Recovery URL detection must support auth=recovery.");
assert.match(html, /type === "recovery"/, "Recovery URL detection must support Supabase type=recovery.");
assert.match(html, /exchangeCodeForSession\(code\)/, "PKCE recovery redirects must exchange code for a session.");
assert.match(html, /STATE\._passwordRecoveryMode = isPasswordRecoveryRedirect\(\)/, "Boot must enter recovery mode before auth events race.");
assert.match(html, /if \(STATE\._passwordRecoveryMode\) \{[\s\S]*?showPasswordRecoveryModal\(\);[\s\S]*?return;/, "SIGNED_IN during recovery must not route to the normal home.");
assert.match(html, /await handlePasswordRecoveryRedirect\(\)/, "Boot must handle recovery redirects before normal postSignIn.");
assert.match(html, /clearPasswordRecoveryUrl\(\)/, "Successful password reset must clean one-time tokens from the URL.");
assert.match(html, /Entre novamente com a nova senha/, "User must be guided back to login after setting a new password.");

assert.match(edge, /APP_SITE_URL/, "Admin reset links must have a production app URL fallback.");
assert.match(edge, /redirectTo: `\$\{APP_SITE_URL\}\?auth=recovery`/, "Admin generated recovery links must target explicit recovery mode.");

console.log("qa-password-recovery-tests: ok");
