import { CATALOG } from './catalog.js';

/** The planner stores intentions. Only engine.logWorkout may award training. */
export const PLAN_VERSION = 7;
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const clone = value => JSON.parse(JSON.stringify(value));
const number = (value, fallback = 0, max = 100000) => Number.isFinite(Number(value)) ? Math.min(max, Math.max(0, Number(value))) : fallback;
const label = (value, fallback = '') => String(value ?? fallback).slice(0, 4000);
export const plannerId = (prefix = 'routine') => `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`;
const key = name => String(name || '').toLowerCase().replace(/dumbell/g, 'dumbbell').replace(/[^a-z0-9]/g, '');
const isSetType = type => ['weighted', 'bodyweight', 'timed_hold'].includes(type);

export function resolveExercise(source, catalog = CATALOG) {
    const name = typeof source === 'string' ? source : source?.name || source?.exerciseName;
    const id = typeof source === 'object' && source?.exerciseId;
    return catalog.exercises.find(ex => ex.id === id) || catalog.exercises.find(ex => key(ex.name) === key(name)) ||
        catalog.exercises.find(ex => key(ex.name) === key(catalog.exerciseAliases?.[name])) || null;
}

export function defaultEntry(exercise, catalog = CATALOG) {
    const ex = typeof exercise === 'string' ? resolveExercise(exercise, catalog) || catalog.exercises.find(e => e.id === exercise) : exercise;
    if (!ex) throw Error('Choose an exercise from the library.');
    return normalizeEntry({ exerciseId: ex.id, name: ex.name, sets: isSetType(ex.type) ? [{ reps: ex.type === 'timed_hold' ? 0 : 10, seconds: ex.type === 'timed_hold' ? 60 : 0, weight: 0 }] : [], duration: isSetType(ex.type) || ex.type === 'recovery_rest' ? 0 : 20, distance: 0 }, catalog);
}

export function equipmentFor(exercise) {
    const name = String(exercise?.name || exercise || '').toLowerCase();
    if (/cable fly|cable crossover/.test(name)) return 'cable_machine';
    if (/dumbbell|dumbell|arnold|raise|curl/.test(name)) return 'dumbbell';
    if (/machine|cable|pushdown|extension|leg press/.test(name)) return 'machine';
    return 'barbell';
}

/** Accept current entries, v6 planner items, v6 saved templates and raw [name, sets]. */
export function normalizeEntry(source, catalog = CATALOG) {
    let raw = Array.isArray(source) ? { name: source[0], sets: source[1] } : clone(source || {});
    if (raw.exerciseJson) { try { raw = { ...JSON.parse(raw.exerciseJson), ...raw }; } catch { /* Original string remains recoverable. */ } }
    const ex = resolveExercise(raw, catalog), type = ex?.type || raw.type || 'weighted', inputs = raw.inputs || {};
    let sets = Array.isArray(raw.sets) ? raw.sets : Array.isArray(inputs.setsList) ? inputs.setsList : [];
    if (!sets.length && isSetType(type) && number(inputs.sets || raw.setCount, 0, 100)) {
        sets = Array.from({ length: number(inputs.sets || raw.setCount, 0, 100) }, () => ({ reps: inputs.reps, weight: inputs.weight, seconds: inputs.seconds || inputs.holdSeconds || inputs.duration }));
    }
    const duration = number(raw.duration ?? inputs.duration), distance = number(raw.distance ?? inputs.distance);
    const speed = number(raw.speed ?? inputs.speed);
    return {
        ...raw, id: raw.id || plannerId('entry'), exerciseId: ex?.id || raw.exerciseId || '',
        name: label(raw.name || raw.exerciseName || ex?.name || 'Unresolved exercise'), type,
        unresolved: !ex, selected: raw.selected !== false, completed: !!raw.completed,
        sets: sets.map(s => ({ ...s, reps: number(s.reps, 0, 10000), weight: number(s.weight, 0, 10000), seconds: number(s.seconds ?? s.duration, 0, 86400), manualWeight: s.manualWeight !== false && s.weight !== undefined })),
        duration: duration || (distance && speed ? Math.round(distance / speed * 600) / 10 : 0), distance,
        notes: label(raw.notes ?? inputs.notes), restSeconds: number(raw.restSeconds ?? inputs.restSeconds, 90, 3600),
        equipmentId: raw.equipmentId || equipmentFor(ex || raw),
    };
}

export function normalizeTemplate(source, catalog = CATALOG) {
    const raw = clone(source || {});
    return { ...raw, id: raw.id || plannerId(), name: label(raw.name || 'Untitled routine').slice(0, 160), notes: label(raw.notes), restSeconds: number(raw.restSeconds, 90, 3600), entries: (raw.entries || raw.exercises || []).map(entry => normalizeEntry(entry, catalog)) };
}

