import test from 'node:test';
import assert from 'node:assert/strict';
import '../dbz-v6-config.js';
import '../dbz-v6-progression-config.js';
import '../dbz-v6-progression-core.js';

const core = globalThis.DBZ_V6_PROGRESSION;

test('cores copy one bounded trait without changing partner levels', () => {
    const partner = { id: 'piccolo', name: 'Piccolo', canonPL: 1000000, effects: { statBonus: { VIT: 0.5, SPI: 0.3 }, txpBonus: 0.2 } };
    const progress = { level: 80, totalXp: 250000 };
    const before = structuredClone(progress);
    const coreResult = core.buildAbsorptionCore(partner, progress, 'majin');
    assert.deepEqual(progress, before);
    assert.equal(coreResult.trait.key, 'VIT');
    assert.ok(coreResult.trait.value <= 0.12);
    assert.deepEqual(Object.keys(coreResult.effects.statBonus), ['VIT']);
});

test('core and template collections are capped at three', () => {
    const char = { race: 'majin', unlockedTransformations: ['base'], equippedTransformations: ['base'], raceProgression: { absorptionCores: [], earnedTiers: ['base'] } };
    for (let index = 0; index < 5; index += 1) {
        core.installAbsorptionCore(char, { id: `c${index}`, sourcePartnerId: `p${index}`, quality: 50, active: true }, 'majin');
    }
    assert.equal(char.raceProgression.absorptionCores.length, 3);
});

test('an active copied trait suppresses its source partner from double-dipping', () => {
    const char = { race: 'majin', raceProgression: { absorptionCores: [{ sourcePartnerId: 'p1', active: true }] } };
    assert.equal(core.isPartnerSuppressedByCore(char, 'p1'), true);
    assert.equal(core.isPartnerSuppressedByCore(char, 'p2'), false);
});
