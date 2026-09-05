import { CATALOG, STATS } from './catalog.js';

// All earning rules live here. The browser and campaign simulator use this module.
export const RULES = Object.freeze({ version: 1, weeklyStoryCap: 50, storyMinutes: 150, statConversion: 0.18, maxPartners: 7, maxAbilities: 4, maxCores: 3 });
const routes = Array.isArray(CATALOG.routes) ? Object.fromEntries(CATALOG.routes.map(x => [x.id, x])) : CATALOG.routes;
const exercises = new Map(CATALOG.exercises.map(x => [x.id, x]));
const partners = new Map(CATALOG.partners.map(x => [x.id, x]));
const abilities = new Map(CATALOG.abilities.map(x => [x.id, x]));
const forms = new Map(CATALOG.transformations.map(x => [x.id, x]));
const equipment = new Map(CATALOG.trainingBranches.flatMap(b => b.upgrades.map(x => ({ ...x, branchId: b.id })) ).map(x => [x.id, x]));
const sagas = new Map(CATALOG.sagas.map(x => [x.id, x]));
const bands = CATALOG.stateBands;
const weights = { STR: 1.1, END: .95, AGI: 1, VIT: .9, SPI: 1.15, TEC: 1.05, GKI: 3 };
const zeroStats = () => Object.fromEntries(STATS.map(s => [s, 0]));
const clone = value => JSON.parse(JSON.stringify(value));
const num = (x, fallback = 0) => Number.isFinite(Number(x)) ? Number(x) : fallback;
const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
const sum = values => values.reduce((a, b) => a + b, 0);
const round = x => Math.round(x * 1e9) / 1e9;
const id = prefix => `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const fail = message => { throw new Error(message); };
const routeOf = c => routes[c.routeId] || routes.earthling;
const sagaIndex = sagaId => CATALOG.sagas.findIndex(s => s.id === sagaId);
const currentSaga = c => CATALOG.sagas.find(s => !c.completedSagas.includes(s.id)) || CATALOG.sagas.at(-1);
const availableSaga = (c, sagaId) => !sagaId || (sagas.has(sagaId) && (sagaIndex(sagaId) === 0 || c.completedSagas.includes(CATALOG.sagas[sagaIndex(sagaId) - 1].id)));
const owned = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);

export function localDate(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return checkedDate(value, new Date(), true);
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) fail('Use a valid date.');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function checkedDate(value, now, allowFuture = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Use a date in YYYY-MM-DD format.');
  const [y, m, d] = value.split('-').map(Number);
  const parsed = new Date(y, m - 1, d, 12);
  if (y < 1970 || y > 2200 || localDate(parsed) !== value) fail('Use a real calendar date between 1970 and 2200.');
  if (!allowFuture && value > localDate(now)) fail('Workouts cannot be logged in the future.');
  return value;
}
export function weekKey(date) {
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y, m - 1, d, 12);
  day.setDate(day.getDate() - (day.getDay() + 6) % 7);
  return localDate(day);
}
function daysBetween(a, b) {
  const stamp = v => { const [y, m, d] = v.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((stamp(b) - stamp(a)) / 86400000);
}
function boundedNumber(value, label, minimum, maximum, nullable = false) {
  if (nullable && (value === null || value === undefined || value === '')) return null;
  if (typeof value !== 'number' && typeof value !== 'string') fail(`${label} must be a number.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < minimum || n > maximum) fail(`${label} must be between ${minimum} and ${maximum}.`);
  return n;
}
function shortText(value, fallback, length) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || value.length > length) fail(`Text must be at most ${length} characters.`);
  return value.trim();
}

export function createState() {
  return { schemaVersion: 70, version: '7.0.0', revision: 0, savedAt: null, activeCharacterId: null, characters: {}, settings: { motion: true, sound: false }, templates: [], plan: {}, migration: null };
}
export function createCharacter(state, options, now = new Date()) {
  if (!options || !routes[options.routeId]) fail('Choose one of the eight race routes.');
  const characterId = options.id || id('hero');
  if (typeof characterId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(characterId) || ['__proto__', 'constructor', 'prototype'].includes(characterId)) fail('Invalid character ID.');
  if (owned(state.characters, characterId)) fail('That character already exists.');
  if (Object.keys(state.characters).length >= 32) fail('You can keep up to 32 characters in one save.');
  const race = routes[options.routeId].race;
  const stats = clone(CATALOG.startingStats[race] || CATALOG.startingStats.earthling);
  const character = {
    id: characterId, name: shortText(options.name, 'New adventurer', 60) || 'New adventurer', routeId: options.routeId, race,
    branch: options.branch || (options.routeId === 'namekian' ? 'balanced' : 'native'), createdAt: new Date(now).toISOString(),
    baseline: { stats: clone(stats), xp: 0, tp: 12, ap: 2, storyXP: 0, partnerXP: {}, formXP: {}, sagaFocus: {}, raceResource: 0 },
    stats, xp: 0, tp: 12, ap: 2, storyXP: 0, workouts: [], partners: { bulma: { level: 1, xp: 0 } }, activePartners: ['bulma'],
    equipment: {}, abilities: {}, activeAbilities: [], forms: { base: { level: 1, xp: 0 } }, activeForm: 'base', earnedBands: ['base'],
    completedSagas: [], masteredSagas: [], sagaFocus: {}, raceResource: 0, cores: [], draft: null, bodyWeightLog: [], plan: {}, journal: [],
    wishes: [], achievements: [], spending: [], recovery: { illness: false, injury: false, deload: false }, dailySnapshots: {}, storyRead: [], expeditionPoints: 0,
  };
  if (character.routeId === 'namekian' && !['warrior', 'dragon', 'balanced'].includes(character.branch)) fail('Choose Warrior, Dragon, or Balanced Namekian training.');
  state.characters[characterId] = character;
  state.activeCharacterId = characterId;
  return character;
}

