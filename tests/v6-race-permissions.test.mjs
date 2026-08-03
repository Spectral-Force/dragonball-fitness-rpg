import test from 'node:test';
import assert from 'node:assert/strict';
import '../dbz-v6-config.js';
import '../dbz-v6-progression-config.js';
import '../dbz-v6-progression-core.js';

const core = globalThis.DBZ_V6_PROGRESSION;

const transformations = [
    { id: 'base', race: 'universal', mult: 1 },
    { id: 'human_full_potential', race: 'earthling', powerMultiplier: 5 },
    { id: 'super_saiyan', race: 'saiyan', powerMultiplier: 50 },
    { id: 'super_saiyan_2_gohan', race: 'hybrid', powerMultiplier: 100 },
    { id: 'orange_piccolo', race: 'namekian', powerMultiplier: 1000 },
    { id: 'perfect_form', race: 'android', powerMultiplier: 100 },
    { id: 'black_frieza', race: 'frieza_race', powerMultiplier: 80000 },
    { id: 'ultra_instinct_sign', race: 'saiyan', powerMultiplier: 10000 }
];

function character(race, overrides = {}) {
    return {
        race,
        storyXP: 0,
        totalTXP: 0,
        unlockedTransformations: ['base'],
        equippedTransformations: ['base'],
        transformationSlots: 3,
        completedSagas: [],
        sagaProgress: {},
        ...overrides
    };
}

test('race permissions reject every conventional wrong-race form', () => {
    const expected = {
        earthling: 'human_full_potential',
        saiyan: 'super_saiyan',
        hybrid: 'super_saiyan_2_gohan',
        namekian: 'orange_piccolo',
        android: 'perfect_form',
        frieza_race: 'black_frieza'
    };
    for (const [race, validId] of Object.entries(expected)) {
        const char = character(race, { raceProgression: { androidPath: 'bio' } });
        for (const transformation of transformations.filter(item => !['base', 'ultra_instinct_sign'].includes(item.id))) {
            assert.equal(
                core.isRaceCompatible(char, transformation),
                transformation.id === validId || (race === 'hybrid' && transformation.id === 'super_saiyan'),
                `${race} permission for ${transformation.id}`
            );
        }
    }
    assert.equal(core.isRaceCompatible(character('majin'), transformations[2]), false);
});

test('shared divine forms require an explicit discipline outside Saiyan routes', () => {
    const earthling = character('earthling', { raceProgression: { divineDiscipline: 'native' } });
    assert.equal(core.isRaceCompatible(earthling, transformations.at(-1)), false);
    earthling.raceProgression.divineDiscipline = 'instinct';
    assert.equal(core.isRaceCompatible(earthling, transformations.at(-1)), true);
});

test('contaminated equipment is repaired but discovery history is preserved', () => {
    const char = character('earthling', {
        storyXP: 100,
        unlockedTransformations: ['base', 'black_frieza'],
        equippedTransformations: ['black_frieza', 'base']
    });
    core.ensureCharacterProgression(char, { transformations });
    assert.deepEqual(char.equippedTransformations, ['base']);
    assert.ok(char.unlockedTransformations.includes('black_frieza'));
    assert.ok(char.raceProgression.dormantTransformationIds.includes('black_frieza'));
});

test('a compatible form discovered before its tier is locked, not mislabeled as wrong-path', () => {
    const char = character('earthling', {
        unlockedTransformations: ['base', 'human_full_potential'],
        raceProgression: { earnedTiers: ['base'] }
    });
    const status = core.getTransformationStatus(char, transformations[1], {
        transformations,
        basePower: 1
    });
    assert.equal(status.key, 'locked');
    assert.equal(status.discovered, true);
    assert.ok(status.blockers.length > 0);
});

test('trained characters cannot switch race', () => {
    const trained = character('saiyan', { totalTXP: 1 });
    core.ensureCharacterProgression(trained, { transformations });
    assert.equal(core.canChangeRace(trained, 'earthling').ok, false);
    assert.equal(core.canChangeRace(character('saiyan'), 'earthling').ok, true);
});
