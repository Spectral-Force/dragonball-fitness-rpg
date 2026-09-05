import { CATALOG, STATS } from './catalog.js';
import { createState, createCharacter, validateWorkout, restoreCharacterDevelopment } from './engine.js';
import { planForCharacter } from './planner.js';

export const MAX_SAVE_BYTES = 40 * 1024 * 1024;
const IDS = /^[a-zA-Z0-9_-]{1,100}$/;
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const NUMBER_LIMITS = { reps: 1000, weight: 1000, weightKg: 1000, bodyWeight: 1000, seconds: 14400, duration: 1440, durationMinutes: 1440, distance: 500, distanceKm: 500, speed: 150, speedKph: 150, rpe: 10, rir: 100 };
const DATE_KEYS = new Set(['date', 'startedAt', 'createdAt', 'savedAt', 'lastSavedAt', 'updatedAt', 'migratedAt', 'unlockedAt', 'clearedAt', 'masteredAt', 'lastWorkoutDate', 'lastRestDate']);
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const catalogIds = key => new Set((CATALOG[key] || []).map(item => item.id));
const partnerIds = catalogIds('partners');
const abilityIds = catalogIds('abilities');
const formIds = catalogIds('transformations');
const sagaIds = catalogIds('sagas');
const exerciseIds = catalogIds('exercises');
const bandIds = new Set((Array.isArray(CATALOG.stateBands) ? CATALOG.stateBands : Object.values(CATALOG.stateBands || {})).map(item => item.id));
const routeIds = new Set(Object.keys(CATALOG.routes));
const equipmentIds = new Set(CATALOG.trainingBranches.flatMap(branch => branch.upgrades.map(item => item.id)));
const byExerciseName = new Map(CATALOG.exercises.map(item => [item.name.toLowerCase(), item]));
const partnerAlias = key => key === 'frieza_namek' ? 'frieza_final_form' : key;
const abilityAlias = key => key === 'planet_burst' ? 'granolah_sniping' : key;
const clone = value => JSON.parse(JSON.stringify(value));

export function validDate(value) {
    if (typeof value !== 'string' || value.length > 40) return false;
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
    if (!match) return false;
    const [, y, m, d] = match.map(Number);
    if (y < 1970 || y > 2300 || m < 1 || m > 12 || d < 1) return false;
    const day = new Date(Date.UTC(y, m - 1, d));
    if (day.getUTCFullYear() !== y || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) return false;
    return value.length === 10 || (value.includes('T') && Number.isFinite(Date.parse(value)));
}

/** A detached, prototype-safe JSON copy. Numeric strings are checked before any conversion. */
export function safeCopy(value) {
    const seen = new Set();
    let nodes = 0;
    function visit(item, path = 'save', depth = 0, key = '') {
        if (++nodes > 8000000 || depth > 30) throw new Error(`${path} is too large or deeply nested.`);
        if (item === null) return null;
        if (typeof item === 'boolean') return item;
        if (typeof item === 'number') {
            if (!Number.isFinite(item) || Math.abs(item) > 1e18) throw new Error(`${path} contains an invalid number.`);
            if (NUMBER_LIMITS[key] && (item < 0 || item > NUMBER_LIMITS[key])) throw new Error(`${path} is outside the accepted range.`);
            return item;
        }
        if (typeof item === 'string') {
            if (item.length > 200000) throw new Error(`${path} contains too much text.`);
            if (DATE_KEYS.has(key) && item && !validDate(item)) throw new Error(`${path} is not a real calendar date.`);
            if (NUMBER_LIMITS[key] && item !== '') {
                const n = Number(item);
                if (!Number.isFinite(n) || n < 0 || n > NUMBER_LIMITS[key]) throw new Error(`${path} is outside the accepted range.`);
            }
            return item;
        }
        if (typeof item !== 'object' || (!Array.isArray(item) && !plain(item))) throw new Error(`${path} contains an unsupported value.`);
        if (seen.has(item)) throw new Error(`${path} contains a circular reference.`);
        seen.add(item);
        let result;
        if (Array.isArray(item)) {
            if (item.length > 50000) throw new Error(`${path} contains too many entries.`);
            result = item.map((child, index) => visit(child, `${path}[${index}]`, depth + 1));
        } else {
            if (Object.keys(item).length > 50000) throw new Error(`${path} contains too many properties.`);
            result = {};
            for (const [childKey, child] of Object.entries(item)) {
                if (BAD_KEYS.has(childKey) || childKey.length > 200) throw new Error(`${path} contains an unsafe property.`);
                result[childKey] = visit(child, `${path}.${childKey}`, depth + 1, childKey);
            }
        }
        seen.delete(item);
        return result;
    }
    const result = visit(value);
    if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SAVE_BYTES) throw new Error('The save exceeds the 40 MB limit.');
    return result;
}

