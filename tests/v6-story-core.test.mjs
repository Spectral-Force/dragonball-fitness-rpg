import test from 'node:test';
import assert from 'node:assert/strict';
import '../dbz-v6-config.js';
import '../dbz-v6-story-core.js';

const core = globalThis.DBZ_V6_STORY_CORE;
const config = globalThis.DBZ_V6_CONFIG;

function makeEntries(prefix) {
    return [
        {
            id: `${prefix}_entry`, order: 1, phase: 'entry', title: 'Arrival',
            canonText: `Canon context opens ${prefix}.`,
            characterText: `An original character moment opens ${prefix}.`,
            playerReflection: `The player considers the first demand of ${prefix}.`,
            characters: ['hero'], tags: ['opening']
        },
        {
            id: `${prefix}_development`, order: 2, phase: 'development', focusRatio: 0.25,
            title: 'Pressure', canonText: `Canon pressure grows in ${prefix}.`,
            characterText: `An original character response develops ${prefix}.`,
            playerReflection: `The player measures steady progress in ${prefix}.`,
            characters: ['hero'], tags: ['focus']
        },
        {
            id: `${prefix}_preclimax`, order: 3, phase: 'preclimax', focusRatio: 0.75,
            title: 'Threshold', canonText: `Canon stakes peak before the end of ${prefix}.`,
            characterText: `An original character choice sharpens ${prefix}.`,
            playerReflection: `The player prepares for the final test of ${prefix}.`,
            characters: ['hero'], tags: ['focus', 'climax']
        },
        {
            id: `${prefix}_resolution`, order: 4, phase: 'resolution', title: 'Aftermath',
            canonText: `Canon consequences settle after ${prefix}.`,
            characterText: `An original character response closes ${prefix}.`,
            playerReflection: `The player records what clearing ${prefix} required.`,
            characters: ['hero'], tags: ['clear']
        },
        {
            id: `${prefix}_mastery`, order: 5, phase: 'mastery', title: 'Mastery',
            canonText: `Canon themes remain after ${prefix}.`,
            characterText: `An original character insight revisits ${prefix}.`,
            playerReflection: `The player turns ${prefix} into durable practice.`,
            characters: ['hero'], tags: ['mastery']
        }
    ];
}

function makePack(id) {
    return {
        id,
        title: `Saga ${id}`,
        series: id.startsWith('dbs_') ? 'DBS' : id.startsWith('dbz_') ? 'DBZ' : id.startsWith('daima_') ? 'DAIMA' : 'DB',
        continuity: 'Main story continuity',
        sourceNote: 'Original summary based on high-level events.',
        entries: makeEntries(id)
    };
}

function makeCompleteStoryData() {
    return {
        version: '6.4.0',
        sagas: Object.fromEntries(Object.keys(config.sagaTargetWeeks).map(id => [id, makePack(id)])),
        characters: {},
        relationships: {}
    };
}

const sampleData = {
    version: '6.4.0',
    sagas: { dbz_vegeta: makePack('dbz_vegeta') },
    characters: {},
    relationships: {}
};

test('status ranking is conservative and monotonic', () => {
    assert.equal(core.sagaStatusRank('locked'), 0);
    assert.equal(core.sagaStatusRank('unlocked'), 1);
    assert.equal(core.sagaStatusRank({ status: 'cleared' }), 2);
    assert.equal(core.sagaStatusRank('mastered'), 3);
    assert.equal(core.sagaStatusRank('completed'), 0);
    assert.equal(core.sagaStatusRank(null), 0);
});

test('Focus normalization clamps values and rejects unusable targets', () => {
    assert.equal(core.normalizeFocusRatio(0, 100), 0);
    assert.equal(core.normalizeFocusRatio(25, 100), 0.25);
    assert.equal(core.normalizeFocusRatio(250, 100), 1);
    assert.equal(core.normalizeFocusRatio(-5, 100), 0);
    assert.equal(core.normalizeFocusRatio({ focusRatio: 0.6 }, 999), 0.6);
    assert.equal(core.normalizeFocusRatio({ focusXP: 25 }, 0), 0);
    assert.equal(core.normalizeFocusRatio('not-a-number', 100), 0);
});

test('an unlocked saga at 0% exposes only its entry beat', () => {
    const state = {
        sagaProgress: { dbz_vegeta: { status: 'unlocked', focusXP: 0 } },
        completedSagas: []
    };
    const resolved = core.resolveSagaEntries(sampleData, 'dbz_vegeta', state, { focusTarget: 100 });
    assert.deepEqual(resolved.map(entry => entry.unlocked), [true, false, false, false, false]);
    assert.equal(core.getLatestSagaEntry(sampleData, 'dbz_vegeta', state, { focusTarget: 100 }).phase, 'entry');
});

test('locked sagas expose no entries, even with enough Focus', () => {
    const state = { sagaProgress: { dbz_vegeta: { status: 'locked', focusXP: 100 } } };
    const resolved = core.resolveSagaEntries(sampleData, 'dbz_vegeta', state, { focusTarget: 100 });
    assert.ok(resolved.every(entry => !entry.unlocked));
    assert.equal(core.getLatestSagaEntry(sampleData, 'dbz_vegeta', state, { focusTarget: 100 }), null);
});

