import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const fn = readFileSync(new URL("../supabase/functions/ai-workout-draft/index.ts", import.meta.url), "utf8");

assert.match(fn, /serve\(async \(req\)/, "Edge Function deve expor handler HTTP");
assert.match(fn, /createClient\(SUPABASE_URL, SUPABASE_ANON_KEY/, "Função deve validar JWT do usuário");
assert.match(fn, /createClient\(SUPABASE_URL, SUPABASE_SERVICE_KEY/, "Função deve conseguir consultar perfil com service role");
assert.match(fn, /\["coach", "admin"\]\.includes/, "Função deve restringir acesso a coach/admin");
assert.match(fn, /A IA de treinos está disponível apenas para treinador e admin\./, "Função deve retornar mensagem clara de acesso restrito");
assert.match(fn, /https:\/\/api\.openai\.com\/v1\/responses/, "Função deve usar Responses API oficial da OpenAI");
assert.match(fn, /json_schema/, "Saída da IA deve usar schema estruturado");
assert.match(fn, /generateFallbackPlan/, "Função deve ter fallback seguro se a IA indisponível");
assert.match(fn, /buildWorkoutDraft/, "Função deve devolver workoutDraft pronto para o frontend");
assert.match(fn, /usedModel/, "Função deve informar qual motor foi usado");
assert.match(fn, /warning/, "Função deve devolver aviso quando cair em fallback");

console.log("AI workout production QA passed.");
