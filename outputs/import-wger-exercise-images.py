#!/usr/bin/env python3
"""Import licensed exercise images from the public wger exercise database.

This script is intentionally conservative. It only replaces local Treinova
exercise images when a curated Portuguese exercise name maps to a direct wger
exercise name that has images and license metadata.
"""

from __future__ import annotations

import io
import json
import re
import unicodedata
import urllib.error
import urllib.request
import urllib.parse
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
VISUALS_PATH = ROOT / "outputs" / "exercise-exact-visuals.json"
LICENSES_PATH = ROOT / "outputs" / "exercise-image-licenses.json"
REPORT_PATH = ROOT / "outputs" / "exercise-image-import-report.md"
WGER_API = "https://wger.de/api/v2/exerciseinfo/?language=2&limit=100"
USER_AGENT = "Treinova beta exercise image importer/1.0"


CURATED_MATCHES: dict[str, list[str]] = {
    "Ab Wheel (Roda Abdominal)": ["ab wheel"],
    "Ab wheel (rolinho abdominal)": ["ab wheel"],
    "Abdominal infra (elevação de pernas)": ["leg raises, lying", "decline bench leg raise"],
    "Abdominal Infra na Barra": ["leg raises, lying"],
    "Agachamento Livre com Barra": ["barbell full squat", "front squats"],
    "Agachamento Frontal": ["front squats"],
    "Agachamento Goblet": ["dumbbell goblet squat"],
    "Agachamento Goblet com Halter": ["dumbbell goblet squat"],
    "Agachamento no Hack": ["leg press on hackenschmidt machine"],
    "Agachamento Sumô com Halter": ["dumbbell sumo deadlift", "kettlebell sumo deadlift"],
    "Afundo (Lunge)": ["dumbbell lunges walking", "walking lunges"],
    "Afundo Reverso": ["reverse lunges"],
    "Afundo Lateral": ["sliding lateral lunge"],
    "Agachamento Búlgaro": ["bulgarian squat with dumbbells"],
    "Agachamento Búlgaro com Halteres": ["bulgarian squat with dumbbells"],
    "Barra Fixa": ["pull-ups", "chin-ups"],
    "Barra fixa pronada": ["pull-ups"],
    "Barra fixa supinada": ["chin-ups"],
    "Bike ergométrica": ["cardio en bicicleta estática"],
    "Bicicleta ergométrica": ["cardio en bicicleta estática"],
    "Bíceps Concentrado": ["cable concentration curl"],
    "Cadeira Extensora": ["leg extension"],
    "Cadeira Flexora": ["leg curls (sitting)"],
    "Cadeira Abdutora": ["machine hip abduction"],
    "Cadeira Adutora": ["seated hip adduction"],
    "Calf Raise em Pé": ["standing calf raises"],
    "Caminhada na Esteira": ["treadmill cardio"],
    "Corrida na Esteira": ["treadmill cardio"],
    "Crossover no Cabo": ["cable cross-over", "fly with cable"],
    "Crossover Polia Alta": ["cable cross-over", "high-cable cross tricep extention - nb"],
    "Crucifixo com Halteres": ["fly with dumbbells"],
    "Crucifixo Reto": ["fly with dumbbells"],
    "Crucifixo Inverso": ["incline bench reverse fly", "rear delt raise"],
    "Crunch Abdominal": ["abdominal", "incline crunches"],
    "Deadlift": ["deadlifts"],
    "Desenvolvimento com Barra": ["shoulder press, barbell", "overhead barbell press"],
    "Desenvolvimento com Halteres": ["shoulder press, dumbbells"],
    "Desenvolvimento Máquina": ["shoulder press, on machine"],
    "Elevação Frontal com Halteres": ["front raises"],
    "Elevação Lateral com Halter": ["lateral raises"],
    "Elevação Lateral com Halteres": ["lateral raises"],
    "Elevação Lateral no Cabo": ["cable lateral raises (single arm)", "lateral rows on cable, one armed"],
    "Elevação pélvica": ["dumbbell hip thrust"],
    "Elevação Pélvica": ["dumbbell hip thrust"],
    "Extensão de Tríceps Máquina": ["overhead triceps extension"],
    "Face Pull": ["face pulls with yellow/green band"],
    "Flexão de Braços": ["push-up"],
    "Flexão de braços": ["push-up"],
    "Flexão de Braços Fechada": ["close-grip press-ups"],
    "Flexão fechada": ["close-grip press-ups"],
    "Flexora em pé": ["leg curls (standing)"],
    "Flexora Sentada": ["leg curls (sitting)"],
    "Good Morning": ["good mornings"],
    "Hip Thrust": ["dumbbell hip thrust"],
    "Leg Press": ["leg press"],
    "Leg Press 45°": ["leg press"],
    "Levantamento Terra": ["deadlifts"],
    "Levantamento Terra Convencional": ["deadlifts"],
    "Levantamento Terra Sumô": ["sumo deadlift"],
    "Mesa Flexora": ["leg curls (laying)", "leg curl"],
    "Mountain Climber": ["mountain climber"],
    "Panturrilha em Pé": ["standing calf raises"],
    "Panturrilha no Leg Press": ["calf press using leg press machine"],
    "Pistol Squat": ["pistol squat"],
    "Prancha (Plank)": ["plank", "forearm plank"],
    "Prancha Lateral": ["side plank"],
    "Pullover com Halter": ["rope pullover/row"],
    "Pullover no Cabo": ["pull over polea alta", "straight-arm pulldown (cable)"],
    "Puxada frontal com barra (pegada neutra)": ["jalones pecho neutro", "close-grip lat pull down"],
    "Puxada Frontal Pegada Aberta": ["lat pull down", "modified pulldown"],
    "Remada Baixa": ["long-pulley (low row)", "seated cable row"],
    "Remada Baixa com Triângulo": ["rowing seated, narrow grip", "remo gironda"],
    "Remada Curvada com Barra": ["bent over rowing"],
    "Remada Curvada com Halteres": ["bent over dumbbell rows"],
    "Remada Unilateral com Halter": ["single arm row", "one arm bent row"],
    "Rosca Alternada com Halteres": ["alternating bicep curls"],
    "Rosca Concentrada": ["cable concentration curl"],
    "Rosca Direta": ["biceps curls with barbell"],
    "Rosca Direta Barra W": ["biceps curls with sz-bar"],
    "Rosca Martelo": ["hammer curls"],
    "Rosca Martelo Alternada": ["alternating dumbbell hammer curl"],
    "Rosca Scott (Preacher Curl)": ["preacher curls"],
    "Rosca scott na máquina": ["preacher curls"],
    "Russian Twist": ["russian twist"],
    "Stiff": ["dumbbell romanian deadlift"],
    "Stiff / Terra Romeno": ["dumbbell romanian deadlift"],
    "Supino Declinado com Barra": ["decline bench press barbell"],
    "Supino Inclinado com Barra": ["incline bench press - barbell"],
    "Supino Inclinado com Halteres": ["incline bench press - dumbbell"],
    "Supino Reto com Barra": ["bench press"],
    "Supino Reto com Halteres": ["benchpress dumbbells"],
    "Supino Fechado": ["bench press narrow grip", "close-grip bench press"],
    "T-Bar Row": ["rowing, t-bar"],
    "Tríceps Corda no Cabo": ["tricep rope pushdowns", "triceps pushdown"],
    "Tríceps Francês": ["skullcrusher sz-bar"],
    "Tríceps Pulley": ["triceps extensions on cable"],
    "Tríceps Testa": ["skullcrusher sz-bar"],
}

