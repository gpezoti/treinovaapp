import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /AUTH_FALLBACK_LOGO_URL\s*=\s*"\/assets\/icon-192\.png\?v=20260825-login"/);
assert.match(html, /id="auth-logo"[\s\S]*?<img src="\/assets\/icon-192\.png\?v=20260825-login"/);
assert.match(html, /function renderAuthLogo\(/);
assert.match(html, /renderAuthLogo\(\{[\s\S]*logoUrl: data\.logo_url/);
assert.match(html, /AUTH_LOGIN_TIMEOUT_MS\s*=\s*12000/);
assert.match(html, /withTimeout\([\s\S]*?sb\.auth\.signInWithPassword\(\{ email, password \}\)[\s\S]*?AUTH_LOGIN_TIMEOUT_MS[\s\S]*?"login timeout"/);
assert.match(html, /Você está sem conexão\. Conecte-se à internet para entrar\./);
assert.match(html, /Não foi possível conectar agora\. Verifique sua internet e tente novamente\./);

console.log("Auth login resilience QA passed.");
