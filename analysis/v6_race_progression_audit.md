# Dragon Ball Fitness RPG v6 — Race Progression Audit

Date: 2026-08-03
Audited build: v6.0, repository commit `42db142`
Scope: Earthling, Half-Saiyan, Namekian, Android, Majin and Frieza Race, followed by a final Saiyan pass.

## Executive verdict

The seven races do **not yet have proven three-year parity**.

The current system contains two different progression models:

1. Saiyans use the actual multiplier of an equipped transformation.
2. Most non-Saiyans equip one qualifying early state and then receive a dynamic multiplier derived from the **next saga's target band**.

That second model can keep a non-Saiyan numerically on schedule, but it is not an earned progression ladder. A 5x Earthling state, 5x Large Namekian form, 3x Frieza second form, or base Android with three cheap absorptions can silently become an 80,000x-equivalent finale state. Later forms are therefore often cosmetic, redundant, or unlocked after they would have mattered.

There is also an active enforcement defect beneath the intended model: the final v6 auto-unlocker and equip paths do not consistently apply race restrictions, while story power reads raw equipped IDs. Wrong-race forms can therefore leak into ownership, equipment, story PL and collection rewards. The race-by-race analysis below evaluates both the intended route rules and this actual bypass.

The reference Saiyan path is also not a sound benchmark yet. Several forms unlock only after clearing the saga whose clear target assumes that form, and late form level/God Ki requirements are not demonstrated as achievable by the stated Tim-plan route. Frieza Race has the clearest early hard gap: it cannot use Kaioken and cannot unlock its first released form until Namek is already cleared, while the Namek clear gate assumes a 10x state.

The strongest conclusion is therefore:

> Keep the 156-week campaign target, but replace target-following race normalization with explicit, fixed race tiers that are earned before the saga that needs them. Then test the actual runtime economies—not a declared parity table—for every race.

### Current parity assessment

| Race | Three-year verdict | Main reason |
|---|---|---|
| Earthling | Numerically plausible, mechanically over-normalized | Full Potential can auto-scale from 5x to the finale band; later progression is mostly unnecessary. |
| Half-Saiyan | Likely advantaged after Cell, uncertain before it | Uses much of the Saiyan ladder, including unintended Great Ape access, then gains automatic Hybrid normalization. |
| Namekian | Early delay risk, then auto-normalized | The first Namekian state arrives after Namek's 10x clear gate; “assimilation” is only a label, not a mechanic. |
| Android | Plausible only with undocumented absorption play | Weak-partner absorption counts, not absorbed power, determine late eligibility; base form can auto-scale. |
| Majin | Numerically easy and highly exploitable | One early absorption activates the route; three weak absorptions and permanent copied boosts can outperform the intended economy. |
| Frieza Race | Broken at Namek, then over-normalized | Base form must clear a 10x Namek gate; afterward Second Form can auto-scale through the finale. |
| Saiyan | Not a reliable baseline yet | Same-saga unlock circularity, mandatory bridge forms, and unvalidated late level/God Ki requirements. |

## What was audited

The review traced the runtime implementation rather than relying only on the design documents:

- saga weeks, base targets and intended state bands in `dbz-v6-config.js` and `SAGA_REBALANCE_ROWS`;
- transformation race rules, saga/level/stat requirements, unlock timing and loadout behavior;
- `getRaceRoutePowerMultiplier`, including support readiness and absorption thresholds;
- player level and TXP curves;
- race stat and system bonuses;
- partner purchasing, activation, leveling and absorption snapshots;
- saga unlock, clear and mastery checks;
- race switching and persistence behavior;
- the balance model and test suite.

All 17 existing Node tests pass. That is useful release evidence, but it does not establish race parity. The current parity test calls `raceParityMatrix()`, whose rows set `competitive: true` unconditionally. It never executes transformation unlock rules, level requirements, absorption odds, support readiness, God Ki, or saga clearing.

## Intended campaign bands

The three-year schedule itself is coherent. Important clear bands are:

| Target week | Era / representative gate | Intended state multiplier |
|---:|---|---:|
| 0–29 | Dragon Ball through Raditz | 1x |
| 33 | Vegeta | 3x |
| 39 | Namek | 10x |
| 45 | Ginyu | 20x |
| 51–65 | Frieza through Androids | 50x |
| 69–74 | Cell evolution | 55–60x |
| 78–93 | Cell Games through Babidi | 100x |
| 97–113 | Buu through Daima Supreme Kai | 400x |
| 116 | Daima True Form | 800x |
| 120 | Beerus | 1,000x |
| 125–134 | Golden Frieza through Copy Vegeta | 2,000x |
| 138 | Future Trunks | 3,500x |
| 144 | Universe Survival | 10,000x |
| 150 | Galactic Patrol | 50,000x |
| 156 | Granolah finale | 80,000x |

The problem is not the shape of this table. The problem is how each race is allowed to meet it.

## Cross-race systemic findings

### P0 — Route normalization follows the answer

`getRaceRoutePowerMultiplier` looks up the first uncleared saga and reads that saga's intended multiplier. It then grants a percentage of that target to a qualifying race state.