function num(value, label, fallback = 0, maximum = 1e12) {
    if (value === undefined || value === null || value === '') return fallback;
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n) || n < 0 || n > maximum) throw new Error(`${label} is outside the accepted range.`);
    return n;
}
function id(value, label) {
    if (typeof value !== 'string' || !IDS.test(value)) throw new Error(`${label} has an invalid ID.`);
    return value;
}
function text(value, label, maximum = 4000) {
    if (typeof value !== 'string' || value.length > maximum) throw new Error(`${label} contains invalid text.`);
    return value;
}
function numericMap(value, label, accepted, maximum = 1e12) {
    if (!plain(value)) throw new Error(`${label} must be an object.`);
    const result = {};
    for (const [key, amount] of Object.entries(value)) {
        id(key, label);
        if (accepted && !accepted.has(key)) throw new Error(`${label} contains an unknown ID: ${key}.`);
        result[key] = num(amount, `${label}.${key}`, 0, maximum);
    }
    return result;
}
function idList(value, label, accepted, maximum = 1000) {
    if (!Array.isArray(value) || value.length > maximum) throw new Error(`${label} must be a bounded list.`);
    return [...new Set(value.map(item => {
        id(item, label);
        if (accepted && !accepted.has(item)) throw new Error(`${label} contains an unknown ID: ${item}.`);
        return item;
    }))];
}

function validateTemplates(templates) {
    if (!Array.isArray(templates) || templates.length > 500) throw new Error('The template collection is invalid.');
    return templates.map((template, index) => {
        if (!plain(template)) throw new Error('A template is invalid.');
        text(template.name, 'Template name', 160);
        const entries = template.entries || template.exercises;
        if (!Array.isArray(entries) || entries.length > 100) throw new Error('A template has invalid exercises.');
        entries.forEach(entry => {
            if (Array.isArray(entry)) {
                if (!byExerciseName.has(String(entry[0]).toLowerCase())) throw new Error('A template has an unknown exercise.');
            } else if (!plain(entry) || !exerciseIds.has(entry.exerciseId)) throw new Error('A template has an unknown exercise ID.');
        });
        return { ...template, id: String(template.id || `template_${index + 1}`) };
    });
}

