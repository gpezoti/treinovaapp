import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));

assert.match(html, /STATE\.profile\?\.role !== "coach"[\s\S]*Apenas treinadores podem aprovar/);
assert.match(html, /const canManageStatus = STATE\.profile\?\.role === "coach"/);
assert.match(html, /const canManageStudents = STATE\.profile\.role === "coach"/);
assert.doesNotMatch(html, /Admin aprova/);

assert.match(html, /action: "create_trainer"/);
assert.match(html, /action: "create_student"/);
assert.doesNotMatch(html, /tmp\.auth\.signUp/);
assert.doesNotMatch(html, /Profile não foi criado pelo trigger/);
assert.match(html, /const allApproved = STATE\.trainers\.filter\(t => t\.status !== "blocked"\)/);
assert.doesNotMatch(html, /Pendentes \(\$\{pending\.length\}\).*trainerRow/s);

assert.match(html, /function removeUsersFromLocalLists\(ids\)/);
assert.match(html, /removeUsersFromLocalLists\(ids\);\s*renderStudents\(\);/);
assert.match(html, /removeUsersFromLocalLists\(id\);\s*renderStudents\(\);/);
assert.match(html, /removeUsersFromLocalLists\(ids\);\s*renderTrainers\(\);/);
assert.match(html, /removeUsersFromLocalLists\(id\);\s*if \(STATE\.view === "trainers"\) renderTrainers\(\);/);

[
  "/assets/favicon.ico?v=20260505",
  "/assets/apple-touch-icon.png?v=20260505",
  "/assets/favicon-32x32.png?v=20260505",
  "/assets/favicon-16x16.png?v=20260505"
].forEach((assetPath) => {
  assert.ok(html.includes(assetPath), `Missing favicon path ${assetPath}`);
});

[
  "assets/favicon.ico",
  "assets/apple-touch-icon.png",
  "assets/favicon-32x32.png",
  "assets/favicon-16x16.png",
  "assets/icon-192.png",
  "assets/icon-512.png"
].forEach((assetPath) => {
  assert.ok(fs.existsSync(path.join(root, assetPath)), `Missing asset ${assetPath}`);
});

assert.equal(manifest.start_url, "/");
assert.equal(manifest.scope, "/");
assert.ok(manifest.icons.every((icon) => icon.src.startsWith("/assets/")));

console.log("QA user management + favicon checks passed.");
