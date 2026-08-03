# Dragon Ball Fitness RPG v6 — Comprehensive Race Progression Implementation Plan

Date: 2026-08-03
Input audit: `analysis/v6_race_progression_audit.md`
Target: a safe v6.1 progression rewrite followed by race-content and presentation releases.

## 1. Outcome

The completed system must satisfy five promises:

1. A player following the built-in Tim plan consistently, while developing a sensible optimal loadout, can finish the main campaign in approximately 156 weeks with **any race**.
2. Power comes from durable Base Fitness PL multiplied by a visible, earned transformation or fixed race tier. The calculation never borrows the multiplier of the next saga.
3. Every signature state needed for a saga can be earned during that saga **before its clear gate**.
4. Each race reaches the same broad timeline through a distinct mechanic, without borrowing invalid forms, switching races for bonuses, or exploiting level-1 partners.
5. Existing saves migrate without losing workouts, stats, completed sagas, earned currency or legitimate mastery.

This is not a single multiplier patch. It is a progression-integrity repair, a shared power-engine extraction, seven race-route implementations, and a new evidence-based balance gate.

## 2. Product decisions to lock

These decisions should be treated as requirements, not postponed until midway through implementation.

### 2.1 Campaign target

- The canonical optimal campaign remains **156 weeks**.
- `DBZ_V6_CONFIG.sagaTargetWeeks` remains the authoritative schedule.
- Saga state bands, Story XP, Focus XP, Base PL, Effective PL and God Power requirements must be generated from one combined saga progression table.
- The old 208-week values may remain only as historical comments or migration inputs, never as a second live dataset.

The current runtime remaps its saga rows onto the 156-week configuration, so it is not presently running a 208-week campaign. The problem is duplicate data and weak verification, not a confirmed live 208-week schedule.

### 2.2 Signature-form timing

- A form intended to clear a saga is earned through a **breakthrough inside that saga**.
- Saga entry exposes the breakthrough objective.
- Completing the breakthrough unlocks the state.
- Clearing the saga proves that the player can use the new state at the required power.
- Saga clear is not the prerequisite for the state needed to perform that clear.

Every transformation receives an explicit `unlockPhase`: `entry`, `breakthrough`, `clear`, or `postgame`. Combat-effect tags such as `god` must never determine unlock timing.

### 2.3 Race permanence

- Race selection is free until the first meaningful workout.
- The first meaningful workout records `raceLockedAt` and locks that character's race.
- Players use the existing multi-character system to experience other races.
- A future respec may be designed separately, but it must be a complete transaction that clears incompatible forms, race resources and loadouts. It is not part of the initial repair.

### 2.4 Transformation ownership

- `discoveredTransformations` may contain historical or cross-race discoveries.
- `usableTransformations` is always derived from current race, route choice, saga phase and requirements.
- Only usable transformations can be equipped, affect PL/God PL, earn active mastery or satisfy collections.
- Existing wrong-race ownership is preserved as dormant discovery history rather than destructively deleted.

This closes the exploit without pretending the old save never contained the record.

### 2.5 Story power and echo slots

- Only the **primary** transformation or race state supplies the story multiplier.
- Echo slots retain their advertised 35%, 20%, 14%, 10%, 7% and 5% training-effect weights.
- Echoes never supply raw PL, God PL, route eligibility or breakthrough qualification.
- If the primary becomes invalid, it falls back to Base immediately and visibly.

### 2.6 Level requirements

- Base PL, saga breakthrough, race resource and state mastery are the primary hard gates.
- Player level becomes a recommended milestone or a modest supporting requirement calibrated to the simulator's median.
- No transformation may be hard-blocked by a level that the optimal Tim-plan simulation does not reach with at least a 10% margin.
- Existing high legacy levels may remain as postgame mastery recommendations.

### 2.7 Shared divine techniques

- Ultra Instinct and Ultra Ego become explicit optional **Divine Discipline** branches rather than a hidden race-filter exception.
- Each discipline has an explicit allowed-race list and prerequisites.
- A race's native finale route must remain competitive without taking a shared discipline.
- Instinct and Ego are alternatives, not automatic upgrades every optimized character collects.