At maximum declared support readiness:

| Route | Multiplier produced from the next saga target |
|---|---:|
| Earthling / Namekian | 104% |
| Half-Saiyan | 106% |
| Frieza Race | 108% |
| Android, one absorption | 95% |
| Android, two absorptions | 107% |
| Android, three absorptions | 108% |
| Majin, one absorption | 99% |
| Majin, two or three absorptions | 110% |

This makes the system self-fulfilling: if a route has its qualifying flag, it receives roughly what the current gate asks for. The multiplier is not a consequence of a fixed state that can be compared with the target.

Consequences:

- old forms remain optimal forever;
- upcoming forms are not needed to cross upcoming thresholds;
- changing a saga target automatically changes race power without changing the character;
- the UI cannot explain why a displayed 5x form is acting like an 80,000x state;
- race difficulty is governed more by whether the qualifying Boolean is present than by player progression.

### P0 — “Mastery readiness” is free

Support readiness is intended to reward three abilities, three partners and C-rank transformation mastery. The implementation checks whether **any** transformation mastery entry has at least 2,400 XP.

Every ensured character receives base-form mastery at the highest mastery threshold. Therefore the 0.06 mastery contribution is normally active without mastering the equipped race state.

The implemented support maximum is also 0.33, not 0.36:

- three abilities: 0.15;
- three partners: 0.12;
- mastery: 0.06;
- total: 0.33.

Ability and partner contributions are pure counts. A level-1 ability and level-1 partner count as fully ready. This rewards slot filling, not development or synergy.

### P0 — Form timing and saga timing are circular

Normal transformations require their listed saga to be cleared. Yet saga clear targets commonly assume the signature form of that same saga.

Examples:

- Kaioken x3 is tied to Vegeta, but the Vegeta clear target is 3x.
- Kaioken x10 is tied to Namek, but Namek is 10x.
- Super Saiyan is tied to Frieza, but Frieza is 50x.
- Super Saiyan 2 is tied to Cell Games, but Cell Games is 100x.
- Super Saiyan 3 is tied to Buu, but Buu is 400x.
- Hybrid Beast and Black Frieza are tied to Granolah, so they normally arrive after the finale they appear designed to serve.

God-tagged transformations use a different automatic rule and may unlock when their saga is merely unlocked. The transformation UI nevertheless reports the saga as needing to be cleared. Runtime and UI therefore disagree for forms such as Super Saiyan God and other God-tagged states.

### P0 — The level curve is not connected to the balance proof

Player level is calculated from total TXP, while the published balance model simulates only Base Fitness PL. It does not prove that the required player levels are reached.

Using the game's own standard workout value of 45 TXP and four workouts per week:

| Week | Baseline player level |
|---:|---:|
| 39 | 24 |
| 51 | 28 |
| 78 | 36 |
| 97 | 40 |
| 120 | 45 |
| 156 | 52 |

If only the 125% v5 loadout TXP cap is added, the same route reaches approximately level 79 at week 156 before finite rewards. Partner and training multipliers can raise that, but the current simulator does not model their acquisition or prove the result.

Late requirements include level 84 for Blue, 104 for Ultra Instinct Sign, 112 for Mastered Ultra Instinct, and 118–120 for finale states. Those may be attainable only through a very specific stacked economy; that is precisely what needs to be simulated rather than assumed.

### P0 — God Ki requirements use an incompatible scale

God Ki is reset to zero before the God tier unlocks. Super Saiyan God then asks for 30,000 GKI, Blue for 56,000, and later forms hundreds of thousands or millions. These GKI values are excluded from the v6 requirement-normalization function.

Meanwhile saga God Power gates use comparatively small calculated values. This lets non-Saiyan normalized routes potentially continue without their marquee divine forms, while direct-form Saiyans can be blocked from the multipliers intended to clear those sagas.

The uncertainty here is material: a full workout-economy simulator may show a narrow viable route, but no existing test demonstrates it.

### P0 — Race switching invalidates race balance

Race can be changed from the dashboard after progression has begun. The change:

- has no cost or confirmation;
- retains stats, unlocks, inventory and race absorption records;
- does not immediately rebuild all race-specific state;
- allows a player to select whichever passive and route is best for the current action.

Examples include training under Frieza Race's stronger training/partner-effect scaling, leveling partners under Earthling/Half-Saiyan bonuses, using Majin's safer absorption formula, or switching into a normalized route to pass a saga.

Multi-character support already provides a clean way to experience different races. A single character should not be able to harvest all racial economies without an explicit respec system.

### P0 — Active race restrictions can be bypassed

The early implementation of `unlockTransformationsAndAbilities` checked `transformationAllowedForRace`. The later active v6 override does not. It adds every form whose saga, level, stats and God Ki requirements are met to the character's global `unlockedTransformations` array, regardless of race.

Several downstream paths then trust that global ownership:

- transformation status reports `unlocked` before checking whether the race is allowed;
- both primary and echo equip actions check ownership but not race;
- `setTransformationSlot` also checks ownership but not race;
- transformation collections count the global unlocked list;
- route/story power reads raw `equippedTransformations` in `getV6EquippedState` instead of the race-sanitized `getEquippedTransformations` result.

