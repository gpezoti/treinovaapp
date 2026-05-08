import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /window\.VAPID_PUBLIC_KEY="BKzeRbIyNBtAvl6x7bS8DmDBSojGWaC4HPzz-uQaxadrjvon4DCP1US6I0azjsxTVFZ4UMQkA3szqTzbCdwaEeE"/);
assert.match(html, /function subscriptionUsesCurrentVapidKey\(sub\)/);
assert.match(html, /sub && \(!previousVapidKey \|\| previousVapidKey !== VAPID_PUBLIC_KEY \|\| !subscriptionUsesCurrentVapidKey\(sub\)\)/);
assert.match(html, /\.delete\(\)\s*\.eq\("user_id", userId\)\s*\.neq\("endpoint", json\.endpoint\)/);

assert.match(html, /function canShareFeedWorkout\(p\)/);
assert.match(html, /window\.shareFeedWorkout = async function\(postId\)/);
assert.match(html, /onclick="shareFeedWorkout\('\$\{p\.id\}'\)"/);
assert.match(html, /TREINO DO FEED/);
assert.match(html, /const W = 1080, H = 1350;/);
assert.match(html, /function showPushDiagnosticsModal\(detail\)/);

console.log("qa-push-share-regression ok");
