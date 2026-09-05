import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '../v7/catalog.js';
import { PLAN_VERSION, clone, normalizeEntry, normalizeTemplate, blankPlan, normalizePlan, planForCharacter, presetLibrary, applyPreset, copyDay, copyWeek, roundLoad, repPercentage, oneRepMax, calculateEntry, workoutFromDay, scheduledReferences, importTemplates, exportTemplates, importPlan } from '../v7/planner.js';
import { createPlannerUI } from '../v7/planner-ui.js';

const bench = () => normalizeEntry({ name: 'Bench Press', inputs: { setsList: [{ reps: 10, weight: 51.25, manualWeight: true }, { reps: 8, weight: 55, manualWeight: true }] }, notes: 'Slow lowering', restSeconds: 120 });
const legacyPlan = () => ({ version: 1, name: 'My edited plan', activeProfileId: 'personal', oneRepMaxes: { 'Bench Press': 103 }, exerciseEquipment: { 'Bench Press': 'barbell' }, intensityProfiles: { personal: { id: 'personal', name: 'Personal profile', percentages: { 8: .81, 10: .73 } } }, equipmentProfiles: { barbell: { name: 'My plates', step: 1.25, values: '' } }, myWorkbookColumn: 'preserve me', weeks: [{ title: 'Heavy week', days: [{ title: 'Push Monday', status: 'planned', notes: 'Travel day', exercises: [{ name: 'Bench Press', inputs: { setsList: [{ reps: 8, weight: 81.25, manualWeight: true }], unknownField: 'still here' }, selected: false, completed: true }] }] }] });

test('original v6 plan converts into editable days without discarding personal settings or source', () => {
    const original = legacyPlan(), before = clone(original), plan = normalizePlan(original);
    assert.equal(plan.version, PLAN_VERSION); assert.equal(plan.weeks.length, 4); assert.ok(plan.weeks.every(w => w.days.length === 7));
    assert.equal(plan.weeks[0].title, 'Heavy week'); assert.equal(plan.weeks[0].days[0].title, 'Push Monday');
    assert.equal(plan.weeks[0].days[0].notes, 'Travel day'); assert.equal(plan.weeks[0].days[0].entries[0].sets[0].weight, 81.25);
    assert.equal(plan.weeks[0].days[0].entries[0].inputs.unknownField, 'still here'); assert.equal(plan.myWorkbookColumn, 'preserve me');
    assert.equal(plan.equipmentProfiles.barbell.step, 1.25); assert.equal(plan.oneRepMaxes['Bench Press'], 103);
    assert.equal(plan.activeProfileId, 'personal'); assert.equal(plan.weeks[0].days[0].entries[0].selected, false);
    assert.equal(plan.weeks[0].days[0].entries[0].completed, true);
    assert.deepEqual(plan.sourceArchive.find(a => a.kind === 'v6-four-week-plan').original, original);
    plan.weeks[0].days[0].entries[0].sets[0].weight = 2; assert.deepEqual(original, before);
});

test('canonical plan normalization is idempotent, including entry IDs and archives', () => {
    const once = normalizePlan(legacyPlan()); assert.deepEqual(normalizePlan(once), once);
});

test('an existing v7 weekday schedule becomes all four weeks without losing the old mapping', () => {
    const template = normalizeTemplate({ id: 'custom_work', name: 'Old weekly routine', entries: [bench()] });
    const schedule = { 1: 'custom_work', 3: 'custom_work', 0: '' };
    const plan = normalizePlan(schedule, { templates: [template] });
    for (const week of plan.weeks) { assert.equal(week.days[0].templateId, template.id); assert.equal(week.days[2].entries[0].sets[0].weight, 51.25); assert.equal(week.days[1].entries.length, 0); }
    assert.deepEqual(plan.sourceArchive.find(a => a.kind === 'prior-weekly-schedule').original, schedule);
    plan.weeks[0].days[0].entries[0].sets[0].weight = 1;
    assert.equal(plan.weeks[1].days[0].entries[0].sets[0].weight, 51.25); assert.equal(template.entries[0].sets[0].weight, 51.25);
});