export function templateLibrary(state, catalog = CATALOG) {
    return [...catalog.templates.map(t => ({ ...normalizeTemplate(t, catalog), builtIn: true })), ...(state.templates || []).map(t => ({ ...normalizeTemplate(t, catalog), builtIn: false }))];
}

export function blankPlan(catalog = CATALOG) {
    const old = clone(catalog.plannerDefaults || {});
    return {
        ...old, version: PLAN_VERSION, name: 'My four-week plan', presetId: null,
        activeProfileId: old.activeProfileId || 'classic_85_80_75',
        intensityProfiles: old.intensityProfiles || {
            classic_85_80_75: { id: 'classic_85_80_75', name: 'Classic 85 | 80 | 75', percentages: { 1: 1, 2: .95, 4: .9, 6: .85, 8: .8, 10: .75, 12: .7 } },
            volume_75_70_65: { id: 'volume_75_70_65', name: 'Volume 75 | 70 | 65', percentages: { 1: 1, 2: .95, 4: .85, 6: .8, 8: .75, 10: .7, 12: .65 } },
        },
        equipmentProfiles: old.equipmentProfiles || { barbell: { name: 'Barbell', step: 2.5, values: '' }, dumbbell: { name: 'Dumbbell, per hand', step: 2, values: '' }, machine: { name: 'Machine stack', step: 5, values: '' }, cable_machine: { name: 'Cable stack', step: 2.5, values: '' } },
        // A new user's 1RM must never silently inherit another person's lifting numbers.
        oneRepMaxes: {}, exerciseEquipment: {}, sourceArchive: [], customPresets: [],
        weeks: Array.from({ length: 4 }, (_, w) => ({ title: `Week ${w + 1}`, days: DAY_NAMES.map(title => ({ title, status: 'planned', notes: '', entries: [] })) })),
    };
}

function archive(plan, source, kind) {
    if (!source || typeof source !== 'object' || !Object.keys(source).length) return;
    if (!plan.sourceArchive.some(row => row.kind === kind)) plan.sourceArchive.push({ kind, original: clone(source) });
}

/** Pure conversion: caller explicitly saves the editable copy; every original remains in sourceArchive. */
export function normalizePlan(source, options = {}) {
    const catalog = options.catalog || CATALOG, templates = options.templates || catalog.templates;
    const raw = source && typeof source === 'object' ? clone(source) : {}, base = blankPlan(catalog);
    const result = { ...base, ...raw, version: PLAN_VERSION, sourceArchive: Array.isArray(raw.sourceArchive) ? raw.sourceArchive : [], customPresets: Array.isArray(raw.customPresets) ? raw.customPresets : [],
        intensityProfiles: { ...base.intensityProfiles, ...raw.intensityProfiles }, equipmentProfiles: { ...base.equipmentProfiles, ...raw.equipmentProfiles },
        oneRepMaxes: { ...raw.oneRepMaxes }, exerciseEquipment: { ...raw.exerciseEquipment } };
    const legacy = raw.version !== PLAN_VERSION;
    if (legacy) archive(result, raw, Array.isArray(raw.weeks) ? 'v6-four-week-plan' : 'v7-weekly-schedule');
    const schedule = options.schedule || (!Array.isArray(raw.weeks) ? raw : {});
    if (schedule && Object.keys(schedule).length) archive(result, schedule, 'prior-weekly-schedule');
    result.weeks = base.weeks.map((week, wi) => {
        const oldWeek = raw.weeks?.[wi] || {};
        return { ...week, ...oldWeek, days: week.days.map((day, di) => {
            const oldDay = oldWeek.days?.[di], templateId = schedule[(di + 1) % 7];
            const routine = typeof templateId === 'string' ? templates.find(t => t.id === templateId) : null;
            const value = oldDay || (routine ? { title: day.title, templateId, notes: '', entries: normalizeTemplate(routine, catalog).entries } : {});
            const { exercises, ...rest } = value;
            return { ...day, ...rest, entries: (value.entries || exercises || []).map(entry => normalizeEntry(entry, catalog)) };
        }) };
    });
    if (Array.isArray(raw.weeks) && raw.weeks.length > 4) archive(result, raw, 'additional-original-weeks');
    return result;
}

