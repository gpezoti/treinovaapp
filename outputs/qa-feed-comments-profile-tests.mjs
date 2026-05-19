import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync("index.html", "utf8");

assert.match(html, /async function hydrateCommentAuthors\(comments = \[\]\)/, "Comments must explicitly hydrate author profiles.");
assert.match(html, /\.from\("profiles"\)\s*\.select\("id, full_name, email, avatar_emoji, avatar_url"\)\s*\.in\("id", ids\)/, "Comment author hydration must query profiles by user_id.");
assert.match(html, /function getCommentAuthorFallback\(userId\)/, "Comments must fallback to the logged-in profile for newly inserted comments.");
assert.match(html, /function renderCommentItems\(comments = \[\], postId\)/, "Comment rendering must be centralized.");
assert.match(html, /const authorName = a\.full_name \|\| \(a\.email \? a\.email\.split\("@"\)\[0\] : ""\) \|\| "Usuário"/, "Comment names must use full_name or email before generic fallback.");
assert.match(html, /\.select\("id, post_id, user_id, content, created_at"\)/, "Comment loading should not depend on implicit profile joins.");
assert.doesNotMatch(html, /author:profiles\(id, full_name, avatar_emoji, avatar_url\)/, "Comment loading must not rely on the old implicit author join.");

console.log("qa-feed-comments-profile-tests: ok");
