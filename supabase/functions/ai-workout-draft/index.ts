// supabase/functions/ai-workout-draft/index.ts
// Gera um rascunho estruturado de treino para coach/admin.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";
const OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini";

const sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const workoutPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "code",
    "goal",
    "level",
    "estimated_duration_min",
    "periodization_type",
    "blocks",
    "coach_review_checklist",
    "progression_notes",
    "warnings",
  ],
  properties: {
    name: { type: "string" },
    code: { type: "string" },
    goal: { type: "string" },
    level: { type: "string" },
    estimated_duration_min: { type: "number" },
    periodization_type: { type: "string" },
    blocks: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "focus", "exercises"],
        properties: {
          title: { type: "string" },
          focus: { type: "string" },
          exercises: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "muscle_group", "equipment", "sets", "reps", "rest_seconds", "cadence", "notes"],
              properties: {
                name: { type: "string" },
                muscle_group: { type: "string" },
                equipment: { type: "string" },
                sets: { type: "number" },
                reps: { type: "string" },
                rest_seconds: { type: "number" },
                cadence: { type: "string" },
                notes: { type: "string" },
              },
            },
          },
        },
      },
    },
    coach_review_checklist: { type: "array", items: { type: "string" } },
    progression_notes: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
  },
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function normalizePrompt(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 4000);
}

function normalizeStudentProfile(input: unknown) {
  const profile = input && typeof input === "object" ? input as Record<string, unknown> : {};
  return {
    goal: String(profile.goal || "Hipertrofia").slice(0, 80),
    level: String(profile.level || "Intermediário").slice(0, 80),
    frequency: String(profile.frequency || "4x/semana").slice(0, 80),
    limitations: String(profile.limitations || "Sem limitações informadas").slice(0, 180),
  };
}

function titleCasePt(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/(^|\s)([a-záàâãéêíóôõúç])/g, (_, space, char) => `${space}${char.toUpperCase()}`);
}

function plainText(text: unknown) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const groupAliases = [
  { group: "Peito", pattern: /peito|supino|crucifixo|crossover|peck/ },
  { group: "Costas", pattern: /costas|dorsal|puxada|remada|barra fixa|pulldown/ },
  { group: "Ombros", pattern: /ombro|ombros|desenvolvimento|elevacao lateral|elevação lateral|face pull/ },
  { group: "Bíceps", pattern: /biceps|bíceps|rosca/ },
  { group: "Tríceps", pattern: /triceps|tríceps|pulley|frances|francês|testa/ },
  { group: "Quadríceps", pattern: /quadriceps|quadríceps|extensora|agachamento|leg press|afundo|passada|hack/ },
  { group: "Posterior de coxa", pattern: /posterior(?: de coxa)?|flexora|stiff|terra romeno|levantamento terra/ },
  { group: "Glúteos", pattern: /gluteos|glúteos|gluteo|glúteo|pelvica|pélvica|hip thrust|coice/ },
  { group: "Panturrilha", pattern: /panturrilha|gemeos|gêmeos/ },
  { group: "Abdômen/Core", pattern: /abdomen|abdômen|core|abdominal|prancha|crunch|pallof/ },
  { group: "Mobilidade", pattern: /mobilidade|alongamento|flexibilidade/ },
  { group: "Cardio/Aeróbio", pattern: /cardio|aerobio|aeróbio|corrida|caminhada|bicicleta|escada|eliptico|elíptico|remo/ },
];

function canonicalGroup(label: string) {
  const text = plainText(label);
  const match = groupAliases.find((item) => item.pattern.test(text));
  return match ? match.group : titleCasePt(String(label || "").trim());
}

function inferGoal(prompt: string, profile: ReturnType<typeof normalizeStudentProfile>) {
  const text = `${plainText(prompt)} ${plainText(profile.goal)}`;
  if (/forca|max|1rm|carga/.test(text)) return "Força";
  if (/emagrec|defini|condicion|cardio|aerobio/.test(text)) return "Condicionamento";
  if (/mobilidade|alongamento|flexibilidade/.test(text)) return "Mobilidade";
  return "Hipertrofia";
}