Practical consequences:

- a Majin, Frieza Race, Earthling or Android can auto-own and equip a Saiyan form once its generic requirements are met;
- the race-filtered transformation UI and the story multiplier can disagree about what is equipped;
- a wrong-race form may disappear from the sanitized loadout but still provide its full raw story multiplier;
- collections and achievements can reward a character for completing other races' form sets;
- intended Majin and Frieza restrictions are not reliable enough to balance against.

This is a correctness bug, not merely a tuning issue. Race validation must be applied atomically at unlock, status, equip, loadout sanitation, story power, collections and migration.

### P0 — Echo slots contribute full story power

Transformation echo slots advertise reduced weights of 35%, 20%, 14%, 10%, 7% and 5%. Those weights affect ongoing training effects. Story power does something different: `getV6EquippedState` selects the strongest raw form from every equipped slot and uses 100% of its multiplier.

Any qualifying racial form in an echo slot can also activate full race normalization. The primary slot is therefore not authoritative for story power, and the UI understates an echo's effect by a potentially enormous margin.

The clean rule is: only the primary state determines Effective PL and race-tier eligibility. Echoes may contribute their advertised bounded training/mastery effects, never their raw PL multiplier.

### P0 — Absorption rewards weak targets and permits double use

Android and Majin success probability is based on partner level divided by player level. Weaker partners are easier to absorb.

Representative chances:

| Partner level / player level | Android success | Majin success |
|---:|---:|---:|
| 0.25x | 85.6% | 100% |
| 0.5x | 67.8% | 100% |
| 1x | 50% | 100% |
| 2x | 32.2% | 82.2% |
| 4x | 14.4% | 64.4% |
| 7x | 0% | 50% |

This makes the optimal route the opposite of the fantasy: buy or preserve weak partners and consume those. Majin's seven-times divisor makes an equal-level absorption effectively guaranteed.

On success, the partner remains owned and can remain active/main. The player therefore receives the active partner effect and the permanent absorbed snapshot simultaneously. Majin copies 100% of the current effect; Android copies 10%. Caps limit the final totals, but they do not remove the double-dipping incentive.

The route multiplier counts distinct absorbed partner IDs, not their level, tier, effect strength or copied value. Three level-1 support characters satisfy the same late route gate as three maximized legendary partners.

### P1 — Absorption failure and UX are unnecessarily hostile

- The Absorb button immediately rolls; there is no confirmation for a permanent action.
- Android failure removes 25% of the partner's levels, resets current XP, may remove milestones, and adds a seven-day cooldown.
- Majin failure adds only the cooldown, despite usually having much better odds and copying ten times as much effect.
- Cooldowns use wall-clock time in a local application, making clock manipulation possible and legitimate device-clock changes awkward.
- There is no pity counter or deterministic progress path.

This is too much irreversible downside for a fitness game in which partner levels represent months of real play.

### P1 — Race identity and implementation diverge

- Namekian assimilation and Frieza control mastery are labels in the route formula, not developed subsystems.
- Majin has no usable transformation ladder at all; every non-base transformation is rejected.
- Every Android is treated as a “Perfect Android” capable of Cell-like absorption, even though the race picker says Android and the route description also covers infinite-energy Androids.
- Half-Saiyans may use Great Ape because it is not in their exclusion list, regardless of a tail or origin choice.
- Shared Ultra states, including Ultra Ego, are allowed for Earthling, Half-Saiyan, Namekian and Android, which weakens late racial identity.
- Character-creation copy still claims that some routes have no transformation restrictions, while the intended filter does impose them.

## Race-by-race audit

## Earthling

### Current route

- Growth profile: neutral overall stats with a small Technique advantage.
- System advantages: 25% stronger training-upgrade effects, 25% stronger saga effects, 25% faster ability XP, easier Dragon Balls, and increasing partner XP.
- Race forms: Full Potential 5x after Tournament; Potential Unlocked 15x after Namek.
- Universal access: Kaioken and shared Ultra states.
- Normalization trigger: equip an ID beginning `human_` or `kaioken_`.

### Timeline analysis

Earthling has the cleanest early bridge. Full Potential becomes available after the Tournament, well before the first 3x/10x/20x state bands. Once equipped, generic support can make it track every later saga automatically.

That means the timeline can match or beat Saiyan, but for the wrong reason. Potential Unlocked, higher Kaioken levels and divine states are not required once Full Potential plus support has qualified. Full Potential can effectively act as a finale state without its displayed 5x value changing.

The stacking of several Earthling economy bonuses also risks making Earthling the best long-term optimizer even before route normalization is considered.

### Broken or unfun features

- A two-form racial ladder is too sparse for 156 weeks.
- Full Potential invalidates Potential Unlocked as a route requirement.
- “Technique and mastery” is measured by slot counts and free base mastery.
- The player cannot see how much of the race-equivalent multiplier comes from abilities, partners or state mastery.
- Ultra access can turn the late route into a generic Saiyan-adjacent endgame rather than an Earthling identity.