export function validateWorkout(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Provide a workout to save.');
  const kind = input.kind || 'training';
  if (!['training', 'rest'].includes(kind)) fail('Choose a training or rest session.');
  const date = checkedDate(input.date || localDate(now), now);
  if (input.id && (typeof input.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(input.id))) fail('Invalid workout ID.');
  if (input.entries !== undefined && !Array.isArray(input.entries)) fail('Workout exercises must be a list.');
  if ((input.entries || []).length > 100) fail('A session can contain at most 100 exercises.');
  const entries = (kind === 'rest' ? [] : input.entries || []).map(entry => {
    if (!entry || !exercises.has(entry.exerciseId)) fail('One of these exercises is not in the exercise library.');
    const exercise = exercises.get(entry.exerciseId);
    if (exercise.type === 'recovery_rest') fail('Use a rest session to log recovery.');
    if (entry.sets !== undefined && !Array.isArray(entry.sets)) fail('Exercise sets must be a list.');
    if ((entry.sets || []).length > 100) fail('An exercise can contain at most 100 sets.');
    const sets = (entry.sets || []).map(set => ({
      reps: boundedNumber(set.reps ?? 0, 'Repetitions', 0, 1000),
      weight: boundedNumber(set.weight ?? 0, 'Load in kg', 0, 1000),
      seconds: boundedNumber(set.seconds ?? 0, 'Seconds', 0, 14400),
    }));
    const duration = boundedNumber(entry.duration ?? 0, 'Duration in minutes', 0, 1440);
    const distance = boundedNumber(entry.distance ?? 0, 'Distance in km', 0, 500);
    if (['weighted', 'bodyweight'].includes(exercise.type) && !sets.some(s => s.reps > 0)) fail(`${exercise.name} needs at least one set with repetitions.`);
    if (exercise.type === 'timed_hold' && !sets.some(s => s.seconds > 0)) fail(`${exercise.name} needs a hold time in seconds.`);
    if (exercise.type === 'cardio_duration' && duration <= 0) fail(`${exercise.name} needs a duration in minutes.`);
    if (exercise.type === 'cardio_distance' && distance <= 0 && duration <= 0) fail(`${exercise.name} needs a distance or duration.`);
    return { exerciseId: exercise.id, sets, duration, distance };
  });
  if (kind === 'training' && !entries.length) fail('Add at least one exercise before saving a training session.');
  const rpe = boundedNumber(input.rpe, 'RPE', 1, 10, true);
  const rir = boundedNumber(input.rir, 'Repetitions in reserve', 0, 20, true);
  if (sum(entries.map(entry => measure(entry, exercises.get(entry.exerciseId)).minutes)) > 1440) fail('A single session cannot contain more than 24 hours of activity.');
  return { ...(input.id ? { id: input.id } : {}), date, kind, name: shortText(input.name, kind === 'rest' ? 'Rest and recovery' : 'Training', 120) || 'Training', notes: shortText(input.notes, '', 6000), rpe, rir, entries,
    recovery: { illness: input.recovery?.illness === true, injury: input.recovery?.injury === true, deload: input.recovery?.deload === true } };
}

function effectValue(effect = {}, exercise, stat) {
  const statPart = stat ? num(effect.stat?.[stat]) : sum(Object.values(effect.stat || {}).map(n => num(n))) / 6;
  return num(effect.statAll) + statPart + num(effect.category?.[exercise?.category]) + num(effect.category?.[exercise?.group]) + num(effect.type?.[exercise?.type]);
}
function historicalTraining(c) {
  if (c._historyProfile) return { ...c._historyProfile, groups: new Set(c._historyProfile.groups) };
  const logs = c.workouts.filter(w => !w.legacy && w.kind === 'training');
  const dates = [...new Set(logs.map(w => w.date))].sort();
  const recent = dates.slice(-14);
  const groups = new Set(logs.filter(w => recent.includes(w.date)).flatMap(w => w.entries.map(e => exercises.get(e.exerciseId)?.group)).filter(Boolean));
  return { logs, dates, groups, weeks: new Set(logs.map(w => weekKey(w.date))).size };
}
const routeCopy = {
  earthling: 'Technique discipline turns a varied practice into faster learning. Martial skills and movement receive extra growth; familiar partners become unusually effective.',
  saiyan: 'Battle evolution rewards repeated training blocks and strength practice. Growth comes from accumulated practice, never from injury or training through illness.',
  hybrid: 'Potential opens in earned mastery steps. A mixed practice develops strength and spirit, with larger bursts of efficiency every five character levels.',
  namekian: 'Choose Warrior, Dragon, or Balanced development. Warrior favours strength and endurance; Dragon favours spirit and technique; Balanced supports broad training.',
  android_infinite: 'The reactor steadily improves training efficiency as work accumulates. Cardio and endurance receive a larger return, with no dependence on streaks or fatigue.',
  android_bio: 'Build up to three partner templates and train across movement groups. Your selected templates contribute their specialties to permanent growth.',
  majin: 'Shape up to three absorbed partner cores into your own style. Vitality, mobility, and selected core specialties drive growth without consuming your partners.',
  frieza_race: 'Control develops through accumulated practice and deliberate releases. Earlier fundamentals remain useful while each earned band improves your next training block.',
};
function raceFactor(c, exercise, stat) {
  const resource = clamp(num(c.raceResource) / 100, 0, 1);
  const category = exercise?.category;
  const history = historicalTraining(c);
  const special = values => stat ? (values[stat] || 0) : sum(Object.values(values)) / 6;
  switch (c.routeId) {
    case 'earthling': return 1.12 + Math.min(.24, history.groups.size * .035) + special({ TEC: .20, SPI: .1, AGI: .08 }) + (category === 'martial' ? .12 : 0) + resource * .14;
    case 'saiyan': return 1.10 + resource * .32 + special({ STR: .22, END: .12 }) + Math.min(.18, history.weeks * .003);
    case 'hybrid': return 1.10 + Math.min(.4, Math.floor(getLevel(c).level / 5) * .04) + special({ SPI: .18, STR: .14 }) + resource * .10;
    case 'namekian': return 1.14 + resource * .24 + special(c.branch === 'warrior' ? { STR: .35, END: .25, VIT: .15 } : c.branch === 'dragon' ? { SPI: .4, TEC: .25, GKI: .3 } : { STR: .13, END: .13, AGI: .13, VIT: .13, SPI: .13, TEC: .13 });
    case 'android_infinite': return 1.15 + resource * .36 + special({ END: .22, TEC: .12 }) + (category === 'cardio' ? .12 : 0);
    case 'android_bio': return 1.08 + resource * .22 + Math.min(.22, history.groups.size * .03) + coreEffect(c, exercise, stat);
    case 'majin': return 1.10 + resource * .20 + special({ VIT: .22, AGI: .08 }) + coreEffect(c, exercise, stat) + (category === 'flexibility' ? .18 : 0);
    case 'frieza_race': return 1.10 + resource * .25 + Math.min(.26, (c.earnedBands.length - 1) * .025) + special({ STR: .12, AGI: .22 });
    default: return 1;
  }
}
function coreEffect(c, exercise, stat) {
  return sum((c.cores || []).slice(0, RULES.maxCores).map(pid => {
    const p = partners.get(pid); return p && c.partners[pid] && !c.activePartners.includes(pid) ? .045 + effectValue(p.effects, exercise, stat) * 1.8 + Math.min(.065, num(c.partners[pid].level) * .002) : 0;
  }));
}
function abilitySpecialty(ability) {
  const name = `${ability.id} ${ability.name}`.toLowerCase();
  if (/heal|regener|barrier|shield|body|absorp/.test(name)) return { VIT: .065, END: .035, SPI: .025 };
  if (/fist|punch|kick|hammer|janken|claw|rush|strike|sword/.test(name)) return { STR: .065, AGI: .035, TEC: .025 };
  if (/instant|image|flight|speed|step|time|solar/.test(name)) return { AGI: .065, TEC: .05, SPI: .01 };
  if (/meditat|sense|spirit|potential|focus|fusion|god/.test(name)) return { SPI: .055, TEC: .04, GKI: .03 };
  return { SPI: .065, STR: .025, TEC: .035 };
}
function masteryProfile(c) {
  if (c._masteryProfile) return c._masteryProfile;
  const legitimate = Object.entries(c.forms).filter(([fid]) => {
    const definition = getFormDefinition(c, fid);
    return definition && c.earnedBands.includes(definition.bandId) && availableSaga(c, definition.originalSagaId);
  });
  return { highestLevel: Math.max(1, ...legitimate.map(([, form]) => num(form.level, 1))), practicedForms: legitimate.filter(([, form]) => num(form.level) >= 5).length };
}
export function getBoosts(c, exercise) {
  if (typeof exercise === 'string') exercise = exercises.get(exercise);
  const stat = exercise?._stat;
  const race = raceFactor(c, exercise, stat);
  let partnerBonus = 0;
  const details = [{ label: routeOf(c).label, category: 'race', multiplier: race }];
  for (const pid of c.activePartners.slice(0, getPartnerSlots(c))) {
    const partner = partners.get(pid), ownedPartner = c.partners[pid];
    if (!partner || !ownedPartner) continue;
    const specialization = effectValue(partner.effects, exercise, stat);
    const contribution = (.09 + Math.min(.18, num(partner.powerTier) * .004) + specialization * 4) * (1 + Math.min(200, num(ownedPartner.level, 1) - 1) * .021);
    partnerBonus += contribution * (c.routeId === 'earthling' ? 1.08 : 1);
    details.push({ label: `${partner.name} · level ${ownedPartner.level}`, category: 'partners', bonus: contribution });
  }
  let gearBonus = 0;
  for (const [eid, level] of Object.entries(c.equipment)) {
    const upgrade = equipment.get(eid);
    if (!upgrade) continue;
    const contribution = (effectValue(upgrade.effectsPerLevel, exercise, stat) * 8 + .013) * level;
    gearBonus += contribution;
    details.push({ label: `${upgrade.name} · ${level}`, category: 'equipment', bonus: contribution });
  }
  let techniqueBonus = 0;
  for (const aid of c.activeAbilities.slice(0, RULES.maxAbilities)) {
    const ability = abilities.get(aid), rank = num(c.abilities[aid]);
    if (!ability || !rank) continue;
    const specialty = abilitySpecialty(ability);
    const contribution = rank * (.075 + (stat ? num(specialty[stat]) : sum(Object.values(specialty)) / 6)) * (1 + Math.min(2, sagaIndex(ability.sagaId) / 18));
    techniqueBonus += contribution;
    details.push({ label: `${ability.name} · rank ${rank}`, category: 'abilities', bonus: contribution });
  }
  const inheritedMastery = masteryProfile(c);
  const activeDefinition = getFormDefinition(c, c.activeForm);
  const formProfile = activeDefinition?.statProfile || {};
  const specialization = stat ? Math.max(0, num(formProfile[stat], 1) - 1) : sum(STATS.map(s => Math.max(0, num(formProfile[s], 1) - 1))) / STATS.length;
  const mastery = 1 + Math.min(.45, (inheritedMastery.highestLevel - 1) * .018) + Math.min(.15, c.masteredSagas.length * .004) + Math.min(.04, Math.max(0, inheritedMastery.practicedForms - 1) * .004) + Math.min(.04, specialization * .04);
  const wishBonus = Math.min(.20, c.wishes.filter(w => w.type === 'training').length * .01);
  const result = { race, partners: 1 + Math.min(10, partnerBonus), equipment: 1 + Math.min(12, gearBonus), abilities: 1 + Math.min(2.5, techniqueBonus), mastery: mastery + wishBonus, details };
  result.total = result.race * result.partners * result.equipment * result.abilities * result.mastery;
  details.push({ label: 'Carried form mastery, active specialty and saga mastery', category: 'mastery', multiplier: result.mastery });
  return result;
}
export function getPartnerSlots(c) { return Math.min(RULES.maxPartners, 2 + Math.floor(c.completedSagas.length / 7)); }
export function getLearningBoosts(c) {
  const contribution = key => sum(c.activePartners.slice(0, getPartnerSlots(c)).map(pid => c.partners[pid] ? num(partners.get(pid)?.effects?.[key]) * (1 + num(c.partners[pid].level) * .01) : 0))
    + sum(Object.entries(c.equipment).map(([eid, level]) => num(equipment.get(eid)?.effectsPerLevel?.[key]) * level * 4));
  return { xp: 1 + Math.min(1.5, contribution('txp')), tp: 1 + Math.min(1.5, contribution('tp')),
    bond: 1 + Math.min(1.5, contribution('characterXP') + c.wishes.filter(w => w.type === 'partners').length * .05) };
}
export function getPower(c) {
  const start = CATALOG.startingStats[c.race] || CATALOG.startingStats.earthling;
  const base = 5 + sum(STATS.map(stat => Math.max(0, num(c.stats[stat]) - num(start[stat])) * weights[stat]));
  const highest = [...routeOf(c).tiers].reverse().find(t => c.earnedBands.includes(t.bandId)) || routeOf(c).tiers[0];
  // An equipped variant never suppresses the route's already-earned release.
  const state = c.activeForm === 'base' ? null : getFormDefinition(c, c.activeForm);
  const multiplier = Math.max(highest.multiplier || 1, state && c.forms[c.activeForm] ? state.multiplier : 1);
  return { base, effective: base * multiplier, multiplier, formName: state?.name || highest.name || 'Base', bandId: highest.bandId };
}
export function getLevel(c) {
  const xp = Math.max(0, num(c.xp));
  const level = Math.floor(Math.sqrt(xp / 160)) + 1;
  const floor = (level - 1) ** 2 * 160, ceiling = level ** 2 * 160;
  return { level, xpInto: xp - floor, xpNeeded: ceiling - floor, progress: (xp - floor) / (ceiling - floor) };
}