function inferFocus(prompt: string) {
  const text = plainText(prompt);
  if (/peito|ombro|triceps|supino|push/.test(text)) return "Peito, ombros e tríceps";
  if (/costas|biceps|puxada|remada|pull/.test(text)) return "Costas e bíceps";
  if (/posterior|flexora|stiff|terra|pelvica|gluteo/.test(text)) return "Posterior de coxa e glúteos";
  if (/perna|quadriceps|inferior/.test(text)) return "Membros inferiores";
  if (/full|corpo todo|geral/.test(text)) return "Full body";
  return "Treino completo";
}

const exerciseBank: Record<string, Array<[string, string, string]>> = {
  "Peito": [
    ["Supino reto com barra", "Peito", "Barra"],
    ["Supino inclinado com halteres", "Peito", "Halteres"],
    ["Crucifixo com halteres", "Peito", "Halteres"],
    ["Crossover na polia", "Peito", "Polia"],
    ["Peck deck", "Peito", "Máquina"],
  ],
  "Costas": [
    ["Puxada alta na polia", "Costas", "Polia"],
    ["Remada baixa", "Costas", "Máquina"],
    ["Remada unilateral com halter", "Costas", "Halter"],
    ["Pulldown", "Costas", "Polia"],
    ["Barra fixa", "Costas", "Peso corporal"],
  ],
  "Ombros": [
    ["Desenvolvimento com halteres", "Ombros", "Halteres"],
    ["Elevação lateral", "Ombros", "Halteres"],
    ["Elevação frontal", "Ombros", "Halteres"],
    ["Crucifixo inverso", "Ombros", "Máquina"],
    ["Face pull", "Ombros", "Polia"],
  ],
  "Bíceps": [
    ["Rosca direta", "Bíceps", "Barra"],
    ["Rosca alternada", "Bíceps", "Halteres"],
    ["Rosca martelo", "Bíceps", "Halteres"],
    ["Rosca Scott", "Bíceps", "Máquina"],
    ["Rosca concentrada", "Bíceps", "Halter"],
  ],
  "Tríceps": [
    ["Tríceps corda", "Tríceps", "Polia"],
    ["Tríceps testa", "Tríceps", "Barra"],
    ["Tríceps francês", "Tríceps", "Halter"],
    ["Tríceps pulley", "Tríceps", "Polia"],
    ["Mergulho nas paralelas", "Tríceps", "Peso corporal"],
  ],
  "Quadríceps": [
    ["Agachamento livre", "Quadríceps", "Barra"],
    ["Leg press", "Quadríceps", "Máquina"],
    ["Cadeira extensora", "Quadríceps", "Máquina"],
    ["Afundo", "Quadríceps", "Halteres"],
    ["Passada", "Quadríceps", "Halteres"],
  ],
  "Posterior de coxa": [
    ["Flexora unilateral", "Posterior de coxa", "Máquina"],
    ["Mesa flexora", "Posterior de coxa", "Máquina"],
    ["Cadeira flexora", "Posterior de coxa", "Máquina"],
    ["Stiff", "Posterior de coxa", "Barra"],
    ["Levantamento terra", "Posterior de coxa", "Barra"],
  ],
  "Glúteos": [
    ["Elevação pélvica", "Glúteos", "Barra"],
    ["Hip thrust", "Glúteos", "Barra"],
    ["Coice no cabo", "Glúteos", "Polia"],
    ["Glúteo na polia", "Glúteos", "Polia"],
    ["Agachamento sumô", "Glúteos", "Halter"],
  ],
  "Peito, ombros e tríceps": [
    ["Supino reto com barra", "Peito", "Barra"],
    ["Supino inclinado com halteres", "Peito", "Halteres"],
    ["Desenvolvimento com halteres", "Ombros", "Halteres"],
    ["Elevação lateral", "Ombros", "Halteres"],
    ["Tríceps corda", "Tríceps", "Polia"],
  ],
  "Costas e bíceps": [
    ["Puxada alta na polia", "Costas", "Polia"],
    ["Remada baixa", "Costas", "Máquina"],
    ["Remada unilateral com halter", "Costas", "Halter"],
    ["Rosca direta", "Bíceps", "Barra"],
    ["Rosca martelo", "Bíceps", "Halteres"],
  ],
  "Membros inferiores": [
    ["Agachamento livre", "Quadríceps", "Barra"],
    ["Leg press", "Quadríceps", "Máquina"],
    ["Cadeira extensora", "Quadríceps", "Máquina"],
    ["Stiff", "Posterior de coxa", "Barra"],
    ["Elevação pélvica", "Glúteos", "Barra"],
  ],
  "Posterior de coxa e glúteos": [
    ["Flexora unilateral", "Posterior de coxa", "Máquina"],
    ["Stiff", "Posterior de coxa", "Barra"],
    ["Levantamento terra", "Posterior de coxa", "Barra"],
    ["Elevação pélvica", "Glúteos", "Barra"],
    ["Mesa flexora", "Posterior de coxa", "Máquina"],
  ],
  "Full body": [
    ["Agachamento goblet", "Quadríceps", "Halter"],
    ["Supino com halteres", "Peito", "Halteres"],
    ["Remada baixa", "Costas", "Máquina"],
    ["Desenvolvimento com halteres", "Ombros", "Halteres"],
    ["Prancha", "Abdômen/Core", "Peso corporal"],
  ],
  "Treino completo": [
    ["Leg press", "Quadríceps", "Máquina"],
    ["Puxada alta na polia", "Costas", "Polia"],
    ["Supino reto com barra", "Peito", "Barra"],
    ["Elevação lateral", "Ombros", "Halteres"],
    ["Abdominal supra", "Abdômen/Core", "Peso corporal"],
  ],
};

