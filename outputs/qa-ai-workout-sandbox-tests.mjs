import { readFileSync, existsSync } from "node:fs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

const server = read("sandbox/ai-workout-builder/server.mjs");
const html = read("sandbox/ai-workout-builder/public/index.html");
const app = read("sandbox/ai-workout-builder/public/app.js");
const css = read("sandbox/ai-workout-builder/public/styles.css");
const pkg = read("sandbox/ai-workout-builder/package.json");

assert.ok(existsSync(new URL("sandbox/ai-workout-builder/README.md", root)), "README do sandbox deve existir");
assert.match(pkg, /"dev": "node server\.mjs"/, "sandbox deve rodar com node server.mjs");

assert.match(server, /const HOST = process\.env\.HOST \|\| "127\.0\.0\.1"/, "servidor deve ficar local por padrão");
assert.match(server, /OPENAI_API_KEY/, "servidor deve aceitar OPENAI_API_KEY via ambiente");
assert.match(server, /generateFallbackPlan/, "sandbox deve funcionar sem chave real");
assert.match(server, /\/api\/generate-workout/, "endpoint de geração deve existir");
assert.doesNotMatch(server, /sk-proj-|sk-[A-Za-z0-9_-]{20,}/, "não pode haver chave OpenAI hardcoded");

assert.match(html, /id="prompt"/, "UI deve ter prompt principal");
assert.match(html, /id="generate"/, "UI deve ter ação de geração");
assert.match(app, /fetch\("\/api\/generate-workout"/, "frontend deve chamar endpoint local");
assert.match(app, /Copiar JSON/, "sandbox deve permitir copiar JSON gerado");
assert.match(app, /data-workout-field="name"/, "rascunho deve permitir editar nome do treino");
assert.match(app, /data-exercise-field="name"/, "rascunho deve permitir editar exercícios");
assert.match(app, /data-move-exercise/, "rascunho deve permitir reordenar exercícios");
assert.match(app, /draft-exercise-card/, "rascunho standalone deve renderizar exercícios como cards");
assert.match(css, /\.draft-exercise-card/, "CSS standalone deve ter card visual para exercício gerado");
assert.match(css, /\.draft-stat-grid/, "Cards standalone devem separar séries/reps/descanso em blocos");

assert.match(css, /@media \(max-width: 620px\)/, "sandbox deve ter responsividade mobile");
assert.match(css, /min-height: 44px/, "botões devem preservar área de toque mínima");

const sandboxDir = fileURLToPath(new URL("sandbox/ai-workout-builder/", root));
const integrationPort = 4188;
const child = spawn(process.execPath, ["server.mjs"], {
  cwd: sandboxDir,
  env: { ...process.env, PORT: String(integrationPort), OPENAI_API_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"]
});

let childLog = "";
child.stdout.on("data", (chunk) => {
  childLog += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  childLog += chunk.toString();
});

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${integrationPort}/`);
      if (response.ok) return;
    } catch {
      await delay(100);
    }
  }
  throw new Error(`Servidor do sandbox não subiu para teste. Log: ${childLog}`);
}

try {
  await waitForServer();
  const response = await fetch(`http://127.0.0.1:${integrationPort}/api/generate-workout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "monte um treino D focado em posterior, precisa ter flexora unilateral, stiff, Terra e elevação pelvica, precisa ser 4 series de 8 a 12 com 90 segundos de intervalo",
      studentProfile: {
        goal: "Hipertrofia",
        level: "Iniciante",
        frequency: "1x",
        limitations: "Sem limitações informadas"
      }
    })
  });
  assert.equal(response.status, 200, "geração deve responder 200");
  const payload = await response.json();
  const plan = payload.plan;
  const draft = payload.workoutDraft;
  const exercises = plan.blocks[0].exercises;
  const names = exercises.map((exercise) => exercise.name);

  assert.equal(plan.code, "D", "fallback deve respeitar código explícito do treino");
  assert.equal(plan.goal, "Hipertrofia", "flexora não pode ser interpretada como mobilidade");
  assert.equal(plan.periodization_type, "Hipertrofia", "tipo do período deve seguir o objetivo correto");
  assert.deepEqual(names, ["Flexora unilateral", "Stiff", "Levantamento terra", "Elevação pélvica"], "fallback deve preservar exercícios pedidos no prompt");
  assert.ok(exercises.every((exercise) => exercise.sets === 4), "todas as séries devem respeitar o prompt");
  assert.ok(exercises.every((exercise) => exercise.reps === "8-12"), "todas as repetições devem respeitar o prompt");
  assert.ok(exercises.every((exercise) => exercise.rest_seconds === 90), "todo descanso deve respeitar o prompt");
  assert.equal(draft.workout.name, plan.name, "API deve devolver rascunho editável com nome do treino");
  assert.equal(draft.workout.code, "D", "rascunho deve manter código do treino");
  assert.deepEqual(draft.exercises.map((exercise) => exercise.name), names, "rascunho deve manter exercícios na ordem gerada");
  assert.deepEqual(draft.exercises.map((exercise) => exercise.order), [1, 2, 3, 4], "rascunho deve numerar ordem de execução");
} finally {
  child.kill();
}

console.log("AI workout sandbox QA passed.");