### 2.8 Android identity

Android receives an early path choice:

- **Infinite Energy Android:** reactor, battery, frame and overclock progression; no biological absorption.
- **Bio-Android:** adaptation templates, scans and evolution states.

Existing Android saves migrate provisionally to Bio-Android because that best preserves the current Cell-form/absorption route. They receive one free path choice before their first post-migration workout.

### 2.9 Absorption semantics

Partners are not deleted. Partner levels represent real training history and should not be destroyed for a story mechanic.

- Majin uses **Absorption Cores** that copy one bounded trait.
- Bio-Android uses **Adaptation Templates** that scan one bounded trait.
- The source partner may remain owned, but it cannot provide the same equipped trait while that copied trait is active.
- Route credit depends on quality and mastery, not the number of partner IDs.
- No random failure removes partner levels.
- Permanent choices always receive a preview and confirmation.

## 3. Target architecture

The current main runtime is generated. Direct edits to `dbz-v6.js` are not durable. The new progression engine must live in hand-maintained files and be callable from both the generated browser runtime and Node tests.

### 3.1 New hand-maintained files

#### `dbz-v6-progression-config.js`

Contains data only:

- combined saga schedule and state bands;
- race route definitions;
- transformation permissions;
- explicit unlock phases;
- fixed race tiers;
- race resource thresholds;
- divine discipline permissions;
- migration aliases and version numbers.

It installs `globalThis.DBZ_V6_PROGRESSION_CONFIG` and is safe to load in Node.

#### `dbz-v6-progression-core.js`

Pure or context-driven functions:

- `normalizeRaceKey`;
- `isTransformationUsable`;
- `getUsableTransformationIds`;
- `sanitizePrimaryState`;
- `getPrimaryStateMultiplier`;
- `getRaceTierStatus`;
- `calculateRaceTierMultiplier`;
- `calculateEffectivePower`;
- `calculateGodPowerRoute`;
- `getBreakthroughStatus`;
- `getSupportQuality`;
- `calculateAbsorptionQuality`;
- `getNextRaceMilestone`.

It installs `globalThis.DBZ_V6_PROGRESSION`. All functions accept explicit data/context so the same code can be run in Node.

#### `dbz-v6-race-ui.js`

Browser integration and presentation:

- Race Path panel;
- breakthrough objective panel;
- support-quality explanation;
- Android path choice;
- Majin core and Bio-Android template management;
- confirmation dialogs;
- migration receipt additions.

It must not contain balance formulas; it renders results from the progression core.

#### `analysis/v6_race_simulator.mjs`

Runs the actual progression configuration and core across weekly player profiles. It replaces the declared `competitive: true` matrix.

#### `analysis/v6_tim_plan_fixture.mjs`

Moves or mirrors the built-in Tim four-week plan as a shared deterministic fixture. Runtime and simulation must derive expected sessions from the same plan data.

### 3.2 Existing files to change

#### `analysis/build_v6_from_mobile.mjs`

- Remains the generator for legacy/base runtime and CSS.
- Stops embedding new race-balance formulas as large string replacements.
- Adds the new script tags in deterministic order.
- Rewrites the small number of generated runtime call sites to delegate to `DBZ_V6_PROGRESSION`.
- Fails the build if required hook points are missing.
- Emits the new build ID consistently into HTML, service worker and documentation.

#### `dbz-v6-config.js`

- Retains global version, schema, Base PL curve, input limits and recovery.
- Removes hand-authored “race parity” declarations once the new config is authoritative.
- Exports campaign duration to the progression config without duplicate week tables.

#### `dbz-v6-storage.js`

- Bumps schema from 31 to 32.
- Validates new race-progression state, route IDs, core slots and breakthrough records.
- Adds an idempotent schema-32 migration.
- Preserves a migration receipt and dormant legacy data.

#### `dbz-v6-enhancements.js`

- Adds projected finale week and race-path information to Today/diagnostics.
- Adds accessible confirmation/focus behavior for race choices and absorption/template changes.

#### Generated `dbz-v6.js`

Must only change through the builder. Required delegated call sites include:

- auto-unlock;
- manual unlock status;
- both equip paths;
- active/primary transformation;
- story PL and God PL;
- collections/achievements;
- saga breakthrough checks;
- race switching/locking;
- absorption effects.

## 4. Release sequence

The work should ship in four controlled releases. The phases are dependency-ordered; race tuning before integrity repair would produce impressive spreadsheets about invalid states.

## Release A — v6.0.11 integrity hotfix

Purpose: close exploitable/broken paths without yet replacing every race route.

### A1. Race validation everywhere

Implement one authoritative permission call and use it at:

- automatic transformation unlock;
- manual transformation unlock;
- transformation status calculation;
- primary equip;
- echo equip;
- save normalization;
- active transformation selection;
- story PL and God PL;
- transformation collection progress;
- transformation achievements.

Invalid usable state must fall back to Base. Wrong-race discoveries may remain recorded but dormant.

### A2. Primary-only story power

- Change `getV6EquippedState` to obtain the sanitized primary ID only.
- Never sort all raw slots to find the largest multiplier.
- Confirm echo effects still use their documented weights for training.

### A3. Lock race after training

- Add `raceLockedAt`.
- Disable the dashboard race picker when the character has meaningful progress.
- Explain that another character can be created for another race.
- Sanitize race state during migration and before every save.

### A4. Repair mastery readiness

- Exclude Base.
- Require C rank on the qualifying primary race state.
- Do not count an arbitrary mastered transformation.
- Display the exact mastery state used.

### A5. Contain absorption damage

Before the full redesign:

- add a confirmation dialog;
- remove Android's 25% partner-level loss;
- prevent an absorbed partner from also contributing the copied portion while active;
- cap route-relevant absorptions at three;
- mark the current system “Legacy Absorption” in the save model;
- retain cooldowns only for compatibility, not as a permanent design commitment.

### A6. Hotfix tests

Add failing tests before implementation:

- every race × every transformation permission;
- auto-unlock cannot create usable wrong-race forms;
- both equip paths reject invalid forms;
- raw invalid save equipment cannot change PL/God PL after normalization;
- echo multiplier cannot change story PL;
- Base mastery cannot satisfy race readiness;
- switching a trained character's race is rejected;
- collections ignore unusable forms;
- Legacy Absorption no longer destroys partner levels or double-dips.

### Release A gate

- No known alternate path can apply a wrong-race or echo multiplier.
- Existing tests and new integrity tests pass.
- A contaminated schema-31 fixture loads safely and receives a repair receipt.
- Existing saga completion and currency remain untouched.

## Release B — v6.1 progression foundation

Purpose: replace target-following normalization and establish testable fixed routes.

### B1. Canonical saga/state-band table

Create one row per saga containing:

- `id`;
- `targetWeek`;
- `baseEndPL` derived from the Base PL curve;
- `stateBandId`;
- `stateMultiplier`;
- Story XP unlock/clear values;
- Focus XP values;
- God Power requirements;
- breakthrough IDs available during the saga.

All runtime and analytical consumers use this table. Add a test that the live Granolah row equals week 156.

### B2. Fixed tier engine

Replace:

`race multiplier = next saga target × readiness coefficient`

with:

`effective multiplier = max(primary form multiplier, highest earned fixed race tier)`

Rules:

- fixed tiers never inspect the next saga's multiplier;
- an earned tier has its own fixed multiplier and requirements;
- support quality helps earn/master a tier but cannot redefine its number;
- catch-up smoothing, if retained, is capped at 10–15% of the fixed tier and can never cross into the next band.

### B3. Breakthrough system

Each breakthrough contains:

- saga and phase;
- Base PL percentage of the saga target;
- one or two route-appropriate stat requirements;
- primary-state mastery requirement;
- race resource requirement;
- Focus XP requirement;
- explicit reward state/tier;
- explanatory story text.

Breakthroughs unlock at saga entry and can complete before clear. The saga screen shows them alongside Story XP and Effective PL.

### B4. Support quality

Use a 0–100 score:

- 35 points: primary-state mastery, from G to Super;
- 25 points: equipped ability development, weighted by ability levels and relevant tags;
- 20 points: active partner development, weighted by level/bond and relevant tags;
- 20 points: race resource/mechanic development.