export function validateState(value) {
    const candidate = safeCopy(value);
    if (!plain(candidate) || candidate.schemaVersion !== 70) throw new Error('This is not a supported v7 save (schema 70).');
    if (!plain(candidate.characters) || Object.keys(candidate.characters).length > 32) throw new Error('The character collection is invalid.');
    const defaults = createState();
    const result = { ...defaults, ...candidate };
    result.revision = num(candidate.revision, 'Save revision', 0, Number.MAX_SAFE_INTEGER);
    if (!Number.isInteger(result.revision)) throw new Error('The save revision must be an integer.');
    if (result.savedAt !== null && !validDate(result.savedAt)) throw new Error('The save timestamp is invalid.');
    result.version = '7.0.0';
    if (candidate.activeCharacterId !== null && !candidate.characters[candidate.activeCharacterId]) throw new Error('The active character is missing.');
    for (const [characterId, source] of Object.entries(candidate.characters)) {
        id(characterId, 'Character');
        if (!plain(source) || source.id !== characterId || !routeIds.has(source.routeId)) throw new Error(`Character ${characterId} has an invalid route or ID.`);
        text(source.name, 'Character name', 60);
        const temp = createState();
        const standard = createCharacter(temp, { id: characterId, name: source.name, routeId: source.routeId }, source.createdAt || new Date().toISOString());
        const character = { ...standard, ...source };
        if (character.race !== standard.race) throw new Error('The character race does not match its route.');
        if (character.routeId === 'namekian' && !['warrior', 'dragon', 'balanced'].includes(character.branch)) throw new Error('The Namekian branch is invalid.');
        character.stats = numericMap(character.stats, 'Character stats', new Set(STATS));
        if (!plain(character.baseline)) throw new Error('The opening balance is missing.');
        character.baseline.stats = numericMap(character.baseline.stats, 'Opening stats', new Set(STATS));
        STATS.forEach(stat => {
            if (character.stats[stat] === undefined || character.baseline.stats[stat] === undefined) throw new Error(`The ${stat} stat is missing.`);
        });
        for (const key of ['xp', 'tp', 'ap', 'storyXP', 'raceResource']) {
            character[key] = num(character[key], `Character ${key}`);
            if (character.baseline[key] !== undefined) character.baseline[key] = num(character.baseline[key], `Opening ${key}`);
        }
        for (const [key, accepted] of [['partnerXP', partnerIds], ['partnerLevels', partnerIds], ['formXP', formIds], ['formLevels', formIds], ['abilityXP', abilityIds], ['sagaFocus', sagaIds]]) {
            if (character.baseline[key] !== undefined) character.baseline[key] = numericMap(character.baseline[key], `Opening ${key}`, accepted);
        }
        character.sagaFocus = numericMap(character.sagaFocus, 'Saga focus', sagaIds);
        for (const key of ['spending', 'journal', 'wishes', 'bodyWeightLog']) {
            if (!Array.isArray(character[key]) || character[key].length > 25000 || character[key].some(entry => !plain(entry))) throw new Error(`Character ${key} is invalid.`);
        }
        for (const spend of character.spending) {
            spend.tp = num(spend.tp, 'Spent TP'); spend.ap = num(spend.ap, 'Spent AP');
        }
        const journalIds=new Set();
        for (const event of character.journal) {
            if(event.id!==undefined){if(typeof event.id!=='string'||event.id.length>200||journalIds.has(event.id))throw new Error('Journal reward IDs must be unique.');journalIds.add(event.id);}
            if (event.reward !== undefined) {
                if (!plain(event.reward)) throw new Error('A journal reward is invalid.');
                for (const key of ['tp', 'ap', 'xp','storyXP','partnerXP','abilityXP']) if (event.reward[key] !== undefined) event.reward[key] = num(event.reward[key], `Journal ${key}`);
            }
        }
        for (const entry of character.bodyWeightLog) {
            if (!validDate(entry.date) || entry.date.length !== 10) throw new Error('Body-weight history has an invalid date.');
            entry.weight = num(entry.weight, 'Body weight', 0, 1000);
        }
        if (character.wishes.some(wish => !['training', 'partners', 'technique'].includes(wish.type))) throw new Error('The wish history contains an unknown wish.');
        if (!plain(character.plan) || !plain(character.recovery)) throw new Error('The character plan or recovery check-in is invalid.');
        character.activePartners = idList(character.activePartners, 'Active partners', partnerIds, 10);
        character.activeAbilities = idList(character.activeAbilities, 'Active abilities', abilityIds, 10);
        character.completedSagas = idList(character.completedSagas, 'Completed sagas', sagaIds, 100);
        character.masteredSagas = idList(character.masteredSagas, 'Mastered sagas', sagaIds, 100);
        character.earnedBands = idList(character.earnedBands, 'Earned stages', bandIds, 30);
        character.equipment = numericMap(character.equipment, 'Equipment', equipmentIds, 1000);
        character.abilities = numericMap(character.abilities, 'Abilities', abilityIds, 1000);
        for (const key of ['partners', 'forms']) {
            if (!plain(character[key])) throw new Error(`Character ${key} is invalid.`);
            for (const [entryId, progress] of Object.entries(character[key])) {
                if (!(key === 'partners' ? partnerIds : formIds).has(entryId) || !plain(progress)) throw new Error(`Unknown ${key} entry: ${entryId}.`);
                progress.xp = num(progress.xp, `${key} XP`);
                progress.level = num(progress.level, `${key} level`, 1, 100000);
            }
        }
        if (!formIds.has(character.activeForm) || !character.forms[character.activeForm]) throw new Error('The active form is not owned.');
        // Earlier v7 used the highest earned release even when the stored form was
        // Base. Keep that native state explicitly; named forms now use their own PL.
        if(source.activeRelease===undefined)character.activeRelease=character.activeForm==='base'&&character.earnedBands.some(band=>band!=='base');
        if(typeof character.activeRelease!=='boolean')throw new Error('The active native release selection is invalid.');
        if(character.activeRelease&&character.activeForm!=='base')throw new Error('Choose either a named form or a native release.');
        if (character.activePartners.some(entryId => !character.partners[entryId])) throw new Error('An active partner is not owned.');
        if (character.activeAbilities.some(entryId => !character.abilities[entryId])) throw new Error('An active ability is not owned.');
        character.cores = idList(character.cores, 'Partner cores', partnerIds, 3);
        if (character.cores.some(entryId => !character.partners[entryId])) throw new Error('A partner core is not owned.');
        if (!Array.isArray(character.workouts) || character.workouts.length > 25000) throw new Error('Workout history is too large or invalid.');
        const workoutIds = new Set();
        character.workouts = character.workouts.map(workout => {
            id(workout.id, 'Workout');
            if (workoutIds.has(workout.id)) throw new Error('Workout IDs must be unique.');
            workoutIds.add(workout.id);
            if (!validDate(workout.date) || workout.date.length !== 10) throw new Error('A workout has an impossible local date.');
            if (workout.legacy === true) {
                text(workout.name, 'Archived workout name', 120);
                text(workout.notes, 'Archived workout notes', 6000);
                if (!['training', 'rest'].includes(workout.kind) || !Array.isArray(workout.entries) || workout.entries.length > 100) throw new Error('An archived workout has invalid activity data.');
                for (const entry of workout.entries) {
                    if (!plain(entry) || !Array.isArray(entry.sets) || entry.sets.length > 100) throw new Error('An archived exercise has invalid sets.');
                }
                return workout;
            }
            const normalized = validateWorkout(workout);
            if (!plain(workout.receipt)) throw new Error('A completed workout is missing its reward receipt.');
            if(![1,2].includes(workout.receipt.version))throw new Error('Unsupported workout earning rules.');
            if(workout.receipt.partnerXPById!==undefined)workout.receipt.partnerXPById=numericMap(workout.receipt.partnerXPById,'Partner reward XP',partnerIds);
            if(workout.receipt.activeAbilities!==undefined)workout.receipt.activeAbilities=idList(workout.receipt.activeAbilities,'Practiced abilities',abilityIds,7);
            if(workout.receipt.abilityXP!==undefined)workout.receipt.abilityXP=num(workout.receipt.abilityXP,'Ability practice XP');
            workout.receipt.stats = numericMap(workout.receipt.stats, 'Receipt stats', new Set(STATS));
            for (const key of ['xp', 'tp', 'ap', 'minutes', 'raw', 'partnerXP', 'formXP', 'raceResource']) workout.receipt[key] = num(workout.receipt[key], `Receipt ${key}`);
            if (!plain(workout.receipt.snapshot) || !plain(workout.receipt.snapshot.source)) throw new Error('A workout is missing its original training build.');
            if (!routeIds.has(workout.receipt.snapshot.source.routeId)) throw new Error('A workout training build has an invalid race route.');
            return { ...workout, ...normalized, receipt: workout.receipt };
        });
        if (character.draft !== null) {
            if (!plain(character.draft)) throw new Error('The workout draft is invalid.');
            if (character.draft.entries && (!Array.isArray(character.draft.entries) || character.draft.entries.length > 100)) throw new Error('The workout draft is too large.');
            for (const entry of character.draft.entries || []) {
                if (!plain(entry) || !exerciseIds.has(entry.exerciseId)) throw new Error('The draft has an unknown exercise.');
            }
        }
        if (!source.developmentVersion) restoreCharacterDevelopment(character,{existing:true,legacy:result.migration?.original?.characters?.[character.legacy?.originalCharacterId || characterId] || null});
        if (character.developmentVersion !== 1) throw new Error('Unsupported character development rules.');
        for (const key of ['abilitySlots','partnerSlots']) { character[key]=num(character[key],key,2,7); if(!Number.isInteger(character[key]))throw new Error('Slot counts must be whole numbers.'); }
        if(!plain(character.abilityPractice))throw new Error('Ability practice is invalid.');
        for(const [aid,p] of Object.entries(character.abilityPractice)){if(!abilityIds.has(aid)||!character.abilities[aid]||!plain(p))throw new Error('Unknown ability practice entry.');for(const key of ['xp','baselineXP','legacyXP'])if(p[key]!==undefined)p[key]=num(p[key],`Ability ${key}`);for(const key of ['level','baselineLevel'])if(p[key]!==undefined){p[key]=num(p[key],`Ability ${key}`,1,100);if(!Number.isInteger(p[key]))throw new Error('Ability levels must be whole numbers.');}}
        if(character.mainMentor!==null&&(!partnerIds.has(character.mainMentor)||!character.activePartners.includes(character.mainMentor)))throw new Error('The main mentor must be on the active team.');
        character.echoForms=idList(character.echoForms,'Training echoes',formIds,2);
        if(character.echoForms.some(fid=>!character.forms[fid]||fid===character.activeForm||fid==='base'))throw new Error('A training echo must be an owned resting form.');
        if(!['native','instinct','destruction'].includes(character.divineDiscipline))throw new Error('Invalid Divine Discipline.');
        if(!plain(character.coreTraits)||!plain(character.dragonBallSets))throw new Error('Core traits or Dragon Ball searches are invalid.');
        for(const [pid,trait] of Object.entries(character.coreTraits)){if(!partnerIds.has(pid)||!plain(trait)||!STATS.includes(trait.stat))throw new Error('Invalid core trait.');trait.value=num(trait.value,'Copied trait',0,.12);}
        for(const [setId,search] of Object.entries(character.dragonBallSets)){if(!['earth','namek','super'].includes(setId)||!plain(search))throw new Error('Unknown Dragon Ball set.');search.cycle=num(search.cycle,'Search cycle',0,100000);search.bankedExpeditionPoints=num(search.bankedExpeditionPoints,'Banked expedition points',0,1000000000);search.remainingWishes=num(search.remainingWishes,'Remaining wishes',0,setId==='namek'?3:1);if(!plain(search.baseline)||!plain(search.creditProgress))throw new Error('Invalid search metrics.');for(const [star,credit]of Object.entries(search.creditProgress)){if(!/^[1-7]$/.test(star))throw new Error('Invalid Dragon Ball star.');search.creditProgress[star]=num(credit,'Converted search progress',0,1);}for(const [metric,val] of Object.entries(search.baseline)){if(typeof val==='number'&&!Number.isFinite(val))throw new Error('Invalid search baseline.');}}
        if(character.fitnessPlan || Object.keys(character.plan||{}).length || result.plan?.weeks || result.migration?.original?.fitnessPlan) character.fitnessPlan=planForCharacter(character,result);
        result.characters[characterId] = character;
    }
    result.templates = validateTemplates(result.templates);
    if (!plain(result.settings) || !plain(result.plan)) throw new Error('Save settings or plan are invalid.');
    return result;
}