test('current v7 plan wins over older archive while all alternate imported plans remain recoverable', () => {
    const current = normalizePlan(legacyPlan()); current.name = 'Current edited plan'; current.weeks[0].days[0].entries[0].sets[0].weight = 90;
    const character = { fitnessPlan: current, plan: { 5: CATALOG.templates[0].id } }, state = { templates: [], plan: legacyPlan(), migration: { original: { fitnessPlan: { ...legacyPlan(), name: 'Ancient plan' } } } };
    const plan = planForCharacter(character, state);
    assert.equal(plan.name, 'Current edited plan'); assert.equal(plan.weeks[0].days[0].entries[0].sets[0].weight, 90);
    assert.ok(plan.sourceArchive.some(a => a.original.name === 'Ancient plan'));
    assert.ok(plan.sourceArchive.some(a => a.kind === 'prior-weekly-schedule'));
    assert.deepEqual(character.fitnessPlan, current);
});

test('both exact authored presets cover four complete weeks and resolve every exercise', () => {
    assert.equal(CATALOG.plannerPresets.length, 2);
    for (const preset of CATALOG.plannerPresets) {
        const plan = applyPreset(blankPlan(), preset.id);
        assert.equal(plan.weeks.length, 4); assert.equal(plan.activeProfileId, preset.activeProfileId);
        assert.ok(plan.weeks.every(w => w.days.length === 7));
        assert.deepEqual(plan.weeks.map(w => w.days.map(d => d.entries.map(e => e.name))), preset.weeks.map(w => w.days.map(d => d.exercises.map(e => e.name))));
        assert.ok(plan.weeks.flatMap(w => w.days.flatMap(d => d.entries)).every(e => !e.unresolved));
        assert.deepEqual(plan.oneRepMaxes, {});
    }
    assert.equal(CATALOG.exercises.length, 92);
});

test('loading a preset retains previous edited weeks plus personal load settings', () => {
    const existing = normalizePlan(legacyPlan()), before = clone(existing), loaded = applyPreset(existing, CATALOG.plannerPresets[0].id);
    assert.equal(loaded.oneRepMaxes['Bench Press'], 103); assert.equal(loaded.equipmentProfiles.barbell.step, 1.25);
    assert.ok(loaded.sourceArchive.some(a => a.kind.startsWith('before-preset-') && a.original.weeks[0].days[0].entries[0].sets[0].weight === 81.25));
    assert.deepEqual(existing, before);
    const cleared = applyPreset(existing, 'blank'); assert.ok(cleared.weeks.every(w => w.days.every(d => !d.entries.length)));
});

test('custom v6 plan presets become available again and cannot be duplicated by repeated normalization', () => {
    const preset = { ...legacyPlan(), id: 12345, name: 'My saved custom week cycle' };
    const state = { templates: [], migration: { original: { fitnessPlanPresets: [preset] } } };
    const character = { plan: {} };
    const plan = planForCharacter(character, state);
    assert.equal(plan.customPresets.length, 1); assert.equal(presetLibrary(plan).length, CATALOG.plannerPresets.length + 1);
    const loaded = applyPreset(plan, '12345'); assert.equal(loaded.weeks[0].days[0].entries[0].sets[0].weight, 81.25); assert.equal(loaded.weeks[0].days[0].entries[0].completed, false);
    assert.equal(planForCharacter({ ...character, fitnessPlan: loaded }, state).customPresets.length, 1);
    assert.equal(preset.weeks[0].days[0].exercises[0].completed, true);
});

