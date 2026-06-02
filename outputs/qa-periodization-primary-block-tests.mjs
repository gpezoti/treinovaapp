import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../supabase/migrations/20260602183000_sync_periodization_day_legacy_fields.sql', import.meta.url),
  'utf8'
);

assert.match(
  html,
  /function\s+getPrimaryPeriodizationBlock\(blocks,\s*presetCode\s*=\s*null\)[\s\S]*!isAeroPresetCode\(b\.preset_code\)/,
  'Primary periodization block must prefer non-aerobic workout blocks.'
);

assert.match(
  html,
  /const\s+resolvedIntensity\s*=\s*legacyIntensityFromPresetCode\(presetCode,\s*d\.intensity\s*\|\|\s*"off"\)/,
  'findDayInfo must derive visible intensity from the resolved block preset.'
);

assert.match(
  html,
  /intensity:\s*legacyIntensityFromPresetCode\(first\?\.preset_code,\s*d\.intensity\s*\|\|\s*"off"\)/,
  'loadPeriodization must normalize day intensity after loading periodization blocks.'
);

assert.match(
  html,
  /openWorkoutWithPreset\('\$\{today\}','\$\{myInfo\.workout_code\}','\$\{myInfo\.preset_code\}'/,
  'Coach self-training card must open workout with the resolved preset when available.'
);

assert.match(
  html,
  /function\s+feedIntensityPill\(post\)[\s\S]*return intensityPill\(raw,\s*post\?\.preset_code\s*\|\|\s*null\)/,
  'Feed badge rendering must not default every unknown intensity to Mobilidade.'
);

assert.match(
  migration,
  /case when lower\(coalesce\(b\.preset_code,\s*''\)\) in \('aero', 'cardio'\) then 1 else 0 end/,
  'Migration must rank aerobic/cardio blocks after the primary training block.'
);

assert.match(
  migration,
  /update public\.periodization_days d[\s\S]*workout_code = m\.next_workout_code[\s\S]*intensity = m\.next_intensity[\s\S]*aero = m\.next_aero/,
  'Migration must backfill legacy periodization_days workout/intensity/aero fields.'
);

console.log('Periodization primary block QA passed.');
