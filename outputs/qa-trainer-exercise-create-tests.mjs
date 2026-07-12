import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const migration = fs.readFileSync(
  new URL("../supabase/migrations/20260710231924_secure_trainer_exercise_library.sql", import.meta.url),
  "utf8"
);

const checks = [
  ["bloqueia envio duplicado", /STATE\._savingLibraryExercise = true/],
  ["normaliza duplicidade", /findDuplicateLibraryExercise\(name/],
  ["atribui proprietário ao exercício do treinador", /owner_coach_id:\s*currentEx\?\.owner_coach_id \|\| exerciseLibraryOwnerId\(\)/],
  ["usa pasta de mídia do usuário", /exerciseMediaPathPrefix\(savedId\)/],
  ["não transforma falha de mídia em falha total", /\[saveLibraryExercise\] media upload/],
  ["invalida cache após salvar dentro do treino", /await loadExerciseLibrary\(true\)/],
  ["migration adiciona proprietário", /add column if not exists owner_coach_id uuid/],
  ["migration remove leitura ampla antiga", /drop policy if exists "exercises auth read"/],
  ["trainer edita somente biblioteca própria", /exercises coach update own library/],
  ["storage restringe pasta ao usuário", /storage\.foldername\(name\)\)\[1\] = \(select auth\.uid\(\)\)::text/]
];

for (const [label, pattern] of checks) {
  const source = label.startsWith("migration") || label.startsWith("trainer") || label.startsWith("storage")
    ? migration
    : html;
  assert.match(source, pattern, label);
  console.log(`OK: ${label}`);
}

console.log("OK: fluxo de inclusão de exercícios protegido");