test('legacy timed/distance/template formats retain individual sets, times, notes and rest defaults', () => {
    const raw = { id: 123, name: 'My original routine', notes: 'Bring bands', restSeconds: 150, exercises: [
        { exerciseJson: JSON.stringify({ name: 'Bench Press', type: 'weighted' }), inputs: { setsList: [{ reps: 12, weight: 40 }, { reps: 9, weight: 45 }] } },
        { name: 'Plank', inputs: { setsList: [{ seconds: 37 }, { seconds: 51 }] } },
        { name: 'Outdoor Run', inputs: { distance: 5, speed: 10 }, notes: 'Easy pace' },
        { name: 'Meditation', inputs: { duration: 13 } },
    ] };
    const t = normalizeTemplate(raw);
    assert.equal(t.notes, 'Bring bands'); assert.equal(t.restSeconds, 150);
    assert.deepEqual(t.entries[0].sets.map(s => [s.reps, s.weight]), [[12, 40], [9, 45]]);
    assert.deepEqual(t.entries[1].sets.map(s => s.seconds), [37, 51]);
    assert.equal(t.entries[2].duration, 30); assert.equal(t.entries[2].distance, 5); assert.equal(t.entries[2].notes, 'Easy pace');
    assert.equal(t.entries[3].duration, 13); assert.equal(raw.exercises[0].exerciseId, undefined);
});

test('increment rounding, explicit machine stack, zero loads and exact ties are deterministic', () => {
    assert.equal(roundLoad(82, { step: 2.5 }), 82.5);
    assert.equal(roundLoad(82.1, { step: 1.25 }), 82.5);
    assert.equal(roundLoad(23, { step: 100, values: '10, 17, 22, 29' }), 22);
    assert.equal(roundLoad(20, { values: '25, 15, invalid, 15' }), 15);
    assert.equal(roundLoad(0, { values: '10,20' }), 0);
    assert.equal(roundLoad(Number.NaN, { step: 5 }), 0);
    assert.equal(roundLoad(47.9, { values: [45, 50, 55] }), 50);
});

test('1RM aliases and rep profiles inform suggestions without replacing manual actual weights', () => {
    const plan = normalizePlan(legacyPlan()), item = bench(), before = clone(item);
    const suggested = calculateEntry(item, plan);
    assert.equal(suggested.sets[0].weight, 51.25); assert.equal(suggested.sets[0].targetWeight, 75);
    assert.equal(suggested.sets[1].targetWeight, 83.75);
    const applied = calculateEntry(item, plan, true); assert.equal(applied.sets[0].weight, 75); assert.equal(applied.sets[0].manualWeight, false);
    assert.deepEqual(item, before); assert.equal(repPercentage(plan, 10), .73);
    assert.equal(repPercentage(plan, 5), 1 / (1 + 5 / 30));
    plan.oneRepMaxes = { 'Incline Dumbbell Bench Press': 42 }; assert.equal(oneRepMax(plan, 'Incline Dumbbell Bench'), 42);
});

test('day/week copies are separate objects and reset completion without changing source values', () => {
    const plan = normalizePlan(legacyPlan());
    const copied = copyDay(plan, 0, 0, 1, 2);
    assert.equal(copied.weeks[1].days[2].title, 'Wednesday'); assert.equal(copied.weeks[1].days[2].entries[0].completed, false);
    assert.equal(copied.weeks[0].days[0].entries[0].completed, true);
    copied.weeks[1].days[2].entries[0].sets[0].weight = 1;
    assert.equal(copied.weeks[0].days[0].entries[0].sets[0].weight, 81.25); assert.equal(plan.weeks[0].days[0].entries[0].sets[0].weight, 81.25);
    const whole = copyWeek(plan, 0, 3); assert.equal(whole.weeks[3].days[0].entries[0].sets[0].weight, 81.25); assert.equal(whole.weeks[3].days[0].entries[0].completed, false);
});