function snapshot(c) {
  const history = historicalTraining(c);
  // Store a compact, versioned loadout rather than duplicating the entire character
  // or a 75-exercise matrix inside every receipt. Years of logs must stay portable.
  const trainingPartners = [...new Set([...c.activePartners, ...c.cores])];
  const source = clone({ routeId: c.routeId, race: c.race, branch: c.branch, raceResource: c.raceResource, xp: c.xp,
    partners: Object.fromEntries(trainingPartners.map(pid => [pid, { level: c.partners[pid]?.level || 1 }])), activePartners: c.activePartners, equipment: c.equipment,
    abilities: Object.fromEntries(c.activeAbilities.map(aid => [aid, c.abilities[aid]])),
    activeAbilities: c.activeAbilities, activeForm: c.activeForm, forms: { [c.activeForm]: { level: c.forms[c.activeForm]?.level || 1 } }, earnedBands: c.earnedBands,
    masteredSagas: c.masteredSagas, completedSagas: c.completedSagas, cores: c.cores,
    wishes: c.wishes.map(w => ({ type: w.type })), _historyProfile: { weeks: history.weeks, groups: [...history.groups] }, _masteryProfile: masteryProfile(c) });
  const focusId = c.focusSagaId && c.completedSagas.includes(c.focusSagaId) ? c.focusSagaId : currentSaga(c).id;
  const learning = getLearningBoosts(c);
  return { version: RULES.version, sagaId: focusId, partners: [...c.activePartners].slice(0, getPartnerSlots(c)), formId: c.activeForm,
    source, summary: { ...getBoosts(source), details: [] }, godKi: c.earnedBands.includes('divine'), tpMultiplier: learning.tp,
    xpMultiplier: learning.xp, partnerMultiplier: learning.bond,
  };
}
function measure(entry, exercise) {
  let raw = 0, minutes = 0;
  if (exercise.type === 'weighted') {
    raw = sum(entry.sets.map(s => s.reps * (1 + Math.min(s.weight, 250) / 100) * .05));
    minutes = sum(entry.sets.map(s => s.reps * .18));
  } else if (exercise.type === 'bodyweight') {
    raw = sum(entry.sets.map(s => s.reps * (1 + Math.min(s.weight, 100) / 100) * .055));
    minutes = sum(entry.sets.map(s => s.reps * .18));
  } else if (exercise.type === 'timed_hold') {
    minutes = sum(entry.sets.map(s => s.seconds / 60)); raw = minutes * .8;
  } else if (exercise.type === 'cardio_distance') {
    const group = exercise.group;
    const speed = group === 'walking' ? 12 : group === 'cycling' ? 3 : group === 'swimming' ? 25 : 6;
    const inferred = entry.distance * speed;
    minutes = entry.duration || inferred;
    // Equal minutes give equal raw growth; distance documents the activity without granting a speed jackpot.
    raw = minutes * .20;
  } else { minutes = entry.duration; raw = minutes * .20; }
  return { raw: raw * RULES.statConversion, minutes };
}
function buildReceipt(workout, snap) {
  const stats = zeroStats();
  let minutes = 0, raw = 0;
  const entries = [];
  for (const entry of workout.entries) {
    const exercise = exercises.get(entry.exerciseId);
    const measured = measure(entry, exercise);
    const distribution = exercise.stat || exercise.weights || { END: 1, TEC: .2 };
    const allowed = STATS.filter(s => s !== 'GKI' || snap.godKi);
    const totalWeight = sum(allowed.map(s => num(distribution[s]))) || 1;
    const gains = zeroStats();
    for (const stat of allowed) {
      gains[stat] = measured.raw * num(distribution[stat]) / totalWeight * getBoosts(snap.source, { ...exercise, _stat: stat }).total;
      stats[stat] += gains[stat];
    }
    minutes += measured.minutes; raw += measured.raw;
    entries.push({ exerciseId: exercise.id, minutes: measured.minutes, raw: measured.raw, stats: gains });
  }
  return { version: RULES.version, stats, xp: minutes * 4 * num(snap.xpMultiplier, 1), tp: minutes * .35 * snap.tpMultiplier, ap: minutes / 90,
    minutes, raw, partnerXP: minutes * 1.4 * snap.partnerMultiplier, formXP: minutes * .5, sagaId: snap.sagaId, activePartners: snap.partners,
    activeForm: snap.formId, raceResource: minutes / 120, snapshot: snap, entries };
}