Safeguards:

- level-1 slot fillers earn little credit;
- only the primary state supplies mastery credit;
- irrelevant abilities/partners receive reduced credit, not zero, to preserve player choice;
- the Race Path UI shows each component.

### B5. Level and God Ki calibration

- Run the shared Tim-plan fixture through the real TXP multipliers and purchase strategy.
- Calculate median player level at every signature saga.
- Replace hard legacy level requirements with `recommendedLevel` initially.
- Model God Ki from Beerus onward and derive normalized state requirements from weeks 120–156.
- Add native God Power equivalence for every race; normal route PL does not silently satisfy God Power.

### Release B gate

- No power calculation reads the next uncleared saga.
- Every state multiplier is fixed and displayed.
- Every saga's assumed state is obtainable through a breakthrough before clear.
- The simulator can produce a full weekly trace for all seven races.

## Release C — v6.2 race mechanics

Purpose: make every route distinct, complete and fun rather than merely numerically legal.

### C1. Shared state-band contract

All routes must answer these bands. Names and mechanics differ; timeline obligations do not.

| Band | Multiplier | Target week/era |
|---|---:|---|
| Base | 1x | weeks 0–29 |
| First Break | 3x | Vegeta, week 33 |
| Surge | 10x | Namek, week 39 |
| Mastered Surge | 20x | Ginyu, week 45 |
| Z State | 50x | Frieza, week 51 |
| Evolved Z | 100x | Cell Games, week 78 |
| Ultimate Mortal | 400x | Buu, week 97 |
| Ascendant Mortal | 800x | Daima True, week 116 |
| Divine | 1,000x | Beerus, week 120 |
| Divine Mastery | 2,000x | Golden Frieza, week 125 |
| Transcendent | 3,500x | Future Trunks, week 138 |
| Tournament Apex | 10,000x | Universe Survival, week 144 |
| Cosmic Mastery | 50,000x | Galactic Patrol, week 150 |
| Finale | 80,000x | Granolah, week 156 |

An iconic form may exceed a band, but it must pay for the overshoot through stricter mastery, narrower stat emphasis or a recovery/sustain tradeoff.

### C2. Saiyan route

| Band | Route answer |
|---|---|
| 3x | Kaioken x3 breakthrough during Vegeta |
| 10x | Kaioken x10 or controlled Great Ape during Namek |
| 20x | Kaioken x20 mastery during Ginyu |
| 50x | Super Saiyan breakthrough during Frieza |
| 100x | Super Saiyan 2 during Cell Games |
| 400x | Super Saiyan 3 during Buu |
| 800x | Primal/SS4 or Daima ascendant branch |
| 1,000x | Super Saiyan God during Beerus |
| 2,000x | Super Saiyan Blue during Golden Frieza |
| 3,500x | Rage, Rosé or Blue Evolved specialization |
| 10,000x | UI Sign, Legendary or equivalent branch |
| 50,000x | Mastered UI, Blue/Kaioken mastery or Ego mastery |
| 80,000x | True Instinct, perfected Ego or equivalent finale mastery |

Additional rules:

- Great Ape requires an optional Tail origin and Control mastery; it is never mandatory.
- Kaioken adds recovery strain.
- bulky Super Saiyan grades trade Agility/Endurance for Strength.
- SS3 has a sustain cost until mastered.
- late branches are side-grades with different stat profiles, not one numeric ladder.

### C3. Earthling route

Earthling progression is a fixed technique/potential ladder:

| Band | Route answer |
|---|---|
| 3–10x | Full Potential and optional Kaioken |
| 20x | Potential Unlocked |
| 50–100x | Human Limit Break / Master Martial State |
| 400–800x | Ultimate Human / Earthborn Ascendant |
| 1,000–2,000x | Divine Technique and God Ki Control |
| 3,500–10,000x | Perfected Instinct discipline or native Technique Apex |
| 50,000–80,000x | Earthborn Mastery finale tiers |

