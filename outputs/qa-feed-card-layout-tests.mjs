import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /\.fp-action-btns \{ display: grid; grid-template-columns: repeat\(auto-fit, minmax\(70px, 1fr\)\)/, "Feed actions must use a compact responsive grid.");
assert.match(html, /\.fp-action-label \{[^}]*text-overflow: ellipsis/s, "Feed action labels must truncate instead of breaking the card.");
assert.match(html, /const viewsLabel = viewCount === 1 \? "1 visualização" : `\$\{viewCount\} visualizações`;/, "View count label must be assembled as a stable full word.");
assert.match(html, /const commentsLabel = commentCount === 1 \? "1 comentário" : `\$\{commentCount\} comentários`;/, "Comment count label must be assembled as a stable full word.");
assert.match(html, /class="fp-like fp-delete-btn"/, "Delete action must share the compact feed action layout.");
assert.match(html, /<div class="fp-meta-line">/, "Feed post metrics must use the compact meta line class.");

console.log("qa-feed-card-layout-tests: ok");