function schemeForGoal(goal: string) {
  if (goal === "Força") return { sets: 4, reps: "4-6", rest: 150, cadence: "2-1-1" };
  if (goal === "Condicionamento") return { sets: 3, reps: "12-20", rest: 45, cadence: "controlada" };
  if (goal === "Mobilidade") return { sets: 2, reps: "8-12", rest: 30, cadence: "lenta" };
  return { sets: 3, reps: "8-12", rest: 75, cadence: "2-0-2" };
}

const requestedExerciseMatchers = [
  { name: "Flexora unilateral", muscle_group: "Posterior de coxa", equipment: "Máquina", aliases: [/flexora unilateral/] },
  { name: "Mesa flexora", muscle_group: "Posterior de coxa", equipment: "Máquina", aliases: [/mesa flexora/] },
  { name: "Cadeira flexora", muscle_group: "Posterior de coxa", equipment: "Máquina", aliases: [/cadeira flexora/] },
  { name: "Stiff", muscle_group: "Posterior de coxa", equipment: "Barra", aliases: [/\bstiff\b/] },
  { name: "Levantamento terra", muscle_group: "Posterior de coxa", equipment: "Barra", aliases: [/levantamento terra/, /(^|\s)terra(\s|$)/] },
  { name: "Levantamento terra romeno", muscle_group: "Posterior de coxa", equipment: "Barra", aliases: [/terra romeno/, /levantamento terra romeno/] },
  { name: "Elevação pélvica", muscle_group: "Glúteos", equipment: "Barra", aliases: [/elevacao pelvica/, /hip thrust/] },
  { name: "Agachamento livre", muscle_group: "Quadríceps", equipment: "Barra", aliases: [/agachamento livre/] },
  { name: "Leg press", muscle_group: "Quadríceps", equipment: "Máquina", aliases: [/leg press/] },
  { name: "Cadeira extensora", muscle_group: "Quadríceps", equipment: "Máquina", aliases: [/cadeira extensora/] },
  { name: "Puxada alta na polia", muscle_group: "Costas", equipment: "Polia", aliases: [/puxada alta/, /puxada na polia/] },
  { name: "Remada baixa", muscle_group: "Costas", equipment: "Máquina", aliases: [/remada baixa/] },
  { name: "Rosca direta", muscle_group: "Bíceps", equipment: "Barra", aliases: [/rosca direta/] },
  { name: "Rosca martelo", muscle_group: "Bíceps", equipment: "Halteres", aliases: [/rosca martelo/] },
];

function extractWorkoutCode(prompt: string, fallbackCode: string) {
  const text = plainText(prompt).toUpperCase();
  const match = text.match(/\bTREINO\s+([A-Z0-9_-]{1,8})\b/);
  return match?.[1] || fallbackCode;
}