Requirements emphasize Technique, ability mastery, relevant partner bonds and consistent mixed training. Earthling's stronger economy remains, but multiplicative race bonuses should be re-audited so they do not make it the universal optimizer.

### C4. Half-Saiyan route

Two branches share progression:

- **Saiyan Heritage:** classic Super Saiyan states.
- **Human Potential:** latent rage, Potential Unlocked, Ultimate and Beast.

Rules:

- Great Ape only with the Tail origin.
- inherited Saiyan states and native Hybrid states both count when explicitly listed in the route config;
- Super Saiyan Rage is classified as a valid Hybrid rage state;
- SS2 Rage serves the Cell band;
- Potential Unlocked/Ultimate serves Buu–Daima;
- Beast Omen, Beast Awakened and Beast mastery serve 10,000x, 50,000x and the finale;
- full Beast is earned during Granolah, before clear.

### C5. Namekian route

Implement **Assimilation Insight** and three branches:

- Warrior Clan: Strength, Endurance and martial focus;
- Dragon Clan: Spirit, Technique, vitality and Dragon Ball focus;
- Balanced Fusion: slower specialization but broader support.

Fixed milestones:

- Giant/Power Expansion before the first 3–10x gates;
- Namekian Power and Warrior Fusion for 10–50x;
- Super Namekian for 100x;
- Potential Awakened and Dragon Ascendant for 400–800x;
- Orange before/within Beerus for 1,000x;
- controlled Orange for 2,000–10,000x;
- Orange Mastery/Dragon Awakening for 50,000–80,000x.

Assimilation is a permanent tree choice earned through Namekian partner bonds and saga breakthroughs. It does not delete partners. Warrior Fusion should be modeled as a permanent tier/node rather than an ordinary removable costume.

### C6. Infinite Energy Android route

Fixed resource: **Reactor Charge** plus **Frame Mastery**.

Milestones:

- Reactor Overclock: 3x;
- Infinite Drive: 10–20x;
- Combat Frame: 50x;
- Limitless Battery: 100x;
- Perfect Overclock: 400x;
- Ascendant Core: 800x;
- Divine Reactor/God Engine: 1,000–2,000x;
- Quantum Engine: 3,500–10,000x;
- Cosmic/Limitless Core: 50,000–80,000x.

Implement the promised race identity as bounded reduced strain/faster readiness recovery, not literal immunity to fatigue or safe-training rules.

### C7. Bio-Android route

Fixed resources: up to three **Adaptation Templates** plus evolution mastery.

Template quality is based on:

- partner tier;
- partner level/bond;
- relevant trait strength;
- template mastery.

Milestones combine a minimum total template-quality score with fixed evolution states. A level-1 partner can contribute a small early template but cannot qualify a late tier.

- scan/adaptation supports 3–20x;
- Power Charge and evolved forms support 50–100x;
- Super Perfect/adaptive apex supports 400–800x;
- divine bio-core tiers support 1,000–10,000x;
- cosmic adaptation supports 50,000–80,000x.

There is no random partner-level loss. Template replacement has a visible cost and preview.

### C8. Majin route

Fixed resources: **Body Control**, **Regeneration Mastery** and three **Absorption Cores**.

- Body Control supplies the 3x route without requiring an early partner sacrifice.
- Regeneration Release supplies 10x.
- First core plus mastery supplies 20–50x.
- Core Fusion supplies 100x.
- Super/Pure Majin mastery supplies 400–800x.
- Divine Regeneration supplies 1,000–2,000x and a real God Power route.
- mastered core configurations supply 3,500–10,000x.
- Cosmic Regeneration/finale core mastery supplies 50,000–80,000x.

Each core copies one trait at a bounded percentage. The source partner cannot apply that same trait while the core is equipped. Cores can be refreshed or replaced, so early snapshots are not permanent traps.

### C9. Frieza Race route

Fixed resource: **Release Control**.

- Controlled Release supplies 3x before Vegeta clear.
- Second/Third release and 5% Final supply 10–20x before Namek/Ginyu clear.
- Final release states supply 50–240x.
- evolved/Cooler mastery supplies 400–800x.
- Golden supplies 1,000–2,000x.
- perfected/True Golden supplies 3,500–10,000x.
- Black and Black Mastery supply 50,000–80,000x during the finale.

