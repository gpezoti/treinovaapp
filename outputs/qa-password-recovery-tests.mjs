import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");
const edge = fs.readFileSync("supabase/functions/admin-user/index.ts", "utf8");

assert.match(html, /const APP_PASSWORD_RECOVERY_URL = APP_SITE_URL \+ "\?auth=recovery"/, "Forgot-password emails must redirect to explicit recovery mode.");
assert.match(html, /resetPasswordForEmail\(email, \{ redirectTo \}\)/, "Client reset flow must pass redirectTo.");
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
