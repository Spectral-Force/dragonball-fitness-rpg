# Dragon Ball Fitness RPG v6 Changelog

## v6.4 - build 6.4.0-20260803.7

### Complete story campaign

- Replaced three bespoke saga packs and 105 generic fallback beats with 278 authored chapters across all 38 sagas: DB 63, DBZ 126, Daima 23 and DBS 66.
- Added 20 canon-core character arcs with five beats each and 20 game-original two-part relationship interludes using only real roster IDs.
- Labelled canon-core, anime-only, Daima, Super anime and Super manga continuity and source scope per saga pack.
- Added Story, Character lens and Your chapter presentation, spoiler-safe locked cards, read receipts and Current Saga, Unread, Saga Archive, Characters, Relationships, Training Journal and All filters.

### Progression and save integrity

- Replaced ratio-only story checks with exact saga unlock rules: entry requires unlock, development and preclimax use Focus thresholds, resolution requires clear, and mastery requires mastery.
- Fixed the dashboard so it never borrows an unrelated saga's latest story.
- Added schema-33 idempotent story migration with compact ID/timestamp/read receipts; duplicated prose is no longer stored in saves.
- Preserved one immutable raw pre-schema-33 recovery snapshot before any story migration, even when an older legacy backup already exists.
- Added a Legacy History Codex view so unmapped historical receipts remain visible and mapped character receipts retain their read state.
- Moved generated partner milestone notes into a separate compact Training Journal while preserving partner development.
- Added deterministic legacy mappings for the original nine bespoke entries without allowing legacy data to grant unearned resolution or mastery.

### Interface, offline and QA

- Added desktop Story navigation and a mobile Story Codex item in More while retaining Saga on the primary bottom bar.
- Raised active modals above the mobile navigation so first-run setup and other modal actions remain reachable.
- Added the story data, engine, UI and CSS to the offline application shell and advanced its cache to build 6.4.0-20260803.7.
- Made cache lookup ignore version query strings so the versioned browser shell starts correctly from the unversioned offline cache.
- Added a cache-bypassing, build-versioned service-worker bootstrap that automatically refreshes a returning browser once when a new release takes control.
- Made scripts, styles and the manifest network-first while online, updating both canonical and versioned cache keys so a non-atomic Pages deployment cannot strand an old runtime beneath new HTML.
- Added schema, unlock, migration, content, roster, continuity and regression tests. Release result: 67/67 automated tests pass, 38/38 saga packs validate, 496 production narrative IDs are unique and browser QA reports no console warnings or errors.

## v6.3 - build 6.3.0-20260803.1

### Progression integrity

- Replaced target-following race normalization with one canonical saga table and fixed 1x-80,000x state bands.
- Added one authoritative race/path permission engine to automatic unlock, manual unlock, primary and echo equipment, save normalization, collections and story power.
- Made story Effective PL use only the sanitized primary state or highest earned fixed route tier; echo slots remain training-only.
- Locked a character's race after meaningful training while preserving wrong-race discoveries as dormant history.
- Excluded Base and unrelated transformations from route mastery readiness.
- Made Granolah's finale breakthrough available at week 153 and its clear gate at week 156.

### Complete native routes

- Added native Earthling, Saiyan, Hybrid, Namekian, Majin and Frieza Race ladders across every campaign band.
- Split Android into Infinite Energy reactor/frame progression and Bio-Android adaptation-template progression.
- Added explicit Namekian branch, Android path and optional Divine Discipline choices with lock-safe UI.
- Replaced destructive/random absorption with deterministic three-slot Majin Absorption Cores and Bio-Android Adaptation Templates. Each copies one bounded trait, preserves partner levels and prevents active-team double-dipping.
- Added the Race Path panel with Base and Effective PL separation, current and next fixed tiers, blockers, support-quality breakdown and finale projection.

### Saves, tests and validation

- Bumped saves to schema 32 with idempotent migration, invalid-equipment repair and a migration receipt.
- Added a shared Tim-plan fixture and a deterministic real-config race simulator.
- Added permission, primary-only power, absorption and route-parity tests alongside the existing build, balance and persistence suites.
- Acceptance result: optimal week 156 for all eight routes (0-week spread), sensible week 200 and casual week 279. A no-RPG profile stalls instead of receiving free opponent scaling.

### Artwork and interface