### Recommended Earthling design

Use fixed martial-potential tiers rather than saga-following normalization:

1. Full Potential — early Dragon Ball, approximately 3–5x.
2. Potential Unlocked — Namek, 15–20x.
3. Human Limit Break — Cell, approximately 100x.
4. Ultimate Human — Buu/Daima, approximately 400–800x.
5. Divine Technique — Beerus/Blue era, 1,000–2,000x.
6. Perfected Instinct / Earthborn Mastery — late Super tiers, earned through high ability mastery and partner bonds.

Kaioken should be a valid alternate burst route with fatigue/strain tradeoffs, not a mandatory universal ladder. Readiness should use levels/mastery of the equipped abilities and state.

**Parity target:** on-time at week 156, with slightly slower form spikes than Saiyan but faster Base Fitness and support development.

## Half-Saiyan

### Current route

- Strong Spirit growth and increasing partner XP.
- Can use most Saiyan transformations.
- Explicitly excludes God, Blue, SS4, Legendary and several advanced Saiyan forms.
- Does not exclude Great Ape, Super Saiyan, Ascended/Ultra Super Saiyan, SS2 or SS3.
- Hybrid-specific forms: SS2 Rage 150x after Cell Games, Potential Unlocked 500x after Buu, Beast 100,000x after Granolah.
- Normalization starts only when an explicitly Hybrid-race state is equipped.

### Timeline analysis

Before Cell Games, the Half-Saiyan route is mostly a Saiyan route with better Spirit and partner development. Great Ape is its strongest early bridge if available, whether or not that was intended.

After Cell Games, SS2 Rage activates normalization and can follow every state band through the finale. Potential Unlocked improves the direct multiplier but is not required. Beast arrives after the finale under normal non-God unlock semantics, while SS2 Rage or Potential Unlocked has already been scaled to the 80,000x finale band.

This route is likely stronger than Saiyan after week 78 because it combines access to much of the Saiyan ladder with target-following normalization.

Super Saiyan Rage is stored as a Saiyan state. A Half-Saiyan may equip it, but it does not activate `Hybrid Awakening`, despite rage being part of the advertised Hybrid identity.

### Broken or unfun features

- Great Ape access is implicit rather than a tail/origin choice.
- The route abruptly changes rules at Cell Games.
- Inherited Saiyan states and native Hybrid states are classified differently even when they represent the advertised rage route.
- Beast is a post-finale trophy rather than the culmination of the route.
- Rage and potential are labels; there is no rage meter, awakening choice or controlled-potential mastery.
- Exclusions are a hard-coded list that is easy to miss when new forms are added.

### Recommended Half-Saiyan design

Offer two explicit but interoperable branches:

- **Saiyan Heritage:** Super Saiyan forms, potentially including Great Ape only if a Tail trait is selected.
- **Human Potential:** rage awakenings, Potential Unlocked, Ultimate and Beast-style states.

Allow branch crossing, but make the strongest result come from developing one branch deeply rather than collecting every form. Beast-equivalent readiness must unlock before the Granolah clear, not after it.

**Parity target:** slightly volatile milestone timing—occasional early spikes followed by mastery consolidation—but no more than ±3 weeks from Saiyan at Cell, Buu, Beerus and finale.

## Namekian

### Current route

- Strong Vitality and Endurance; good Spirit and Technique.
- Easier Dragon Ball collection.
- Can use Kaioken and shared Ultra states.
- Race forms: Large Form 5x and Warrior Fusion 40x after Namek, Super Namekian 80x after Imperfect Cell, Orange 1,000x after Granolah.
- Normalization activates with any equipped Namekian state.

### Timeline analysis

Namek is the weak point. The 10x Namek clear gate arrives before Large Form and Warrior Fusion can unlock. Kaioken x3 is available only after Vegeta and Kaioken x10 is itself tied to clearing Namek. A Namekian may therefore need substantially more base power than the scheduled curve to clear Namek.

After any Namekian form is unlocked, even Large Form 5x can track every later target at up to 104%. Super Namekian and Orange are therefore not necessary for route parity. Orange also arrives after the final saga and cannot serve the intended late-game arc.

There is no assimilation inventory, choice, partner bond, permanent stat event or fusion cost. “Assimilation mastery” is generic support readiness.

### Broken or unfun features

- First race form arrives too late to solve the first race-relevant gate.
- The advertised permanent assimilation route does not exist.
- Large Form can silently become an 80,000x finale state.
- Warrior Fusion is described as permanent but implemented as an equipable transformation.
- Orange is postgame-only and unnecessary.
- Shared Ultra states reach 10,000–80,000x before the 1,000x Orange signature state unlocks, making Orange dead content unless universals are restricted or Orange is moved/reworked.

### Recommended Namekian design

Implement assimilation as a real, fixed progression resource:

- earn **Assimilation Insight** through Namekian partner bonds, Namek saga focus and Spirit/Vitality training;
- choose permanent fusion nodes rather than destroying a partner;
- use a visible assimilation tree: Dragon Clan, Warrior Clan and Balanced Fusion;
- unlock a 10x-capable state before Namek clear;
- make Warrior Fusion and Super Namekian fixed midgame tiers;
- place Potential/Orange progression before Beerus and the late Super finale;
- reserve a final Orange mastery or Dragon awakening tier for 10,000–80,000x bands.

**Parity target:** a modest early base-power advantage, a deliberate fusion choice around Namek, and durable fixed tiers thereafter.

## Android / Bio-Android

### Current route

- Good Strength, Agility and Technique; low Spirit and God Ki growth.
- Can use Kaioken and shared Ultra states.
- Cell-style forms: Power Charge 25x, Semi-Perfect 60x, Perfect 90x and Super Perfect 130x.
- Every Android receives the absorption system.
- Required absorption counts: zero through 130x, one through 1,000x, two through 10,000x, three above 10,000x.

### Timeline analysis

Before the first Android form, route normalization requires at least one absorption because the code accepts `absorptions > 0` as a substitute for an equipped Android state. Without it, Android follows the same early Kaioken timing gap as Namekian.

With one weak absorption, the optimal-support route reaches 95% of targets through Beerus. Two reach 107% through Universe Survival; three reach 108% in the final bands. The strength of the absorbed partners is irrelevant.

Even after Android forms exist, three absorptions permit base form to receive the full late route because `absorptions > 0` satisfies the state condition. Perfect/Super Perfect forms are not required.

### Broken or unfun features

- Pure infinite-energy Androids and Cell-like Bio-Androids are conflated.
- The UI calls the feature “Perfect Android Absorption” for every Android.
- Weak partners are optimal absorption targets.
- Android failure has the harshest punishment despite the smallest reward.
- Absorbed partners remain usable, producing a double benefit.
- A count of three is a trivial checklist rather than an evolution system.
- Low Spirit/God Ki growth can make shared late forms less reachable while normalization hides the problem.
- Character-creation copy promises “boundless energy with no fatigue,” but no Android-specific fatigue/recovery exemption is implemented.

### Recommended Android design

Add a subtype or early branch choice:

- **Infinite Energy Android:** reactor, battery, overclock, limit-break and divine-core upgrades. No biological absorption.
- **Bio-Android:** adaptation scans, genetic templates and deliberate evolution forms. Absorption/adaptation is central.

Replace absorption count with **Adaptation Power** based on partner tier, partner level, bond/mastery and the chosen copied trait. If the partner remains available, call it a scan/copy and copy one bounded trait. If it is true irreversible absorption, remove it from active/owned use and require explicit confirmation.

Remove level loss on failure. Use a resource cost, control XP and a pity meter. Add fixed evolution thresholds before Buu, Beerus, Universe Survival and Galactic Patrol.

**Parity target:** reliable and low-variance, with less burst than Saiyan but no random multi-week stalls.

## Majin

### Current route

- High Vitality with slower Agility and Technique.
- No non-base transformation is allowed.
- Can copy 100% of each absorbed partner's current effects permanently.
- Required absorption counts are nominally zero through 100x, one through 1,000x, two through 10,000x and three above it.

### Timeline analysis

Although the threshold says zero absorptions at early bands, the route condition requires either an absorption or an equipped multiplier already at the target. Majin cannot equip any non-base form, so one absorption is functionally mandatory when the story first moves above base.

Pilaf grants enough TP to buy a 5-TP starter partner, so the route is not permanently deadlocked. The dependency is poorly communicated, however. An equal-level Majin absorption is effectively guaranteed, and one absorption plus developed support reaches 99% of every target through Beerus. Two or three exceed their respective targets.

Because copied effects are permanent and the partner remains active, Majin can become the strongest growth economy while also receiving the most generous state normalization. The absence of visual/form progression makes the route numerically effective but experientially thin.

If the wrong-race equip exploit is fixed without adding a Majin divine route, another problem emerges in Super: race normalization changes normal Effective PL but not God Power. Majin has no God-tagged state, so it cannot receive the transformation contribution available to other late routes. God Power parity must be designed explicitly rather than accidentally supplied by an invalid Saiyan form.

### Broken or unfun features

- No Majin form, regeneration state, body-control state or visual evolution is usable.
- The first absorption is mandatory but the threshold table implies zero.
- The success formula is so generous that randomness rarely adds tension for sensible targets.
- Full-effect copying plus continued partner use is a major stacking exploit.
- Count, not absorbed power or technique choice, controls story eligibility.
- Permanent snapshots do not grow with the source partner, encouraging awkward timing decisions.
- There is no absorption-count cap; a player can absorb the whole roster and saturate every copied-effect bucket even though only three IDs matter for route qualification.

### Recommended Majin design

Build a capacity-based absorption system:

- three **Absorption Cores**, earned at defined story milestones;
- each core may hold one copied trait, technique or stat profile—not a partner's complete effect package;
- absorbed traits have their own mastery and can be swapped through a costly but non-destructive ritual;
- regeneration/body-control mastery supplies the early route before the first core;
- fixed Majin states at roughly 10x, 100x, 400x, 1,000x, 10,000x and 80,000x combine core quality with form mastery;
- visible appearance overlays reflect the equipped copied traits.