function applyPromptScheme(prompt: string, scheme: ReturnType<typeof schemeForGoal>) {
  const text = plainText(prompt);
  const next = { ...scheme };
  const setsMatch = text.match(/(\d{1,2})\s*(series|serie|sets|set)\b/);
  if (setsMatch) next.sets = Number(setsMatch[1]);

  const repsRange = text.match(/(\d{1,2})\s*(?:a|-|ate)\s*(\d{1,2})/);
  if (repsRange) next.reps = `${Number(repsRange[1])}-${Number(repsRange[2])}`;
  else {
    const repsSingle = text.match(/(\d{1,2})\s*(reps|repeticoes|repeticao)\b/);
    if (repsSingle) next.reps = String(Number(repsSingle[1]));
  }

  const restMatch = text.match(/(\d{2,3})\s*(segundos|seg|s)\s*(?:de\s*)?(intervalo|descanso|pausa)?/);
  if (restMatch) next.rest = Number(restMatch[1]);
  return next;
}

function extractRequestedExercises(prompt: string) {
  const text = plainText(prompt);
  const found: Array<[string, string, string]> = [];
  const seen = new Set<string>();
  for (const exercise of requestedExerciseMatchers) {
    if (exercise.aliases.some((alias) => alias.test(text)) && !seen.has(exercise.name)) {
      seen.add(exercise.name);
      found.push([exercise.name, exercise.muscle_group, exercise.equipment]);
    }
  }
  return found;
}

function extractRequestedGroupQuotas(prompt: string) {
  const text = plainText(prompt)
    .replace(/\s+/g, " ")
    .replace(/,/g, " ")
    .replace(/\be\b/g, " e ");
  const groupPattern = "(costas|dorsal|biceps|bíceps|triceps|tríceps|peito|ombros?|quadriceps|quadríceps|posterior(?: de coxa)?|gluteos|glúteos|gluteo|glúteo|panturrilhas?|abdomen|abdômen|core|mobilidade|cardio|aerobio|aeróbio)";
  const regex = new RegExp(`(\\d{1,2})\\s*(?:exercicios?|movimentos?)?\\s*(?:de|para|focados? em)?\\s*${groupPattern}`, "g");
  const quotas: Array<{ group: string; count: number }> = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    const count = Math.max(1, Number(match[1] || 0));
    const group = canonicalGroup(match[2] || "");
    if (!group || !count || seen.has(group)) continue;
    seen.add(group);
    quotas.push({ group, count });
  }
  return quotas;
}

function buildExercisesFromGroupQuotas(prompt: string, requestedExercises: Array<[string, string, string]>) {
  const quotas = extractRequestedGroupQuotas(prompt);
  if (!quotas.length) return [] as Array<[string, string, string]>;

  const requestedByGroup = new Map<string, Array<[string, string, string]>>();
  for (const exercise of requestedExercises) {
    const group = canonicalGroup(exercise[1] || "");
    const list = requestedByGroup.get(group) || [];
    list.push([exercise[0], group, exercise[2]]);
    requestedByGroup.set(group, list);
  }

  const output: Array<[string, string, string]> = [];
  for (const { group, count } of quotas) {
    const bank = exerciseBank[group] || [];
    const used = new Set<string>();
    const chosen: Array<[string, string, string]> = [];
    for (const exercise of requestedByGroup.get(group) || []) {
      if (chosen.length >= count) break;
      if (used.has(exercise[0])) continue;
      chosen.push(exercise);
      used.add(exercise[0]);
    }
    for (const exercise of bank) {
      if (chosen.length >= count) break;
      if (used.has(exercise[0])) continue;
      chosen.push([exercise[0], canonicalGroup(exercise[1] || group), exercise[2]]);
      used.add(exercise[0]);
    }
    output.push(...chosen.slice(0, count));
  }
  return output;
}

