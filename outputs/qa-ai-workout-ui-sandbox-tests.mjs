import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.match(html, /openAIWorkoutSandbox/, "UI principal deve expor o fluxo IA sandbox");
assert.match(html, /Treinova IA/, "Tela de Treinos deve ter entrada final da IA");
assert.match(html, /AI_WORKOUT_FUNCTION_NAME/, "Fluxo principal deve apontar para a Edge Function publicada");
assert.match(html, /sb\.functions\.invoke\(AI_WORKOUT_FUNCTION_NAME/, "Fluxo principal deve chamar a IA via Supabase Edge Function");
assert.match(html, /buildLocalAIWorkoutDraft/, "Fluxo deve ter fallback local sem depender de servidor externo");
assert.match(html, /renderAIWorkoutDraftHTML/, "Fluxo deve renderizar rascunho editável");
assert.match(html, /moveAIWorkoutDraftExercise/, "Fluxo deve permitir reordenar exercícios");
assert.match(html, /saveAIWorkoutDraftToLibrary/, "Fluxo deve salvar o rascunho gerado na biblioteca");
assert.match(html, /ai-manual-workout-card/, "Rascunho IA deve usar visão de card semelhante ao editor manual");
assert.match(html, /ai-manual-exercise-card/, "Exercícios gerados pela IA devem renderizar como cards revisáveis");
assert.match(html, /getExThumb\(mediaEx\)/, "Cards da IA devem usar miniatura/fallback visual do exercício");
assert.match(html, /ai-prompt-textarea/, "Modal da IA deve priorizar apenas a caixa de texto do briefing");
assert.match(html, /Salvar na biblioteca/, "Depois de gerar, treinador deve ter ação para salvar na biblioteca");
assert.doesNotMatch(html, /IA beta|sandbox local|Protótipo do fluxo final|Simular salvar|Copiar payload|Neste sandbox nada é salvo no Supabase/, "UI final da IA não deve exibir rótulos de beta/sandbox");

const aiSection = html.slice(
  html.indexOf("IA — GERAR RASCUNHO DE TREINO"),
  html.indexOf("RENDER — COACH: ADMIN WORKOUTS")
);

assert.match(aiSection, /AI_WORKOUT_LOCAL_FALLBACK_ENDPOINT/, "Fluxo pode manter fallback local apenas para ambiente de desenvolvimento");
assert.match(aiSection, /canUseLocalAIWorkoutFallbackEndpoint/, "Uso do servidor local deve ficar restrito a localhost");
assert.match(aiSection, /\.from\(["']workouts["']\)[\s\S]*?\.insert/, "Salvar IA deve inserir workout na biblioteca");
assert.match(aiSection, /\.from\(["']exercises["']\)\.insert/, "Salvar IA deve inserir exercícios do treino");
assert.match(aiSection, /\.is\(["']student_id["'], null\)/, "Salvar IA deve criar modelo de treino sem aluno específico");
assert.match(aiSection, /openWorkoutEditor\(code, createdWorkout\.id\)/, "Após salvar, deve abrir o editor manual do treino");
assert.match(aiSection, /buildAIWorkoutExerciseRows/, "Salvar IA deve converter rascunho em linhas de exercício");
assert.match(aiSection, /sets_override/, "Salvar IA deve preservar séries sugeridas como override revisável");
assert.match(aiSection, /reps_override/, "Salvar IA deve preservar repetições sugeridas como override revisável");
assert.doesNotMatch(aiSection, /fetch\(AI_WORKOUT_LOCAL_FALLBACK_ENDPOINT[\s\S]*?try[\s\S]*?sb\.functions\.invoke/s, "Fluxo não deve priorizar o servidor local antes da função publicada");

console.log("AI workout UI sandbox QA passed.");