export function logWorkout(c, input, now = new Date()) {
  const workout = validateWorkout(input, now);
  if (workout.id && c.workouts.some(w => w.id === workout.id)) fail('This session has already been saved.');
  if (workout.kind === 'rest' && c.workouts.some(w => !w.legacy && w.kind === 'rest' && w.date === workout.date)) fail('A rest check-in is already recorded for this date.');
  c.dailySnapshots ||= {};
  const daily = c.workouts.find(w => w.date === workout.date && !w.legacy && w.receipt)?.receipt.snapshot || c.dailySnapshots[workout.date] || snapshot(c);
  const saved = { ...workout, id: workout.id || id('workout'), createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), receipt: buildReceipt(workout, daily) };
  // The receipt owns its snapshot. Only dates whose last receipt was deleted need
  // a tombstone; duplicating every snapshot in two save fields doubles long saves.
  delete c.dailySnapshots[workout.date];
  c.workouts.push(saved);
  c.workouts.sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id));
  if (workout.date === localDate(now)) c.recovery = { ...workout.recovery };
  rebuildCharacter(c);
  return saved;
}
export function editWorkout(c, workoutId, patch, now = new Date()) {
  const index = c.workouts.findIndex(w => w.id === workoutId);
  if (index < 0) fail('That workout was not found.');
  const previous = c.workouts[index];
  if (previous.legacy && (patch.entries || patch.kind || patch.date)) fail('Imported v6 training is an archive. Its notes can be edited; use a v7 session for new training.');
  if (previous.legacy) {
    const edited = { ...previous, name: shortText(patch.name, previous.name, 120), notes: shortText(patch.notes, previous.notes, 6000), updatedAt: new Date(now).toISOString() };
    c.workouts[index] = edited; return edited;
  }
  const edited = validateWorkout({ ...previous, ...patch, id: workoutId }, now);
  if (edited.kind === 'rest' && c.workouts.some(w => w.id !== workoutId && !w.legacy && w.kind === 'rest' && w.date === edited.date)) fail('A rest check-in is already recorded for this date.');
  const contentChanged = JSON.stringify(edited.entries) !== JSON.stringify(previous.entries) || edited.kind !== previous.kind;
  const receipt = contentChanged ? buildReceipt(edited, previous.receipt.snapshot) : previous.receipt;
  const saved = { ...previous, ...edited, receipt, updatedAt: new Date(now).toISOString() };
  c.workouts[index] = saved;
  c.workouts.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  rebuildCharacter(c);
  return saved;
}
export function deleteWorkout(c, workoutId) {
  const index = c.workouts.findIndex(w => w.id === workoutId);
  if (index < 0) fail('That workout was not found.');
  const removed = c.workouts[index];
  if (!removed.legacy && removed.receipt && !c.workouts.some(w => w.id !== workoutId && w.date === removed.date && !w.legacy)) {
    c.dailySnapshots ||= {};
    c.dailySnapshots[removed.date] = removed.receipt.snapshot;
  }
  c.workouts.splice(index, 1);
  rebuildCharacter(c);
  return c;
}