function canonicalRace(value) {
    const key = String(value || 'earthling').toLowerCase().replace(/[\s-]+/g, '_');
    return ({ human: 'earthling', half_saiyan: 'hybrid', frieza: 'frieza_race', friezas_race: 'frieza_race' })[key] || key;
}
function knownList(value, accepted) { return [...new Set(Array.isArray(value) ? value.filter(item => accepted.has(item)) : [])]; }
function normalizedLegacyEntry(entry) {
    const exercise = byExerciseName.get(String(entry.name || '').toLowerCase());
    const inputs = entry.inputs || {};
    return {
        exerciseId: exercise?.id || `legacy_${String(entry.name || 'exercise').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 75)}`,
        name: String(entry.name || 'Legacy exercise').slice(0, 120),
        type: entry.type || exercise?.type || 'legacy',
        sets: (Array.isArray(entry.sets) ? entry.sets : Array.isArray(inputs.setsList) ? inputs.setsList : []).map(set => ({ reps: num(set.reps, 'Legacy reps', 0, 1000), weight: num(set.weight, 'Legacy weight', 0, 1000), seconds: num(set.seconds, 'Legacy seconds', 0, 14400) })),
        duration: num(inputs.duration ?? inputs.durationMinutes ?? entry.duration, 'Legacy duration', 0, 1440),
        distance: num(inputs.distance ?? inputs.distanceKm ?? entry.distance, 'Legacy distance', 0, 500),
        notes: String(entry.notes || inputs.notes || '').slice(0,2000), restSeconds:num(entry.restSeconds ?? inputs.restSeconds,'Legacy rest seconds',0,3600)
    };
}

