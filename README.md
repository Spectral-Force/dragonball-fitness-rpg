# Dragon Ball Fitness RPG v7

[Play the game](https://spectral-force.github.io/dragonball-fitness-rpg/)

A long-form fitness RPG for desktop and mobile: record real workouts, develop seven individual stats, and progress through 38 sagas across eight race paths. Collect 89 training partners, 95 abilities, 52 transformations and 32 illustrated equipment upgrades.

## Existing mobile installations

Open your existing app while online. Its old v6 launch address now opens v7 on the same site, so no reinstall is required. If it initially shows v6, allow the update to download, then close and reopen it. Future releases are checked on launch, return online and return to the app. Updates wait while an editor or dialog is open and save the current workout draft before refreshing.

The first v7 launch imports the newest valid v6 save from the same browser/site. Original v6 data remains untouched and is also retained in the v7 migration archive. Subsequent launches continue your v7 progress. Saves are local to each device and browser; desktop and mobile progress do not sync automatically. Settings & backup supports export/import and recovery snapshots.

## Playing and training

- **Today:** prominent TP/AP, player level, all seven stats, current story, growth plot, partners, abilities, equipment and Dragon Radar.
- **Train:** editable workout templates, a four-week planner, set and distance logging, notes, drafts and rest timers.
- **Develop:** partners, equipment, abilities, race paths and transformations, with level effects and unlock requirements.
- **Adventure:** story progression, archive, saga replays, Dragon Balls and wishes.
- **Records:** history, calendar, personal records, body weight, stat growth, goals and training projections.

The installed shell is approximately 5.24 MB. Artwork loads as needed; Settings & backup offers the complete offline art download. Sound is optional. Reduced-motion preferences are supported.

## Development

Serve the repository with Node.js:

```sh
node analysis/serve_v7.mjs
```

Open http://127.0.0.1:8878/. Rebuild the release manifest, launch aliases and service workers after runtime changes:

```sh
node analysis/build_v7_release.mjs
node --test tests/*.test.mjs
```

GitHub Pages publishes this repository's `main` branch. The v6 manifest ID and compatibility worker URLs deliberately remain stable so existing installed apps can update. Historical v6 files remain for regression coverage.
