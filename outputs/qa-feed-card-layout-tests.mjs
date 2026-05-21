import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /\.fp-action-btns \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, "Feed actions must use a compact responsive grid.");
assert.match(html, /\.fp-action-label \{[^}]*text-overflow: ellipsis/s, "Feed action labels must truncate instead of breaking the card.");
assert.match(html, /const viewsLabel = viewCount === 1 \? "1 visualização" : `\$\{viewCount\} visualizações`;/, "View count label must be assembled as a stable full word.");
assert.match(html, /const commentsLabel = commentCount === 1 \? "1 comentário" : `\$\{commentCount\} comentários`;/, "Comment count label must be assembled as a stable full word.");
assert.match(html, /<details class="fp-more">/, "Secondary feed actions must live in the overflow menu.");
assert.match(html, /class="fp-menu-item danger" onclick="onDeletePost/, "Delete must be a secondary destructive action.");
assert.doesNotMatch(html, /fp-delete-btn/, "Delete should not remain as a primary card action.");
assert.match(html, /<div class="fp-meta-line">/, "Feed post metrics must use the compact meta line class.");
assert.doesNotMatch(html, /const codes = \["ALL","A","B","C","D","FLEX"\]/, "Feed must not render workout-type filter chips because trainer variations can grow without bound.");
assert.doesNotMatch(html, /onclick="setFeedFilter\('\$\{c\}'\)"/, "Feed workout filter buttons should stay removed from the UI.");
assert.match(html, /STATE\.feedFilter = "ALL";\s*const feed = STATE\.feed \|\| \[\];/, "Feed should always render all followed posts after removing workout filters.");
assert.match(html, /Conclua um treino ou siga mais pessoas para ver novidades aqui\./, "Feed empty state should no longer mention a removed filter.");

console.log("qa-feed-card-layout-tests: ok");
