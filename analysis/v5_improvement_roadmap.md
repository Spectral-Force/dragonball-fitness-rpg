# Dragon Ball Fitness RPG v5 Improvement Roadmap

Saved: 2026-07-24

Status: Implemented by the canonical v6.0 release. This file remains the original acceptance roadmap; completion evidence is recorded in `v6_release_audit.md`.

## Product Direction

Preserve the game's unusually broad fitness-RPG systems while making one canonical build reliable enough for a multi-year campaign.

The intended progression direction is:

- The main story can be cleared in approximately three years by following the base Tim exercise plan consistently and making near-optimal use of partners, abilities, transformations, race mechanics, wishes, training upgrades, and other unlock systems.
- Raw exercise stats provide slow, durable base growth.
- Anime-scale exponential jumps come from unlocked and levelled game systems rather than an exponential base-stat-to-power formula.
- Transformations can be equipped to cross saga thresholds.
- Races without conventional Saiyan-style transformations receive equivalent progression routes such as absorption, fusion, assimilation, potential unlocks, artificial upgrades, regeneration mastery, or other race-specific systems.
- Clearing the story is not the end of progression. Saga mastery, transformation mastery, collection completion, rival play, prestige goals, and uncapped post-story growth can continue beyond the three-year target.

## Phase 0 — Canonical Source and Release Discipline

- Choose one canonical editable source for v5.
- Reconcile the current `DragonBall_Fitness_RPG_v5.0.html` with the separately documented Mobile v5 progression implementation.
- Mark superseded files and documents clearly so future work cannot land in the wrong version.
- Replace the stale v4.9 README with current v5 mechanics and save schema documentation.
- Keep old generated HTML releases in an archive or version-control releases rather than treating them as editable source.
- Add a changelog and a generated build/version identifier visible in the game.

### Completion Criteria

- There is one documented source of truth.
- The game, README, service worker, manifest, balance workbook, and save schema report the same version.
- A developer or AI can identify the correct editable source without inference.

## Phase 1 — v5.0.1 Stabilisation

### Mobile and Interaction

- Remove the global 880px minimum page width.
- Rebuild the layout from a 360–390px mobile baseline.
- Replace the two-row desktop tab bar on mobile with a compact primary navigation and overflow menu.
- Make workout logging, today's plan, recovery state, and current saga reachable without horizontal scrolling.
- Replace blocking `alert()` completion messages with an in-game reward summary and notifications.

### Offline/PWA

- Correct the service-worker application shell.
- Cache the actual current HTML entry and the real PNG/WebP assets.
- Remove references to missing `index.html` and Dragon Ball SVG files.
- Provide a working navigation fallback.
- Test clean install, refresh, update, offline launch, and cache replacement.

### Persistence and Import Safety

- Move the main save from one `localStorage` JSON value to IndexedDB.
- Retain small settings and a save pointer in localStorage if helpful.
- Add transactional saves, rolling recovery snapshots, quota-error handling, and visible save status.
- Validate imported saves with a versioned schema before replacing active state.
- Validate file size, object shape, IDs, dates, and numeric ranges.
- Escape all imported and player-created text before inserting it into HTML.
- Add a compact-history/archive strategy suitable for at least five years of play.

### Data and Presentation Fixes

- Remove or clearly label duplicate benchmark characters in the goal database.
- Replace raw internal saga IDs with display names.
- Make Dragon Ball descriptions show effective race-adjusted requirements.
- Make ability buttons name missing AP/requirements instead of saying both "Requirements met" and "Locked".
- Standardise AP, TP, TXP, Story XP, Focus XP, PL, and God PL terminology.
- Fix compact-number formatting such as `1000K` and `1000M`.
- Add plausible-range warnings and undo for accidentally extreme workout inputs.

### Completion Criteria

- No page-level horizontal overflow at 360, 390, 768, 1280, or 1920px.
- A clean browser profile can install and launch the game offline.
- A simulated five-year save does not approach the active storage limit.
- Malformed imports cannot replace the active save.
- The core create-character and complete-workout flows contain no blocking browser dialogs.

## Phase 2 — v5.1 Progression and Power Rebalance

