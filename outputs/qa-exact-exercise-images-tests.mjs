import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexPath = path.join(root, "index.html");
const visualsPath = path.join(root, "outputs", "exercise-exact-visuals.json");
const index = fs.readFileSync(indexPath, "utf8");
const visuals = JSON.parse(fs.readFileSync(visualsPath, "utf8"));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredSeedExercises = [
  "Agachamento hack linear",
  "Cadeira extensora",
  "Panturrilhas no leg horizontal",
  "Supino inclinado com halteres (banco 30°)",
  "Crucifixo no cross over polia baixa, banco inclinado 45°",
  "Tríceps francês com corda na polia média",
  "RDL (stiff) com barra descalço",
  "Bike Zona 2/3",
];

assert(index.includes("const EXACT_EXERCISE_IMAGE_ASSETS = {"), "Mapa exato de imagens não foi encontrado no index.html.");
assert(index.includes("function getExactExerciseAssetUrl"), "Função de resolução por nome exato ausente.");
assert(index.includes("return getMissingExerciseImageUrl(ex || {});"), "Fallback neutro não está configurado para exercícios sem asset específico.");
assert(!index.includes("const item = STANDARD_EXERCISE_IMAGES[kind] || STANDARD_EXERCISE_IMAGES.generic;\n  return item.assetPath;"), "O fallback antigo por categoria ainda está retornando assets genéricos.");

for (const name of requiredSeedExercises) {
  const record = visuals.find((item) => item.name === name);
  assert(record, `Exercício obrigatório sem visual exato: ${name}`);
  assert(index.includes(JSON.stringify(record.assetPath)), `Asset não está mapeado no app: ${record.assetPath}`);
  const assetPath = path.join(root, record.assetPath);
  assert(fs.existsSync(assetPath), `Arquivo WebP não existe: ${record.assetPath}`);
  assert(fs.statSync(assetPath).size > 5_000, `Arquivo WebP parece vazio ou inválido: ${record.assetPath}`);
  assert(record.prompt.includes(name), `Prompt não inclui o nome exato do exercício: ${name}`);
}

const missingFiles = visuals
  .map((item) => item.assetPath)
  .filter((assetPath) => !fs.existsSync(path.join(root, assetPath)));
assert(missingFiles.length === 0, `Há assets mapeados sem arquivo físico: ${missingFiles.join(", ")}`);

console.log(`OK: ${visuals.length} exercícios auditados, ${new Set(visuals.map((item) => item.assetPath)).size} assets WebP verificados.`);