test('development and preclimax beats use normalized Focus thresholds', () => {
    const state = { sagaProgress: { dbz_vegeta: { status: 'unlocked', focusXP: 25 } } };
    let resolved = core.resolveSagaEntries(sampleData, 'dbz_vegeta', state, { focusTarget: 100 });
    assert.equal(resolved[1].unlocked, true);
    assert.equal(resolved[2].unlocked, false);

    state.sagaProgress.dbz_vegeta.focusXP = 75;
    resolved = core.resolveSagaEntries(sampleData, 'dbz_vegeta', state, { focusTarget: 100 });
    assert.equal(resolved[2].unlocked, true);
    assert.equal(resolved[3].unlocked, false, '100% Focus is not evidence of clearing');
});

test('resolution requires actual exact-saga clear evidence', () => {
    const resolution = sampleData.sagas.dbz_vegeta.entries[3];
    const states = [
        { sagaProgress: { dbz_vegeta: { status: 'cleared' } } },
        { sagaProgress: { dbz_vegeta: { status: 'unlocked', clearedAt: '2026-08-03' } } },
        { sagaProgress: { dbz_vegeta: { status: 'unlocked' } }, completedSagas: ['dbz_vegeta'] }
    ];
    for (const state of states) assert.equal(core.shouldUnlockEntry(resolution, 'dbz_vegeta', state), true);
    assert.equal(core.shouldUnlockEntry(resolution, 'dbz_vegeta', {
        sagaProgress: { dbz_vegeta: { status: 'unlocked', focusXP: 1000 } }
    }, { focusTarget: 100 }), false);
});

test('mastery requires mastered status or masteredAt, not merely a clear', () => {
    const mastery = sampleData.sagas.dbz_vegeta.entries[4];
    assert.equal(core.shouldUnlockEntry(mastery, 'dbz_vegeta', {
        sagaProgress: { dbz_vegeta: { status: 'cleared', clearedAt: '2026-08-03' } },
        completedSagas: ['dbz_vegeta']
    }), false);
    assert.equal(core.shouldUnlockEntry(mastery, 'dbz_vegeta', {
        sagaProgress: { dbz_vegeta: { status: 'mastered' } }
    }), true);
    assert.equal(core.shouldUnlockEntry(mastery, 'dbz_vegeta', {
        sagaProgress: { dbz_vegeta: { status: 'cleared', masteredAt: '2026-08-04T10:00:00Z' } }
    }), true);
});

test('similar saga IDs cannot leak unlock, clear, or mastery state', () => {
    const entry = sampleData.sagas.dbz_vegeta.entries[0];
    const resolution = sampleData.sagas.dbz_vegeta.entries[3];
    const mastery = sampleData.sagas.dbz_vegeta.entries[4];
    const state = {
        unlockedSagas: ['dbz_vegeta_extra'],
        completedSagas: ['dbz_vegeta_extra'],
        sagaProgress: {
            dbz_vegeta_extra: {
                status: 'mastered',
                unlockedAt: '2026-08-01',
                clearedAt: '2026-08-02',
                masteredAt: '2026-08-03'
            }
        }
    };
    assert.equal(core.shouldUnlockEntry(entry, 'dbz_vegeta', state), false);
    assert.equal(core.shouldUnlockEntry(resolution, 'dbz_vegeta', state), false);
    assert.equal(core.shouldUnlockEntry(mastery, 'dbz_vegeta', state), false);
    assert.deepEqual(core.resolveSagaEntries(sampleData, 'dbz_veget', state), []);
});

test('an entry carrying a different sagaId is rejected defensively', () => {
    const entry = { ...sampleData.sagas.dbz_vegeta.entries[0], sagaId: 'dbz_raditz' };
    assert.equal(core.shouldUnlockEntry(entry, 'dbz_vegeta', {
        sagaProgress: { dbz_vegeta: { status: 'unlocked' } }
    }), false);
});

test('latest saga entry is the highest-order currently eligible beat', () => {
    const state = {
        sagaProgress: { dbz_vegeta: { status: 'cleared', focusXP: 100 } },
        completedSagas: ['dbz_vegeta']
    };
    assert.equal(core.getLatestSagaEntry(sampleData, 'dbz_vegeta', state, { focusTarget: 100 }).phase, 'resolution');
    state.sagaProgress.dbz_vegeta.status = 'mastered';
    assert.equal(core.getLatestSagaEntry(sampleData, 'dbz_vegeta', state, { focusTarget: 100 }).phase, 'mastery');
});

test('validator accepts all 38 configured saga packs', () => {
    const result = core.validateStoryData(makeCompleteStoryData(), config);
    assert.equal(result.valid, true, result.errors.join('\n'));
    assert.equal(result.sagaCount, 38);
    assert.equal(result.entryCount, 190);
});

test('validator reports missing configured sagas and globally duplicate entry IDs', () => {
    const data = makeCompleteStoryData();
    delete data.sagas.db_pilaf;
    data.sagas.dbz_vegeta.entries[0].id = data.sagas.dbz_raditz.entries[0].id;
    const result = core.validateStoryData(data, config);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes('Missing configured saga: db_pilaf')));
    assert.ok(result.errors.some(error => error.includes('Duplicate story entry id')));
});

