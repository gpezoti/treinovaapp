import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sql = readFileSync(new URL("../sql/beta_security_audit_2026_05_05.sql", import.meta.url), "utf8");

const checks = [
  ["chat opens with limited profile fields", /select\("id, full_name, avatar_emoji, avatar_url, role, coach_id"\)/.test(html)],
  ["chat relationship guard exists", /function canOpenChatWith\(other\)/.test(html)],
  ["chat blocks unauthorized open", /Você não tem permissão para conversar/.test(html)],
  ["chat blocks unauthorized send", /Você não tem permissão para enviar mensagem/.test(html)],
  ["private message image resolver exists", /async function resolveMessageImageUrl\(raw\)/.test(html)],
  ["message uploads store storage path", /content: "\[imagem\]", image_url: path/.test(html)],
  ["profile self update freezes role", /role = \(select p\.role/.test(sql)],
  ["signup trigger forces student pending", /'student',\s*'pending'/s.test(sql)],
  ["messages insert checks relationship", /public\.can_message_user\(from_user, to_user\)/.test(sql)],
  ["messages bucket private", /update storage\.buckets set public = false where id in \('messages', 'progress'\)/.test(sql)],
  ["progress storage is scoped", /create policy "progress_photos read scoped"/.test(sql)],
  ["views set security invoker", /v_chat_threads set \(security_invoker = true\)/.test(sql)]
];

for (const [label, ok] of checks) {
  assert.equal(ok, true, label);
}

console.log(`OK: ${checks.length} security audit checks passed`);