// Rebuild from immutable receipts, never from today's loadout. Currency debt is visible
// after deleting previously spent rewards; it is repaid before any further purchases.
export function rebuildCharacter(c) {
  const b = c.baseline || {};
  c.stats = { ...zeroStats(), ...(b.stats || CATALOG.startingStats[c.race]) };
  let xp = num(b.xp), tp = num(b.tp), ap = num(b.ap), resource = num(b.raceResource), story = num(b.storyXP);
  const pXP = { ...(b.partnerXP || {}) }, fXP = { ...(b.formXP || {}) };
  const weekly = {}, focus = { ...(b.sagaFocus || {}) }, dates = new Set();
  let totalMinutes = 0;
  for (const workout of c.workouts) {
    if (workout.legacy || !workout.receipt) continue;
    const receipt = workout.receipt;
    for (const stat of STATS) c.stats[stat] += num(receipt.stats?.[stat]);
    xp += num(receipt.xp); tp += num(receipt.tp); ap += num(receipt.ap); resource += num(receipt.raceResource);
    for (const pid of receipt.activePartners || []) pXP[pid] = num(pXP[pid]) + num(receipt.partnerXP);
    fXP[receipt.activeForm || 'base'] = num(fXP[receipt.activeForm || 'base']) + num(receipt.formXP);
    const key = weekKey(workout.date);
    weekly[key] ||= { minutes: 0, focus: {} };
    weekly[key].minutes += num(receipt.minutes);
    weekly[key].focus[receipt.sagaId] = num(weekly[key].focus[receipt.sagaId]) + num(receipt.minutes);
    if (receipt.minutes > 0) dates.add(workout.date);
    totalMinutes += num(receipt.minutes);
  }
  for (const week of Object.values(weekly)) {
    const earned = Math.min(RULES.weeklyStoryCap, week.minutes / RULES.storyMinutes * RULES.weeklyStoryCap);
    story += earned;
    for (const [sagaId, minutes] of Object.entries(week.focus)) focus[sagaId] = num(focus[sagaId]) + (week.minutes ? earned * minutes / week.minutes : 0);
  }
  for (const event of c.journal || []) {
    xp += num(event.reward?.xp); tp += num(event.reward?.tp); ap += num(event.reward?.ap);
  }
  for (const spend of c.spending || []) { tp -= num(spend.tp); ap -= num(spend.ap); }
  c.currencyDebt = { tp: Math.max(0, -tp), ap: Math.max(0, -ap) };
  c.xp = round(xp); c.tp = round(Math.max(0, tp)); c.ap = round(Math.max(0, ap)); c.storyXP = round(story); c.raceResource = round(Math.min(100, resource)); c.sagaFocus = focus;
  for (const [pid, partner] of Object.entries(c.partners)) {
    partner.xp = round(num(pXP[pid]));
    const baseLevel = num(b.partnerLevels?.[pid], 1 + Math.floor(Math.sqrt(num(b.partnerXP?.[pid]) / 24)));
    partner.level = baseLevel + Math.floor(Math.sqrt(Math.max(0, partner.xp - num(b.partnerXP?.[pid])) / 24));
  }
  for (const [fid, form] of Object.entries(c.forms)) {
    form.xp = round(num(fXP[fid]));
    const baseLevel = num(b.formLevels?.[fid], 1 + Math.floor(Math.sqrt(num(b.formXP?.[fid]) / 50)));
    form.level = baseLevel + Math.floor(Math.sqrt(Math.max(0, form.xp - num(b.formXP?.[fid])) / 50));
  }
  c.expeditionPoints = sum(Object.values(weekly).map(w => Math.min(50, w.minutes / 3)));
  c.weeklyProgress = weekly;
  c.achievements = [...new Set([...(c.achievements || []), ...(dates.size >= 1 ? ['first_training'] : []), ...(dates.size >= 10 ? ['ten_training_days'] : []), ...(dates.size >= 100 ? ['hundred_training_days'] : []), ...(totalMinutes >= 1000 ? ['thousand_minutes'] : []), ...(Object.keys(c.partners).length >= 10 ? ['growing_school'] : []), ...(c.completedSagas.length >= 9 ? ['dragon_ball_complete'] : [])])];
  for (const stat of STATS) c.stats[stat] = round(c.stats[stat]);
  return c;
}

function sagaRequirements(saga) {
  return { base: Math.max(12, num(saga.baseEndPL, 12)), story: Math.max(50, num(saga.storyClearXP, 50)), focus: Math.max(45, num(saga.focusClearXP, 45)) };
}
export function getSagaState(c, sagaId) {
  const saga = sagas.get(sagaId);
  if (!saga) fail('That saga was not found.');
  const req = sagaRequirements(saga);
  const mastered = c.masteredSagas.includes(sagaId), cleared = c.completedSagas.includes(sagaId);
  const open = availableSaga(c, sagaId);
  const focus = num(c.sagaFocus[sagaId]);
  const power = getPower(c).base;
  const bandReady = c.earnedBands.includes(saga.stateBandId || 'base');
  const requiredRelease = routeOf(c).tiers.find(t => t.bandId === saga.stateBandId)?.name || saga.stateBandId;
  const reason = !open ? 'Clear the previous saga to continue the story.' : power < req.base ? `Develop base power to ${Math.ceil(req.base).toLocaleString()}.` : c.storyXP < req.story ? `Earn ${Math.ceil(req.story - c.storyXP)} more story XP through training.` : focus < req.focus ? `Earn ${Math.ceil(req.focus - focus)} more focus in this saga.` : !bandReady ? `Awaken ${requiredRelease} to face this saga’s finale.` : 'Ready for the saga finale.';
  const replays = (c.journal || []).filter(event => event.kind === 'replay' && event.sagaId === sagaId);
  const replaySpent = sum(replays.map(event => num(event.focusCost, 100)));
  const replayProgress = Math.max(0, focus - req.focus - replaySpent);
  return { status: mastered ? 'mastered' : cleared ? 'cleared' : open ? 'available' : 'locked', focus, focusRequired: req.focus, baseRequired: req.base, storyRequired: req.story, bandRequired: saga.stateBandId || 'base', canClear: !cleared && open && power >= req.base && c.storyXP >= req.story && focus >= req.focus && bandReady, reason,
    focused: (c.focusSagaId || currentSaga(c).id) === sagaId, replayCount: replays.length, replayProgress, replayRequired: 100, canReplay: cleared && replayProgress >= 100 };
}
export function setFocusSaga(c, sagaId = null) {
  if (sagaId !== null && sagaId !== currentSaga(c).id && !c.completedSagas.includes(sagaId)) fail('Choose the current saga or a saga you have already cleared.');
  if (sagaId !== null && !sagas.has(sagaId)) fail('That saga was not found.');
  c.focusSagaId = sagaId === currentSaga(c).id ? null : sagaId;
  return c.focusSagaId;
}
export function replaySaga(c, sagaId) {
  const state = getSagaState(c, sagaId);
  if (!state.canReplay) fail(state.status === 'locked' || state.status === 'available' ? 'Clear this saga before replaying its challenge.' : `Earn ${Math.ceil(state.replayRequired - state.replayProgress)} more replay focus by training in this saga.`);
  c.journal.push({ id: `replay:${sagaId}:${state.replayCount + 1}`, kind: 'replay', sagaId, focusCost: state.replayRequired, reward: { tp: 20 + sagaIndex(sagaId) * 2, ap: 1 } });
  rebuildCharacter(c);
  return getSagaState(c, sagaId);
}
export function clearSaga(c, sagaId) {
  const s = getSagaState(c, sagaId);
  if (!s.canClear) fail(s.status === 'cleared' || s.status === 'mastered' ? 'This saga is already complete.' : s.reason);
  c.completedSagas.push(sagaId);
  const index = sagaIndex(sagaId);
  c.journal.push({ id: `clear:${sagaId}`, kind: 'saga', sagaId, reward: { tp: 12 + index * 3, ap: 2 + Math.floor(index / 6), xp: 100 + index * 20 } });
  rebuildCharacter(c);
  return getSagaState(c, sagaId);
}
export function masterSaga(c, sagaId) {
  const s = getSagaState(c, sagaId);
  if (s.status === 'mastered') fail('This saga is already mastered.');
  if (s.status !== 'cleared') fail('Clear the saga before pursuing mastery.');
  if (getPower(c).base < s.baseRequired * 1.25) fail(`Mastery requires ${Math.ceil(s.baseRequired * 1.25).toLocaleString()} base power.`);
  if (c.storyXP < s.storyRequired + 100) fail('Earn another 100 story XP beyond this saga’s clear requirement.');
  c.masteredSagas.push(sagaId);
  c.journal.push({ id: `master:${sagaId}`, kind: 'mastery', sagaId, reward: { tp: 20 + sagaIndex(sagaId) * 3, ap: 3 } });
  rebuildCharacter(c);
  return getSagaState(c, sagaId);
}