test('validator rejects malformed pack metadata, ordering, phases, text, arrays, and thresholds', () => {
    const pack = makePack('broken');
    pack.continuity = '';
    pack.sourceNote = '';
    pack.entries[1].order = 1;
    pack.entries[1].phase = 'intermission';
    pack.entries[1].focusRatio = 2;
    pack.entries[1].canonText = '';
    pack.entries[1].characters = [];
    pack.entries[1].tags = ['same', 'same'];
    pack.entries = pack.entries.filter(entry => entry.phase !== 'mastery');
    const result = core.validateStoryData({
        version: '6.4.0', sagas: { broken: pack }, characters: {}, relationships: {}
    }, null);
    assert.equal(result.valid, false);
    for (const fragment of ['requires continuity', 'requires sourceNote', 'strictly increasing order',
        'unsupported phase', 'focusRatio must be between', 'requires original canonText',
        'non-empty characters', 'unique, non-empty strings', 'requires a mastery entry']) {
        assert.ok(result.errors.some(error => error.includes(fragment)), fragment);
    }
});

test('validator requires thresholds on Focus phases and entry/resolution/mastery coverage', () => {
    const pack = makePack('thin');
    delete pack.entries[1].focusRatio;
    pack.entries = pack.entries.filter(entry => !['entry', 'resolution'].includes(entry.phase));
    const result = core.validateStoryData({
        version: '6.4.0', sagas: { thin: pack }, characters: {}, relationships: {}
    }, null);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => error.includes('requires a focusRatio')));
    assert.ok(result.errors.some(error => error.includes('requires a entry entry')));
    assert.ok(result.errors.some(error => error.includes('requires a resolution entry')));
});

test('migration strips duplicated prose while preserving IDs, timestamps, read state, and order history', () => {
    const legacy = {
        unlockedEntries: {
            dbz_vegeta_entry: {
                id: 'dbz_vegeta_entry', title: 'Duplicated title', text: ['Duplicated prose'],
                source: 'Duplicated source', tags: ['duplicated'], unlockedAt: '2026-08-01T09:00:00Z'
            },
            dbz_vegeta_resolution: {
                id: 'dbz_vegeta_resolution', title: 'Premature old clear',
                summary: ['Focus used to unlock this prematurely.'], unlockedAt: '2026-08-02T09:00:00Z'
            }
        },
        readEntries: {
            dbz_vegeta_entry: '2026-08-01T10:00:00Z',
            dbz_vegeta_resolution: true
        },
        lastUnlockedEntryIds: ['dbz_vegeta_resolution', 'dbz_vegeta_entry']
    };
    const migrated = core.migrateLegacyStoryLog(legacy, sampleData, {
        migratedAt: '2026-08-03T12:00:00Z'
    });

    assert.equal(migrated.schemaVersion, 1);
    assert.equal(migrated.contentVersion, '6.4.0');
    assert.deepEqual(migrated.lastUnlockedEntryIds, ['dbz_vegeta_resolution', 'dbz_vegeta_entry']);
    assert.deepEqual(migrated.entries.dbz_vegeta_entry, {
        unlocked: true,
        unlockedAt: '2026-08-01T09:00:00Z',
        read: true,
        readAt: '2026-08-01T10:00:00Z'
    });
    const serialized = JSON.stringify(migrated);
    assert.ok(!serialized.includes('Duplicated prose'));
    assert.ok(!serialized.includes('Duplicated title'));
    assert.ok(!serialized.includes('Premature old clear'));
});

test('migration is idempotent and keeps unknown historical IDs', () => {
    const legacy = {
        unlockedEntries: { retired_story_id: true },
        readEntries: { retired_story_id: true },
        lastUnlockedEntryIds: ['retired_story_id']
    };
    const first = core.migrateLegacyStoryLog(legacy, sampleData, { migratedAt: '2026-08-03T12:00:00Z' });
    const second = core.migrateLegacyStoryLog(first, sampleData, { migratedAt: '2027-01-01T00:00:00Z' });
    assert.deepEqual(second, first);
    assert.equal(second.entries.retired_story_id.unlocked, true);
    assert.equal(second.entries.retired_story_id.read, true);
});

test('migrated legacy unlock history does not grant an unearned resolution', () => {
    const storyLog = core.migrateLegacyStoryLog({
        unlockedEntries: {
            dbz_vegeta_resolution: { id: 'dbz_vegeta_resolution', unlockedAt: '2026-08-02' }
        },
        readEntries: { dbz_vegeta_resolution: true }
    }, sampleData);
    const state = {
        sagaProgress: { dbz_vegeta: { status: 'unlocked', focusXP: 100 } },
        storyLog
    };
    const resolution = core.resolveSagaEntries(sampleData, 'dbz_vegeta', state, { focusTarget: 100 })[3];
    assert.equal(resolution.historicallyUnlocked, true);
    assert.equal(resolution.read, true);
    assert.equal(resolution.unlocked, false);
});