- Replace exponential raw base PL with a flat or gently piecewise base fitness-power formula.
- Target approximately 156 weeks for an optimal Tim-plan player to clear the main story.
- Keep raw training substantially slower than the target when unlock systems are ignored.
- Build exponential escalation through equipped transformations, levelled partners, levelled abilities, training branches, wishes, saga resonance, and race mechanics.
- Use one named and consistently displayed effective-PL formula for saga checks.
- Permit an equipped transformation or race-equivalent state to cross the next saga threshold.
- Reorder Daima to the agreed chronology between Kid Buu and Beerus.
- Implement transformation mastery and race-equivalent mastery systems.
- Apply era pacing/soft-cap controls to boost accumulation rather than silently inflating base PL.
- Rebalance Story XP and saga focus so they support the three-year curve without acting as arbitrary waiting timers.
- Provide a recalculation preview and migration route for existing saves.

### Required Balance Simulations

- Training patterns: light, standard, Tim-plan consistent, and optimised.
- Attendance: uninterrupted, normal missed weeks, deloads, illness/holiday gaps.
- Races: Earthling/Human, Saiyan, Half-Saiyan, Namekian, Android, Frieza Race, and Majin/Cell-Buu-style absorption paths as supported by the final race list.
- Builds: minimal unlock use, sensible casual loadout, optimal loadout, and deliberately exploitative stacking.
- Sensitivity: input typo/outlier, maximum partners, maximum abilities, all wishes, highest form, and post-story uncapped growth.

### Completion Criteria

- The optimal Tim-plan route clears the final story saga near week 156 within an agreed tolerance.
- A sensible non-optimal route still progresses but takes longer.
- Raw base training without major unlock mechanics does not clear the story near the optimal target.
- Every race has at least one understandable and competitive route through every saga.
- No race depends on borrowing a transformation it cannot canonically access.
- No partner, ability, wish, or single race mechanic can trivialise multiple eras by itself.
- Existing saves migrate deterministically and receive a clear before/after preview.

## Phase 3 — v5.2 Fitness, Recovery, and UX

- Replace permanent short-gap stat decay with temporary readiness, rust, or recovery pressure.
- Give logged rest and deload weeks meaningful protection.
- Use meaningful sessions and training quality rather than sheer exercise count for weekly fitness goals.
- Add optional RPE/RIR, readiness, illness, injury, and deload inputs.
- Replace daily-only streak pressure with flexible weekly consistency goals.
- Redesign the dashboard around Today, Next Workout, Current Saga, Recovery, and the next important unlock.
- Add estimated weeks to unlock based on recent training.
- Make achievements, partners, abilities, forms, and goals searchable and virtualised.
- Add accessible modal semantics, focus management, keyboard navigation, reduced motion, contrast improvements, and named icon controls.

### Completion Criteria

- The game rewards sustainable consistency without penalising normal recovery behaviour.
- A player can identify today's useful action within a few seconds.
- All essential flows are keyboard and screen-reader operable.

## Phase 4 — v5.3 Visual Remaster and Asset Pipeline

- Replace the partner portraits already identified as poor, incorrect, text-heavy, or inconsistently cropped.
- Create a coherent original race-avatar system.
- Add reusable transformation aura, lightning, glow, and particle layers.
- Build a consistent family-based ability icon system.
- Redesign saga banners around original silhouettes and environmental motifs.
- Add lightweight reward, scouter, capsule, Dragon Ball, and transformation-rank animations.
- Externalise assets behind a generated hashed manifest.
- Use correctly sized WebP/AVIF thumbnails and lazy loading.
- Remove email-page artifacts and other non-runtime files from release packages.
- Keep an optional generated single-file build only as a distribution format, not the editable source.

### Completion Criteria

- Character/partner cards use consistent crops and visual language.
- Artwork remains legible behind all card text.
- The initial mobile payload and decoded image memory are substantially reduced.
- A public-facing build can use an original, coherent anime-inspired identity.

## Test and Release Gates

Every future release should cover:

- Character creation and race starting state.
- Workout preview, completion, undo, editing, and recalculation.
- Planner presets and template import/export.
- Save migration, export, import, backup recovery, and storage stress.
- Saga unlock, clear, mastery, and chronology.
- Partner, ability, transformation, and race-mechanic loadouts.
- Dragon Ball progress and wishes.
- Responsive layout and keyboard accessibility.
- Clean PWA install, update, and offline launch.
- Automated progression snapshots for every supported race and training pattern.

## Current Recommended Build Order

1. Establish the canonical source.
2. Complete v5.0.1 stabilisation.
3. Lock the three-year progression model and its simulation acceptance criteria.
4. Implement and migrate the progression engine.
5. Redesign recovery and mobile UX.
6. Produce the visual remaster and optimised asset pipeline.