test('selected/completed day to workout loading preserves isolation and refuses unresolved rows', () => {
    const a = bench(), b = normalizeEntry({ name: 'Meditation', duration: 15, selected: false, completed: true });
    a.selected = true; a.completed = false;
    const day = { entries: [a, b] };
    assert.equal(workoutFromDay(day, 'selected')[0].name, 'Bench Press'); assert.equal(workoutFromDay(day, 'completed')[0].name, 'Meditation');
    const workout = workoutFromDay(day); workout[0].sets[0].weight = 500;
    assert.equal(a.sets[0].weight, 51.25); assert.equal(workout[0].notes, 'Slow lowering'); assert.equal(workout[0].restSeconds, 120);
    assert.throws(() => workoutFromDay({ entries: [normalizeEntry({ name: 'My custom unknown movement' })] }), /Match each unresolved/);
    assert.throws(() => workoutFromDay({ entries: [a] }, 'completed'), /Mark at least one/);
});

test('template import accepts original v6 and v7 export while keeping stable existing routines', () => {
    const existing = [{ id: 'keep-me', name: 'Same name', entries: [bench()] }], before = clone(existing);
    const imported = importTemplates(exportTemplates(existing), existing);
    assert.equal(imported.length, 1); assert.notEqual(imported[0].id, existing[0].id); assert.equal(imported[0].importedFrom, existing[0].id);
    assert.equal(imported[0].entries[0].sets[0].weight, 51.25); assert.deepEqual(existing, before);
    const old = importTemplates(JSON.stringify({ workoutTemplates: [{ id: 100, name: 'Old routine', exercises: [['Bench Press', [{ reps: 8, weight: 42 }]]] }] }));
    assert.equal(old[0].entries[0].sets[0].weight, 42); assert.equal(old[0].sourceOriginal.id, 100);
});

test('unsafe, unknown or oversized imports fail rather than silently dropping content', () => {
    assert.throws(() => importTemplates('{"name":"bad","entries":[],"__proto__":{"polluted":true}}'), /unsafe field/);
    assert.throws(() => importTemplates(JSON.stringify({ name: 'Unknown', exercises: [['Missing exercise', [{ reps: 3 }]]] })), /Match/);
    assert.throws(() => importTemplates(JSON.stringify({ name: 'Empty', entries: [] })), /between 1 and 100/);
    assert.throws(() => importTemplates(JSON.stringify({ name: 'Too many sets', entries: [{ name: 'Bench Press', sets: Array.from({ length: 101 }, () => ({ reps: 10, weight: 20 })) }] })), /100 sets/);
    assert.throws(() => importPlan('{"weeks":[],"__proto__":{"polluted":true}}', blankPlan()), /unsafe field/);
    assert.equal({}.polluted, undefined);
});

test('plan JSON import conserves previous plan and retains unresolved legacy names for manual matching', () => {
    const current = normalizePlan(legacyPlan()), source = legacyPlan(); source.weeks[0].days[0].exercises.push({ name: 'My original custom movement', inputs: { setsList: [{ reps: 11, weight: 5 }] } });
    const imported = importPlan(JSON.stringify({ fitnessPlan: source }), current);
    assert.equal(imported.weeks[0].days[0].entries[1].name, 'My original custom movement'); assert.equal(imported.weeks[0].days[0].entries[1].unresolved, true);
    assert.deepEqual(imported.sourceArchive.find(a => a.kind === 'before-plan-import').original, current);
});

test('deletion preview finds all character schedules and copied four-week day references', () => {
    const plan = blankPlan(); plan.weeks[1].days[2].templateId = 'x';
    const refs = scheduledReferences({ characters: { a: { name: 'A', plan: { 1: 'x' }, fitnessPlan: plan }, b: { name: 'B', plan: { 0: 'x' } } } }, 'x');
    assert.equal(refs.length, 3); assert.ok(refs.some(r => /Sunday/.test(r))); assert.ok(refs.some(r => /week 2, Wednesday/.test(r)));
});