export function planForCharacter(character, state = {}, catalog = CATALOG) {
    const templates = templateLibrary(state, catalog);
    const candidates = [character.fitnessPlan, character.plan?.weeks ? character.plan : null, state.plan?.weeks ? state.plan : null, character.legacy?.fitnessPlan, state.migration?.original?.fitnessPlan];
    const source = candidates.find(p => Array.isArray(p?.weeks)) || character.fitnessPlan || {};
    const plan = normalizePlan(source, { templates, catalog, schedule: !character.plan?.weeks ? character.plan : {} });
    candidates.filter(Boolean).forEach((candidate, index) => { if (candidate !== source) archive(plan, candidate, `alternate-original-plan-${index}`); });
    const oldPresets = [...(state.fitnessPlanPresets || []), ...(state.migration?.original?.fitnessPlanPresets || [])];
    const presetIds = new Set([...(catalog.plannerPresets || []), ...(plan.customPresets || [])].map(p => String(p.id)));
    oldPresets.forEach((preset, index) => {
        const id = String(preset.id || `imported_plan_preset_${index + 1}`);
        if (Array.isArray(preset.weeks) && !presetIds.has(id)) { plan.customPresets.push({ ...clone(preset), id, builtIn: false }); presetIds.add(id); }
    });
    if (oldPresets.length) archive(plan, oldPresets, 'original-custom-plan-presets');
    return plan;
}

export function presetLibrary(plan, catalog = CATALOG) {
    return [...(catalog.plannerPresets || []).map(p => ({ ...clone(p), builtIn: true })), ...(plan.customPresets || []).map(p => ({ ...clone(p), builtIn: false }))];
}

export function applyPreset(plan, presetId, catalog = CATALOG) {
    const result = clone(plan), preset = presetLibrary(plan, catalog).find(p => String(p.id) === String(presetId));
    if (presetId !== 'blank' && !preset) throw Error('That plan preset is unavailable.');
    const loaded = normalizePlan(preset || {}, { catalog });
    archive(result, { ...plan, sourceArchive: undefined }, `before-preset-${Date.now()}`);
    result.weeks = loaded.weeks; result.presetId = preset?.id || null; result.name = preset?.name || 'My four-week plan';
    result.weeks.forEach(w => w.days.forEach(d => { if (d.status === 'completed') d.status = 'planned'; d.entries.forEach(e => { e.completed = false; }); }));
    if (preset?.intensityProfiles) result.intensityProfiles = { ...result.intensityProfiles, ...clone(preset.intensityProfiles) };
    if (preset?.activeProfileId && result.intensityProfiles[preset.activeProfileId]) result.activeProfileId = preset.activeProfileId;
    else if (/hannah/i.test(preset?.name || presetId)) result.activeProfileId = 'volume_75_70_65';
    return result;
}

export function copyDay(plan, fromWeek, fromDay, toWeek, toDay) {
    const result = clone(plan), oldTitle = result.weeks[toWeek].days[toDay].title;
    result.weeks[toWeek].days[toDay] = { ...clone(result.weeks[fromWeek].days[fromDay]), title: oldTitle, entries: result.weeks[fromWeek].days[fromDay].entries.map(e => ({ ...clone(e), id: plannerId('entry'), completed: false })) };
    return result;
}

export function copyWeek(plan, fromWeek, toWeek) {
    let result = clone(plan);
    DAY_NAMES.forEach((_, day) => { result = copyDay(result, fromWeek, day, toWeek, day); });
    return result;
}

export function roundLoad(raw, equipment = {}) {
    const value = number(raw);
    if (!value) return 0;
    const supplied = Array.isArray(equipment.values) ? equipment.values : String(equipment.values || '').split(/[,;\s]+/).filter(Boolean);
    const values = [...new Set(supplied.map(Number).filter(v => Number.isFinite(v) && v >= 0))].sort((a, b) => a - b);
    if (values.length) return values.reduce((best, next) => Math.abs(next - value) < Math.abs(best - value) ? next : best, values[0]);
    const step = number(equipment.step, 1) || 1;
    return Math.round(Math.round(value / step) * step * 1000) / 1000;
}

export function repPercentage(plan, reps) {
    const profile = plan.intensityProfiles?.[plan.activeProfileId] || Object.values(plan.intensityProfiles || {})[0];
    const exact = Number(profile?.percentages?.[reps]);
    return exact > 0 && exact <= 1.5 ? exact : Math.min(1, Math.max(.45, 1 / (1 + number(reps, 10) / 30)));
}

export function oneRepMax(plan, name, catalog = CATALOG) {
    const aliases = (catalog.oneRmAliasGroups || []).find(group => group.some(alias => key(alias) === key(name))) || [];
    const keys = new Set([name, ...aliases].map(key));
    const found = Object.entries(plan.oneRepMaxes || {}).find(([stored, value]) => keys.has(key(stored)) && number(value) > 0);
    return number(found?.[1]);
}

export function calculateEntry(entry, plan, force = false, catalog = CATALOG) {
    const result = clone(entry), maximum = oneRepMax(plan, entry.name, catalog);
    if (entry.type !== 'weighted' || !maximum) return result;
    const equipmentId = plan.exerciseEquipment?.[entry.name] || entry.equipmentId;
    result.sets.forEach(set => {
        set.targetWeight = roundLoad(maximum * repPercentage(plan, set.reps), plan.equipmentProfiles?.[equipmentId]);
        if (force || !set.manualWeight) { set.weight = set.targetWeight; set.manualWeight = false; }
    });
    return result;
}