Control mastery governs sustain and training efficiency. A low form never impersonates a later multiplier.

### Release C gate

- Each race has at least one native answer to every band.
- Every signature state is useful when unlocked.
- Shared disciplines never obsolete Orange, Beast, Black, Majin or Android finale paths.
- Optimal race spread at the finale is no more than six weeks.

## Release D — v6.3 UX, artwork and polish

Purpose: make the repaired mechanics understandable and rewarding.

### D1. Race Path UI

Add a horizontal/mobile-wrapping progression rail showing:

- current fixed tier and multiplier;
- next tier and target saga;
- completed/active/locked breakthroughs;
- primary state;
- mastery, support and race-resource contributions;
- Base PL and Effective PL separately;
- projected week relative to the target.

### D2. Transformation state language

Every card displays one of:

- Primary;
- Echo — training effects only;
- Usable;
- Discovered, wrong race/path;
- Breakthrough available;
- Locked, with exact blockers;
- Postgame.

The UI and automatic unlock engine use the same status function.

### D3. Permanent-choice safety

Absorption/template/assimilation dialogs show:

- source partner;
- exact copied trait and percentage;
- quality score and route contribution;
- what becomes mutually exclusive;
- replacement/refresh rules;
- confirmation text;
- Undo only where the operation is genuinely reversible.

### D4. Artwork package

Generate art only after route IDs and milestones are frozen.

Deliverables:

- one 1,024×512 route header per race/path;
- one 512×512 transparent icon/portrait for each new signature state;
- shared band badges at 3x, 10x, 20x, 50x, 100x, 400x, 800x, 1,000x, 2,000x, 3,500x, 10,000x, 50,000x and 80,000x;
- modular aura/overlay layers;
- Android circuit/template glyphs;
- Majin core trait glyphs;
- Namekian clan/fusion crests;
- Frieza release-control indicators;
- Saiyan branch icons;
- reduced-motion alternatives.

All player-route art should be original anime-inspired work rather than copied franchise characters or logos. Preserve source prompts and source images in the changelog/source asset folders; deploy optimized WebP/AVIF derivatives through the hashed manifest.

### D5. Mobile and accessibility

- Race rail becomes a swipeable or wrapping list without horizontal page overflow.
- 44px minimum interactive targets.
- full keyboard/focus support for route and confirmation dialogs;
- semantic progress labels and text alternatives for every visual tier;
- no information conveyed by aura color alone;
- all animation honors reduced motion.

## 5. Simulator and balance methodology

## 5.1 Profiles

Run at least:

- optimal Tim plan/loadout;
- sensible developed loadout;
- casual developed loadout;
- Tim plan with major RPG systems ignored;
- interruption variants: normal missed weeks, deloads, illness/holiday;
- exploit/adversarial profiles.

The optimal strategy must be explicit and reproducible: purchase order, active partners, ability levels, state mastery, race-resource decisions and breakthrough choices.

## 5.2 Weekly state

Each simulated week records:

- sessions completed from the Tim fixture;
- raw and modified TXP;
- stat gains by stat;
- Base PL;
- player level;
- Story XP and Focus XP;
- AP/TP earned and spent;
- ability levels/equipment;
- partners owned, active and leveled;
- primary transformation and mastery;
- race resource and tier;
- God Ki/God Power;
- saga unlock/clear/master status;
- blockers and stalled weeks.

## 5.3 Determinism and randomness

- Core parity runs are deterministic.
- If any random mechanic survives, run fixed seeds plus percentile reporting.
- No required progression may rely on a favorable random result.

## 5.4 Acceptance thresholds

### Timeline

- optimal finale per race: weeks 153–159;
- fastest-to-slowest optimal spread: ≤6 weeks;
- milestone gap versus Saiyan at Namek, Frieza, Cell, Buu, Beerus and finale: ≤3 weeks unless offset by an intentional earlier advantage;
- sensible route: approximately 180–210 weeks;
- casual route: approximately 240–300 weeks.

### Integrity

