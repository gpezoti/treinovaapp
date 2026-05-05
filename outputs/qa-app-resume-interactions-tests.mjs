import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

const checks = [
  ["resume touch repair flag exists", /_APP_RESUME_NEEDS_TOUCH_REPAIR/.test(html)],
  ["interaction watchdog exists", /function bindInteractionWatchdog\(\)/.test(html)],
  ["first pointerdown repairs before click handlers", /document\.addEventListener\("pointerdown", onAnyInteraction, true\)/.test(html)],
  ["first touchstart repairs before inline handlers", /document\.addEventListener\("touchstart", onAnyInteraction, true\)/.test(html)],
  ["pagehide marks app hidden", /window\.addEventListener\("pagehide", markAppHiddenForResume\)/.test(html)],
  ["blur marks app hidden", /window\.addEventListener\("blur", markAppHiddenForResume\)/.test(html)],
  ["pageshow pre-repairs interaction layer", /repairInteractionLayer\("pageshow:pre"\)/.test(html)],
  ["invisible serie modal removed on repair", /serieModal && \(!window\._sdmModal \|\| serieModal\.style\.opacity === "0"\)/.test(html)],
  ["fullscreen timer closes when app hides", /document\.visibilityState === "hidden"\) \{\s*closeFsTimer\(\);/.test(html)],
  ["timer lifecycle reconciliation exists", /function reconcileTimerAfterLifecycle\(reason = "resume"\)/.test(html)],
  ["expired timer is reconciled on resume", /reconcileTimerAfterLifecycle\(reason\);\s*repairInteractionLayer\(reason\)/.test(html)],
  ["expired timer clears persisted storage", /remaining <= 0[\s\S]*clearPersistedTimer\(\)/.test(html)],
  ["sheet pointer events restored on open", /sheet\.style\.pointerEvents = "";\s*sheet\.classList\.add\("active"\)/.test(html)],
  ["sheet pointer events disabled on close", /sheet\.style\.pointerEvents = "none"/.test(html)],
  ["pull-to-refresh resets on touchcancel", /document\.addEventListener\("touchcancel", \(\) => \{\s*pulling = false/.test(html)]
];

for (const [label, ok] of checks) {
  assert.equal(ok, true, label);
}

console.log(`OK: ${checks.length} app resume interaction checks passed`);