function spend(c, kind, itemId, tp = 0, ap = 0) {
  if (c.tp + 1e-8 < tp || num(c.currencyDebt?.tp) > 0) fail('You need more training points for that purchase.');
  if (c.ap + 1e-8 < ap || num(c.currencyDebt?.ap) > 0) fail('You need more ability points for that technique.');
  c.spending.push({ id: id('purchase'), kind, itemId, tp, ap });
}
export function getPartnerState(c, partnerId) {
  const partner = partners.get(partnerId);
  if (!partner) fail('That training partner was not found.');
  const cost = Math.max(5, Math.round(Math.pow(num(partner.cost, 5), .78)));
  const unlocked = availableSaga(c, partner.sagaReq);
  const isOwned = !!c.partners[partnerId];
  const reason = isOwned ? 'Train together to develop this bond.' : !unlocked ? `Reach ${sagas.get(partner.sagaReq)?.name || sagas.get(partner.sagaReq)?.title || partner.sagaReq} to meet this partner.` : c.tp < cost || num(c.currencyDebt?.tp) ? `Requires ${cost} training points.` : 'Ready to join your training school.';
  return { owned: isOwned, active: c.activePartners.includes(partnerId), level: num(c.partners[partnerId]?.level), cost, canBuy: !isOwned && unlocked && c.tp >= cost && !num(c.currencyDebt?.tp), reason, bonus: partner.role || partner.boonTrack || 'Training growth and partner mastery' };
}
export function recruitPartner(c, partnerId) {
  const state = getPartnerState(c, partnerId);
  if (!state.canBuy) fail(state.reason);
  spend(c, 'partner', partnerId, state.cost);
  c.partners[partnerId] = { level: 1, xp: 0 };
  if (c.activePartners.length < getPartnerSlots(c)) c.activePartners.push(partnerId);
  rebuildCharacter(c);
  return c.partners[partnerId];
}
export function togglePartner(c, partnerId) {
  if (!c.partners[partnerId] || !partners.has(partnerId)) fail('Recruit this partner first.');
  if (c.activePartners.includes(partnerId)) c.activePartners = c.activePartners.filter(pid => pid !== partnerId);
  else {
    if (c.cores.includes(partnerId)) fail('Remove this partner’s core before adding them to the active team.');
    if (c.activePartners.length >= getPartnerSlots(c)) fail(`Your team has ${getPartnerSlots(c)} slots. Rest a partner before adding another.`);
    c.activePartners.push(partnerId);
  }
  return c.activePartners;
}
export function getEquipmentState(c, equipmentId) {
  const upgrade = equipment.get(equipmentId);
  if (!upgrade) fail('That equipment upgrade was not found.');
  const level = num(c.equipment[equipmentId]), maxLevel = num(upgrade.maxLevel, 1);
  const cost = Math.max(5, Math.round(num(upgrade.cost, 10) * .42 + num(upgrade.costStep) * level * .30));
  const required = (upgrade.requires || []).find(eid => num(c.equipment[eid]) < Math.max(1, num(upgrade.requiresLevel?.[eid], 1)));
  const requiredLevel = Object.entries(upgrade.requiresLevel || {}).find(([eid, n]) => num(c.equipment[eid]) < n);
  const unlocked = availableSaga(c, upgrade.sagaId);
  const reason = level >= maxLevel ? 'This equipment is fully developed.' : !unlocked ? `Reach ${sagas.get(upgrade.sagaId)?.name || upgrade.sagaId} first.` : required || requiredLevel ? `Develop ${equipment.get(required || requiredLevel[0])?.name || required || requiredLevel[0]}${requiredLevel ? ` to level ${requiredLevel[1]}` : ''} first.` : c.tp < cost || num(c.currencyDebt?.tp) ? `Requires ${cost} training points.` : 'Invest in faster permanent stat growth.';
  return { level, maxLevel, cost, canBuy: level < maxLevel && unlocked && !required && !requiredLevel && c.tp >= cost && !num(c.currencyDebt?.tp), reason };
}
export function buyEquipment(c, equipmentId) {
  const state = getEquipmentState(c, equipmentId);
  if (!state.canBuy) fail(state.reason);
  spend(c, 'equipment', equipmentId, state.cost);
  c.equipment[equipmentId] = state.level + 1;
  rebuildCharacter(c);
  return getEquipmentState(c, equipmentId);
}
export function getAbilityState(c, abilityId) {
  const ability = abilities.get(abilityId);
  if (!ability) fail('That ability was not found.');
  const rank = num(c.abilities[abilityId]), maxRank = num(ability.ranks, 1), cost = Math.max(1, Math.ceil(num(ability.spCost, 1) * (1 + rank * .6)));
  const unlocked = availableSaga(c, ability.sagaId);
  // Legacy absolute stat thresholds belonged to a different power scale. Saga access and
  // earned AP gate v7 techniques; their specialties still determine where training grows.
  const reason = rank >= maxRank ? 'Technique fully learned.' : !unlocked ? `Reach ${sagas.get(ability.sagaId)?.name || ability.sagaId} to learn this technique.` : c.ap < cost || num(c.currencyDebt?.ap) ? `Requires ${cost} ability points.` : 'Learn a training specialty.';
  return { rank, maxRank, cost, canBuy: rank < maxRank && unlocked && c.ap >= cost && !num(c.currencyDebt?.ap), reason, active: c.activeAbilities.includes(abilityId), specialty: abilitySpecialty(ability) };
}
export function buyAbility(c, abilityId) {
  const state = getAbilityState(c, abilityId);
  if (!state.canBuy) fail(state.reason);
  spend(c, 'ability', abilityId, 0, state.cost);
  c.abilities[abilityId] = state.rank + 1;
  if (!c.activeAbilities.includes(abilityId) && c.activeAbilities.length < RULES.maxAbilities) c.activeAbilities.push(abilityId);
  rebuildCharacter(c);
  return getAbilityState(c, abilityId);
}
export function toggleAbility(c, abilityId) {
  if (!c.abilities[abilityId] || !abilities.has(abilityId)) fail('Learn this technique first.');
  if (c.activeAbilities.includes(abilityId)) c.activeAbilities = c.activeAbilities.filter(aid => aid !== abilityId);
  else {
    if (c.activeAbilities.length >= RULES.maxAbilities) fail(`Prepare up to ${RULES.maxAbilities} abilities at a time.`);
    c.activeAbilities.push(abilityId);
  }
  return c.activeAbilities;
}

