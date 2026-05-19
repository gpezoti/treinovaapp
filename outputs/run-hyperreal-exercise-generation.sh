#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/guilhermepezoti/Documents/Treinova - cópia"
cd "$ROOT"

JOBS_FILE="outputs/imagegen/hyperreal-exercise-image-jobs.jsonl"
OUT_DIR="assets/exercises/exact"
IMAGE_GEN="${IMAGE_GEN:-$HOME/.codex/skills/.system/imagegen/scripts/image_gen.py}"

if [[ ! -f "$JOBS_FILE" ]]; then
  echo "Erro: arquivo de jobs não encontrado: $JOBS_FILE" >&2
  exit 1
fi

if [[ ! -f "$IMAGE_GEN" ]]; then
  echo "Erro: script de geração não encontrado: $IMAGE_GEN" >&2
  exit 1
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  printf "Cole sua OPENAI_API_KEY e pressione Enter. A chave não será salva: "
  read -r -s OPENAI_API_KEY
  printf "\n"
  export OPENAI_API_KEY
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Erro: OPENAI_API_KEY vazia." >&2
  exit 1
fi

JOB_COUNT="$(wc -l < "$JOBS_FILE" | tr -d ' ')"
echo "Pasta: $ROOT"
echo "Jobs de imagem: $JOB_COUNT"
echo "Saída: $OUT_DIR"
echo
echo "Atenção: este lote regenera imagens via API e pode consumir créditos."
printf "Digite GERAR para confirmar: "
read -r CONFIRM
if [[ "$CONFIRM" != "GERAR" ]]; then
  echo "Cancelado."
  exit 0
fi

python3 "$IMAGE_GEN" generate-batch \
  --input "$JOBS_FILE" \
  --out-dir "$OUT_DIR" \
  --model gpt-image-2 \
  --size 1024x1024 \
  --quality high \
  --output-format webp \
  --concurrency 2 \
  --max-attempts 2 \
  --force

node outputs/qa-exact-exercise-images-tests.mjs
node outputs/qa-realistic-exercise-visuals-tests.mjs

echo
echo "Geração concluída e QA básico aprovado."
