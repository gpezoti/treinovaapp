import fs from "node:fs";
import assert from "node:assert/strict";

const edge = fs.readFileSync("outputs/edge-functions/admin-user/index.ts", "utf8");
const html = fs.readFileSync("index.html", "utf8");

assert.match(edge, /action === "create_student"/);
assert.match(edge, /action === "create_trainer"/);
assert.match(edge, /sbAdmin\.auth\.admin\.createUser/);
assert.match(edge, /coachId = caller\.role === "coach" \? caller\.id/);
assert.match(edge, /must_reset_password: true/);
assert.match(edge, /Apenas admin pode criar treinadores/);
assert.match(edge, /user_id é obrigatório para esta ação/);

assert.match(html, /sb\.functions\.invoke\("admin-user"/);
assert.match(html, /action: "create_student"/);
assert.match(html, /action: "create_trainer"/);
assert.doesNotMatch(html, /tmp\.auth\.signUp/);
assert.doesNotMatch(html, /Perfil não foi criado a tempo/);
assert.doesNotMatch(html, /Profile não foi criado pelo trigger/);

console.log("QA admin-user creation checks passed.");
