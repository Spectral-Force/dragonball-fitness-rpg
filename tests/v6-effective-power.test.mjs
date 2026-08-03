import test from 'node:test';
import assert from 'node:assert/strict';
import '../dbz-v6-config.js';
import '../dbz-v6-progression-config.js';
import '../dbz-v6-progression-core.js';

const core = globalThis.DBZ_V6_PROGRESSION;
const transformations = [
    { id: 'base', race: 'universal', powerMultiplier: 1 },
    { id: 'super_saiyan', race: 'saiyan', powerMultiplier: 50 },
    { id: 'super_saiyan_2', race: 'saiyan', powerMultiplier: 100 }
];

function masteredSaiyan(equipped) {
    return {
        race: 'saiyan',
        storyXP: 4000,
        totalTXP: 10000,
        completedSagas: ['dbz_frieza', 'dbz_cell_games'],
        sagaProgress: {},
        unlockedTransformations: ['base', 'super_saiyan', 'super_saiyan_2'],
        equippedTransformations: equipped,
        transformationSlots: 3,
        raceProgression: {
            version: '6.3.0',
            schema32MigratedAt: '2026-08-03T00:00:00.000Z',
            earnedTiers: ['base', 'first_break', 'surge', 'mastered_surge', 'z_state', 'evolved_z'],
            breakthroughs: {}
        }
    };
}

test('echo multipliers never change story power', () => {
    const primary50 = masteredSaiyan(['super_saiyan', 'super_saiyan_2']);
    const primary100 = masteredSaiyan(['super_saiyan_2', 'super_saiyan']);
    assert.equal(core.getPrimaryStateMultiplier(primary50, transformations), 50);
    assert.equal(core.getPrimaryStateMultiplier(primary100, transformations), 100);
    assert.equal(core.calculateEffectivePower(1000, core.getRacePowerState(primary50, { transformations, basePower: 1000 })), 100000);
    assert.equal(core.calculateEffectivePower(1000, core.getRacePowerState(primary100, { transformations, basePower: 1000 })), 100000);
});

test('Base mastery does not count as transformation mastery support', () => {
    const char = {
        race: 'saiyan', storyXP: 0, totalTXP: 0, unlockedTransformations: ['base'],
        equippedTransformations: ['base'], transformationSlots: 1,
        transformationMastery: { base: { xp: 999999 } }, raceProgression: { earnedTiers: ['base'] }
    };
    const support = core.getSupportQuality(char, { transformations, abilities: [] });
    assert.equal(support.components.mastery, 0);
    assert.equal(support.primaryId, 'base');
});

test('fixed route tiers do not read or imitate the next saga target', () => {
    const char = masteredSaiyan(['base']);
    char.raceProgression.earnedTiers = ['base', 'first_break'];
    const state = core.getRacePowerState(char, { transformations, basePower: 500 });
    assert.equal(state.tierMultiplier, 3);
    assert.equal(state.multiplier, 3);
});