# wger occasionally contains placeholders or unsuitable community submissions.
# These are intentionally kept on the local fallback image until a better
# licensed source is found.
EXCLUDED_IMPORTS = {
    "Ab Wheel (Roda Abdominal)",
    "Ab wheel (rolinho abdominal)",
}


@dataclass
class WgerExercise:
    id: int
    uuid: str
    names: list[str]
    images: list[dict]
    license: dict
    license_author: str | None


def request_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)


def request_bytes(url: str) -> bytes:
    url = urllib.parse.urljoin("https://wger.de", url)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()


def normalize(value: str) -> str:
    text = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def add_name(names: list[str], value: object) -> None:
    if isinstance(value, str):
        candidate = value.strip()
    elif isinstance(value, dict):
        raw = value.get("name") or value.get("alias")
        candidate = raw.strip() if isinstance(raw, str) else ""
    else:
        candidate = ""
    if candidate and candidate not in names:
        names.append(candidate)


def fetch_wger() -> list[WgerExercise]:
    url = WGER_API
    exercises: list[WgerExercise] = []
    while url:
        data = request_json(url)
        for raw in data.get("results", []):
            images = raw.get("images") or []
            if not images:
                continue
            names: list[str] = []
            for translation in raw.get("translations", []):
                add_name(names, translation.get("name"))
                for alias in translation.get("aliases") or []:
                    add_name(names, alias)
            exercises.append(
                WgerExercise(
                    id=raw.get("id"),
                    uuid=raw.get("uuid") or "",
                    names=names,
                    images=images,
                    license=raw.get("license") or {},
                    license_author=raw.get("license_author"),
                )
            )
        url = data.get("next")
    return exercises


def image_sort_key(image: dict) -> tuple[int, int, int]:
    return (
        0 if image.get("is_main") else 1,
        1 if image.get("is_ai_generated") else 0,
        image.get("id") or 0,
    )


def best_image(exercise: WgerExercise) -> dict | None:
    valid = [img for img in exercise.images if img.get("image")]
    if not valid:
        return None
    return sorted(valid, key=image_sort_key)[0]


