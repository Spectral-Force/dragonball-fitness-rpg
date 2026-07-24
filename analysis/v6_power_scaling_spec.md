# v6 Power Scaling Specification

## Decision

The campaign is designed around a 156-week optimal route, not an automatic 156-week timer. Three independent gates must agree:

1. consistent training produces durable Base Fitness PL;
2. Story XP and Focus XP establish campaign order and meaningful engagement;
3. an equipped transformation or race-equivalent state supplies the anime-scale jump required by the current saga.

Missing one of those layers delays progression. Raw exercise statistics alone cannot clear the Super-era campaign near year three.

## Formula

`Base Fitness PL = 5 + positive weighted change from the race's starting stats`

Weights are STR 1.10, END 0.95, AGI 1.00, VIT 0.90, SPI 1.15 and TEC 1.05. GKI is tracked separately for God Power requirements and is not used to disguise normal fitness growth.

`Effective PL = Base Fitness PL × max(equipped form, qualified race-equivalent state)`

Only one state multiplier wins. Partner, ability, wish, saga and training effects improve earned stats and state readiness; they do not form an unlimited direct-PL multiplication chain.

## Three-year base curve

The original Dragon Ball targets remain deliberately close to their readable early values: 12 at Pilaf and 416 at Piccolo Jr. From week 24, the target grows log-linearly to 75,000 Base Fitness PL at week 156.

The target is calibrated with a normalised Tim-plan acceptance rate of 240 base-power points per active week:

| Route | Attendance | Bounded growth | Expected finale |
|---|---:|---:|---:|
| Optimal Tim plan/loadout | 92% | 2.22× | week 153–156 |
| Sensible developed loadout | 86% | 1.82× | about week 200 |
| Casual developed loadout | 78% | 1.45× | about week 277 |
| Tim plan, major systems ignored | 92% | 1.00× | about week 340 |

The runtime era soft cap derives its session target from the same saga-to-saga base deltas. Excessive single sessions have a 0.10 overflow exponent, so useful extra work still counts but a typo or marathon cannot skip an era.

## State curve

Saga rows retain an explicit intended state band: Base, Kaioken 3/10/20, Super Saiyan 50, Cell-era 55–100, Super Saiyan 3 at 400, Daima/GT-like 800, God 1,000, Blue 2,000, late divine states 3,500–80,000. The effective target for a saga is its recomputed base target multiplied by its state band.

Transformation and ability stat requirements are normalised to the recomputed base target for their saga. Their narrative, saga and level gates remain.

## Race parity

- Saiyan uses the equipped transformation multiplier directly.
- Earthling requires an equipped potential/Kaioken state. Developed abilities, partners and mastery can raise that state to the era-equivalent band.
- Hybrid requires an equipped hybrid awakening; potential mastery fills the sparse jumps between SS2/Potential and Beast.
- Namekian requires an equipped Namekian state; fusion/assimilation mastery provides era-equivalent scaling.
- Frieza Race requires an equipped released form; control mastery bridges the late gap between Black Frieza and the final state band.
- Android can use Cell-style forms through the Cell era. Later bands require permanent absorptions: one through roughly 1,000×, two through 10,000× and three beyond it.
- Majin may use universal techniques early. Above 100× it requires permanent absorptions on the same one/two/three progression.

Race-equivalent readiness is deliberately less than 100% without developed support. Three useful abilities, three active partners and at least C-rank state mastery are the intended optimal configuration. Direct forms remain valid if their multiplier is stronger.

## Story and mastery

Story XP is capped at 50 per week and saga targets are mapped to the 0–156 schedule. Focus XP rewards engagement with the chosen saga; it does not replace power or force dead waiting after the other gates are ready. Daima occurs at weeks 110–116, Beerus at 120 and Granolah at 156.

Transformation mastery is 25% faster than the inherited curve and uses G, F, E, D, C, B, A, S, Z and Super ranks. Mastery affects route readiness and ongoing efficiency, not an unbounded multiplier.

## Exploit controls

- Imported and typed numeric values have plausible maximums.
- Erroneous input can be undone immediately.
- Training, partner and loadout buckets use diminishing-return caps.
- The analytical extreme-stack ceiling is 2.60× growth.
- Era session soft caps prevent one extreme workout from skipping campaign phases.
- Partner power affects earned stats/XP, never the displayed PL directly.
- The strongest state wins; state multipliers are not multiplied together.
- Post-story progression removes the era cap so long-term growth remains open.

## Simulation acceptance

`tests/v6-balance.test.mjs` and `analysis/v6_balance_model.mjs` cover:

- light, standard, Tim-plan and optimised training;
- uninterrupted play, normal missed weeks, deloads and illness/holiday gaps;
- all seven races;
- raw/minimal, sensible, optimal and extreme stacking assumptions;
- final-base sensitivity and boost caps.

The simulation is a transparent normalised acceptance model, not a replacement for future telemetry. After real players accumulate 8–12 weeks of history, compare median recent Base Fitness PL/week and route-readiness attainment with these assumptions before changing thresholds.