/** Independent workout copies, including completion filters. Unresolved imports cannot silently vanish. */
export function workoutFromDay(day, mode = 'all') {
    const selected = (day.entries || []).filter(e => mode === 'selected' ? e.selected : mode === 'completed' ? e.completed : true);
    if (selected.some(e => e.unresolved || !e.exerciseId)) throw Error('Match each unresolved exercise to the library before loading this day. The original name is retained in your plan.');
    const entries = selected.filter(e => e.type !== 'recovery_rest').map(e => ({ exerciseId: e.exerciseId, name: e.name, sets: clone(e.sets || []), duration: e.duration, distance: e.distance, notes: e.notes, restSeconds: e.restSeconds }));
    if (!entries.length) throw Error(mode === 'completed' ? 'Mark at least one exercise completed first.' : mode === 'selected' ? 'Select at least one exercise first.' : 'This day has no training exercises. Use Log recovery day to record rest.');
    return entries;
}

export function scheduledReferences(state, templateId) {
    const result = [];
    Object.values(state.characters || {}).forEach(character => {
        Object.entries(character.plan || {}).forEach(([day, id]) => { if (id === templateId) result.push(`${character.name}: ${DAY_NAMES[(Number(day) + 6) % 7]} weekly schedule`); });
        character.fitnessPlan?.weeks?.forEach((week, wi) => week.days?.forEach(day => { if (day.templateId === templateId) result.push(`${character.name}: week ${wi + 1}, ${day.title}`); }));
    });
    return result;
}

export function validateTemplate(template) {
    if (!template.name.trim()) throw Error('Give this template a name.');
    if (!template.entries.length || template.entries.length > 100) throw Error('A template needs between 1 and 100 exercises.');
    for (const entry of template.entries) {
        if (entry.unresolved || !entry.exerciseId) throw Error(`Match “${entry.name}” to an exercise in the library.`);
        if (entry.sets.length > 100) throw Error('An exercise may contain at most 100 sets.');
        if (isSetType(entry.type) && !entry.sets.length) throw Error(`Add at least one set for “${entry.name}”.`);
    }
    return template;
}

function safeImport(value, depth = 0) {
    if (depth > 35) throw Error('The template file is too deeply nested.');
    if (Array.isArray(value)) { if (value.length > 10000) throw Error('The template file is too large.'); value.forEach(v => safeImport(v, depth + 1)); }
    else if (value && typeof value === 'object') Object.entries(value).forEach(([name, v]) => { if (['__proto__', 'constructor', 'prototype'].includes(name)) throw Error('The template file contains an unsafe field.'); safeImport(v, depth + 1); });
}

export function importTemplates(text, existing = [], catalog = CATALOG) {
    if (typeof text !== 'string' || text.length > 8 * 1024 * 1024) throw Error('Choose a template JSON file smaller than 8 MB.');
    const value = JSON.parse(text); safeImport(value);
    const rows = Array.isArray(value) ? value : value.templates || value.workoutTemplates || (value.name && (value.entries || value.exercises) ? [value] : null);
    if (!Array.isArray(rows) || !rows.length || existing.length + rows.length > 500) throw Error('The file must contain templates; the library supports up to 500 custom routines.');
    return rows.map(row => {
        const template = normalizeTemplate(row, catalog);
        validateTemplate(template);
        return { ...template, id: plannerId(), builtIn: false, importedFrom: row.id || null, sourceOriginal: clone(row) };
    });
}

export function exportTemplates(templates) {
    return JSON.stringify({ format: 'dbz-fitness-templates', version: 1, exportedAt: new Date().toISOString(), templates: clone(templates) }, null, 2);
}

export function importPlan(text, existing, options = {}) {
    if (typeof text !== 'string' || text.length > 8 * 1024 * 1024) throw Error('Choose a plan JSON file smaller than 8 MB.');
    const value = JSON.parse(text); safeImport(value);
    const source = value.fitnessPlan || value;
    if (!Array.isArray(source.weeks) || source.weeks.length > 52 || source.weeks.some(w => !Array.isArray(w.days) || w.days.length > 7 || w.days.some(d => !Array.isArray(d.entries || d.exercises || []) || (d.entries || d.exercises || []).length > 100 || (d.entries || d.exercises || []).some(e => (e.sets || e.inputs?.setsList || []).length > 100)))) throw Error('The file does not contain a valid four-week plan.');
    const result = normalizePlan(source, options);
    archive(result, existing, 'before-plan-import');
    return result;
}