- zero wrong-race usable forms;
- zero echo-derived story PL;
- zero next-saga-derived route multipliers;
- zero level-1 absorption routes to late tiers;
- zero mandatory random stalls;
- every assumed clear state available before clear.

### Economy

- level and God Ki requirements have ≥10% median headroom on the optimal route;
- no single partner/ability is mandatory;
- at least three viable loadout families per race reach within five weeks of its optimum;
- no race-switch strategy beats a locked-race optimum because switching is unavailable.

### Fun/playability

- meaningful race milestone at least every 12–18 campaign weeks;
- no signature state is obsolete at unlock;
- permanent choices have preview and recovery/refresh rules;
- route status and next action are understandable without reading a formula document.

## 6. Test suite

Add the following files using Node's built-in test runner where possible.

### `tests/v6-race-permissions.test.mjs`

- full race × transformation matrix;
- shared discipline permissions;
- discovery versus usability;
- primary and echo equip rejection;
- collection/achievement filtering.

### `tests/v6-effective-power.test.mjs`

- primary-only state multiplier;
- fixed race tier selection;
- no next-saga dependency;
- Base PL separation;
- God Power route by race;
- invalid loadout fallback.

### `tests/v6-breakthrough-timing.test.mjs`

- every saga's required band has an obtainable pre-clear state;
- UI and engine unlock phases agree;
- signature forms unlock during, not after, their saga.

### `tests/v6-absorption.test.mjs`

- quality scoring;
- level-1 partner insufficiency;
- three-slot cap;
- source/copy mutual exclusion;
- refresh and replacement;
- no level loss;
- deterministic qualification.

### `tests/v6-race-migration.test.mjs`

- schema 31→32 idempotence;
- wrong-race equipped forms sanitized;
- dormant discovery/mastery preserved;
- saga completion and rewards preserved;
- Android provisional path choice;
- legacy absorption conversion;
- migration receipt.

### `tests/v6-race-parity.test.mjs`

- imports the real simulator;
- asserts timeline thresholds per profile and race;
- emits a readable trace on failure;
- contains no hard-coded `competitive: true` field.

### `tests/v6-generated-runtime.test.mjs`

- builds v6 from the legacy source;
- confirms required progression hooks exist exactly once;
- confirms no shadowed active implementation bypasses the core;
- verifies build output is deterministic.

### Browser smoke tests

Add a minimal browser harness for:

- new character and race lock;
- transformation status/equip;
- Race Path rendering on mobile and desktop;
- breakthrough completion;
- absorption/template confirmation;
- migration receipt;
- offline reload and save persistence.

## 7. Save migration plan

## 7.1 Schema-32 character shape

Add:

```text
raceProgression: {
  version,
  race,
  raceLockedAt,
  pathId,
  tierId,
  resourceState,
  breakthroughs,
  absorptionCores,
  adaptationTemplates,
  legacyDiscoveries,
  migrationGrace
}
```

Exact storage remains JSON-compatible and bounded by validator limits.

## 7.2 Migration rules

1. Normalize the current race alias and make it authoritative.
2. If workout history is non-empty, lock the race at the first meaningful workout date.
3. Preserve `unlockedTransformations` as discovery history.
4. Derive usable transformations from race permissions.
5. Remove invalid equipped/active forms and fall back to Base.
6. Preserve dormant mastery XP.
7. Preserve completed/mastered sagas monotonically; never relock cleared content.
8. Preserve all AP/TP and previously claimed rewards; do not claw back bug-derived currency.
9. Mark invalid collection claims as grandfathered so they cannot pay twice.
10. Convert existing Android characters to provisional Bio-Android with one free path choice.
11. Convert up to three strongest legacy absorption snapshots into provisional cores/templates; archive extras.
12. Allow migrated weak snapshots to be refreshed so early choices are not permanent traps.
13. Add a receipt explaining any visible PL, primary-form or route change.

## 7.3 Migration grace

If sanitation lowers Effective PL below the next uncleared saga:

- never undo a completed saga;
- grant a bounded `legacyBridge` equal to the highest legitimately achieved prior state band;
- the bridge applies only until the next corrected breakthrough is completed or for a capped number of meaningful workouts;
- it cannot advance beyond the previously reached saga band;
- it is visible in the migration receipt and Race Path.

