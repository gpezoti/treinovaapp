import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

function includes(needle, message) {
  assert.ok(html.includes(needle), message || `Missing ${needle}`);
}

includes("overflow-x: hidden", "app/page must prevent horizontal overflow");
includes("@media (max-width: 560px)", "mobile polish breakpoint must cover the 520px app shell");
includes(".list-row { display: flex", "list cards must use shared list-row pattern");
includes("width: 100%; max-width: 100%; min-width: 0; overflow: hidden", "list-row must contain overflowing card content");
includes(".list-row .lr-info { flex: 1 1 0; min-width: 0", "list text column must shrink safely");
includes(".list-row .lr-actions { width: 100%; margin-top: 8px; justify-content: flex-start; }", "card actions must wrap below on mobile");
includes(".list-row .lr-sub { white-space: normal; display: -webkit-box", "secondary text must wrap safely on mobile");
includes(".segmented-scroll", "tab/segment rows must scroll horizontally without breaking layout");
includes("class=\"segmented-scroll\"", "student filters must use the shared segmented scroll row");
includes(".finance-summary-grid { grid-template-columns:1fr; }", "student finance summary must collapse to one column on mobile");
includes(".finance-item-head { flex-wrap: wrap; }", "finance card header must wrap on mobile");
includes(".sheet-action-grid { grid-template-columns:1fr; }", "student detail actions must become one column on mobile");
includes(".exercise-card { background: var(--bg-card)", "exercise cards must keep shared card styling");
includes("min-width: 0; max-width: 100%;", "cards must define safe responsive bounds");
includes(".empty .empty-actions .btn-primary", "empty-state actions must wrap instead of overflowing");

console.log("Layout polish static QA checks passed");