function compatible(c, form) {
  if (c.routeId === 'android_infinite' && ['semi_perfect_cell', 'perfect_form', 'super_perfect_form'].includes(form.id)) return false;
  return form.race === 'universal' || form.race === c.race || (c.race === 'hybrid' && form.race === 'saiyan') || (Array.isArray(form.race) && form.race.includes(c.race));
}
function getFormDefinition(c, formId) {
  if (formId === 'base') return { id: 'base', name: routeOf(c).tiers[0].name, bandId: 'base', multiplier: 1, sagaId: CATALOG.sagas[0].id };
  const form = forms.get(formId);
  if (!form || !compatible(c, form)) return null;
  let tier = routeOf(c).tiers.find(t => t.formIds.includes(formId));
  if (!tier) {
    // A compatible race can share a form without accidentally receiving it in its
    // base band simply because the legacy record has no explicit saga requirement.
    const nativeRoute = Object.values(routes).find(r => r.race === form.race && r.tiers.some(t => t.formIds.includes(formId)));
    const nativeTier = nativeRoute?.tiers.find(t => t.formIds.includes(formId));
    const sagaId = form.reqs?.sagaId;
    const index = Math.max(0, sagaIndex(sagaId));
    tier = nativeTier ? routeOf(c).tiers.find(t => t.bandId === nativeTier.bandId) : [...routeOf(c).tiers].reverse().find(t => sagaIndex(t.sagaId) <= index) || routeOf(c).tiers[1];
    if (tier.bandId === 'base') tier = routeOf(c).tiers[1];
  }
  // Earliest matching route band is authoritative, shared variants never invent an
  // independent million-fold multiplier. Later compatible bands keep the release useful.
  return { ...form, bandId: tier.bandId, multiplier: tier.multiplier, sagaId: tier.sagaId, originalSagaId: form.reqs?.sagaId };
}
export function getFormState(c, formId) {
  const definition = getFormDefinition(c, formId);
  const unlocked = !!c.forms[formId];
  if (!definition) return { unlocked: false, equipped: false, canUnlock: false, reason: 'This form belongs to another race route.', multiplier: 1, level: 0 };
  const bandReady = c.earnedBands.includes(definition.bandId);
  const sagaReady = availableSaga(c, definition.originalSagaId);
  const ready = bandReady && sagaReady;
  return { unlocked, equipped: c.activeForm === formId, canUnlock: !unlocked && ready, reason: unlocked ? 'Train in this form to deepen mastery.' : !sagaReady ? `Reach ${sagas.get(definition.originalSagaId)?.name || definition.originalSagaId} first.` : ready ? 'Your earned release supports this form.' : `Earn ${routeOf(c).tiers.find(t => t.bandId === definition.bandId)?.name || definition.bandId} first.`, multiplier: definition.multiplier, level: num(c.forms[formId]?.level), bandId: definition.bandId };
}
export function unlockForm(c, formId) {
  const state = getFormState(c, formId);
  if (!state.canUnlock) fail(state.reason);
  c.forms[formId] = { xp: 0, level: 1 };
  return c.forms[formId];
}
export function equipForm(c, formId) {
  const state = getFormState(c, formId);
  if (!state.unlocked) fail('Unlock this form before using it.');
  c.activeForm = formId;
  return getPower(c);
}
function tierState(c, tier) {
  const earned = c.earnedBands.includes(tier.bandId);
  const index = routeOf(c).tiers.findIndex(t => t.bandId === tier.bandId);
  const previous = routeOf(c).tiers[Math.max(0, index - 1)];
  const saga = sagas.get(tier.sagaId) || CATALOG.sagas[0];
  const requiredBase = sagaRequirements(saga).base * (tier.baseShare || .75);
  const requiredResource = num(tier.resource);
  const focusRequired = Math.min(num(tier.focusXP), sagaRequirements(saga).focus);
  const coreRequired = ['majin', 'android_bio'].includes(c.routeId) && index >= 3 ? Math.min(3, Math.floor(index / 3)) : 0;
  const reason = earned ? 'Release earned permanently.' : !c.earnedBands.includes(previous.bandId) ? `Earn ${previous.name} first.` : !availableSaga(c, tier.sagaId) ? `Reach ${saga.name || saga.title || tier.sagaId}.` : getPowerBase(c) < requiredBase ? `Develop ${Math.ceil(requiredBase).toLocaleString()} base power.` : num(c.sagaFocus[tier.sagaId]) < focusRequired ? `Earn ${Math.ceil(focusRequired - num(c.sagaFocus[tier.sagaId]))} more focus in this saga.` : c.raceResource < requiredResource ? `Develop ${requiredResource} ${routeOf(c).resourceLabel}.` : (c.cores || []).length < coreRequired ? `Equip ${coreRequired} ${c.routeId === 'majin' ? 'partner cores' : 'adaptation templates'}.` : 'Ready to awaken.';
  return { ...tier, earned, canUnlock: !earned && reason === 'Ready to awaken.', reason, requiredBase, requiredResource, coreRequired };
}
function getPowerBase(c) {
  const start = CATALOG.startingStats[c.race] || CATALOG.startingStats.earthling;
  return 5 + sum(STATS.map(s => Math.max(0, num(c.stats[s]) - num(start[s])) * weights[s]));
}
export function getRouteState(c) {
  const route = routeOf(c);
  return { name: route.label, description: routeCopy[c.routeId], resourceName: route.resourceLabel, resource: num(c.raceResource), tiers: route.tiers.map(t => tierState(c, t)), branches: c.routeId === 'namekian' ? [{ id: 'warrior', name: 'Warrior', description: '+35% STR, +25% END and +15% VIT within the race factor.' }, { id: 'dragon', name: 'Dragon', description: '+40% SPI, +25% TEC and +30% GKI within the race factor.' }, { id: 'balanced', name: 'Balanced', description: '+13% to all six ordinary stats within the race factor.' }] : [] };
}
export function awaken(c, bandId) {
  const tier = routeOf(c).tiers.find(t => t.bandId === bandId || t.id === bandId);
  if (!tier) fail('That release does not belong to this route.');
  const state = tierState(c, tier);
  if (!state.canUnlock) fail(state.reason);
  c.earnedBands.push(tier.bandId);
  c.journal.push({ id: `awaken:${tier.bandId}`, kind: 'awakening', bandId: tier.bandId, reward: { ap: 2 + bands.findIndex(b => b.id === tier.bandId) } });
  for (const fid of tier.formIds) if (getFormState(c, fid).canUnlock) c.forms[fid] = { level: 1, xp: 0 };
  const signature = tier.formIds.find(fid => c.forms[fid]);
  if (signature) c.activeForm = signature;
  rebuildCharacter(c);
  return getPower(c);
}
export function setBranch(c, branch) {
  if (c.routeId !== 'namekian') fail('Branch specialisation is part of Namekian training.');
  if (!['warrior', 'dragon', 'balanced'].includes(branch)) fail('Choose Warrior, Dragon, or Balanced training.');
  c.branch = branch;
  return getRouteState(c);
}
export function equipCore(c, partnerId) {
  if (!['majin', 'android_bio'].includes(c.routeId)) fail('Partner cores belong to Majin and Bio-Android routes.');
  if (!c.partners[partnerId]) fail('Recruit this partner before learning their core.');
  if (c.cores.includes(partnerId)) c.cores = c.cores.filter(pid => pid !== partnerId);
  else {
    if (c.activePartners.includes(partnerId)) fail('Rest this active partner before equipping their core.');
    if (c.cores.length >= RULES.maxCores) fail('You can equip up to three partner cores. Remove one to change your build.');
    c.cores.push(partnerId);
  }
  return c.cores;
}

