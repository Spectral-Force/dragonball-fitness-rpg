# v6.3 Power Scaling Specification

## Decision

The main campaign targets 156 weeks of optimal play, not an automatic 156-week timer. Four independent layers must agree:

1. consistent exercise grows durable Base Fitness PL;
2. Story XP and saga order establish campaign position;
3. Focus XP and visible route support prove engagement;
4. one equipped primary transformation or earned fixed race tier supplies the anime-scale state multiplier.

Missing a layer delays progression. Exercise statistics alone cannot clear the Super-era campaign near year three, and the route system never borrows the multiplier of the next opponent.

## Formula

`Base Fitness PL = 5 + positive weighted change from the race's starting stats`

Weights are STR 1.10, END 0.95, AGI 1.00, VIT 0.90, SPI 1.15 and TEC 1.05. GKI remains a separate God Power input.

`Effective PL = Base Fitness PL x max(primary transformation, highest earned fixed race tier)`

Only the sanitized primary state contributes a transformation multiplier. Echo slots retain their documented training-effect weights but contribute no story PL, God PL, route qualification or mastery credit. Partners, abilities, wishes and training branches accelerate earned stats and route support; they do not form a hidden direct-PL chain.

## Canonical schedule and bands

`dbz-v6-progression-config.js` is the single saga/state-band source. Its main fixed multipliers are:

| Band | Multiplier | Signature saga | Target week |
|---|---:|---|---:|
| Base | 1x | Raditz | 29 |
| First Break | 3x | Vegeta | 33 |
| Surge | 10x | Namek | 39 |
| Mastered Surge | 20x | Ginyu | 45 |
| Z State | 50x | Frieza | 51 |
| Evolved Z | 100x | Cell Games | 78 |
| Ultimate Mortal | 400x | Buu | 97 |
| Ascendant Mortal | 800x | Daima True Form | 116 |
| Divine | 1,000x | Beerus | 120 |
| Divine Mastery | 2,000x | Golden Frieza | 125 |
| Transcendent | 3,500x | Future Trunks | 138 |
| Tournament Apex | 10,000x | Universe Survival | 144 |
| Cosmic Mastery | 50,000x | Galactic Patrol | 150 |
| Finale | 80,000x | Granolah | 156 |

Every route has one immutable answer at every band. A tier's support, resource, Base PL and Focus XP requirements determine whether it is earned; they never change its multiplier. Granolah's finale breakthrough is exposed at week 153 and the saga clear gate remains week 156, so the state needed to clear the finale is obtainable within the saga rather than rewarded afterwards.

## Support quality

Breakthrough support is a visible 0-100 score:

- 35 points from the qualifying primary state's mastery; Base never counts;
- 25 points from developed equipped abilities;
- 20 points from developed active partners;
- 20 points from the route's resource or signature mechanic.

Level-1 filler provides little credit. Primary mastery, support components and route resource are displayed separately in the Race Path panel.

## Route contract

- Earthling uses fixed technique, potential, mastery and native divine-control tiers.
- Saiyan uses Kaioken, Super Saiyan, Primal/Daima and divine specialization milestones.
- Hybrid uses heritage, rage, Ultimate and Beast milestones.
- Namekian uses a Warrior, Dragon or Balanced assimilation branch and Giant, fusion, ascendant and Orange milestones.
- Infinite Energy Android uses reactor, frame, overclock and engine mastery without absorption.
- Bio-Android uses up to three deterministic Adaptation Templates plus fixed evolution tiers.
- Majin uses Body Control, Regeneration Mastery and up to three deterministic Absorption Cores.
- Frieza Race uses controlled release, evolved, Golden and Black mastery milestones.

Ultra Instinct and Ultra Ego are explicit optional Divine Discipline branches. Every route has a competitive native finale and does not require a shared discipline.

Majin cores and Bio-Android templates copy exactly one bounded trait. Quality derives from partner tier and development, a collection is capped at three, no random failure destroys partner levels, and the source partner cannot also contribute through the active team while its copied trait is equipped.

## Integrity controls

- Race locks after the first meaningful workout; another race uses another character.
- Cross-race discoveries remain preserved but dormant and unusable.
- One permission engine governs unlock, both equip paths, save repair, PL, God PL and collections.
- Invalid primary equipment falls visibly to Base.
- State multipliers are never multiplied together.
- Imported numeric values and collections remain bounded.
- Session growth uses diminishing returns and era soft caps; post-story growth remains open.

## Deterministic acceptance

`analysis/v6_race_simulator.mjs` imports the real configuration, progression core and shared Tim-plan fixture. The v6.3 release gate is:

| Profile | Required result | Verified result |
|---|---:|---:|
| Optimal developed loadout | weeks 153-159, race spread <=6 | week 156 for all routes, spread 0 |
| Sensible developed loadout | weeks 180-210 | week 200 for all routes |
| Casual developed loadout | weeks 240-300 | week 279 for all routes |
| RPG systems ignored | no free finale scaling | stalled for all routes |

The simulator is a reproducible balance contract rather than a substitute for player telemetry. After 8-12 weeks of real v6.3 history, compare median Base Fitness PL growth, support attainment and stalled blockers before making small threshold adjustments. Do not restore target-following normalization.
