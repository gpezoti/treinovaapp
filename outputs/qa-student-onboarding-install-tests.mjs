import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /function isIOSDevice\(\)/);
assert.match(html, /function isStandalonePWA\(\)/);
assert.match(html, /function getIOSBrowserInstallCopy\(\)/);
assert.match(html, /\/CriOS\/i\.test\(ua\)/);
assert.match(html, /Instalar no iPhone pelo Chrome/);
assert.match(html, /Toque no ícone compartilhar do Chrome/);
assert.match(html, /Se a opção não aparecer, abra este app no Safari/);
assert.match(html, /function showIOSInstallHintIfNeeded\(opts = \{\}\)/);
assert.match(html, /const force = opts\.force === true;/);
assert.match(html, /const copy = getIOSBrowserInstallCopy\(\);/);
assert.match(html, /id="ios-install-panel"/);
assert.match(html, /role="dialog" aria-modal="true"/);
assert.match(html, /z-index:10080/);
assert.match(html, /Siga estes passos no navegador para deixar o Treinova na tela inicial\./);
assert.match(html, /Adicionar à Tela de Início/);
assert.doesNotMatch(html, /⬆️/);
assert.match(html, /async function requestPWAInstall\(opts = \{\}\)/);
assert.match(html, /showIOSInstallHintIfNeeded\(\{ force: true \}\);/);
assert.match(html, /await requestPWAInstall\(\{ source: "install-banner" \}\);/);
assert.match(html, /const installInitialState = isStandalonePWA\(\) \? "✓ Instalado" : \(isIOSDevice\(\) \? "Ver guia" : "Tocar"\);/);
assert.match(html, /const result = await requestPWAInstall\(\{ source: "student-onboarding" \}\);/);
assert.match(html, /st\.textContent = "Siga o guia";/);
assert.match(html, /Siga os passos para adicionar o app à tela inicial\./);
assert.match(html, /function showCoachOnboarding\(\)/);
assert.match(html, /id="coach-onb-install-app"/);
assert.match(html, /id="coach-onb-install-state"/);
assert.match(html, /const result = await requestPWAInstall\(\{ source: "coach-onboarding" \}\);/);
assert.match(html, /Math\.min\(4, idx\)/);
assert.match(html, /<div class="onb-step" data-step="4">/);

console.log("qa-student-onboarding-install-tests ok");
