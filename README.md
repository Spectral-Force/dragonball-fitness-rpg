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

The current build uses the v5 cascade dashboard for phone use. The top banner depends on `icons/top_banner.png`, so keep that file beside the icon set and include it in the service worker app shell when updating the PWA cache.

Character comparison targets include all seven stats, including Technique (`TEC`), with benchmark stats balanced by archetype.
