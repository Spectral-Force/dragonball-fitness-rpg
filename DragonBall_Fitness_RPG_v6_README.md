# Dragon Ball Fitness RPG v6

Version: v6.0
Build: 6.0.0-20260724.10
Save schema: 31
Canonical entry: `DragonBall_Fitness_RPG_v6.0.html`

## What v6 is

v6 is the canonical, maintainable successor to the preserved 51 MB v5 release. It keeps the large fitness-RPG feature set while changing the campaign target to three years, making the interface mobile-first, replacing fragile persistence, and separating code and images from the HTML.

Open `DragonBall_Fitness_RPG_v6.0.html` through a local HTTP server. From this directory:

```powershell
python -m http.server 8765
```

Then visit `http://127.0.0.1:8765/DragonBall_Fitness_RPG_v6.0.html`.

## Canonical source map

- `DragonBall_Fitness_RPG_v6.0.html` — release entry and semantic page structure.
- `dbz-v6.js` — generated main game runtime.
- `dbz-v6-config.js` — hand-edited version, campaign, formula, recovery and input-limit configuration.
- `v6-asset-manifest.js` — generated SHA-256 content-hashed image manifest.
- `dbz-v6-storage.js` — IndexedDB saves, snapshots, fallback and import validation.
- `dbz-v6-enhancements.js` — Today view, readiness, mobile navigation, search, accessibility and safety helpers.
- `dbz-v6.css` — generated legacy/base styles.
- `dbz-v6-overrides.css` — hand-edited responsive v6 layer.
- `analysis/build_v6_from_mobile.mjs` — reproducible migration/build step. It reads the later Mobile v5 source and emits the HTML, base CSS and main runtime without embedded assets.
- `analysis/v6_balance_model.mjs` — deterministic progression acceptance model.
- `tests/*.test.mjs` — release tests.

Do not edit the generated `dbz-v6.js` or `dbz-v6.css` directly. Change the migration script, configuration, storage, enhancement or override source and run:

```powershell
node analysis/build_v6_from_mobile.mjs
node --test tests/*.test.mjs
```

The builder uses the legacy Mobile v5 source when that checkout still contains it. Once the Pages entry has been replaced by v6, it deterministically reads the same source from Git commit `8ac683b`. Set `DBZ_V5_MOBILE_SOURCE` to an alternate snapshot path when moving the project or rebuilding without that Git history.

The v5 HTML and old releases remain historical inputs. They are not the v6 source of truth.

## Power model

The displayed saga-check formula is:

`Effective PL = linear Base Fitness PL × equipped transformation or race-equivalent state`

Base Fitness PL grows from weighted raw stats without an exponential stat-to-power conversion. Partners, abilities, wishes, saga focus, training branches and state mastery improve the stats earned and the readiness of a race route. They are bounded by per-system caps and an era soft cap. They do not add a hidden direct partner multiplier to the final PL.

The campaign maps saga Story XP, base-power and state requirements to weeks 0–156. Daima is between Kid Buu and Beerus. An optimal Tim-plan route targets the Granolah saga around week 156; sensible and casual routes remain viable but take longer. The complete rationale and simulation criteria are in `analysis/v6_power_scaling_spec.md`.

## Race routes

- Earthling: equipped Full Potential/Potential Unlocked or Kaioken, technique, abilities, partners and mastery.
- Saiyan: equipped canonical transformations.
- Hybrid: equipped potential/rage/Beast awakening and mastery.
- Namekian: equipped fusion/Giant/Orange state and assimilation mastery.
- Android/Bio-Android: equipped evolution; late eras require permanent partner absorptions.
- Frieza Race: equipped released/evolved forms and control mastery.
- Majin: copied techniques and permanent partner absorptions; late eras require three developed absorptions.

Only the strongest available transformation or race-equivalent state is used. States do not multiply one another without a declared mechanic.

## Saves and migration

The main save is transactional IndexedDB data. v6 keeps the primary record plus three rolling recovery snapshots. A small localStorage pointer is used for diagnostics and a full localStorage fallback is used only if IndexedDB fails.

Schema-validated imports have a 10 MB limit, bounded depth and collection sizes, finite-number checks, date/ID checks, and a required character shape. The active save is not replaced until validation succeeds. Imported/player text is escaped at render boundaries.

Legacy saves migrate deterministically to schema 31. Raw workouts and stats are preserved. The Today panel provides a v5→v6 recalculation receipt for migrated characters. Export before moving between browsers or devices.

## Sustainable fitness play

Normal rest does not permanently erase stats. The dashboard uses readiness, a 14-day no-training grace period and a flexible three-day weekly consistency target. Optional readiness, illness, injury, deload, RPE, RIR and notes are stored with workouts. Implausible numeric inputs are capped with an Undo action.

This is a motivation game, not medical advice. Stop or adapt training for pain, illness, unsafe technique or professional guidance.

## Offline/PWA

`manifest-v6.webmanifest` and `dbz-sw-v6.0.js` cache the real v6 shell, icons and featured v6 art. Navigation is network-first with an offline entry fallback; the larger image library uses stale-while-revalidate. Card artwork is resolved through the generated content-hashed manifest, which prefers WebP/AVIF over equivalent PNG/JPEG originals. The service-worker cache is versioned to build 6.0.0-20260724.10.

## Visual system

The v6 Today hero uses `images/v6/v6_hero.webp`, derived from `images/v6/v6_hero_source.png`. The seven character-creation portraits under `images/v6/races/` are derived from `images/v6/v6_race_avatar_sheet_source.png`. Both are original anime-inspired assets, not copies of an existing character or logo.

Abilities receive a family badge and color language at render time. Transformations share reusable aura, lightning and glow layers. Saga art receives era-specific planet and environmental overlays, while non-blocking reward notifications use lightweight scouter, capsule, Dragon Ball and rank effects. All motion honors the operating-system reduced-motion preference. The complete generation prompts and modes are recorded in the changelog.