function generateFallbackPlan(prompt: string, profile: ReturnType<typeof normalizeStudentProfile>) {
  const goal = inferGoal(prompt, profile);
  const focus = inferFocus(prompt);
  const scheme = applyPromptScheme(prompt, schemeForGoal(goal));
  const fallbackCode = focus === "Full body"
    ? "FULL"
    : focus.split(/[ ,]/).filter(Boolean)[0].slice(0, 4).toUpperCase();
  const code = extractWorkoutCode(prompt, fallbackCode);
  const requestedExercises = extractRequestedExercises(prompt);
  const quotaExercises = buildExercisesFromGroupQuotas(prompt, requestedExercises);
  const sourceExercises = quotaExercises.length ? quotaExercises : (requestedExercises.length ? requestedExercises : exerciseBank[focus] || exerciseBank["Treino completo"]);
  const exercises = sourceExercises.map(([name, group, equipment]) => ({
    name,
    muscle_group: group,
    equipment,
    sets: scheme.sets,
    reps: scheme.reps,
    rest_seconds: scheme.rest,
    cadence: scheme.cadence,
    notes: goal === "Força" ? "Priorizar técnica e descanso completo." : "Ajustar carga mantendo execução limpa.",
  }));

  return {
    name: `${titleCasePt(goal)} · ${focus}`,
    code,
    goal,
    level: profile.level,
    estimated_duration_min: Math.max(35, Math.min(75, exercises.length * (scheme.rest / 60 + 4))),
    periodization_type: goal,
    blocks: [{
      title: "Bloco principal",
      focus,
      exercises,
    }],
    coach_review_checklist: [
      "Conferir limitações e histórico de dor do aluno.",
      "Validar se o volume cabe na frequência semanal.",
      "Ajustar carga inicial antes de liberar para execução.",
    ],
    progression_notes: [
      "Se completar todas as séries com boa técnica, subir 2-5% na próxima sessão.",
      "Registrar cargas para evolução semanal.",
    ],
    warnings: [],
    source: "fallback",
  };
}

function extractOutputText(response: any) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  if (response?.output_parsed && typeof response.output_parsed === "object") {
    return JSON.stringify(response.output_parsed);
  }
  const chunks: string[] = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string" && content.text.trim()) {
        chunks.push(content.text.trim());
        continue;
      }
      if (typeof content?.output_text === "string" && content.output_text.trim()) {
        chunks.push(content.output_text.trim());
        continue;
      }
      if (content?.parsed && typeof content.parsed === "object") {
        return JSON.stringify(content.parsed);
      }
      if (content?.json && typeof content.json === "object") {
        return JSON.stringify(content.json);
      }
      if (typeof content?.value === "string" && content.value.trim()) {
        chunks.push(content.value.trim());
      }
    }
  }
  const merged = chunks.join("\n").trim();
  if (!merged) throw new Error("OpenAI não retornou conteúdo estruturado.");
  return merged.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

function sanitizePlan(plan: any, source: string, prompt: string, profile: ReturnType<typeof normalizeStudentProfile>) {
  const safe = plan && typeof plan === "object" ? plan : {};
  const fallback = generateFallbackPlan(prompt, profile);
  return {
    ...fallback,
    ...safe,
    source,
    blocks: Array.isArray(safe.blocks) && safe.blocks.length ? safe.blocks : fallback.blocks,
    coach_review_checklist: Array.isArray(safe.coach_review_checklist) ? safe.coach_review_checklist : fallback.coach_review_checklist,
    progression_notes: Array.isArray(safe.progression_notes) ? safe.progression_notes : fallback.progression_notes,
    warnings: Array.isArray(safe.warnings) ? safe.warnings : fallback.warnings,
  };
}

function buildWorkoutDraft(plan: any) {
  const blocks = Array.isArray(plan.blocks) ? plan.blocks : [];
  const exercises = blocks.flatMap((block: any) => Array.isArray(block.exercises) ? block.exercises : []);
  return {
    workout: {
      name: String(plan.name || "Treino gerado"),
      code: String(plan.code || "A").toUpperCase(),
      focus: String(blocks[0]?.focus || plan.goal || "Treino"),
      periodization_type: String(plan.periodization_type || plan.goal || "Hipertrofia"),
      level: String(plan.level || "Não informado"),
      estimated_duration_min: Math.round(Number(plan.estimated_duration_min || 0)),
    },
    exercises: exercises.map((exercise: any, index: number) => ({
      order: index + 1,
      name: String(exercise.name || `Exercício ${index + 1}`),
      muscle_group: String(exercise.muscle_group || "Não informado"),
      equipment: String(exercise.equipment || "Não informado"),
      sets: Number(exercise.sets || 3),
      reps: String(exercise.reps || "8-12"),
      rest_seconds: Number(exercise.rest_seconds || 60),
      cadence: String(exercise.cadence || ""),
      notes: String(exercise.notes || ""),
    })),
  };
}

