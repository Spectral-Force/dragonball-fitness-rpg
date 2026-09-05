import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacy, validateState, validDate, safeCopy } from '../v7/migration.js';
import { createState, createCharacter, logWorkout, deleteWorkout } from '../v7/engine.js';
import { CATALOG } from '../v7/catalog.js';

function oldSave(overrides = {}) {
    return {
        version: '6.4.0', schemaVersion: 33, lastSavedAt: '2026-09-03T20:00:00.000Z', activeCharacter: 'tim',
        workoutTemplates: [{ id: 2, name: '<img src=x onerror=alert(1)>', exercises: [{ name: 'Push-up', exerciseJson: '{"name":"Push-up"}', inputs: {} }] }],
        characters: { tim: {
            name: 'Tim', race: 'saiyan', startedAt: '2025-01-01', stats: { STR: 100, END: 80, AGI: 60, VIT: 50, SPI: 70, TEC: 45, GKI: 0 },
            totalTXP: 5400, trainingPoints: 1300, tpSpent: 240, spEarned: 75, spSpent: 15, abilityPointsEarned: 90, abilityPointsSpent: 20, storyXP: 500,
            ownedPartners: ['bulma', 'kid_goku'], activePartners: ['bulma'], partnerLevels: { bulma: { level: 6, xp: 13, totalXp: 500 } },
            trainingUnlocks: {}, purchasedAbilities: {}, unlockedTransformations: ['base'], activeTransformation: 'base', transformationMastery: { base: { xp: 100 } },
            sagaProgress: { db_pilaf: { status: 'mastered', focusXP: 230 } }, completedSagas: ['db_pilaf'],
            raceProgression: { earnedTiers: ['base'], routeMastery: 10 }, bodyWeightLog: [{ date: '2026-09-01', weight: 78.4 }],
            workoutLog: [{ date: '2026-09-01', notes: 'Original exercise history', totalTXP: 400, wellness: { rpe: 8, rir: 0 }, exercises: [{ name: 'Bench Press', type: 'weighted', sets: [{ reps: 10, weight: 50 }], inputs: {} }] }],
            unknownOriginalField: { keep: 'this too' }, ...overrides
        } }
    };
}

test('legacy migration preserves current balances, race, history and complete source without paying history again', () => {
    const original = oldSave();
    const untouched = structuredClone(original);
    const { state, report } = migrateLegacy(original);
    const character = state.characters.tim;
    assert.equal(state.schemaVersion, 70);
    assert.equal(state.activeCharacterId, 'tim');
    assert.equal(character.routeId, 'saiyan');
    assert.equal(character.tp, 1060);
    assert.equal(character.ap, 70);
    assert.equal(character.xp, 5400);
    assert.deepEqual(character.baseline.stats, original.characters.tim.stats);
    assert.equal(character.baseline.partnerXP.bulma, 500);
    assert.equal(character.baseline.sagaFocus.db_pilaf, 230);
    assert.equal(character.workouts[0].legacy, true);
    assert.equal(character.workouts[0].rir, 0);
    assert.equal(character.workouts[0].receipt.xp, 0);
    assert.equal(character.workouts[0].receipt.legacyXP, 400);
    assert.deepEqual(state.migration.original, untouched);
    assert.deepEqual(original, untouched);
    assert.equal(report.workouts, 1);
    assert.deepEqual(character.masteredSagas, ['db_pilaf']);
});

test('logging and deleting a new activity after migration returns to the preserved opening balance', () => {
    const { state } = migrateLegacy(oldSave());
    const character = state.characters.tim;
    const initial = { stats: structuredClone(character.stats), xp: character.xp, tp: character.tp, ap: character.ap, storyXP: character.storyXP };
    const workout = logWorkout(character, { date: '2026-09-02', name: 'After migration', kind: 'training', entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 50 }] }], rpe: 7, rir: 0 });
    assert.ok(character.xp > initial.xp);
    deleteWorkout(character, workout.id);
    for (const key of Object.keys(initial)) assert.deepEqual(character[key], initial[key], key);
    assert.equal(character.partners.bulma.level, 6, 'Opening partner level survives the new XP curve');
    assert.equal(character.workouts.length, 1);
    assert.equal(character.workouts[0].legacy, true);
});

test('all supported historical race aliases map to independent v7 routes', () => {
    for (const [race, routeId, raceProgression] of [
        ['human', 'earthling', {}], ['half_saiyan', 'hybrid', {}], ['frieza', 'frieza_race', {}],
        ['namekian', 'namekian', { namekianBranch: 'dragon' }],
        ['android', 'android_infinite', { androidPath: 'infinite' }], ['android', 'android_bio', { androidPath: 'bio' }], ['majin', 'majin', {}]
    ]) assert.equal(migrateLegacy(oldSave({ race, raceProgression })).state.characters.tim.routeId, routeId);
});

test('impossible dates and numeric strings cannot bypass import limits', () => {
    assert.equal(validDate('2026-02-30'), false);
    assert.equal(validDate('2024-02-29'), true);
    assert.equal(validDate('2026-09-04T12:00:00Z'), true);
    assert.throws(() => migrateLegacy(oldSave({ workoutLog: [{ date: '2026-02-30', exercises: [] }] })), /calendar date/);
    assert.throws(() => migrateLegacy(oldSave({ workoutLog: [{ date: '2026-09-01', exercises: [{ name: 'Bench Press', sets: [{ reps: '999999999999', weight: '-5' }] }] }] })), /range/);
    assert.throws(() => safeCopy({ stats: { STR: Infinity } }), /invalid number/);
    assert.throws(() => safeCopy(JSON.parse('{"__proto__":{"polluted":true}}')), /unsafe property/);
    assert.equal({}.polluted, undefined);
});