export function migrateLegacy(value) {
    const original = safeCopy(value);
    const schema = Number(original?.schemaVersion || 1);
    if (schema === 70) return { state: validateState(original), report: { sourceSchema: 70, targetSchema: 70, message: 'Validated v7 backup; all history is retained.' } };
    if (!plain(original) || !Number.isInteger(schema) || schema < 1 || schema > 33) throw new Error('This legacy save schema is unsupported.');
    if (!plain(original.characters) || !Object.keys(original.characters).length || Object.keys(original.characters).length > 20) throw new Error('The legacy save has no valid characters.');
    const state = createState();
    const migratedAt = new Date().toISOString();
    const report = { sourceSchema: schema, targetSchema: 70, migratedAt, characters: 0, workouts: 0, archivedUnknownItems: 0, warnings: [], message: '' };
    for (const [characterId, old] of Object.entries(original.characters)) {
        id(characterId, 'Legacy character');
        if (!plain(old)) throw new Error('A legacy character is invalid.');
        const race = canonicalRace(old.race);
        const progression = old.raceProgression || {};
        const routeId = race === 'android' ? (progression.androidPath === 'bio' || progression.routeId === 'android_bio' ? 'android_bio' : 'android_infinite') : race;
        if (!routeIds.has(routeId)) throw new Error(`Unsupported legacy race: ${race}.`);
        const character = createCharacter(state, { id: characterId, name: String(old.name || characterId).slice(0, 60), routeId, branch: progression.namekianBranch || old.branch }, old.startedAt || migratedAt);
        character.stats = Object.fromEntries(STATS.map(stat => [stat, num(old.stats?.[stat], `Legacy ${stat}`, character.stats[stat])]));
        character.xp = num(old.totalTXP, 'Legacy training XP');
        character.tp = Math.max(0, num(old.trainingPoints, 'Legacy TP') - num(old.tpSpent, 'Legacy TP spent'));
        character.ap = Math.max(0, Math.max(num(old.abilityPointsEarned, 'Legacy AP'), num(old.spEarned, 'Legacy SP')) - Math.max(num(old.abilityPointsSpent, 'Legacy AP spent'), num(old.spSpent, 'Legacy SP spent')));
        character.storyXP = num(old.storyXP, 'Legacy story XP');
        character.completedSagas = knownList([...(old.completedSagas || []), ...Object.entries(old.sagaProgress || {}).filter(([, item]) => ['cleared', 'mastered'].includes(item.status)).map(([key]) => key)], sagaIds);
        character.masteredSagas = knownList(Object.entries(old.sagaProgress || {}).filter(([, item]) => item.status === 'mastered').map(([key]) => key), sagaIds);
        character.sagaFocus = Object.fromEntries(Object.entries(old.sagaProgress || {}).filter(([key]) => sagaIds.has(key)).map(([key, item]) => [key, num(item.focusXP, 'Legacy saga focus')]));
        const priorBands = (progression.earnedTiers || []).map(item => bandIds.has(item) ? item : String(item).replace(`${routeId}_`, ''));
        const legacyCompletedBands = schema < 32 ? CATALOG.routes[routeId].tiers.filter(tier => character.completedSagas.includes(tier.sagaId)).map(tier => tier.bandId) : [];
        character.earnedBands = knownList(['base', ...priorBands, ...legacyCompletedBands], bandIds);
        character.partners = {};
        for (const originalId of old.ownedPartners || []) {
            const partnerId = partnerAlias(originalId);
            if (!partnerIds.has(partnerId)) continue;
            const progress = old.partnerLevels?.[originalId] || {};
            character.partners[partnerId] = { level: Math.max(character.partners[partnerId]?.level || 1, num(progress.level, 'Legacy partner level', 1, 100000)), xp: Math.max(character.partners[partnerId]?.xp || 0, num(progress.totalXp ?? progress.xp, 'Legacy partner XP')) };
        }
        character.activePartners = knownList((old.activePartners || []).map(partnerAlias), partnerIds).filter(key => character.partners[key]).slice(0, 7);
        character.equipment = Object.fromEntries(Object.entries(old.trainingUnlocks || {}).filter(([key]) => equipmentIds.has(key)).map(([key, amount]) => [key, num(amount, 'Legacy equipment level', 0, 1000)]));
        character.abilities = {};
        for (const [oldId, amount] of Object.entries(old.purchasedAbilities || {})) {
            const key = abilityAlias(oldId);
            if (abilityIds.has(key)) character.abilities[key] = Math.max(character.abilities[key] || 0, num(amount, 'Legacy ability rank', 0, 1000));
        }
        character.activeAbilities = knownList((old.equippedAbilities || Object.keys(character.abilities)).map(abilityAlias), abilityIds).filter(key => character.abilities[key]).slice(0, 10);
        const refundable = (num(old.purchasedAbilities?.kaioken_technique, 'Legacy retired ability rank') > 0 ? 6 : 0) + (num(old.purchasedAbilities?.gamma_burst_flash, 'Legacy retired ability rank') > 0 ? 18 : 0);
        const refunded = Math.min(refundable, Math.max(num(old.abilityPointsSpent, 'Legacy AP spent'), num(old.spSpent, 'Legacy SP spent')));
        if (refunded) { character.ap += refunded; report.warnings.push(`${character.name}: refunded ${refunded} AP for retired techniques, using the previous release's migration rates.`); }
        character.forms = {};
        for (const formId of knownList(['base', ...(old.unlockedTransformations || [])], formIds)) {
            const progress = old.transformationMastery?.[formId];
            character.forms[formId] = { xp: num(plain(progress) ? progress.xp : progress, 'Legacy form XP'), level: num(plain(progress) ? progress.level : undefined, 'Legacy form level', 1, 100000) };
        }
        character.activeForm = character.forms[old.activeTransformation] ? old.activeTransformation : 'base';
        character.activeRelease=character.activeForm==='base'&&character.earnedBands.some(band=>band!=='base');
        character.raceResource = num(progression.routeMastery ?? old.raceResource, 'Legacy race development');
        const oldCores = [...(progression.absorptionCores || []), ...(progression.adaptationTemplates || []), ...Object.values(old.raceAbsorptions?.[race === 'majin' ? 'majin' : 'android']?.absorbed || {})];
        character.cores = [...new Set(oldCores.map(core => partnerAlias(core.sourcePartnerId || core.partnerId)).filter(key => partnerIds.has(key)))].slice(0, 3);
        for (const coreId of character.cores) if (!character.partners[coreId]) character.partners[coreId] = { xp: 0, level: 1 };
        character.bodyWeightLog = clone(old.bodyWeightLog || []);
        character.achievements = clone(old.achievements || []);
        character.storyRead = Object.entries(old.storyLog?.entries || {}).filter(([, item]) => item.read || item.readAt).map(([key]) => key);
        character.journal = [];
        character.plan = clone(old.plan || original.fitnessPlan || {});
        character.recovery = { illness: false, injury: false, deload: false };
        if (original.v6Wellness?.illness || original.v6Wellness?.injury) report.warnings.push(`${character.name}: the old global wellness check-in was archived; enter a current check-in.`);
        character.spending = [];
        character.baseline = { stats: clone(character.stats), xp: character.xp, tp: character.tp, ap: character.ap, storyXP: character.storyXP, partnerXP: Object.fromEntries(Object.entries(character.partners).map(([key, progress]) => [key, progress.xp])), partnerLevels: Object.fromEntries(Object.entries(character.partners).map(([key, progress]) => [key, progress.level])), formXP: Object.fromEntries(Object.entries(character.forms).map(([key, progress]) => [key, progress.xp])), formLevels: Object.fromEntries(Object.entries(character.forms).map(([key, progress]) => [key, progress.level])), sagaFocus: clone(character.sagaFocus), raceResource: character.raceResource };
        const log = old.workoutLog || [];
        if (!Array.isArray(log) || log.length > 25000) throw new Error('Legacy workout history is invalid or too large.');
        character.workouts = log.map((workout, index) => {
            if (!plain(workout) || !validDate(workout.date) || workout.date.length !== 10) throw new Error(`Legacy workout ${index + 1} has an impossible local date.`);
            const entries = (workout.exercises || []).map(normalizedLegacyEntry);
            return { id: `legacy_${characterId}_${index + 1}`, date: workout.date, name: String(workout.name || 'Imported v6 workout').slice(0, 120), kind: entries.length && entries.every(entry => /rest/i.test(entry.name)) ? 'rest' : 'training', notes: String(workout.notes || '').slice(0, 6000), rpe: workout.wellness?.rpe ?? null, rir: workout.wellness?.rir ?? null, entries, legacy: true, legacyIndex: index, receipt: { version: 'legacy-opening-balance', stats: Object.fromEntries(STATS.map(stat => [stat, 0])), xp: 0, tp: 0, ap: 0, storyXP: 0, legacyXP: num(workout.totalTXP, 'Legacy workout XP') } };
        });
        character.legacy = { sourceSchema: schema, originalCharacterId: characterId, archivedIn: 'migration.original.characters', note: 'Previous gains are retained in the opening balance; archived history does not pay rewards again.' };
        restoreCharacterDevelopment(character,{existing:false,legacy:old});
        if (old.dragonBalls) report.warnings.push(`${character.name}: original Dragon Ball partial searches and unused summon wishes were restored. Paid wish rewards remain in the opening balance and are not paid twice.`);
        report.characters++;
        report.workouts += log.length;
        report.archivedUnknownItems += (old.ownedPartners || []).filter(key => !partnerIds.has(key)).length + Object.keys(old.purchasedAbilities || {}).filter(key => !abilityIds.has(key)).length + (old.unlockedTransformations || []).filter(key => !formIds.has(key)).length;
    }
    state.activeCharacterId = state.characters[original.activeCharacter] ? original.activeCharacter : Object.keys(state.characters)[0];
    state.templates = [];
    for (const [index, template] of (original.workoutTemplates || []).entries()) {
        const entries = [];
        for (const exercise of template.exercises || []) {
            let definition = {};
            if (exercise.exerciseJson) {
                try { definition = safeCopy(JSON.parse(exercise.exerciseJson)); } catch { report.warnings.push(`Template ${index + 1} has an invalid archived exercise definition.`); }
            }
            const normalized = normalizedLegacyEntry({ ...exercise, name: exercise.name || definition.name, sets: exercise.inputs?.sets || exercise.sets });
            if (exerciseIds.has(normalized.exerciseId)) entries.push(normalized);
            else report.archivedUnknownItems++;
        }
        if (entries.length) state.templates.push({ id: `legacy_template_${index + 1}`, name: String(template.name || `Imported template ${index + 1}`).slice(0, 160), entries });
    }
    state.plan = clone(original.fitnessPlan || {});
    report.message = `Migrated ${report.characters} character${report.characters === 1 ? '' : 's'} and archived ${report.workouts} workout${report.workouts === 1 ? '' : 's'}. Stats and available currencies are preserved; previous workouts do not award rewards again. The original v6 save is retained.`;
    if (report.archivedUnknownItems) report.warnings.push(`${report.archivedUnknownItems} retired or unknown collection entries remain in the original archive.`);
    state.migration = { ...report, original };
    return { state: validateState(state), report };
}