export function getReadiness(c, now = new Date()) {
  const today = localDate(now);
  const recent = c.workouts.filter(w => !w.legacy && daysBetween(w.date, today) >= 0 && daysBetween(w.date, today) < 7);
  const todaySignals = recent.filter(w => w.date === today).map(w => w.recovery || {});
  const illness = !!c.recovery?.illness || todaySignals.some(r => r.illness), injury = !!c.recovery?.injury || todaySignals.some(r => r.injury);
  if (illness || injury) return { score: null, label: illness ? 'Illness reported' : 'Injury reported', reason: 'Your own recovery report takes priority over the activity estimate.', recommendation: 'Choose recovery or adjust your plan to how you feel. Permanent progress is safe.' };
  const training = recent.filter(w => w.kind === 'training');
  if (new Set(training.map(w => w.date)).size < 3) return { score: null, label: 'Learning your rhythm', reason: 'There are fewer than three distinct recent training dates for a useful estimate.', recommendation: 'Use your energy, soreness and planned recovery to choose today’s session.' };
  if (c.recovery?.deload) return { score: null, label: 'Deload selected', reason: 'You have planned an easier training period.', recommendation: 'Keep the lighter plan. Deloading never removes earned stats.' };
  const last3 = training.filter(w => daysBetween(w.date, today) <= 2);
  const workload = sum(last3.map(w => {
    const physicalLoad = sum((w.receipt?.entries || []).map(entry => {
      const exercise = exercises.get(entry.exerciseId);
      const contribution = exercise?.id === 'meditation' ? .05 : exercise?.category === 'flexibility' ? .2 : exercise?.type === 'timed_hold' ? .6 : 1;
      return num(entry.minutes) * contribution;
    }));
    return physicalLoad * (w.rpe === null ? .7 : clamp(num(w.rpe, 7) / 10, .1, 1));
  }));
  const score = Math.round(clamp(92 - workload * .3, 15, 92));
  return { score, label: score < 45 ? 'Recovery may help' : score < 70 ? 'Keep it measured' : 'Recent load is manageable', reason: 'A rough estimate from your last three days of logged work and RPE; it does not measure physiological readiness.', recommendation: score < 45 ? 'Consider a lighter session or a rest day, guided by how you feel.' : 'Follow your plan and adjust it to your energy today.' };
}

export const getStoryBondLevel = legacyLevel => Math.max(1, Math.ceil(num(legacyLevel, 1) * .22));
function storyUnlock(c, unlock) {
  if (!unlock) return true;
  const partner = unlock.partner;
  if (partner && (!c.partners[partner.id] || num(c.partners[partner.id].level) < getStoryBondLevel(partner.level))) return false;
  for (const p of unlock.partners || []) if (!c.partners[p.id] || num(c.partners[p.id].level) < getStoryBondLevel(p.level)) return false;
  const saga = unlock.saga;
  if (saga) {
    if (saga.status === 'mastered' && !c.masteredSagas.includes(saga.id)) return false;
    if (saga.status === 'cleared' && !c.completedSagas.includes(saga.id)) return false;
    if (!availableSaga(c, saga.id)) return false;
  }
  return true;
}
export function getStoryEntries(c) {
  const result = [];
  const add = (entry, pack, kind, sagaId) => result.push({ id: entry.id, title: entry.title, text: [entry.canonText || entry.trainingText, entry.characterText, entry.playerReflection].filter(Boolean).join('\n\n'), series: pack.series || '', sagaId, kind, read: (c.storyRead || []).includes(entry.id), sourceNote: pack.sourceNote || '', continuity: entry.continuity || pack.continuity });
  for (const [sagaId, pack] of Object.entries(CATALOG.story.sagas || {})) {
    if (!sagas.has(sagaId) || !availableSaga(c, sagaId)) continue;
    const state = getSagaState(c, sagaId), ratio = Math.min(1, state.focus / state.focusRequired);
    for (const entry of pack.entries || []) {
      if (entry.phase === 'resolution' && !c.completedSagas.includes(sagaId)) continue;
      if (entry.phase === 'mastery' && !c.masteredSagas.includes(sagaId)) continue;
      if (!['resolution', 'mastery'].includes(entry.phase) && num(entry.focusRatio) > ratio && !c.completedSagas.includes(sagaId)) continue;
      add(entry, pack, 'saga', sagaId);
    }
  }
  for (const kind of ['characters', 'relationships']) for (const pack of Object.values(CATALOG.story[kind] || {})) {
    for (const entry of pack.beats || pack.entries || []) if (storyUnlock(c, entry.unlock)) add(entry, pack, kind === 'characters' ? 'character' : 'relationship', entry.unlock?.saga?.id || null);
  }
  return result;
}
export function markStoryRead(c, storyId) {
  if (!getStoryEntries(c).some(entry => entry.id === storyId)) fail('That story is not unlocked yet.');
  c.storyRead ||= [];
  if (!c.storyRead.includes(storyId)) c.storyRead.push(storyId);
}
export function getExpedition(c) {
  const goal = 350;
  const spent = sum(c.wishes.map(w => num(w.cost, goal)));
  const progress = Math.max(0, num(c.expeditionPoints) - spent);
  return { balls: Math.min(7, Math.floor(progress / 50)), progress, goal, canWish: progress >= goal, wishes: c.wishes.length, description: 'Training explores the world: up to one Dragon Ball per week of accumulated work. Seven Dragon Balls grant a wish. Every expedition uses the same attainable cost.' };
}
export function makeWish(c, type) {
  if (!['training', 'partners', 'technique'].includes(type)) fail('Choose training, partners, or technique for your wish.');
  const expedition = getExpedition(c);
  if (!expedition.canWish) fail('Find all seven Dragon Balls through training before making a wish.');
  const wish = { id: id('wish'), type, cost: expedition.goal, number: c.wishes.length + 1 };
  c.wishes.push(wish);
  c.journal.push({ id: wish.id, kind: 'wish', reward: type === 'technique' ? { ap: 8 } : type === 'partners' ? { tp: 30 } : { tp: 15 } });
  rebuildCharacter(c);
  return wish;
}
export function getRecords(c) {
  const records = new Map();
  const keep = record => { const key = `${record.name}:${record.unit}`; if (!records.has(key) || records.get(key).value < record.value) records.set(key, record); };
  for (const workout of c.workouts) for (const entry of workout.entries || []) {
    const exercise = exercises.get(entry.exerciseId);
    if (!exercise) continue;
    if (exercise.type === 'cardio_distance' && entry.distance > 0) keep({ name: exercise.name, value: entry.distance, unit: 'km', date: workout.date });
    if (['cardio_distance', 'cardio_duration'].includes(exercise.type) && entry.duration > 0) keep({ name: exercise.name, value: entry.duration, unit: 'min', date: workout.date });
    for (const set of entry.sets || []) {
      if (['weighted', 'bodyweight'].includes(exercise.type) && set.weight > 0 && set.reps > 0) keep({ name: exercise.name, value: set.weight, unit: 'kg', date: workout.date });
      if (['weighted', 'bodyweight'].includes(exercise.type) && set.reps > 0) keep({ name: exercise.name, value: set.reps, unit: 'reps', date: workout.date });
      if (exercise.type === 'timed_hold' && set.seconds > 0) keep({ name: exercise.name, value: set.seconds, unit: 'sec', date: workout.date });
    }
  }
  return [...records.values()].sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
}