This avoids stranding honest players without preserving the exploit indefinitely.

## 7.4 Rollback safety

- Preserve the pre-migration IndexedDB snapshot.
- Do not delete dormant fields for at least one full release.
- Export/import validator accepts schema 31 and migrates it transactionally.
- Migration is idempotent and produces identical results on repeated loads.

## 8. Observability and diagnostics

Add a local Balance Diagnostics export containing no private notes or raw exercise details unless explicitly requested:

- build/schema/progression versions;
- race/path/tier;
- campaign week;
- Base PL and Effective PL;
- primary state;
- support-quality breakdown;
- race resource;
- next breakthrough blockers;
- player level and God Power;
- projected finale week;
- stalled weeks by blocker category.

This allows tuning from real play without uploading personal fitness data.

## 9. Documentation updates

Update together with each release:

- `README.md` and `DragonBall_Fitness_RPG_v6_README.md`;
- `CHANGELOG_v6.md`;
- `analysis/v6_power_scaling_spec.md`;
- replace or retire `analysis/v6_balance_model.mjs`;
- migration notes;
- race route help text;
- Android path and absorption terminology;
- artwork prompt/source log;
- build and release instructions.

Remove claims such as “no transformation restrictions,” “no fatigue,” permanent Namekian assimilation, or comprehensive race simulation until the runtime actually implements them.

## 10. GitHub Pages release process

For every release candidate:

1. Run the canonical builder.
2. Run all Node tests and the browser smoke suite.
3. Run `git diff --check` and validate generated files are deterministic.
4. Test a clean new save for every race.
5. Test representative early, Cell/Buu, Beerus and finale saves.
6. Test a contaminated schema-31 migration.
7. Test mobile portrait/landscape and desktop.
8. Test offline reload and service-worker upgrade.
9. Bump build ID and service-worker cache.
10. Commit source and generated artifacts together.
11. Push only after the release gate passes.
12. Verify the deployed GitHub Pages build ID and one race-path interaction in the live site.

## 11. Definition of done

The race progression repair is complete only when:

- the browser and simulator use the same progression core and config;
- v6 rebuilds without direct edits to generated runtime files;
- all race-integrity paths are guarded;
- only a sanitized primary state supplies story PL/God PL;
- race is locked after meaningful progress;
- every race has fixed, visible tiers through 80,000x;
- no tier reads the next saga's multiplier;
- every signature state is earned before the clear that assumes it;
- absorption/template quality replaces ID count;
- Majin and every other race has a tested Super-era God Power route;
- optimal race finales fall between weeks 153 and 159 with ≤6 weeks total spread;
- sensible and casual routes remain viable at their longer targets;
- schema-31 saves migrate idempotently without lost workouts, stats, sagas or currency;
- Race Path, blockers and permanent choices are understandable and accessible on mobile and desktop;
- original optimized artwork is included only after mechanics and IDs are stable;
- the deployed GitHub Pages build is verified after push.

## 12. Execution order checklist

The recommended order is:

1. Write failing integrity and migration tests.
2. Build the hand-maintained progression config/core skeleton.
3. Route generated runtime calls through the core.
4. Ship the atomic integrity hotfix and schema sanitation.
5. Consolidate saga/state-band data.
6. Implement fixed tiers and breakthroughs.
7. Build the real Tim-plan simulator.
8. Calibrate levels and God Ki.
9. Implement Saiyan and Frieza timing fixes as reference routes.
10. Implement Majin and Bio-Android quality-based cores/templates.
11. Implement Namekian assimilation and Infinite Android.
12. Complete Earthling and Hybrid native late tiers.
13. Tune all races against the simulator.
14. Add Race Path UX and permanent-choice flows.
15. Freeze route IDs and generate artwork.
16. Run migration, browser, mobile, offline and parity release gates.
17. Build, commit, push and verify GitHub Pages.

This sequence deliberately solves integrity before balance, balance before decoration, and migration before deployment. That order is less glamorous than starting with glowing new forms, but considerably kinder to a three-year save.