- Added `images/v6/race_route_backdrop.webp`, a 174 KB shared route backdrop used behind each route's own portrait, colour and accessible tier rail.
  - Tool/mode: OpenAI image generation, built-in generation mode; mechanically optimized to WebP with FFmpeg.
  - Full prompt: "Create a polished original wide background illustration for a mobile-first fitness role-playing game's Race Path progression panel. An unoccupied cosmic training arena on a distant rocky plateau, with eight abstract luminous energy trails arriving from different directions and converging toward a far golden horizon. Use warm orange, electric cyan, verdant green, violet, crimson, white-gold, magenta and deep blue; no characters, species, franchise symbols or recognizable IP. Wide landscape with horizon in the upper third, a calm low-detail center for dark translucent UI cards and white text, premium original anime-inspired sci-fi environmental concept art, deep navy space and warm sunrise rim light. No people, creatures, text, letters, numbers, logos, watermark, copyrighted emblems or UI frame."
- Added responsive wrapping rails, 44px controls, semantic status labels, visible text alternatives and reduced-motion-safe code-native badges/effects.

## v6.0 — build 6.0.0-20260724.10

### Campaign and balance

- Changed the main-story target from the inherited 208-week curve to 156 weeks.
- Reordered Daima between Kid Buu and Beerus.
- Replaced exponential raw-stat PL with a linear weighted base.
- Recomputed every saga base/effective threshold on the three-year curve.
- Rebalanced transformation and ability stat gates against their target saga.
- Added the named Effective PL formula and route-aware dashboard projections.
- Added transformation mastery ranks G through Super.
- Added competitive Earthling, Saiyan, Hybrid, Namekian, Android, Frieza Race and Majin power routes.
- Added late-game Android and Majin absorption requirements as transformation-equivalent progression.
- Removed direct partner multiplication of displayed PL.
- Added bounded boost buckets and era soft caps; post-story growth is uncapped.
- Added deterministic balance simulations for training patterns, gaps, seven races and exploit stacking.

### Fitness and UX

- Added a Today-first dashboard with next workout, readiness, weekly consistency, saga target and estimated weeks.
- Removed permanent inactivity decay; added a 14-day grace period and readiness pressure.
- Added optional RPE, RIR, illness, injury, deload and session notes.
- Replaced blocking completion alerts with in-game toasts.
- Added mobile bottom navigation and an overflow menu.
- Added search and browser-level card virtualization for partners, abilities, transformations and achievements, plus type-to-find goal benchmarks.
- Added outlier limits, warnings and Undo for workout inputs.
- Improved modal roles, focus trapping, keyboard behavior, touch targets, contrast and reduced-motion handling.
- Added actionable missing-requirement text to locked abilities.
- Fixed raw saga IDs, race-adjusted Dragon Ball labels, compact number formatting and duplicate goal rows.

### Persistence and offline use

- Moved primary saves to IndexedDB.
- Added transactional writes, a rolling three-snapshot recovery history, a fallback store and visible save status.
- Added a 10 MB, schema-aware and range-bounded import validator.
- Fixed an inherited asynchronous startup race that could render defaults over a valid save.
- Added deterministic schema-31 migration and an in-game before/after recalculation receipt.
- Corrected the manifest, service-worker shell, update cache and offline navigation fallback.

### Build and artwork

- Reduced the entry HTML from about 51 MB to about 30 KB.
- Removed roughly 47.6 MB of embedded duplicate assets from the runtime build.
- Split configuration, persistence, runtime, enhancement and style layers.
- Added a reproducible migration builder and automated release tests.
- Added original hero artwork at `images/v6/v6_hero.webp`.
  - Tool/mode: OpenAI image generation, built-in generation mode.
  - Prompt summary: an original anime-inspired cosmic mountain and floating-island fitness journey, a lone trainee, seven colored energy paths representing the playable races, dramatic dawn light, no copyrighted characters, logos or text.
  - Source PNG retained at `images/v6/v6_hero_source.png`.
- Added a coherent v6-only seven-race avatar set under `images/v6/races/`, leaving every v5 portrait untouched.
  - Tool/mode: OpenAI image generation, built-in generation mode.
  - Prompt summary: one original seven-panel anime-inspired character-select sheet with consistent full-body framing and distinct Earthling, Saiyan, Hybrid, Namekian, Android, Frieza-race and Majin energy identities, no text, logos or existing characters.
  - Source PNG retained at `images/v6/v6_race_avatar_sheet_source.png`; the derived 600×750 WebP portraits use a lightweight blurred environment fill to preserve the complete silhouette on cards.
- Added family-coded ability badges, reusable transformation aura/lightning/glow layers, original saga environmental overlays and reward/scouter/capsule/Dragon Ball/rank micro-animations.
- Added `v6-asset-manifest.js`, generated with SHA-256 content hashes by the canonical builder.
- Prefer WebP/AVIF in the generated manifest and omit equivalent large PNG/JPEG source variants from the deployable runtime.
- Excluded review contact sheets, email-page artifacts and image-generation source files from the runtime asset map.