test('template editor edit → save → planner → workout → reload preserves object boundaries and currency', async () => {
    const oldDocument = globalThis.document;
    globalThis.document = { querySelector: () => null };
    try {
        let data = { templates: [], characters: { a: { id: 'a', name: 'Test', tp: 12, ap: 2, xp: 0, plan: {}, workouts: [], draft: { name: 'Unfinished original', entries: [bench()] } } }, activeCharacterId: 'a' }, saves = 0, rendered = '';
        const getCharacter = () => data.characters.a, originalDraft = clone(getCharacter().draft);
        const ui = createPlannerUI({ getState: () => data, getCharacter, save: async () => { data = clone(data); saves++; return true; }, openDialog: (title, html) => { rendered = html; return null; }, closeDialog: () => {}, notify: () => {}, render: () => {}, loadWorkout: async (entries, name) => { getCharacter().draft = { name, entries: clone(entries) }; return true; } });
        ui.saveDraftAsTemplate([bench()], 'My editable routine');
        ui.handleInput({ target: { closest: () => ({}), matches: () => false, dataset: { tfield: 'name' }, type: 'text', value: 'Renamed routine' } });
        await ui.handleSubmit({ target: { id: 'template-editor-form' }, preventDefault() {} });
        assert.equal(saves, 1); assert.equal(data.templates[0].name, 'Renamed routine'); assert.deepEqual(getCharacter().draft, originalDraft);
        const stableId = data.templates[0].id;
        ui.handleInput({ target: { closest: () => ({}), matches: () => false, dataset: { context: 'template', entry: '0', set: '0', sfield: 'weight' }, type: 'number', value: '62.5' } });
        await ui.handleSubmit({ target: { id: 'template-editor-form' }, preventDefault() {} });
        assert.equal(data.templates.length, 1); assert.equal(data.templates[0].id, stableId); assert.equal(data.templates[0].entries[0].sets[0].weight, 62.5);
        ui.openPlan(); await ui.handleAction('planner-day-template', { dataset: {} }); await ui.handleAction('template-use', { dataset: { id: stableId } });
        await ui.handleSubmit({ target: { id: 'planner-editor-form' }, preventDefault() {} });
        assert.equal(getCharacter().fitnessPlan.weeks[0].days[0].entries[0].sets[0].weight, 62.5);
        assert.deepEqual(getCharacter().draft, originalDraft);
        await ui.handleAction('planner-load', { dataset: { load: 'all' } });
        getCharacter().draft.entries[0].sets[0].weight = 70;
        assert.equal(data.templates[0].entries[0].sets[0].weight, 62.5); assert.equal(getCharacter().fitnessPlan.weeks[0].days[0].entries[0].sets[0].weight, 62.5);
        assert.equal(getCharacter().xp, 0); assert.equal(getCharacter().tp, 12); assert.equal(getCharacter().ap, 2); assert.deepEqual(getCharacter().workouts, []);
        assert.ok(rendered.includes('Save plan')); assert.equal(planForCharacter(clone(getCharacter()), clone(data)).weeks[0].days[0].entries[0].sets[0].weight, 62.5);
    } finally { globalThis.document = oldDocument; }
});

test('failed template persistence rolls back the library and leaves the editor/draft recoverable', async () => {
    const oldDocument = globalThis.document; globalThis.document = { querySelector: () => null };
    try {
        const data = { templates: [], characters: { a: { id: 'a', draft: { entries: [bench()] } } } };
        const ui = createPlannerUI({ getState: () => data, getCharacter: () => data.characters.a, save: async () => false, openDialog: () => null, closeDialog: () => {}, notify: () => {} });
        ui.saveDraftAsTemplate([bench()], 'Retry later'); await ui.handleSubmit({ target: { id: 'template-editor-form' }, preventDefault() {} });
        assert.deepEqual(data.templates, []); assert.equal(data.characters.a.draft.entries[0].sets[0].weight, 51.25);
    } finally { globalThis.document = oldDocument; }
});
