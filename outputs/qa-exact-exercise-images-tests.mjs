import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexPath = path.join(root, "index.html");
const visualsPath = path.join(root, "outputs", "exercise-exact-visuals.json");
const normalizedCatalogPath = path.join(root, "supabase", "migrations", "20260519190000_exercise_library_normalized_catalog.sql");
const index = fs.readFileSync(indexPath, "utf8");
const visuals = JSON.parse(fs.readFileSync(visualsPath, "utf8"));
const normalizedCatalog = fs.readFileSync(normalizedCatalogPath, "utf8");

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

function normalizeExerciseText(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractObjectBlock(source, objectName) {
  const start = source.indexOf(`const ${objectName} = {`);
  assert(start >= 0, `Objeto ${objectName} não foi encontrado.`);
  const end = source.indexOf("\n};", start);
  assert(end > start, `Objeto ${objectName} não tem fechamento esperado.`);
  return source.slice(start, end + 3);
}

function extractMappedAssetPaths(objectBlock) {
  return [...objectBlock.matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map((match) => ({
    key: normalizeExerciseText(match[1]),
    assetPath: match[2],
  }));
}

assert(index.includes("const EXACT_EXERCISE_IMAGE_ASSETS = {"), "Mapa exato de imagens não foi encontrado no index.html.");
assert(index.includes("const CANONICAL_EXERCISE_IMAGE_ALIASES = {"), "Mapa de aliases canônicos de imagem não foi encontrado no index.html.");
assert(index.includes("function getExactExerciseAssetUrl"), "Função de resolução por nome exato ausente.");
assert(index.includes("EXACT_EXERCISE_IMAGE_ASSETS[name] || CANONICAL_EXERCISE_IMAGE_ALIASES[name]"), "Resolver exato deve usar aliases canônicos antes do fallback.");
assert(index.includes("getCategoryExerciseAssetUrl(ex || {}) || getMissingExerciseImageUrl(ex || {})"), "Fallback deve tentar asset por categoria antes do placeholder neutro.");
assert(!index.includes("const item = STANDARD_EXERCISE_IMAGES[kind] || STANDARD_EXERCISE_IMAGES.generic;\n  return item.assetPath;"), "O fallback antigo por categoria ainda está retornando assets genéricos.");

const exactImageMap = new Map([
  ...extractMappedAssetPaths(extractObjectBlock(index, "EXACT_EXERCISE_IMAGE_ASSETS")),
  ...extractMappedAssetPaths(extractObjectBlock(index, "CANONICAL_EXERCISE_IMAGE_ALIASES")),
].map((item) => [item.key, item.assetPath]));

const normalizedExercises = [...normalizedCatalog.matchAll(/^  \('([^']+)'/gm)].map((match) => match[1]);
assert(normalizedExercises.length > 100, "Catálogo normalizado não foi parseado corretamente.");

const canonicalMissingImages = normalizedExercises.filter((name) => !exactImageMap.has(normalizeExerciseText(name)));
assert(canonicalMissingImages.length === 0, `Exercícios canônicos sem imagem coerente: ${canonicalMissingImages.join(", ")}`);

const missingMappedFiles = [...exactImageMap.values()]
  .filter((assetPath) => assetPath.startsWith("assets/exercises/exact/"))
  .filter((assetPath) => !fs.existsSync(path.join(root, assetPath)));
assert(missingMappedFiles.length === 0, `Há aliases ou assets exatos apontando para arquivos ausentes: ${missingMappedFiles.join(", ")}`);

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
