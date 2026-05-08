# Hyperreal Exercise Image Generation

Total jobs: 458
Visual clothing standard: fitted plain dark short-sleeve athletic t-shirt + black training shorts. No shirtless athlete and no tank top.
Current duplicated/reused asset count: 422

## Command

```bash
export OPENAI_API_KEY="<sua-chave>"
export IMAGE_GEN="$HOME/.codex/skills/.system/imagegen/scripts/image_gen.py"
python3 "$IMAGE_GEN" generate-batch \
  --input outputs/imagegen/hyperreal-exercise-image-jobs.jsonl \
  --out-dir assets/exercises/exact \
  --model gpt-image-2 \
  --size 1024x1024 \
  --quality high \
  --output-format webp \
  --concurrency 3 \
  --force
```

## QA after generation

```bash
node outputs/qa-exact-exercise-images-tests.mjs
node outputs/qa-realistic-exercise-visuals-tests.mjs
```
