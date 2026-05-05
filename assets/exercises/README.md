# Realistic Exercise Visual Assets

Generated WebP exercise visuals live in this folder.
The app uses these assets when the teacher has not uploaded a custom image.
The current production mapping now prefers `exact/<exercise-name>.webp`, keyed by the exact exercise name, before any legacy category visual.
If an exact asset is missing, the UI falls back to a neutral local placeholder instead of showing another movement incorrectly.

Visual direction:
- Ultra realistic or semi-realistic instructional fitness image.
- Same model/body type, lighting, crop, and camera language across all assets.
- Clean white or soft gray background.
- Minimal equipment/context only when needed.
- Clear form, posture, and movement direction.
- No text, watermark, logo, or decorative visual noise.

Target format:
- WebP
- 640x640 for exact exercise thumbnails
- 640x440 or 1280x880 for legacy category sources
- Optimized for small mobile thumbnails

Exact exercise assets:
- `exact/*.webp` contains one file per registered exercise name.
- `exact/source/workout_exact_sheet_*.png` keeps the AI-generated source sheets used to crop the main workout visuals.
- `outputs/exercise-exact-image-prompts.md` contains the exact prompt for every registered exercise.

Legacy category filenames:
These are kept only as older broad visual references. Runtime selection should not use them for exact registered exercises.

Generated filenames:
- `realistic_barbell_squat.webp`
- `realistic_leg_press.webp`
- `realistic_walking_lunge.webp`
- `realistic_hip_thrust.webp`
- `realistic_deadlift.webp`
- `realistic_bench_press.webp`
- `realistic_chest_fly.webp`
- `realistic_dumbbell_row.webp`
- `realistic_lat_pulldown.webp`
- `realistic_shoulder_press.webp`
- `realistic_lateral_raise.webp`
- `realistic_biceps_curl.webp`
- `realistic_triceps_pushdown.webp`
- `realistic_forearm_plank.webp`
- `realistic_abdominal_crunch.webp`
- `realistic_calf_raise.webp`
- `realistic_mobility_stretch.webp`
- `realistic_functional_strength.webp`

Source:
- `source/ai_exercise_grid_2026-05-04.png` keeps the original AI-generated source grid used to crop these assets.