Use deterministic eligibility or a rapidly filling pity meter. Fitness progress should not be held hostage by a seven-day random cooldown.

**Parity target:** highly customizable but capped; no higher than the other races' optimal finale pace.

## Frieza Race

### Current route

- Good Strength and Agility; weaker Endurance.
- 50% stronger training-upgrade and partner effects.
- Dragon Balls are twice as difficult.
- Cannot use Kaioken or shared Ultra states.
- Forms: Second 3x, Third 6x, 5% Final 12x, Final 120x, 100% 240x, Cooler 500x, Golden 1,000x, True Golden 5,000x and Black 20,000x.
- Any Frieza-race state activates normalization up to 108% of the target.

### Timeline analysis

This is the clearest broken route.

The first Frieza-race state requires Namek to be cleared. Frieza Race is excluded from Kaioken. Namek's clear target assumes a 10x state, so the character must meet a 10x effective target in base form. The 50% training/partner-effect bonuses apply only to bonuses from those systems; they do not supply a direct 10x bridge.

After Namek, Second Form 3x is enough to activate target-following normalization. It can then act as 20x at Ginyu, 50x at Frieza, 400x at Buu and 80,000x at the finale. The otherwise rich Frieza form ladder becomes optional.

Black Frieza requires Granolah and normally unlocks after the finale. It is also only 20,000x against the finale's 80,000x band, so even if moved earlier it needs a mastery tier or stronger fixed value.

### Broken or unfun features

- Probable hard delay at Namek.
- Best-authored non-Saiyan form ladder is invalidated by normalization.
- Suppression/release fantasy is not represented before Namek.
- Golden/Black level and GKI requirements are not included in the three-year proof.
- “Control mastery” is generic support count plus free base mastery.

### Recommended Frieza Race design

Make suppression release the early mechanic:

1. Suppressed / First Form — base era.
2. Controlled Release — 3x before Vegeta clear.
3. Second/Third release — 10–20x before Namek/Ginyu clear.
4. Final release states — 50–240x for Frieza/Cell.
5. Evolved/Cooler state — approximately 400–500x for Buu.
6. Golden — 1,000–2,000x before Beerus/Golden Frieza clears.
7. Perfected Golden — 5,000–10,000x.
8. Black / Black Mastery — fixed late tiers reaching 50,000–80,000x before the finale.

Control mastery should affect efficiency, strain and how much of an unlocked form can be sustained. It should not ask a 3x Second Form to impersonate every future state.

**Parity target:** the fastest access to clean fixed transformations, balanced by Endurance/control demands and harder Dragon Balls—not by an early hard lock.

## Final Saiyan pass

### What works

- The form catalogue is broad and visually satisfying.
- State bands broadly follow recognizable story escalation.
- Direct multipliers are conceptually clearer than hidden race normalization.
- Saiyan stat growth is approximately balanced in aggregate: Strength/Spirit advantages are offset by Endurance, Vitality, Agility and Technique penalties.
- Multiple late branches—Blue/Kaioken, Instinct, Ego, Broly/Legendary—offer good replay potential.

### Main progression problems

#### 1. Great Ape is an unintended keystone

Great Ape is tied to Pilaf and provides 10x. Because Kaioken and Super Saiyan forms arrive after the sagas whose gates assume them, Great Ape is the practical bridge through Vegeta and Namek and remains valuable into Ginyu.

This makes a form that should be an alternate racial trait close to mandatory. It also has no tail/full-moon choice or gameplay cost.

#### 2. Signature forms arrive after their dramatic gate

The path should let the player unlock/equip a state to cross the threshold into or through its signature saga. Currently many are awarded only after that clear. The result is repeated overtraining of base PL to compensate for a missing multiplier.

Key gaps:

- Frieza clear: target 50x; pre-clear bridge is normally Kaioken 20x or Great Ape 10x.
- Cell Games clear: target 100x; SS2 arrives afterward, leaving up to 75x from Ultra Super Saiyan.
- Buu clear: target 400x; SS3 arrives afterward, leaving SS2 100x.
- Daima True clear: target 800x; SS4 can cover it only if its high level/stat requirements are already met.

#### 3. Late Super forms are not proven reachable

The level and GKI curves are absent from the balance simulator. A direct-form race cannot rely on automatic target normalization, so this missing proof disproportionately affects Saiyan.

#### 4. Some late branches are unlock-semantics accidents

Whether a form can unlock on saga entry or only after clear depends on whether its authored effect tags include `god`. The data model should have an explicit `sagaStatus`/`unlockPhase`, not infer progression timing from combat-effect tags.

#### 5. Form values and intended bands sometimes disagree

- SS2 Rage is 150x against a 100x band.
- SS4 is 800x and useful for Daima, but level timing is doubtful.
- Black Frieza is 20,000x and Beast is 100,000x against an 80,000x finale.
- Universe Survival offers several 10,000–40,000x branches, but their same-saga timing differs by incidental tagging.

Different values are healthy when they carry costs; without costs, the largest unlocked number simply wins.