async function generateWithOpenAI(prompt: string, profile: ReturnType<typeof normalizeStudentProfile>) {
  if (!OPENAI_API_KEY) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "system",
          content: [{
            type: "input_text",
            text: [
              "Você é uma IA assistente para personal trainers brasileiros.",
              "Gere uma prescrição inicial de treino em PT-BR, objetiva e revisável.",
              "Não invente diagnóstico médico. Preserve segurança e deixe claro quando o treinador deve revisar.",
              "Use nomes comuns de academia no Brasil e evite exercícios raros sem necessidade.",
              "Se o briefing pedir quantidades exatas por grupo muscular ou por exercício, respeite exatamente essa distribuição.",
              "O resultado deve ser estruturado para o Treinova.",
            ].join(" "),
          }],
        },
        {
          role: "user",
          content: [{
            type: "input_text",
            text: JSON.stringify({ prompt, student_profile: profile }),
          }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "treinova_workout_plan",
          strict: true,
          schema: workoutPlanSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`OpenAI HTTP ${response.status}: ${detail.slice(0, 240)}`);
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);
  let parsedPlan: any = null;
  try {
    parsedPlan = JSON.parse(outputText);
  } catch (_parseError) {
    if (payload?.output_parsed && typeof payload.output_parsed === "object") {
      parsedPlan = payload.output_parsed;
    }
  }
  if (!parsedPlan || typeof parsedPlan !== "object") {
    throw new Error("OpenAI retornou um payload sem JSON válido.");
  }
  return sanitizePlan(parsedPlan, "openai", prompt, profile);
}

async function getAuthenticatedProfile(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return { error: "Não autenticado.", status: 401 };

  const sbUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !user?.id) return { error: "Sessão inválida.", status: 401 };

  const { data: profile, error: profileErr } = await sbAdmin
    .from("profiles")
    .select("id, role, full_name, email, coach_id, status")
    .eq("id", user.id)
    .single();
  if (profileErr || !profile) return { error: "Perfil não encontrado.", status: 404 };
  if (!["coach", "admin"].includes(String(profile.role || ""))) {
    return { error: "A IA de treinos está disponível apenas para treinador e admin.", status: 403 };
  }
  return { profile, status: 200 };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const auth = await getAuthenticatedProfile(req);
    if ("error" in auth) return json({ error: auth.error }, auth.status);

    const body = await req.json().catch(() => ({}));
    const prompt = normalizePrompt(body.prompt);
    const studentProfile = normalizeStudentProfile(body.studentProfile);
    if (prompt.length < 12) {
      return json({ error: "Descreva melhor o treino desejado." }, 400);
    }

    let plan = null;
    let warning = "";
    try {
      plan = await generateWithOpenAI(prompt, studentProfile);
    } catch (e: any) {
      console.error("[ai-workout-draft openai]", e);
      const detail = String(e?.message || "");
      warning = /quota|insufficient_quota|billing|429/i.test(detail)
        ? "A IA avançada está indisponível no momento; montamos um rascunho inicial para você revisar e seguir."
        : "A IA principal não respondeu agora; foi gerada uma sugestão inicial para revisão.";
    }
    if (!plan) plan = generateFallbackPlan(prompt, studentProfile);

    const safePlan = sanitizePlan(plan, plan?.source || "fallback", prompt, studentProfile);
    if (warning) safePlan.warnings = [...(safePlan.warnings || []), warning];

    return json({
      ok: true,
      plan: safePlan,
      workoutDraft: buildWorkoutDraft(safePlan),
      usedModel: safePlan.source === "openai" ? OPENAI_MODEL : "fallback-local",
      warning,
    });
  } catch (e: any) {
    console.error("[ai-workout-draft]", e);
    return json({ error: e?.message || "Não foi possível gerar o treino." }, 500);
  }
});
