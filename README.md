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

The top banner `Plan` button opens a four-week, seven-day editable planner. Planned days can hold the same exercises as the Training logger, calculate target loads from saved 1-rep maxes, use editable intensity profiles such as `85 | 80 | 75` or `75 | 70 | 65`, and round weights by equipment type.

Planner days can be copied to another day, copied week-to-week, auto-filled with daily meditation or mobility, saved as templates, or loaded directly into the Training session for final edits before logging.

## Race Balance Notes

Transformation availability is race-gated. Earthlings, Saiyans, Half-Saiyans, Namekians, and Perfect Androids can use true Kaioken forms, Ultra Instinct forms, and Ultra Ego, while Frieza Race and Majin characters cannot. Half-Saiyans can use most Saiyan transformations, but not Super Saiyan 4, Legendary/Broly forms, or god/Super Saiyan Blue branches.

Race passives now affect long-term progression: Frieza Race boosts partner and training effects but has harder Dragon Ball hunts, Namekians find Dragon Balls faster, Earthlings gain broader training/saga/ability advantages, Half-Saiyans gain scaling partner XP, and Perfect Android/Majin runs use absorption mechanics on the Transformation page.
