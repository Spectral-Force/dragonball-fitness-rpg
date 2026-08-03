# Dragon Ball Fitness RPG v6

Version: v6.4
Build: 6.4.0-20260803.5
Save schema: 33
Canonical entry: `DragonBall_Fitness_RPG_v6.0.html`

## What v6.4 delivers

v6.4 turns the complete three-year progression campaign into an authored story experience. All 38 sagas now have original, unlockable chapters: 278 saga beats in total, plus 100 beats across 20 core character arcs and 40 game-original relationship scenes. Canon-core, anime-only, Daima, Super anime and Super manga continuity are labelled explicitly.

Story unlocks now obey the exact saga state. Entry beats require the saga to be unlocked, development and turning-point beats use bounded Focus progress, resolutions require an actual clear, and mastery epilogues require mastery. The dashboard never substitutes an unrelated saga's latest entry. Partner milestone prose lives in a separate Training Journal so it no longer overwhelms the Story Codex.

The v6.3 race and power contract remains intact: Base Fitness PL grows from real training; one visible primary transformation or fixed race-equivalent tier supplies story power. Echo states improve training only and never inflate story PL.

The optimal built-in Tim-plan profile reaches the finale at week 156 on all eight route variants. The deterministic sensible and casual profiles finish at weeks 200 and 279 respectively. Ignoring RPG development intentionally stalls rather than receiving a hidden target-following multiplier.

Run locally with:

```powershell
python -m http.server 8765
```

Then open `http://127.0.0.1:8765/DragonBall_Fitness_RPG_v6.0.html`.

## Canonical source map

- `DragonBall_Fitness_RPG_v6.0.html` - generated release entry.
- `dbz-v6-config.js` - global campaign, formula, recovery and input configuration.
- `dbz-v6-progression-config.js` - canonical saga bands, race routes, permissions and unlock phases.
- `dbz-v6-progression-core.js` - shared deterministic progression, power, migration and absorption engine.
- `dbz-v6-race-ui.js` - Race Path, choice, breakthrough and core/template UI integration.
- `dbz-v6-story-*.js` - authored story data, deterministic unlock engine, migration and Story Codex UI.
- `dbz-v6-story.css` - responsive story, character, relationship and Training Journal presentation.
- `dbz-v6-storage.js` - IndexedDB saves, snapshots, fallback and schema validation.
- `dbz-v6-enhancements.js` - Today view, readiness, mobile navigation and safety helpers.
- `dbz-v6.css` and `dbz-v6.js` - generated base styles and legacy-compatible runtime.
- `dbz-v6-overrides.css` - maintained responsive v6 presentation layer.
- `analysis/build_v6_from_mobile.mjs` - reproducible generator and progression hook installer.
- `analysis/v6_tim_plan_fixture.mjs` - shared deterministic Tim-plan fixture.
- `analysis/v6_race_simulator.mjs` - real-config weekly parity simulator.
- `tests/*.test.mjs` - release integrity, balance, persistence and build tests.

Do not edit generated `dbz-v6.js` or `dbz-v6.css` directly. Change the builder or maintained modules, then run:

```powershell
node analysis/build_v6_from_mobile.mjs
node analysis/v6_race_simulator.mjs
node --test tests/*.test.mjs
```

## Power and race routes

`Effective PL = linear Base Fitness PL x primary transformation or highest earned fixed race tier`

The canonical bands are 1x, 3x, 10x, 20x, 50x, 100x, 400x, 800x, 1,000x, 2,000x, 3,500x, 10,000x, 50,000x and 80,000x. Every tier is fixed; no calculation reads the next opponent and manufactures a matching multiplier. Support quality from primary-state mastery, developed abilities, active partners and race resources determines breakthrough readiness without redefining the reward.

Playable routes are Earthling, Saiyan, Hybrid, Namekian, Infinite Energy Android, Bio-Android, Majin and Frieza Race. Android paths are distinct: Infinite Energy uses reactor/frame mastery, while Bio-Android uses adaptation templates. Majin Absorption Cores and Bio-Android templates copy one deterministic bounded trait, have three slots, never destroy partner levels and prevent active-team double-dipping. Every route has a native finale answer; Ultra Instinct and Ultra Ego are optional explicit Divine Discipline branches.

Race selection locks after meaningful training. A different route should use another character. Cross-race discoveries remain in save history but are dormant, cannot be equipped and cannot satisfy mastery or collection progress.

## Saves and migration

Primary saves use IndexedDB with three rolling recovery snapshots and a localStorage fallback. Schema-33 migration preserves workouts, stats, completed sagas, currency, discoveries and legitimate mastery; it also compacts old duplicated story prose into ID/timestamp/read receipts and moves partner milestones into the Training Journal. Migration remains idempotent and does not grant unearned resolution or mastery chapters.

Imports are bounded to 10 MB and validated for depth, collection sizes, finite numbers, dates, IDs, route choices and three-slot core/template caps. Export before moving between devices or browsers.

## Fitness safety and offline use

Normal rest does not permanently erase stats. The Today view uses readiness, a 14-day no-training grace period and a flexible three-day weekly consistency target. Optional illness, injury, deload, RPE, RIR and notes are stored with workouts. This is a motivation game, not medical advice; stop or adapt for pain, illness, unsafe technique or professional guidance.

`manifest-v6.webmanifest` and `dbz-sw-v6.0.js` cache the shell, story libraries, icons, route UI and featured art. Navigation is network-first with an offline entry fallback; larger images use stale-while-revalidate. Versioned browser requests resolve against the unversioned shell cache for reliable cold-offline startup. The service-worker cache is versioned to build 6.4.0-20260803.5.

## Visual system

The route panel combines the existing original v6 race portraits with code-native accessible band badges, route colours and reduced-motion effects. `images/v6/race_route_backdrop.webp` is an original shared cosmic training-route illustration generated for v6.3 and optimized to 174 KB WebP. It contains no franchise character, emblem, logo or text. The full prompt and generation mode are recorded in `CHANGELOG_v6.md`.
