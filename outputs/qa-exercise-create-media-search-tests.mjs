import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");
const migration = readFileSync("supabase/migrations/20260601113000_exercise_library_media_permissions.sql", "utf8");

function bodyOf(name) {
  const line = html.split("\n").find(row => row.includes(`window.${name} = function`));
  assert.ok(line, `${name} not found`);
  return line;
}

assert.ok(html.includes("id=\"lib-ex-video-url\""), "Library exercise create/edit must accept a video URL");
assert.ok(html.includes("pickExerciseDraftImage('_libraryExerciseDraftMedia'"), "Library exercise create/edit must allow picking a photo before saving");
assert.ok(html.includes("pickExerciseDraftVideo('_libraryExerciseDraftMedia'"), "Library exercise create/edit must allow picking a video before saving");
assert.ok(html.includes("id=\"ne-video-url\""), "Direct new exercise flow must accept a video URL");
assert.ok(html.includes("pickExerciseDraftImage('_newExerciseDraftMedia'"), "Direct new exercise flow must allow picking a photo before saving");
assert.ok(html.includes("pickExerciseDraftVideo('_newExerciseDraftMedia'"), "Direct new exercise flow must allow picking a video before saving");
assert.match(html, /insert\(payload\)\.select\("id"\)\.single\(\)/, "Library insert must return id before uploading media");
assert.match(html, /uploadExerciseDraftMedia\(savedId,\s*"_libraryExerciseDraftMedia"/, "Library save must upload draft media after DB save");
assert.match(html, /insert\(\{\s*\.\.\.data,[\s\S]*?\}\)\.select\("id"\)\.single\(\)/, "Direct workout exercise insert must return id before uploading media");
assert.match(html, /uploadExerciseDraftMedia\(createdEx\?\.id,\s*"_newExerciseDraftMedia"/, "Direct new exercise must upload draft media after DB save");

assert.doesNotMatch(bodyOf("setTrainerSearch"), /renderTrainers\(\)/, "Trainer search must not recreate the input on every key");
assert.doesNotMatch(bodyOf("setStudentSearch"), /renderStudents\(\)/, "Student search must not recreate the input on every key");
assert.doesNotMatch(bodyOf("setExerciseLibraryQuery"), /renderAdminWorkouts\(\)/, "Exercise library search must not recreate the input on every key");
assert.ok(html.includes("renderTrainerResultsOnly()"), "Trainer search must update only results");
assert.ok(html.includes("renderStudentResultsOnly()"), "Student search must update only results");
assert.ok(html.includes("renderExerciseLibraryResultsOnly()"), "Exercise library search must update only results");

assert.ok(migration.includes('create policy "exercises library manage staff"'), "Migration must allow staff to manage library exercises");
assert.ok(migration.includes("public.is_coach(auth.uid())"), "Migration must include coach permission");
assert.ok(migration.includes("insert into storage.buckets (id, name, public)"), "Migration must ensure exercises storage bucket exists");
assert.ok(migration.includes('create policy "exercise media staff upload"'), "Migration must allow exercise media uploads");

console.log("QA exercise create media/search stability checks passed");
