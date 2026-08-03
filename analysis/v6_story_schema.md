# Dragon Ball Fitness RPG v6.4 story schema

## Runtime contract

Story content is data, while `dbz-v6-story-core.js` owns validation and unlock decisions. Content scripts load first and merge packs into one shared object:

```js
globalThis.DBZ_V6_STORY_DATA ||= {
    version: '6.4.0',
    sagas: {},
    characters: {},
    relationships: {}
};

Object.assign(globalThis.DBZ_V6_STORY_DATA.sagas, sagaPacks);
```

Content modules must not replace an object that another module may already have populated. The story core loads after every content module and installs the browser/Node-safe `globalThis.DBZ_V6_STORY_CORE` API.

## Saga packs

Every configured saga ID must have exactly one pack under the matching key:

```js
{
    id: 'dbz_vegeta',
    title: 'Vegeta Saga',
    series: 'DBZ',
    continuity: 'Main anime continuity',
    sourceNote: 'Original high-level summary; no copied dialogue.',
    entries: [ /* ordered story entries */ ]
}
```

`continuity` identifies how the pack fits the campaign. `sourceNote` records the adaptation/source basis. Both are required non-empty strings rather than implicit assumptions.

The configured v6.4 campaign contains these 38 exact IDs:

```text
db_pilaf, db_tournament, db_red_ribbon, db_general_blue,
db_commander_red, db_baba, db_tien, db_king_piccolo, db_piccolo_jr,
dbz_raditz, dbz_vegeta, dbz_namek, dbz_ginyu, dbz_frieza,
dbz_garlic, dbz_trunks, dbz_androids, dbz_cell_imperfect,
dbz_cell_perfect, dbz_cell_games, dbz_other_world,
dbz_great_saiyaman, dbz_world_tournament, dbz_babidi, dbz_buu,
dbz_fusion, dbz_kid_buu, daima_demon, daima_supreme_kai,
daima_true_form, dbs_beerus, dbs_golden_frieza, dbs_universe6,
dbs_copy_vegeta, dbs_future_trunks, dbs_universe_survival,
dbs_galactic_patrol, dbs_granolah
```

When `DBZ_V6_CONFIG` is loaded, validation requires that entire set and rejects unknown saga keys. This is deliberately exact: prefixes and similar IDs are not campaign membership.

## Story entries

Each pack contains entries in strictly increasing `order`, and phases may not move backwards:

```js
{
    id: 'dbz_vegeta_01_arrival',
    order: 1,
    phase: 'entry',
    title: 'A New Scale',
    canonText: 'A concise, original high-level account of the saga event.',
    characterText: 'Original character-focused writing for this beat.',
    playerReflection: 'A fitness reflection connecting the beat to earned progress.',
    characters: ['goku', 'vegeta'],
    tags: ['saiyans', 'pressure'],
    focusRatio: 0.25 // required only for Focus phases
}
```

The supported phases, in order, are:

| Phase | Unlock evidence |
| --- | --- |
| `entry` | The exact saga is unlocked. |
| `development` | Saga unlocked and normalized Focus meets `focusRatio`. |
| `preclimax` | Saga unlocked and normalized Focus meets `focusRatio`. |
| `resolution` | Actual clear evidence: `cleared`/`mastered` status, valid `clearedAt`/`masteredAt`, or exact membership in `completedSagas`. |
| `mastery` | Actual mastery evidence: `mastered` status or valid `masteredAt`. |

Every saga requires at least `entry`, `resolution`, and `mastery` coverage. `development` and `preclimax` require a finite `focusRatio` above 0 and at most 1. If `focusRatio` appears on another phase, it must still be between 0 and 1 but does not replace that phase's evidence.

Entry IDs are globally unique. `title`, `canonText`, `characterText`, and `playerReflection` are required non-empty strings; the three text bodies must be distinct. `characters` and `tags` are non-empty arrays of unique, non-empty strings.

## Character state consumed by the core

The selectors accept a character-like state without mutating it:

```js
{
    sagaProgress: {
        dbz_vegeta: {
            status: 'unlocked', // locked | unlocked | cleared | mastered
            focusXP: 30,
            focusTarget: 60,
            unlockedAt: '2026-08-01T09:00:00Z',
            clearedAt: null,
            masteredAt: null
        }
    },
    unlockedSagas: ['dbz_vegeta'],
    completedSagas: [],
    storyLog: { /* compact schema below */ }
}
```

All saga lookups use exact object keys or exact array membership. Progress for `dbz_vegeta_extra`, a later saga, or a similarly prefixed saga can never authorize `dbz_vegeta`.

For Focus phases, callers pass one of these targets to `shouldUnlockEntry`/`resolveSagaEntries`/`getLatestSagaEntry`:

1. `options.focusTarget`;
2. `options.focusTargets[sagaId]`;
3. `sagaProgress[sagaId].focusTarget` or `.focusClearXP`; or
4. `options.progressionConfig.sagas[].focusClearXP`.

If no positive target exists and the progress record has no explicit `focusRatio`, the normalized ratio is safely 0.

## Core API

`validateStoryData(data, config?)`
: Returns `{ valid, errors, sagaCount, entryCount }`. It never mutates or freezes content. Omitting `config` uses the installed `DBZ_V6_CONFIG`; passing `null` performs structural validation without configured-saga completeness checks.

`sagaStatusRank(statusOrProgress)`
: Maps `locked`, `unlocked`, `cleared`, and `mastered` to 0 through 3. Unknown values rank as locked; aliases are not silently promoted.

`normalizeFocusRatio(focus, target = 1)`
: Returns a finite value clamped to 0 through 1. `focus` may be a number, `{ focusXP }`, or `{ focusRatio }`.

`shouldUnlockEntry(entry, sagaId, state = {}, options = {})`
: Applies the phase table above to one entry. Historical story-log state is not treated as progression evidence.

`resolveSagaEntries(storyData, sagaId, state = {}, options = {})`
: Resolves the exact pack and returns its entries with ephemeral `sagaId`, `unlocked`, `historicallyUnlocked`, `unlockedAt`, `read`, and `readAt` fields. These resolved objects are render models, not save data.

`getLatestSagaEntry(storyData, sagaId, state = {}, options = {})`
: Returns the highest-order currently eligible entry for the exact saga, or `null`.

`migrateLegacyStoryLog(legacyStoryLog, storyData, options = {})`
: Purely returns the compact schema below. `options.migratedAt` may supply a timestamp; the function does not read the clock. Re-running migration on migrated data returns the same structure and retains the first migration timestamp.

## Compact story-log save schema

The save contains identity and player state, never copied story prose:

```js
{
    schemaVersion: 1,
    contentVersion: '6.4.0',
    migratedAt: '2026-08-03T12:00:00Z',
    entries: {
        dbz_vegeta_01_arrival: {
            unlocked: true,
            unlockedAt: '2026-08-01T09:00:00Z',
            read: true,
            readAt: '2026-08-01T09:05:00Z'
        }
    },
    lastUnlockedEntryIds: ['dbz_vegeta_01_arrival']
}
```

Migration preserves known and retired entry IDs, timestamps, read state, and recent-unlock order. It removes legacy `title`, `text`, `summary`, `source`, and tag payloads. A legacy entry can remain `historicallyUnlocked: true` after resolution, but resolution stays locked until the exact saga has real clear evidence. Thus old history survives without turning an old Focus-only bug into a campaign reward. A small distinction, but rather an important one.

## Validation and loading

After content modules load, integration should validate before presenting story content:

```js
const report = DBZ_V6_STORY_CORE.validateStoryData(DBZ_V6_STORY_DATA);
if (!report.valid) {
    console.error('Invalid v6.4 story data', report.errors);
}
```

The core itself does not mutate `DBZ_V6_STORY_DATA`, character progress, or story logs. Content assembly, save writes, and UI rendering remain separate responsibilities.
