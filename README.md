# DragonBall Fitness RPG Mobile

Static GitHub Pages build for the DragonBall Fitness RPG.

## Publish With GitHub Pages

1. Push this folder to the GitHub repository you want to use.
2. In GitHub, open `Settings -> Pages`.
3. Under `Build and deployment`, choose `Deploy from a branch`.
4. Select the `main` branch and `/root` folder.
5. Open the generated Pages URL on mobile.

## Save Data

The game stores progress in the browser on the device being used. Export your save JSON regularly, especially before replacing `index.html` with a newer version.

Exports use the shorter date filename format `DBSave_DDMMYY.json`, for example `DBSave_030626.json`.

Do not commit personal save files to a public repository.

## v5 Mobile Layout

The current build uses the v5 cascade dashboard for phone use. The top banner depends on `icons/top_banner.png`, so keep that file beside the icon set and include it in the service worker app shell when updating the PWA cache. Saga banner artwork is embedded from `images/saga_banners`, so it should render even when the game is moved as a single HTML file.

Character comparison targets include all seven stats, including Technique (`TEC`), with benchmark stats balanced by archetype.

## Fitness Plan

The top banner `Plan` tab opens a full in-game four-week, seven-day editable planner. Planned days can hold the same exercises as the Training logger, calculate target loads from saved 1-rep maxes, use editable intensity profiles such as `85 | 80 | 75` or `75 | 70 | 65`, and round weights by equipment type.

The default 1-rep max table is seeded from Tim's old `fitness_old.xlsx` workbook, using the `W1RM 85 80 75` sheet. Existing save-file 1RM edits are preserved over these defaults.

Planner days can be copied to another day, copied week-to-week, auto-filled with daily meditation or mobility, saved as templates, loaded from existing Training templates for further editing, or loaded directly into the Training session for final edits before logging.

Planner machine rounding has two built-in stack profiles: the standard machine stack `9,14,19,23,29,36,43,50,57,63,70,77,84,90,97,104`, and a doubled cable-machine stack for cable fly/crossover work using total load across both cables.

## Rest And Deterioration

Training now includes a `Recovery -> Rest Day` entry. A rest day grants a recovery bonus equal to `2.5% x days since last rest`, capped at `10%`, multiplied against the stat gains from the shorter of the days since last rest or the previous four days. Rest day gains are stored as recovery workout entries and are recalculated from the workout log, so retroactive exercise edits update the chart correctly.

No-training deterioration starts after two consecutive non-training days. Rest days, meditation, and walking count as logged activity, but they do not reset this no-training timer; running and ordinary training do. The daily decay is `0.5%` per active decay day and clamps at the race-specific starting stats for Power Level 5.

Weekly variety deterioration checks the nine dashboard activity groups: chest, back, shoulders, arms, legs, core, cardio, martial, and flexibility. Missing the target of four exercises in a group creates a weighted stat reduction based on the stats that group normally trains, capped at `1.5%` per stat per completed week. Meditation counts for martial coverage, and walking counts for cardio coverage.

## Race Balance Notes

Transformation availability is race-gated. Earthlings, Saiyans, Half-Saiyans, Namekians, and Perfect Androids can use true Kaioken forms, Ultra Instinct forms, and Ultra Ego, while Frieza Race and Majin characters cannot. Half-Saiyans can use most Saiyan transformations, but not Super Saiyan 4, Legendary/Broly forms, or god/Super Saiyan Blue branches.

Race passives now affect long-term progression: Frieza Race boosts partner and training effects but has harder Dragon Ball hunts, Namekians find Dragon Balls faster, Earthlings gain broader training/saga/ability advantages, Half-Saiyans gain scaling partner XP, and Perfect Android/Majin runs use absorption mechanics on the Transformation page.