def find_match(wger_exercises: list[WgerExercise], queries: list[str]) -> tuple[WgerExercise, str, str] | None:
    normalized = []
    for exercise in wger_exercises:
        for name in exercise.names:
            normalized.append((normalize(name), name, exercise))

    for query in queries:
        target = normalize(query)
        for norm_name, original_name, exercise in normalized:
            if norm_name == target:
                return exercise, original_name, "exact"

    for query in queries:
        target_tokens = set(normalize(query).split())
        if not target_tokens:
            continue
        for norm_name, original_name, exercise in normalized:
            name_tokens = set(norm_name.split())
            if target_tokens.issubset(name_tokens):
                return exercise, original_name, "token-subset"

    return None


def save_square_webp(image_bytes: bytes, destination: Path) -> None:
    with Image.open(io.BytesIO(image_bytes)) as image:
        image = image.convert("RGB")
        width, height = image.size
        side = min(width, height)
        left = (width - side) // 2
        top = (height - side) // 2
        image = image.crop((left, top, left + side, top + side))
        image = image.resize((640, 640), Image.Resampling.LANCZOS)
        destination.parent.mkdir(parents=True, exist_ok=True)
        image.save(destination, "WEBP", quality=88, method=6)


def main() -> int:
    visuals = json.loads(VISUALS_PATH.read_text())
    by_name = {item["name"]: item for item in visuals}
    by_normalized_name = {normalize(item["name"]): item for item in visuals}
    wger_exercises = fetch_wger()
    license_entries: list[dict] = []
    replaced: list[str] = []
    skipped: list[str] = []
    failed: list[str] = []

    for treinova_name, queries in CURATED_MATCHES.items():
        if treinova_name in EXCLUDED_IMPORTS:
            skipped.append(f"{treinova_name}: fonte wger ignorada por baixa qualidade visual")
            continue
        local = by_name.get(treinova_name) or by_normalized_name.get(normalize(treinova_name))
        if not local:
            skipped.append(f"{treinova_name}: não existe na biblioteca local")
            continue

        match = find_match(wger_exercises, queries)
        if not match:
            skipped.append(f"{treinova_name}: sem match confiável no wger")
            continue

        exercise, matched_name, method = match
        image = best_image(exercise)
        if not image:
            skipped.append(f"{treinova_name}: match sem imagem")
            continue

        try:
            source_url = urllib.parse.urljoin("https://wger.de", image["image"])
            destination = ROOT / local["assetPath"]
            image_bytes = request_bytes(source_url)
            save_square_webp(image_bytes, destination)
            license_entries.append(
                {
                    "treinovaName": treinova_name,
                    "assetPath": local["assetPath"],
                    "source": "wger",
                    "sourceUrl": source_url,
                    "sourceObjectUrl": image.get("license_object_url"),
                    "wgerExerciseId": exercise.id,
                    "wgerExerciseUuid": exercise.uuid,
                    "matchedName": matched_name,
                    "matchMethod": method,
                    "queries": queries,
                    "license": image.get("license_title") or exercise.license.get("full_name"),
                    "licenseShortName": exercise.license.get("short_name"),
                    "licenseUrl": exercise.license.get("url"),
                    "licenseAuthor": image.get("license_author") or exercise.license_author,
                    "licenseAuthorUrl": image.get("license_author_url"),
                    "isAiGenerated": bool(image.get("is_ai_generated")),
                }
            )
            replaced.append(f"{treinova_name} -> {matched_name}")
        except (ValueError, urllib.error.URLError, OSError, Image.UnidentifiedImageError) as exc:
            failed.append(f"{treinova_name}: {exc}")

    LICENSES_PATH.write_text(json.dumps(license_entries, ensure_ascii=False, indent=2) + "\n")
    report = [
        "# Exercise image import report",
        "",
        "Source: wger public exercise API (`https://wger.de/api/v2/exerciseinfo/`).",
        "",
        f"- Local exercises: {len(visuals)}",
        f"- wger exercises with images: {len(wger_exercises)}",
        f"- Images replaced: {len(replaced)}",
        f"- Skipped: {len(skipped)}",
        f"- Failed: {len(failed)}",
        "",
        "## Replaced",
        "",
        *(f"- {item}" for item in replaced),
        "",
        "## Skipped",
        "",
        *(f"- {item}" for item in skipped[:120]),
        "",
        "## Failed",
        "",
        *(f"- {item}" for item in failed),
        "",
        "## Licensing",
        "",
        "Each imported image is listed in `outputs/exercise-image-licenses.json` with source URL, author and license fields.",
        "Keep the manifest with the app assets so attribution can be audited before commercial distribution.",
    ]
    REPORT_PATH.write_text("\n".join(report) + "\n")

    print(f"replaced={len(replaced)} skipped={len(skipped)} failed={len(failed)}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
