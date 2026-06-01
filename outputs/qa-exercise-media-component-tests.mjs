import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");

function has(needle, message) {
  assert.ok(html.includes(needle), message || `Missing ${needle}`);
}

has("function renderExerciseMedia(ex = {}, options = {})", "ExerciseMedia renderer must exist");
has("function getExerciseMediaMeta(ex)", "ExerciseMedia must centralize image/video metadata");
has("function renderExerciseMediaVideoContent", "ExerciseMedia must centralize video embed/preview rendering");
has("window.openExerciseMediaViewer = function", "ExerciseMedia must centralize fullscreen viewer");
has("exercise-media-viewer__switch", "Fullscreen viewer must switch between image and video when both exist");
has("has-media-error", "ExerciseMedia must expose a standardized media error state");
has("data-fallback-src", "ExerciseMedia images must have fallback source");
has("youtube.com/embed", "ExerciseMedia video path must support YouTube embeds");

assert.match(
  html,
  /function getExThumb\(ex\) \{\s*return renderExerciseMedia\(ex, \{ mode: "thumb"/,
  "Legacy getExThumb must delegate to ExerciseMedia"
);
assert.match(
  html,
  /function renderExerciseVideoPreview\(url, name = "Vídeo do exercício"\) \{\s*return renderExerciseMedia/,
  "Legacy video preview must delegate to ExerciseMedia"
);
assert.match(
  html,
  /function renderExerciseVideoEmbed\(url, name = "Vídeo do exercício"\) \{[\s\S]*return renderExerciseMedia/,
  "Legacy video embed must delegate to ExerciseMedia"
);
assert.match(
  html,
  /const heroMedia = renderExerciseMedia\(ex, \{ mode: "hero", interactive: true/,
  "Workout execution expanded image must use ExerciseMedia hero mode"
);
assert.match(
  html,
  /return renderExerciseMedia\(ex, \{ mode: "preview", interactive: false/,
  "Exercise editor draft image preview must use ExerciseMedia"
);

console.log("ExerciseMedia component QA checks passed");