### Recommended Saiyan changes

1. Give every signature saga a **breakthrough objective** that unlocks its form before the final clear:
   - Kaioken x3 during Vegeta;
   - Kaioken x10 during Namek;
   - Super Saiyan during Frieza;
   - Super Saiyan 2 during Cell Games;
   - Super Saiyan 3 during Buu;
   - God during Beerus;
   - Blue during Golden Frieza;
   - late branches during their relevant saga.
2. Keep saga clear as the mastery test for the new state rather than the prerequisite to obtain it.
3. Make Great Ape an optional origin trait with a meaningful control/Endurance tradeoff.
4. Replace raw legacy GKI requirements with normalized God Ki milestones derived from expected post-Beerus training.
5. Either recalibrate player-level requirements to the predicted three-year TXP curve or make level a soft recommendation while Base PL, saga breakthrough and state mastery are the hard gates.
6. Add explicit costs/tradeoffs:
   - Kaioken: strain/recovery burden;
   - bulky Super Saiyan grades: Agility/Endurance penalty;
   - SS3: mastery drain;
   - Blue: control/God Ki efficiency;
   - Ultra Instinct: Agility/Technique emphasis;
   - Ultra Ego: Strength/Vitality emphasis and recovery cost.
7. Ensure each late branch can reach the finale band through its own fixed mastery tiers, so the player chooses a style rather than the largest number.

**Revised Saiyan parity target:** exact reference median of week 156 ±3 for an optimal Tim-plan/loadout route, without requiring Great Ape and without more than one week of waiting after all fitness/story requirements are ready.

## Recommended replacement model

### 1. Fixed race tiers, not next-target scaling

Use:

`Effective PL = Base Fitness PL × max(equipped transformation, earned fixed race tier)`

An earned race tier should contain:

- a fixed multiplier;
- an explicit saga unlock phase (`entry`, `breakthrough`, `clear`, or `postgame`);
- Base PL/stat requirements normalized to that point in the campaign;
- race-specific mastery/resource requirements;
- any drawback or sustain cost;
- a visible explanation in the UI.

Never read the next saga's multiplier when calculating the character's multiplier.

### 2. Shared state-band contract

Every race needs an available, earned answer to the same bands:

| Band | Target window | Design purpose |
|---:|---|---|
| 1x | weeks 0–29 | Base development |
| 3x | week 33 | First limit break |
| 10x | week 39 | Major early state |
| 20x | week 45 | State mastery |
| 50–100x | weeks 51–93 | Z transformation/evolution arc |
| 400–800x | weeks 97–116 | Ultimate mortal state |
| 1,000–2,000x | weeks 120–134 | Divine transition |
| 3,500–10,000x | weeks 138–144 | Specialized late branch |
| 50,000–80,000x | weeks 150–156 | Mastered finale branch |

Races may arrive slightly early or late within a band, but every band needs a real route-specific milestone.

### 3. Quality-based readiness

Replace counts with normalized quality:

- ability quality: equipped level, saga relevance and recent use;
- partner quality: bond/level, active duration and relevant tags;
- state mastery: mastery of the equipped qualifying state only;
- race resource: assimilation insight, adaptation power, absorption cores, control, rage/potential, or technique mastery.

Base form must never satisfy state-mastery readiness for a non-base route.

### 4. Safe absorption contract

Before any absorption rewrite is accepted:

- show a confirmation with exact permanent effects;
- decide whether the source partner is consumed, disabled while copied, or merely scanned;
- prevent active-plus-absorbed double use unless explicitly balanced;
- base route credit on strength/quality, not ID count;
- remove catastrophic partner-level loss;
- include a pity/deterministic path;
- cap copied traits independently from normal active-partner caps;
- validate absorption snapshots during import/migration;
- show progress to the next fixed race tier.

### 5. Lock or formalize race changes

Recommended policy:

- free race changes until the first meaningful workout;
- afterward, create another character to play another race;
- optionally add a rare explicit respec that clears race-specific forms, absorptions/resources and loadouts after a detailed confirmation.

## Required automated simulation

Replace the declared parity matrix with a simulator that imports or mirrors runtime data and advances a character week by week.

It must model:

- workout count and TXP distribution;
- actual stat gains and race stat multipliers;
- Base Fitness PL and era soft caps;
- Story XP and Focus XP;
- player level;
- AP/TP income and slot purchases;
- ability XP/levels and equipped quality;
- partner purchase timing, level and bond quality;
- transformation unlock phase, requirements and mastery;
- God Ki acquisition after Beerus;
- race resources and absorption/adaptation choices;
- interruptions, deloads and missed weeks.

### Acceptance tests

