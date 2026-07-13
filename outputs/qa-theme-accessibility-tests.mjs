import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

function includes(needle, message) {
  assert.ok(html.includes(needle), message || `Missing ${needle}`);
}

includes("color-scheme: dark", "dark theme must expose its native color scheme");
includes("color-scheme: light", "light theme must expose its native color scheme");
includes("--toast-error-text: #8f1d1d", "light-mode error feedback must keep readable contrast");
includes("--toast-success-text: #075f37", "light-mode success feedback must keep readable contrast");
includes("document.documentElement.style.colorScheme = STATE.theme", "theme toggle must update native controls too");
includes("themeButton.setAttribute('aria-pressed'", "theme toggle must announce its state");
includes("aria-pressed=\"${STATE.theme === 'dark'}\"", "profile dark option must expose selection state");
includes("aria-pressed=\"${STATE.theme === 'light'}\"", "profile light option must expose selection state");
includes("role=\"group\" aria-label=\"Tema padrão para novos usuários\"", "branding theme picker needs a group label");
includes("@media (prefers-reduced-motion: reduce)", "motion-sensitive users must be respected");
includes("id=\"app-skeleton\" role=\"status\"", "loading skeleton must be announced");
includes("type=\"button\" class=\"ex-thumb\" aria-label=\"Ampliar", "exercise media zoom must be keyboard reachable");
includes("type=\"button\" class=\"day-pill", "calendar day cards must be semantic buttons");
includes("aria-label=\"Abrir agenda de ${WEEKDAY_FULL", "agenda cards must describe their destination");
includes("aria-label=\"Editar ${WEEKDAY_FULL", "periodization cards must describe their action");

console.log("Theme and accessibility static QA checks passed");