test('source schema is read before migration and unsupported future saves are rejected', () => {
    const source = oldSave(); source.schemaVersion = 12;
    assert.equal(migrateLegacy(source).report.sourceSchema, 12);
    assert.equal(source.schemaVersion, 12);
    source.schemaVersion = 71;
    assert.throws(() => migrateLegacy(source), /unsupported/);
});

test('v7 state round-trip retains drafts, literal user text and the original archive', () => {
    const state = createState();
    const character = createCharacter(state, { name: '<script>alert(1)</script>', routeId: 'earthling', id: 'hero' });
    character.draft = { date: '2026-09-03', entries: [{ exerciseId: 'bench_press', sets: [{ reps: 0, weight: 0 }] }], notes: 'Still working', rir: 0 };
    const result = validateState(state);
    assert.equal(result.characters.hero.name, '<script>alert(1)</script>');
    assert.equal(result.characters.hero.draft.rir, 0);
    result.characters.hero.name = 'Changed clone';
    assert.notEqual(state.characters.hero.name, result.characters.hero.name);
    state.characters.hero.draft.entries[0].exerciseId = 'unknown_exercise';
    assert.throws(() => validateState(state), /unknown exercise/);
});

test('duplicate v7 workout IDs and unknown collections cannot corrupt the ledger', () => {
    const state = createState();
    const character = createCharacter(state, { name: 'Hero', routeId: 'earthling', id: 'hero' });
    logWorkout(character, { date: '2026-09-01', name: 'Training', entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 50 }] }], kind: 'training' });
    character.workouts.push(structuredClone(character.workouts[0]));
    assert.throws(() => validateState(state), /unique/);
    character.workouts.pop();
    character.activePartners.push('not_a_partner');
    assert.throws(() => validateState(state), /unknown ID/);
});

test('six years of production receipts with a full collection remains portable without truncation', t => {
    const state = createState();
    const character = createCharacter(state, { name: 'Archive capacity fixture', routeId: 'majin', id: 'long_archive' }, new Date('2020-01-01T12:00:00Z'));
    // A capacity fixture, not an economic simulation: exercise the largest legitimate catalog inventory.
    character.partners = Object.fromEntries(CATALOG.partners.map(partner => [partner.id, { xp: 0, level: 1 }]));
    character.abilities = Object.fromEntries(CATALOG.abilities.map(ability => [ability.id, 1]));
    character.forms = Object.fromEntries(CATALOG.transformations.map(form => [form.id, { xp: 0, level: 1 }]));
    character.equipment = Object.fromEntries(CATALOG.trainingBranches.flatMap(branch => branch.upgrades.map(upgrade => [upgrade.id, 1])));
    character.completedSagas = CATALOG.sagas.map(saga => saga.id);
    character.activePartners = CATALOG.partners.slice(0, 7).map(partner => partner.id);
    character.activeAbilities = CATALOG.abilities.slice(0, 4).map(ability => ability.id);
    character.cores = CATALOG.partners.slice(7, 10).map(partner => partner.id);
    for (let week = 0; week < 300; week++) {
        for (const offset of [0, 2, 4, 6]) {
            const date = new Date(Date.UTC(2020, 0, 6 + week * 7 + offset, 12));
            logWorkout(character, { date: date.toISOString().slice(0, 10), name: 'Archive training', kind: 'training', entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 50 }] }] }, date);
        }
    }
    const serialized = JSON.stringify(state);
    t.diagnostic(`300 weeks / 1,200 receipts / full catalog: ${(Buffer.byteLength(serialized) / 1024 / 1024).toFixed(2)} MB JSON.`);
    assert.ok(Buffer.byteLength(serialized) < 8 * 1024 * 1024, `Archive uses ${Buffer.byteLength(serialized)} bytes`);
    const restored = validateState(JSON.parse(serialized));
    assert.equal(restored.characters.long_archive.workouts.length, 1200);
    assert.deepEqual(restored.characters.long_archive.stats, character.stats);
    assert.equal(restored.characters.long_archive.storyXP, character.storyXP);
});

test('high historical display power survives in the original archive', () => {
    const source = oldSave({ history: [{ date: '2026-09-01', pl: 2500000000000000 }] });
    assert.equal(migrateLegacy(source).state.migration.original.characters.tim.history[0].pl, 2500000000000000);
});

test('real pre-v6 collection aliases and retired-technique refunds migrate once', () => {
    const source = oldSave({ ownedPartners: ['frieza_namek'], activePartners: ['frieza_namek'], partnerLevels: { frieza_namek: { level: 12, totalXp: 80 } }, purchasedAbilities: { planet_burst: 2, kaioken_technique: 1, gamma_burst_flash: 1 }, equippedAbilities: ['planet_burst'] });
    source.schemaVersion = 24;
    const { state } = migrateLegacy(source);
    const character = state.characters.tim;
    assert.equal(character.partners.frieza_final_form.level, 12);
    assert.deepEqual(character.activePartners, ['frieza_final_form']);
    assert.equal(character.abilities.granolah_sniping, 1, 'Legacy practice ranks are separated from AP breakthroughs');
    assert.equal(character.abilityPractice.granolah_sniping.level, 2);
    assert.deepEqual(character.activeAbilities, ['granolah_sniping']);
    assert.equal(character.ap, 90, 'Refund cannot exceed the 20 previously spent AP');
    assert.equal(migrateLegacy(state).state.characters.tim.ap, 90, 'A v7 backup does not repeat a legacy refund');
});
