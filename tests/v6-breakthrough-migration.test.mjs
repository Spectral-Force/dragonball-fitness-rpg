import test from 'node:test';
import assert from 'node:assert/strict';
import '../dbz-v6-config.js';
import '../dbz-v6-progression-config.js';
import '../dbz-v6-progression-core.js';

const config = globalThis.DBZ_V6_PROGRESSION_CONFIG;
const core = globalThis.DBZ_V6_PROGRESSION;

test('every route has a fixed native answer for every canonical state band', () => {
    const expected = config.stateBands.map(band => [band.id, band.multiplier, band.sagaId]);
    for (const route of Object.values(config.routes)) {
        assert.deepEqual(
            route.tiers.map(tier => [tier.bandId, tier.multiplier, tier.sagaId]),
            expected,
            route.id
        );
    }
});

test('every breakthrough is exposed before or at its saga clear gate', () => {
    for (const band of config.stateBands.filter(item => item.id !== 'base')) {
        const saga = config.sagas.find(item => item.id === band.sagaId);
        assert.ok(saga, band.sagaId);
        assert.ok(saga.breakthroughIds.includes(band.id), `${band.id} is advertised in ${saga.id}`);
        assert.ok(saga.storyUnlockXP <= saga.storyClearXP, `${band.id} unlocks before clear`);
    }
    const finale = config.sagas.find(saga => saga.id === 'dbs_granolah');
    assert.equal(finale.unlockWeek, 153);
    assert.equal(finale.clearWeek, 156);
    assert.equal(finale.targetWeek, 156);
});

test('breakthrough saga checks cannot recurse into the generated power gate', () => {
    const char = {
        race: 'earthling',
        storyXP: 1650,
        completedSagas: ['dbz_raditz'],
        sagaProgress: { dbz_vegeta: { focusXP: 20 } },
        unlockedTransformations: ['base'],
        equippedTransformations: ['base'],
        raceProgression: { earnedTiers: ['base'] }
    };
    let delegated = false;
    const status = core.getBreakthroughStatus(char, 'first_break', {
        basePower: 1000,
        transformations: [{ id: 'base', race: 'universal', powerMultiplier: 1 }],
        getSagaStatus: () => {
            delegated = true;
            throw new Error('recursive saga gate');
        }
    });
    assert.equal(delegated, false);
    assert.ok(!status.blockers.some(blocker => blocker.startsWith('Reach ')));
});

test('schema-31 migration preserves history, bounds legacy absorption and is idempotent', () => {
    const char = {
        race: 'majin',
        totalTXP: 500,
        storyXP: 4000,
        startedAt: '2025-01-01T00:00:00.000Z',
        workoutLog: [{ date: '2025-01-01T00:00:00.000Z', txp: 100 }],
        completedSagas: ['dbz_frieza'],
        unlockedTransformations: ['base', 'black_frieza'],
        equippedTransformations: ['black_frieza'],
        activePartners: ['goku', 'vegeta'],
        mainPartner: 'goku',
        raceAbsorptions: {
            majin: {
                absorbed: {
                    a: { partnerId: 'goku', partnerName: 'Goku', level: 45, effects: { statBonus: { STR: 0.4 } } },
                    b: { partnerId: 'vegeta', partnerName: 'Vegeta', level: 35, effects: { txpBonus: 0.3 } },
                    c: { partnerId: 'piccolo', partnerName: 'Piccolo', level: 25, effects: { statBonus: { TEC: 0.2 } } },
                    d: { partnerId: 'krillin', partnerName: 'Krillin', level: 15, effects: { statBonus: { AGI: 0.1 } } }
                }
            }
        }
    };
    const transformations = [
        { id: 'base', race: 'universal', powerMultiplier: 1 },
        { id: 'black_frieza', race: 'frieza_race', powerMultiplier: 80000 }
    ];

    const first = core.ensureCharacterProgression(char, { transformations });
    const migratedAt = first.schema32MigratedAt;
    const receipt = structuredClone(first.migrationReceipt);

    assert.equal(first.absorptionCores.length, 3);
    assert.deepEqual(char.equippedTransformations, ['base']);
    assert.ok(char.unlockedTransformations.includes('black_frieza'));
    assert.ok(first.dormantTransformationIds.includes('black_frieza'));
    assert.ok(first.earnedTiers.includes('z_state'));
    assert.equal(char.raceLockedRace, 'majin');
    assert.equal(char.completedSagas[0], 'dbz_frieza');
    assert.equal(char.workoutLog.length, 1);
    assert.ok(first.absorptionCores.every(coreItem => coreItem.trait.value <= 0.12));
    assert.ok(!char.activePartners.includes('goku'));

    const second = core.ensureCharacterProgression(char, { transformations });
    assert.equal(second.schema32MigratedAt, migratedAt);
    assert.deepEqual(second.migrationReceipt, receipt);
    assert.equal(second.absorptionCores.length, 3);
});

test('partial schema-32 saves recover a missing migration receipt', () => {
    const char = {
        race: 'earthling',
        unlockedTransformations: ['base'],
        equippedTransformations: ['base'],
        raceProgression: {
            schema32MigratedAt: '2026-08-03T00:00:00.000Z',
            earnedTiers: ['base']
        }
    };
    const progression = core.ensureCharacterProgression(char, {
        transformations: [{ id: 'base', race: 'universal', powerMultiplier: 1 }]
    });
    assert.equal(progression.migrationReceipt.schema, 32);
    assert.deepEqual(progression.migrationReceipt.repairedEquipment, []);
});
