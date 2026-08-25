import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /AUTH_FALLBACK_LOGO_URL\s*=\s*"\/assets\/icon-192\.png\?v=20260825-login"/);
assert.match(html, /id="auth-logo"[\s\S]*?<img src="\/assets\/icon-192\.png\?v=20260825-login"/);
assert.match(html, /function renderAuthLogo\(/);
assert.match(html, /renderAuthLogo\(\{[\s\S]*logoUrl: data\.logo_url/);
assert.match(html, /AUTH_LOGIN_TIMEOUT_MS\s*=\s*35000/);
assert.match(html, /withTimeout\([\s\S]*?sb\.auth\.signInWithPassword\(\{ email, password \}\)[\s\S]*?AUTH_LOGIN_TIMEOUT_MS[\s\S]*?"login timeout"/);
assert.match(html, /function isTransientAuthFailure\(error\)/);
assert.match(html, /async function signInWithTransientRetry\(email, password\)/);
assert.match(html, /O serviço está indisponível no momento\. Tente novamente em instantes\./);
assert.match(html, /if \(!transient\) _loginAttempts\+\+;/);
assert.match(html, /Você está sem conexão\. Conecte-se à internet para entrar\./);

console.log("Auth login resilience QA passed.");