1. Every race's optimal finale median is 153–159 weeks.
2. Spread between fastest and slowest optimal race is no more than six weeks.
3. At Namek, Frieza, Cell Games, Buu, Beerus and Granolah, no race is more than three weeks behind the Saiyan reference without an intentional earlier advantage.
4. Every required state can unlock before the clear gate that assumes it.
5. A standard developed route remains possible without one exact partner, ability or random absorption result.
6. A minimal route is slower but never permanently stuck.
7. No three level-1 partners can satisfy a late absorption/evolution tier.
8. No absorbed partner can simultaneously provide its full active and full copied effect.
9. Base mastery cannot satisfy non-base route mastery.
10. Race switching cannot preserve incompatible race resources or bypass a gate.
11. UI blockers and automatic unlock semantics agree.
12. Finale-required level and God Ki values are reached by the simulated optimal route with a reasonable margin, not by extreme caps.
13. Every transformation/race pair is tested at auto-unlock and at both equip APIs.
14. Story power uses only a race-valid primary state; a stronger echo never changes Effective PL.
15. Wrong-race unlock records cannot complete collections or achievements.
16. Every race has a verified God Power route through Super, including Majin and non-God-form alternatives.

### Telemetry to expose locally

Add a private/exportable balance panel showing:

- week since first workout;
- expected versus actual Base PL;
- current fixed state tier and next tier;
- readiness component breakdown;
- earliest blocked saga and blocker duration;
- level/TXP and God Ki trajectory;
- absorption/adaptation quality;
- projected finale week.

This can remain local-first and need not transmit personal fitness data.

## UX and artwork recommendations

Mechanics should be settled before producing the full art set, otherwise assets will encode another obsolete ladder.

Recommended original visual package:

- a horizontal **Race Path** rail on the transformation page showing fixed bands and the next breakthrough;
- Earthling martial seals, weighted-gi silhouettes and clean controlled auras;
- Half-Saiyan rage cracks that settle into potential/Beast-style aura layers;
- Namekian clan crests, fusion rings and dragon-energy motifs;
- separate Infinite Android circuit overlays and Bio-Android adaptation plates;
- Majin body-control silhouettes with three visible copied-trait glyph slots;
- Frieza suppression shells that visibly open into released/evolved forms;
- Saiyan branch art for primal, classic Super Saiyan, divine control, Instinct and Ego paths;
- a shared 3x/10x/50x/100x/400x/1,000x/10,000x/80,000x icon language so players can compare races without losing identity.

Asset format recommendation:

- 512×512 transparent WebP state portraits/icons;
- 1,024×512 WebP route headers;
- separate aura/overlay layers where possible;
- original player-avatar designs rather than direct copies of franchise characters;
- reduced-motion variants for animated aura effects.

## Implementation roadmap

### Phase 0 — Correctness and proof

1. Build the real weekly race simulator and failing parity tests first.
2. Add explicit transformation `unlockPhase` data and make UI/runtime use the same rule.
3. Recalibrate player-level and God Ki requirements against the simulated Tim-plan route.
4. Replace `getRaceRoutePowerMultiplier` target-following behavior with fixed tiers.
5. Restore race integrity across unlock, status, equip, sanitized loadout, story power, collections and migration.
6. Make only the primary state supply story PL; keep echo effects at their advertised weights.
7. Exclude base mastery and quality-weight support readiness.
8. Lock/formalize race changes.

### Phase 1 — Immediate race blockers

1. Give Frieza Race a valid pre-Namek released state.
2. Give Namekian a pre-clear Namek breakthrough.
3. Move Saiyan signature breakthroughs inside their sagas, before clear.
4. Make Beast, Black Frieza, Orange mastery and finale states obtainable before the finale if they are intended for it.
5. Give Majin an early regeneration/body-control tier independent of absorption.

### Phase 2 — Absorption and race identity

1. Split Infinite Android and Bio-Android routes.
2. Replace absorption count with quality/resource thresholds.
3. Remove double use, harsh failure loss and opaque randomness.
4. Implement Namekian assimilation, Frieza control, Hybrid rage/potential and Majin core mastery as real systems.
5. Add fixed late tiers for every route.

### Phase 3 — UX, art and accessibility

1. Add Race Path rail and readiness breakdown.
2. Add confirmation, comparison and preview screens for permanent choices.
3. Generate the original race-state asset package after IDs and tiers stabilize.
4. Add reduced motion, contrast and mobile layout tests for the new visuals.

### Phase 4 — Tuning and release gate

1. Run optimal, sensible, casual and interrupted simulations for every race.
2. Run deterministic seeds for any remaining random mechanics.
3. Perform save migration tests for race resources and absorption records.
4. Play-test at least one early, mid and late save per race in mobile and desktop layouts.
5. Do not declare parity until the runtime simulator, not a hand-authored matrix, passes.

## Recommended order of decisions

Before implementation, decide these five design questions:

1. Are signature forms earned during their saga or used to enter the next saga? The audit recommends **during, before clear**.
2. Is Android one race or two subtypes? The audit recommends **Infinite Android and Bio-Android branches**.
3. Does true absorption consume a partner? If not, rename it **copy/adaptation** and limit it to one trait.
4. Should late universal Ultra states be available to most races? If yes, make them explicit optional branches rather than an exception hidden in race filtering.
5. Should player level be a hard transformation gate? The audit recommends making **race breakthrough, Base PL and state mastery primary**, with level used only where the simulated route reliably reaches it.

Once these are fixed, the remaining balance work becomes measurable rather than interpretive.
