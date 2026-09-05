import { getBoosts as historicalBoosts } from './rules-v1/engine.js';
import { CATALOG, STATS } from './catalog.js';
import { FORM_POWER_RULES_VERSION, formCombatCosts } from './form-rules.js';
import { RESTORED, ensureDevelopment, practiceState, partnerMilestones, boonEffect, abilitySpecialtyData, abilityResonance, MASTERY_STAGES, trainingMetrics, boundedLegacyReward, developmentReceipt } from './progression.js';

// All earning rules live here. The browser and campaign simulator use this module.
export const RULES = Object.freeze({ version: 2, weeklyStoryCap: 50, storyMinutes: 150, statConversion: 0.18, formXPPerMinute:5, maxPartners: 7, maxAbilities: 7, maxCores: 3 });
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
    equipment: {}, abilities: {}, activeAbilities: [], forms: { base: { level: 1, xp: 0 } }, activeForm: 'base', activeRelease:false, earnedBands: ['base'],
    completedSagas: [], masteredSagas: [], sagaFocus: {}, raceResource: 0, cores: [], draft: null, bodyWeightLog: [], plan: {}, journal: [],
    wishes: [], achievements: [], spending: [], recovery: { illness: false, injury: false, deload: false }, dailySnapshots: {}, storyRead: [], expeditionPoints: 0,
  };
  if (character.routeId === 'namekian' && !['warrior', 'dragon', 'balanced'].includes(character.branch)) fail('Choose Warrior, Dragon, or Balanced Namekian training.');
  ensureDevelopment(character);
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
    return { exerciseId: exercise.id, sets, duration, distance, notes:shortText(entry.notes,'',2000),restSeconds:boundedNumber(entry.restSeconds??0,'Rest seconds',0,3600) };
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
    const copied=c.coreTraits?.[pid];
    if(copied && c.partners[pid] && !c.activePartners.includes(pid)) return .045+(stat ? copied.stat===stat?num(copied.value):0 : num(copied.value)/6);
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
function getBoostsV1(c, exercise) {
  if (typeof exercise === 'string') exercise = exercises.get(exercise);
  const stat = exercise?._stat;
  const race = raceFactor(c, exercise, stat);
  let partnerBonus = 0;
  const details = [{ label: routeOf(c).label, category: 'race', multiplier: race }];
  for (const pid of c.activePartners.slice(0, Math.min(7, 2 + Math.floor(c.completedSagas.length / 7)))) {
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
  for (const aid of c.activeAbilities.slice(0, 4)) {
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
export function getPartnerSlots(c) { return Math.min(RULES.maxPartners, Math.max(num(c.partnerSlots, 2), 2 + Math.floor(c.completedSagas.length / 7))); }
export function getAbilitySlots(c) { return Math.min(7, Math.max(2, num(c.abilitySlots, c.developmentVersion ? 2 : 4))); }
function partnerContribution(c, pid, exercise, stat) {
  const p=partners.get(pid), progress=c.partners?.[pid]; if (!p || !progress) return 0;
  const level=Math.max(1,num(progress.level,1));
  const starting=.09+Math.min(.18,num(p.powerTier)*.004)+effectValue(p.effects,exercise,stat)*4;
  const mentor=c.mainMentor===pid ? .04 : 0;
  const milestone=boonEffect(c,pid,exercise,stat);
  const unlockedForms=getPartnerForms(c,pid).filter(f=>f.unlocked);
  const ownForm=unlockedForms.find(f=>f.id===c.partners[pid]?.activeForm)||unlockedForms.at(-1);
  const formBonus=ownForm ? Math.min(.12,(stat?num(ownForm.effects?.statGain?.[stat]):sum(Object.values(ownForm.effects?.statGain||{}))/6)*1.5+num(ownForm.effects?.categoryGain?.[exercise?.category])*1.5) : 0;
  return (starting*(1+Math.min(200,level-1)*.021)+milestone+mentor+formBonus)*(c.routeId==='earthling'?1.08:1);
}
function abilityContribution(c, aid, exercise, stat) {
  const a=abilities.get(aid), rank=num(c.abilities?.[aid]); if (!a || !rank) return 0;
  const specialty=abilitySpecialtyData(a), e=a.levelBalance?.baseEffects || {};
  const focused=stat ? num(specialty[stat]) : sum(Object.values(specialty))/6;
  const category=Math.min(.08,num(e.categoryGain?.[exercise?.category])*3);
  const affinity=abilityResonance(c,a,exercise,stat).total;
  return (.075+focused+category+affinity)*(1+Math.min(2,Math.max(0,sagaIndex(a.sagaId))/18))*(1+Math.min(2,rank-1)*.25)*practiceState(c,aid).multiplier;
}
function formEffects(c,fid){return c.forms?.[fid]&&getFormDefinition(c,fid)?forms.get(fid)?.effects||{}:{};}
function formTrainingSpecialty(c,fid,exercise,stat){const e=formEffects(c,fid);return (stat?num(e.statGain?.[stat]):sum(Object.values(e.statGain||{}))/6)+num(e.categoryGain?.[exercise?.category]);}
export function getBoosts(c, exercise) {
  if (c._rewardRules===1) return historicalBoosts(c,exercise);
  if (typeof exercise==='string') exercise=exercises.get(exercise);
  const stat=exercise?._stat, base=getBoostsV1({...c,wishes:c.wishes.filter(w=>!w.setId)},exercise);
  const pids=c.activePartners.slice(0,getPartnerSlots(c));
  const aids=c.activeAbilities.slice(0,getAbilitySlots(c));
  const pRaw=sum(pids.map(pid=>partnerContribution(c,pid,exercise,stat)));
  const aRaw=sum(aids.map(aid=>abilityContribution(c,aid,exercise,stat)));
  const echoes=(c.echoForms || []).filter(fid=>fid!==c.activeForm && c.forms?.[fid] && getFormDefinition(c,fid)).slice(0,2);
  const echoBonus=sum(echoes.map(fid=>Math.min(.025,Math.max(0,num(c.forms[fid].level)-1)*.001)+Math.min(.035,formTrainingSpecialty(c,fid,exercise,stat)*.15)));
  const primarySpecialty=Math.min(.10,formTrainingSpecialty(c,c.activeForm,exercise,stat)*.5);
  const discipline=c.divineDiscipline==='instinct' ? (stat==='AGI'||stat==='TEC'?.045:0) : c.divineDiscipline==='destruction' ? (stat==='STR'||stat==='SPI'?.045:0) : 0;
  const result={...base,partners:1+Math.min(10,pRaw),abilities:1+2.5*(1-Math.exp(-aRaw/2.5)),mastery:base.mastery+echoBonus+discipline+primarySpecialty};
  result.details=base.details.filter(d=>!['partners','abilities','mastery'].includes(d.category));
  for (const pid of pids) result.details.push({label:`${partners.get(pid)?.name} · partner level ${c.partners[pid]?.level}`,category:'partners',bonus:partnerContribution(c,pid,exercise,stat),appliedBonus:Math.min(10,pRaw)-Math.min(10,pRaw-partnerContribution(c,pid,exercise,stat)),mentor:c.mainMentor===pid});
  for (const aid of aids) {const contribution=abilityContribution(c,aid,exercise,stat);result.details.push({label:`${abilities.get(aid)?.name} · practice ${practiceState(c,aid).level}`,category:'abilities',bonus:contribution,appliedBonus:2.5*(Math.exp(-(aRaw-contribution)/2.5)-Math.exp(-aRaw/2.5))});}
  result.details.push({label:'Form mastery, training echoes and discipline',category:'mastery',multiplier:result.mastery});
  result.total=result.race*result.partners*result.equipment*result.abilities*result.mastery;
  return result;
}
export function getPartnerForms(c,pid) {
  const level=num(c.partners?.[pid]?.level);
  const result=(RESTORED.partnerForms?.[pid] || []).map((form,index)=>{const gate=[1,6,11,20,32,48,70][index]||70,ready=(!form.requiresSaga||availableSaga(c,form.requiresSaga))&&(form.requiresStatus!=='cleared'||c.completedSagas.includes(form.requiresSaga));return {...form,stage:index,legacyLevel:form.level,legacyPowerMultiplier:form.powerMultiplier,powerMultiplier:1,level:gate,unlocked:level>=gate&&ready,reason:level<gate?`Reach partner level ${gate}.`:!ready?`${form.requiresStatus==='cleared'?'Clear':'Reach'} ${sagas.get(form.requiresSaga)?.name||form.requiresSaga}.`:'Available as a training specialty.',trainingEffects:form.effects,description:'This partner form changes their training specialty; it does not multiply your Story PL.'};});
  const selected=c.partners?.[pid]?.activeForm||result.filter(f=>f.unlocked).at(-1)?.id;
  return result.map(f=>({...f,selected:f.id===selected}));
}
export function setPartnerForm(c,pid,formId){if(!c.partners[pid])fail('Recruit this partner first.');const form=getPartnerForms(c,pid).find(f=>f.id===formId);if(!form?.unlocked)fail(form?.reason||'This partner form is unavailable.');c.partners[pid].activeForm=formId;return getPartnerForms(c,pid);}
export function getPartnerDevelopment(c,pid,exercise) {
  const p=c.partners?.[pid]; if (!partners.has(pid)) fail('That training partner was not found.');
  const level=num(p?.level,1), base=num(c.baseline?.partnerLevels?.[pid],1+Math.floor(Math.sqrt(num(c.baseline?.partnerXP?.[pid])/24)));
  const earned=Math.max(0,num(p?.xp)-num(c.baseline?.partnerXP?.[pid]));
  const floor=(level-base)**2*24, ceiling=(level+1-base)**2*24;
  const contribution=partnerContribution(c,pid,exercise,exercise?._stat);
  const after={...c,partners:{...c.partners,[pid]:{...p,level:level+1}}};
  const next=partnerContribution(after,pid,exercise,exercise?._stat);
  const team=sum(c.activePartners.slice(0,getPartnerSlots(c)).map(id=>partnerContribution(c,id,exercise,exercise?._stat)));
  const active=c.activePartners.includes(pid);
  const milestones=partnerMilestones(c,pid).map(m=>{const at={...c,partners:{...c.partners,[pid]:{...p,level:m.level}}},before={...c,partners:{...c.partners,[pid]:{...p,level:m.level-1}}};const delta=partnerContribution(at,pid,exercise,exercise?._stat)-partnerContribution(before,pid,exercise,exercise?._stat);return {...m,levelUpContributionDelta:delta,effectDescription:`Partner contribution increases by ${(delta*100).toFixed(2)} percentage points at this level for the selected exercise/stat, including the ordinary level increment.`};});
  const track=partners.get(pid).boonTrack;
  return {xp:num(p?.xp),xpInto:Math.max(0,earned-floor),xpNeeded:ceiling-floor,nextXP:Math.max(0,ceiling-earned),progress:clamp((earned-floor)/(ceiling-floor),0,1),contribution,nextContribution:next,nextLevelDelta:next-contribution,appliedNextLevelDelta:active?Math.min(10,team+next-contribution)-Math.min(10,team):0,active,mainMentor:c.mainMentor===pid,mentorBonus:.04,mentorXPBonus:.10,milestones,nextMilestone:milestones.find(m=>!m.earned)||null,boonTrack:track,boons:(RESTORED.boonTracks?.[track]||[]).map((b,i)=>({...b,legacyLevel:b.level,level:[3,6,11,20,32,48,70][i]||70,earned:level>=([3,6,11,20,32,48,70][i]||70)})),partnerForms:getPartnerForms(c,pid)};
}
export function setMainMentor(c,pid=null) {
  ensureDevelopment(c); if (pid && (!c.partners[pid] || !c.activePartners.includes(pid))) fail('Choose an owned partner on the active team as your main mentor.');
  c.mainMentor=pid; return pid ? getPartnerDevelopment(c,pid) : null;
}
export function getSlotDevelopment(c) {
  const build=(kind,current,paid,max,cost,gate)=>({kind,current,paid,max,next:Math.min(max,current+1),cost,requiredSagas:gate,ready:c.completedSagas.length>=gate,canBuy:current<max&&c.completedSagas.length>=gate&&(kind==='partner'?c.tp>=cost&&!num(c.currencyDebt?.tp):c.ap>=cost&&!num(c.currencyDebt?.ap)),reason:current>=max?'All seven slots are available.':c.completedSagas.length<gate?`Clear ${gate} sagas to develop the next slot.`:`Develop the next slot for ${cost} ${kind==='partner'?'TP':'AP'}.`});
  const ps=getPartnerSlots(c),as=getAbilitySlots(c);
  return {partners:build('partner',ps,num(c.partnerSlots,2),7,Math.round(35*(ps-1)**1.6),Math.max(0,(ps-2)*4)),abilities:build('ability',as,num(c.abilitySlots,c.developmentVersion?2:4),7,Math.round(3*(as-1)**1.5),Math.max(0,(as-2)*4)),echoes:{current:2,max:2,minimumMastery:5,description:'Two mastered forms can contribute bounded training effects. Echoes never multiply Story PL.'}};
}
export function buyPartnerSlot(c) {ensureDevelopment(c);const s=getSlotDevelopment(c).partners;if(!s.canBuy)fail(s.reason);spend(c,'partner-slot',String(s.next),s.cost);c.partnerSlots=s.next;rebuildCharacter(c);return getSlotDevelopment(c).partners;}
export function buyAbilitySlot(c) {ensureDevelopment(c);const s=getSlotDevelopment(c).abilities;if(!s.canBuy)fail(s.reason);spend(c,'ability-slot',String(s.next),0,s.cost);c.abilitySlots=s.next;rebuildCharacter(c);return getSlotDevelopment(c).abilities;}
export function getAbilityDevelopment(c,aid,exercise) {
  const a=abilities.get(aid); if(!a)fail('That ability was not found.');
  const p=practiceState(c,aid),contribution=abilityContribution(c,aid,exercise,exercise?._stat);
  const next=contribution*(1+p.level*.008)/p.multiplier;
  return {...p,practiceLevel:p.level,practiceXP:p.xp,contribution,nextContribution:p.level<100?next:contribution,nextLevelDelta:p.level<100?next-contribution:0,affinity:abilityResonance(c,a,exercise,exercise?._stat),effects:a.levelBalance?.baseEffects||{},practiceDescription:'Prepared techniques earn 0.8 practice XP per effort minute. AP unlocks techniques, slots and listed breakthroughs; practice develops them to level 100.'};
}
export function getFormDevelopment(c,fid) {
  const f=c.forms?.[fid],level=num(f?.level,1),base=num(c.baseline?.formLevels?.[fid],1+Math.floor(Math.sqrt(num(c.baseline?.formXP?.[fid])/50)));
  const earned=Math.max(0,num(f?.xp)-num(c.baseline?.formXP?.[fid])),floor=(level-base)**2*50,ceiling=(level+1-base)**2*50;
  return {xp:num(f?.xp),xpInto:Math.max(0,earned-floor),xpNeeded:ceiling-floor,nextXP:Math.max(0,ceiling-earned),progress:clamp((earned-floor)/(ceiling-floor),0,1),stage:[...MASTERY_STAGES].reverse().find(s=>level>=s.level)?.name||'Awakened',stages:MASTERY_STAGES,nextStage:MASTERY_STAGES.find(s=>level<s.level)||null,echo:(c.echoForms||[]).includes(fid),canEcho:!!f&&level>=5&&fid!==c.activeForm&&fid!=='base',effects:formEffects(c,fid),echoBonus:Math.min(.025,Math.max(0,level-1)*.001)+Math.min(.035,formTrainingSpecialty(c,fid,null,null)*.15),echoDescription:'Training multiplier only. Carries 15% of this form’s authored stat/category specialty plus up to 2.5 percentage points from mastery; never multiplies Story PL.'};
}
export function toggleEcho(c,fid) {ensureDevelopment(c);if(c.echoForms.includes(fid)){c.echoForms=c.echoForms.filter(x=>x!==fid);return c.echoForms;}const f=getFormDevelopment(c,fid);if(!f.canEcho)fail('Master an owned, resting form to level 5 before preparing its training echo.');if(c.echoForms.length>=2)fail('Prepare at most two training echoes.');c.echoForms.push(fid);return c.echoForms;}
export function getDivineDiscipline(c) {
  const supported=!['majin','frieza_race'].includes(c.race),multiplier=getEarnedRelease(c).multiplier;
  return {selected:c.divineDiscipline||'native',supported,visible:supported&&multiplier>=800,locked:multiplier>=1000&&!c.disciplineChoiceCredit,oneTimeRestorationChoice:!!c.disciplineChoiceCredit,options:[{id:'native',name:'Race-native mastery',description:'Continue your own race finale; no shared divine path is required.'},{id:'instinct',name:'Instinct discipline',description:'+4.5 percentage points to the mastery training factor for AGI/TEC; grants compatible shared Instinct forms.'},{id:'destruction',name:'Destruction discipline',description:'+4.5 percentage points to the mastery training factor for STR/SPI; grants compatible shared Destruction forms.'}],reason:!supported?'This race follows its native finale.':multiplier<800?'Reach the 800× earned release to choose a discipline.':c.disciplineChoiceCredit?'The earlier v7 UI omitted this choice. Choose your discipline once during restoration.':multiplier>=1000?'Your discipline was committed at the 1,000× release.':'Choose before earning the 1,000× release.'};
}
export function setDivineDiscipline(c,choice) {ensureDevelopment(c);const s=getDivineDiscipline(c);if(!s.options.some(o=>o.id===choice))fail('Choose Native, Instinct or Destruction.');if(!s.visible||s.locked)fail(s.reason);c.divineDiscipline=choice;if(getEarnedRelease(c).multiplier>=1000)c.disciplineChoiceCredit=false;return getDivineDiscipline(c);}
export function getCoreTraits(c) {return (c.cores||[]).map(pid=>({...c.coreTraits?.[pid],sourcePartnerId:pid,name:partners.get(pid)?.name,sourceLevel:c.coreTraits?.[pid]?.sourceLevel||c.partners[pid]?.level,stat:c.coreTraits?.[pid]?.stat||'TEC',value:num(c.coreTraits?.[pid]?.value,.045),provenance:c.coreTraits?.[pid]?.provenance||'Retained legacy core; source partner and level are preserved.'}));}
export function getLearningBoosts(c) {
  const contribution = key => sum(c.activePartners.slice(0, getPartnerSlots(c)).map(pid => c.partners[pid] ? num(partners.get(pid)?.effects?.[key]) * (1 + num(c.partners[pid].level) * .01) : 0))
    + sum(Object.entries(c.equipment).map(([eid, level]) => num(equipment.get(eid)?.effectsPerLevel?.[key]) * level * 4));
  const abilityChannel=key=>sum(c.activeAbilities.slice(0,getAbilitySlots(c)).map(aid=>num(abilities.get(aid)?.levelBalance?.baseEffects?.[key])*practiceState(c,aid).multiplier));
  const milestoneChannel=key=>sum(c.activePartners.slice(0,getPartnerSlots(c)).flatMap(pid=>partnerMilestones(c,pid).filter(m=>m.earned).map(m=>num(m.effects?.[key])*.5)));
  const boonChannel=key=>sum(c.activePartners.slice(0,getPartnerSlots(c)).flatMap(pid=>(RESTORED.boonTracks?.[partners.get(pid)?.boonTrack]||[]).filter((b,i)=>num(c.partners[pid]?.level)>=[3,6,11,20,32,48,70][i]).map(b=>num(b.effects?.[key]))));
  const formChannel=key=>num(formEffects(c,c.activeForm)[key])*.5+sum((c.echoForms||[]).slice(0,2).map(fid=>num(formEffects(c,fid)[key])*.15));
  const formBond=()=>num(formEffects(c,c.activeForm).characterXP?.global)*.5+sum((c.echoForms||[]).slice(0,2).map(fid=>num(formEffects(c,fid).characterXP?.global)*.15));
  const mentor=0; // Main-mentor XP is applied only to that partner in the receipt map.
  return { xp: 1 + Math.min(1.5, contribution('txp')+abilityChannel('txpGain')+milestoneChannel('txp')+boonChannel('txp')+formChannel('txpGain')), tp: 1 + Math.min(1.5, contribution('tp')+abilityChannel('tpGain')+milestoneChannel('tp')+boonChannel('tp')+formChannel('tpGain')),
    ap:1+Math.min(.5,abilityChannel('apGain')+milestoneChannel('sp')+boonChannel('sp')+formChannel('apGain')), bond: 1 + Math.min(1.5, contribution('characterXP') + c.wishes.filter(w => w.type === 'partners'&&!w.setId).length * .05+milestoneChannel('characterXP')+boonChannel('characterXP')+formBond()+mentor) };
}
export function getEarnedRelease(c) {
  const highest=[...routeOf(c).tiers].reverse().find(t=>c.earnedBands.includes(t.bandId)) || routeOf(c).tiers[0];
  const raceName={earthling:'Earthling',saiyan:'Saiyan',hybrid:'Hybrid Saiyan',namekian:'Namekian',android_infinite:'Infinite Android',android_bio:'Bio-Android',majin:'Majin',frieza_race:'Frieza Race'}[c.routeId]||routeOf(c).label;
  return {...highest,name:highest.bandId==='base'?'Base':`${raceName} native release`,milestoneLabel:highest.name,equipped:c.activeRelease===true};
}
export function getFormCombat(c, formId=c.activeForm) {
  const definition=getFormDefinition(c,formId);
  if(!definition)return null;
  const costs=formCombatCosts(formId),powerMultiplier=definition.multiplier;
  // A dimensionless sustained-output estimate: equal weight to movement, stamina,
  // and health reserve. Raw burst PL continues to use the exact named multiplier.
  const sustainFactor=Math.cbrt(costs.speed*costs.stamina*costs.health);
  const statFactors={STR:1,END:costs.stamina,AGI:costs.speed,VIT:costs.health,SPI:1,TEC:1,GKI:1};
  return {formId,powerMultiplier,...costs,sustainFactor,sustainedMultiplier:powerMultiplier*sustainFactor,
    temporaryStats:Object.fromEntries(STATS.map(stat=>[stat,num(c.stats?.[stat])*statFactors[stat]])),
    hasCosts:Object.values(costs).some(factor=>factor<1),composition:definition.powerComposition||null,
    note:'Temporary combat capacity while this form is equipped. Endurance sets stamina; Vitality sets health reserve. Permanent stats, workout rewards and real recovery are unchanged.'};
}
export function getPower(c, {historical=false}={}) {
  const start = CATALOG.startingStats[c.race] || CATALOG.startingStats.earthling;
  const base = 5 + sum(STATS.map(stat => Math.max(0, num(c.stats[stat]) - num(start[stat])) * weights[stat]));
  const highest = getEarnedRelease(c),state=getFormDefinition(c,c.activeForm);
  // Receipts without a version predate per-form power. Their timeline keeps the
  // original route-band calculation rather than rewriting historical power.
  if(historical && num(c.powerRulesVersion)<FORM_POWER_RULES_VERSION){
    const tier=state&&routeOf(c).tiers.find(t=>t.bandId===state.bandId);
    const multiplier=Math.max(highest.multiplier||1,c.activeForm!=='base'&&c.forms[c.activeForm]?tier?.multiplier||1:1);
    return {base,effective:base*multiplier,multiplier,formName:c.activeForm!=='base'&&state?state.name:highest.milestoneLabel,bandId:highest.bandId};
  }
  const useRelease=c.activeRelease===true,validForm=state&&c.forms[c.activeForm];
  const multiplier=useRelease?highest.multiplier:validForm?state.multiplier:1;
  const combat=useRelease?null:getFormCombat(c,validForm?c.activeForm:'base');
  return {base,effective:base*multiplier,multiplier,formName:useRelease?highest.name:validForm?state.name:'Base',bandId:highest.bandId,
    activeRelease:useRelease,releaseMultiplier:highest.multiplier,releaseName:highest.name,
    sustained:base*multiplier*(combat?.sustainFactor||1),sustainedMultiplier:multiplier*(combat?.sustainFactor||1),combat};
}
export function getPowerPotential(c) {
  // Milestones measure available earned power, not a temporarily selected form.
  // Recalculate from the corrected base stats so deleting activity still works.
  const multipliers=Object.keys(c.forms||{}).map(fid=>getFormDefinition(c,fid)).filter(f=>f&&c.earnedBands.includes(f.bandId)&&availableSaga(c,f.originalSagaId)).map(f=>f.multiplier);
  return getPowerBase(c)*Math.max(getEarnedRelease(c).multiplier,...multipliers);
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
  ensureDevelopment(c);
  const trainingPartners = [...new Set([...c.activePartners, ...c.cores])];
  const source = clone({ _rewardRules: RULES.version, powerRulesVersion:FORM_POWER_RULES_VERSION, activeRelease:c.activeRelease===true, developmentVersion:c.developmentVersion, partnerSlots:c.partnerSlots, abilitySlots:c.abilitySlots, abilityPractice:Object.fromEntries(c.activeAbilities.slice(0,getAbilitySlots(c)).map(aid=>[aid,c.abilityPractice[aid]||{xp:0,level:1}])), mainMentor:c.mainMentor, echoForms:c.echoForms, divineDiscipline:c.divineDiscipline, coreTraits:Object.fromEntries(c.cores.filter(pid=>c.coreTraits?.[pid]).map(pid=>[pid,{stat:c.coreTraits[pid].stat,value:c.coreTraits[pid].value}])), focusSagaId:c.focusSagaId, routeId: c.routeId, race: c.race, branch: c.branch, raceResource: c.raceResource, xp: c.xp,
    partners: Object.fromEntries(trainingPartners.map(pid => [pid, { level: c.partners[pid]?.level || 1,activeForm:c.partners[pid]?.activeForm }])), activePartners: c.activePartners, equipment: c.equipment,
    abilities: Object.fromEntries(c.activeAbilities.map(aid => [aid, c.abilities[aid]])),
    activeAbilities: c.activeAbilities, activeForm: c.activeForm, forms: Object.fromEntries([...new Set([c.activeForm,...(c.echoForms || [])])].map(fid=>[fid,{ level:c.forms[fid]?.level || 1 }])), earnedBands: c.earnedBands,
    masteredSagas: c.masteredSagas, completedSagas: c.completedSagas, cores: c.cores,
    wishes: c.wishes.map(w => ({ type: w.type,setId:w.setId })), _historyProfile: { weeks: history.weeks, groups: [...history.groups] }, _masteryProfile: masteryProfile(c) });
  const focusId = c.focusSagaId && c.completedSagas.includes(c.focusSagaId) ? c.focusSagaId : currentSaga(c).id;
  const learning = getLearningBoosts(c);
  return { version: RULES.version, sagaId: focusId, partners: [...c.activePartners].slice(0, getPartnerSlots(c)), formId: c.activeForm,
    abilities:[...c.activeAbilities].slice(0,getAbilitySlots(c)), source, summary: { ...getBoosts(source), details: [] }, godKi: c.earnedBands.includes('divine'), tpMultiplier: learning.tp,
    xpMultiplier: learning.xp, partnerMultiplier: learning.bond,apMultiplier:learning.ap,partnerPracticeMultipliers:partnerPracticeMultipliers(c),
  };
}
function partnerPracticeMultipliers(c){
  return Object.fromEntries(c.activePartners.slice(0,getPartnerSlots(c)).map(pid=>{
    let bonus=c.mainMentor===pid?.10:0;
    const projected=(effect,scale=1)=>{let value=num(effect?.global)+num(effect?.byPartner?.[pid]);for(const tag of partners.get(pid)?.tags||[])value+=num(effect?.byTag?.[tag]);return value*scale;};
    for(const aid of c.activeAbilities.slice(0,getAbilitySlots(c))) {bonus+=projected(abilities.get(aid)?.levelBalance?.baseEffects?.partnerXP,practiceState(c,aid).multiplier);for(const synergy of abilities.get(aid)?.synergies||[]){
      const match=(synergy.withPartner===pid)||(synergy.withPartnerTag&&partners.get(pid)?.tags?.includes(synergy.withPartnerTag));
      if(match){bonus+=num(synergy.bonus?.partnerXP?.byPartner?.[pid]);for(const tag of partners.get(pid)?.tags||[])bonus+=num(synergy.bonus?.partnerXP?.byTag?.[tag]);}
    }}
    bonus+=projected(formEffects(c,c.activeForm).partnerXP,.5);
    for(const fid of (c.echoForms||[]).slice(0,2))bonus+=projected(formEffects(c,fid).partnerXP,.15);
    const form=getPartnerForms(c,pid).find(f=>f.selected&&f.unlocked);bonus+=num(form?.effects?.partnerXP?.byPartner?.[pid]);
    return [pid,1+Math.min(.5,bonus)];
  }));
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
      gains[stat] = measured.raw * num(distribution[stat]) / totalWeight * getBoosts({ ...snap.source, _rewardRules:num(snap.version,1) }, { ...exercise, _stat: stat }).total;
      stats[stat] += gains[stat];
    }
    minutes += measured.minutes; raw += measured.raw;
    entries.push({ exerciseId: exercise.id, minutes: measured.minutes, raw: measured.raw, stats: gains });
  }
  return { version: num(snap.version,1), stats, abilityXP:num(snap.version,1)>=2 ? minutes*.8 : 0, activeAbilities:num(snap.version,1)>=2 ? (snap.abilities || []) : [], xp: minutes * 4 * num(snap.xpMultiplier, 1), tp: minutes * .35 * snap.tpMultiplier, ap: minutes / 90 * num(snap.apMultiplier,1),
    minutes, raw, partnerXP: minutes * 1.4 * snap.partnerMultiplier,partnerXPById:num(snap.version,1)>=2?Object.fromEntries((snap.partners||[]).map(pid=>[pid,minutes*1.4*snap.partnerMultiplier*num(snap.partnerPracticeMultipliers?.[pid],1)])):undefined, formXP: minutes * (num(snap.version,1)>=2?RULES.formXPPerMinute:.5), sagaId: snap.sagaId, activePartners: snap.partners,
    activeForm: snap.formId, raceResource: minutes / 120, snapshot: snap, entries };
}

export function logWorkout(c, input, now = new Date()) {
  ensureDevelopment(c);
  const developmentBefore=developmentReceipt(c);
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
  c._objectiveChangedDates=[workout.date];
  try{rebuildCharacter(c);}finally{delete c._objectiveChangedDates;}
  saved.receipt.development={ before:developmentBefore, after:developmentReceipt(c) };
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
  const developmentBefore=developmentReceipt(c);
  if (edited.kind === 'rest' && c.workouts.some(w => w.id !== workoutId && !w.legacy && w.kind === 'rest' && w.date === edited.date)) fail('A rest check-in is already recorded for this date.');
  const contentChanged = JSON.stringify(edited.entries) !== JSON.stringify(previous.entries) || edited.kind !== previous.kind;
  const receipt = contentChanged ? buildReceipt(edited, previous.receipt.snapshot) : previous.receipt;
  const saved = { ...previous, ...edited, receipt, updatedAt: new Date(now).toISOString() };
  c.workouts[index] = saved;
  c.workouts.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  c._objectiveChangedDates=[previous.date,saved.date];
  try{rebuildCharacter(c);}finally{delete c._objectiveChangedDates;}
  if(contentChanged)saved.receipt.development={before:developmentBefore,after:developmentReceipt(c),correction:true,description:'Character totals immediately before and after this saved correction.'};
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
  c._objectiveChangedDates=[removed.date];
  try{rebuildCharacter(c);}finally{delete c._objectiveChangedDates;}
  return c;
}

// Rebuild from immutable receipts, never from today's loadout. Currency debt is visible
// after deleting previously spent rewards; it is repaid before any further purchases.
export function rebuildCharacter(c) {
  ensureDevelopment(c,{existing:!c.developmentVersion});
  const b = c.baseline || {};
  c.stats = { ...zeroStats(), ...(b.stats || CATALOG.startingStats[c.race]) };
  let xp = num(b.xp), tp = num(b.tp), ap = num(b.ap), resource = num(b.raceResource), story = num(b.storyXP);
  const pXP = { ...(b.partnerXP || {}) }, fXP = { ...(b.formXP || {}) }, aXP = { ...(b.abilityXP || {}) };
  const weekly = {}, focus = { ...(b.sagaFocus || {}) }, dates = new Set();
  let totalMinutes = 0;
  for (const workout of c.workouts) {
    if (workout.legacy || !workout.receipt) continue;
    const receipt = workout.receipt;
    for (const stat of STATS) c.stats[stat] += num(receipt.stats?.[stat]);
    xp += num(receipt.xp); tp += num(receipt.tp); ap += num(receipt.ap); resource += num(receipt.raceResource);
    for (const pid of receipt.activePartners || []) pXP[pid] = num(pXP[pid]) + num(receipt.partnerXPById?.[pid],num(receipt.partnerXP));
    for (const aid of receipt.activeAbilities || []) aXP[aid]=num(aXP[aid])+num(receipt.abilityXP);
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
    if (event.entitlement && event.active === false) continue;
    for (const stat of STATS) c.stats[stat]+=num(event.reward?.stats?.[stat]);
    xp += num(event.reward?.xp); tp += num(event.reward?.tp); ap += num(event.reward?.ap); story += num(event.reward?.storyXP);
    for(const pid of event.activePartners || []) pXP[pid]=num(pXP[pid])+num(event.reward?.partnerXP);
    for(const aid of event.activeAbilities || []) aXP[aid]=num(aXP[aid])+num(event.reward?.abilityXP);
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
  for (const aid of Object.keys(c.abilities)) { c.abilityPractice[aid] ||= {xp:0,level:1,baselineLevel:1,baselineXP:0}; c.abilityPractice[aid].xp=num(aXP[aid])+num(c.abilityPractice[aid].baselineXP); c.abilityPractice[aid].level=practiceState(c,aid).level; }
  c.expeditionPoints = sum(Object.values(weekly).map(w => Math.min(50, w.minutes / 3)));
  c.weeklyProgress = weekly;
  c.achievements = [...new Set([...(c.achievements || []), ...(dates.size >= 1 ? ['first_training'] : []), ...(dates.size >= 10 ? ['ten_training_days'] : []), ...(dates.size >= 100 ? ['hundred_training_days'] : []), ...(totalMinutes >= 1000 ? ['thousand_minutes'] : []), ...(Object.keys(c.partners).length >= 10 ? ['growing_school'] : []), ...(c.completedSagas.length >= 9 ? ['dragon_ball_complete'] : [])])];
  for (const stat of STATS) c.stats[stat] = round(c.stats[stat]);
  if (!c._reconcilingRewards && reconcileDevelopmentRewards(c)) { c._reconcilingRewards=true; try { rebuildCharacter(c); } finally { delete c._reconcilingRewards; } }
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
  c.journal.push({ id: `replay:${sagaId}:${state.replayCount + 1}`, kind: 'replay', sagaId, at:new Date().toISOString(), focusCost: state.replayRequired, reward: { tp: 20 + sagaIndex(sagaId) * 2, ap: 1 } });
  rebuildCharacter(c);
  return getSagaState(c, sagaId);
}
export function clearSaga(c, sagaId) {
  const s = getSagaState(c, sagaId);
  if (!s.canClear) fail(s.status === 'cleared' || s.status === 'mastered' ? 'This saga is already complete.' : s.reason);
  c.completedSagas.push(sagaId);
  const index = sagaIndex(sagaId);
  c.journal.push({ id: `clear:${sagaId}`, kind: 'saga', sagaId, at:new Date().toISOString(), powerAfter:getPower(c), reward: { tp: 12 + index * 3, ap: 2 + Math.floor(index / 6), xp: 100 + index * 20 } });
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
  c.journal.push({ id: `master:${sagaId}`, kind: 'mastery', sagaId, at:new Date().toISOString(), powerAfter:getPower(c), reward: { tp: 20 + sagaIndex(sagaId) * 3, ap: 3 } });
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
  const reason = isOwned ? 'Train together to earn partner XP and milestone rewards.' : !unlocked ? `Reach ${sagas.get(partner.sagaReq)?.name || sagas.get(partner.sagaReq)?.title || partner.sagaReq} to meet this partner.` : c.tp < cost || num(c.currencyDebt?.tp) ? `Requires ${cost} training points.` : 'Ready to join your training school.';
  return { owned: isOwned, active: c.activePartners.includes(partnerId), level: num(c.partners[partnerId]?.level), cost, canBuy: !isOwned && unlocked && c.tp >= cost && !num(c.currencyDebt?.tp), reason, bonus: partner.role || partner.boonTrack || 'Training growth and partner mastery', ...getPartnerDevelopment(c,partnerId) };
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
  if (c.activePartners.includes(partnerId)) {c.activePartners = c.activePartners.filter(pid => pid !== partnerId);if(c.mainMentor===partnerId)c.mainMentor=null;}
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
  const before=getBoosts(c),after=getBoosts({...c,equipment:{...c.equipment,[equipmentId]:level+1}}),beforeLearning=getLearningBoosts(c),afterLearning=getLearningBoosts({...c,equipment:{...c.equipment,[equipmentId]:level+1}});
  const appliedGain=after.total/before.total-1,learningDelta=Object.fromEntries(Object.keys(beforeLearning).map(key=>[key,afterLearning[key]-beforeLearning[key]]));
  const capped=appliedGain<=1e-10&&Object.values(learningDelta).every(value=>value<=1e-10);
  return { level, maxLevel, cost, canBuy: level < maxLevel && unlocked && !required && !requiredLevel && c.tp >= cost && !num(c.currencyDebt?.tp), reason:level<maxLevel&&capped?'Your current build caps this upgrade’s average effects. Review individual stat specialties before buying.':reason,appliedGain,learningDelta,capped };
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
  const rank = num(c.abilities[abilityId]), maxRank = num(ability.purchaseRanks, Math.min(3,num(ability.ranks, 1))), cost = Math.max(1, Math.ceil(num(ability.spCost, 1) * (1 + rank * .6)));
  const unlocked = availableSaga(c, ability.sagaId);
  // Legacy absolute stat thresholds belonged to a different power scale. Saga access and
  // earned AP gate v7 techniques; their specialties still determine where training grows.
  const reason = rank >= maxRank ? 'All AP breakthroughs learned. Train with this ability to develop practice toward level 100.' : !unlocked ? `Reach ${sagas.get(ability.sagaId)?.name || ability.sagaId} to learn this technique.` : c.ap < cost || num(c.currencyDebt?.ap) ? `Requires ${cost} ability points.` : 'Learn a training specialty.';
  return { rank, maxRank, cost, canBuy: rank < maxRank && unlocked && c.ap >= cost && !num(c.currencyDebt?.ap), reason, active: c.activeAbilities.includes(abilityId), specialty: abilitySpecialtyData(ability), ...getAbilityDevelopment(c,abilityId) };
}
export function buyAbility(c, abilityId) {
  const state = getAbilityState(c, abilityId);
  if (!state.canBuy) fail(state.reason);
  spend(c, 'ability', abilityId, 0, state.cost);
  c.abilities[abilityId] = state.rank + 1;
  c.abilityPractice[abilityId] ||= {xp:0,level:1,baselineLevel:1,baselineXP:0};
  if (!c.activeAbilities.includes(abilityId) && c.activeAbilities.length < getAbilitySlots(c)) c.activeAbilities.push(abilityId);
  rebuildCharacter(c);
  return getAbilityState(c, abilityId);
}
export function toggleAbility(c, abilityId) {
  if (!c.abilities[abilityId] || !abilities.has(abilityId)) fail('Learn this technique first.');
  if (c.activeAbilities.includes(abilityId)) c.activeAbilities = c.activeAbilities.filter(aid => aid !== abilityId);
  else {
    if (c.activeAbilities.length >= getAbilitySlots(c)) fail(`Prepare up to ${getAbilitySlots(c)} abilities. Develop another slot in Abilities to expand your build.`);
    c.activeAbilities.push(abilityId);
  }
  return c.activeAbilities;
}

function compatible(c, form) {
  if (c.routeId === 'android_infinite' && ['semi_perfect_cell', 'perfect_form', 'super_perfect_form'].includes(form.id)) return false;
  const discipline=RESTORED.divineDiscipline;
  const family=Object.entries(discipline?.sharedTechniques||{}).find(([,ids])=>ids.includes(form.id))?.[0];
  if(family){const rule=discipline.compatibility[family];return family==='kaioken'?rule.races.includes(c.race):rule.nativeRaces.includes(c.race)||(rule.chosenRaces.includes(c.race)&&c.divineDiscipline===family);}
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
  // Route bands gate access; the selected form determines its actual power.
  return { ...form, bandId: tier.bandId, multiplier: num(form.powerMultiplier || form.mult,1), sagaId: tier.sagaId, originalSagaId: form.reqs?.sagaId };
}
export function getFormState(c, formId) {
  const definition = getFormDefinition(c, formId);
  const unlocked = !!c.forms[formId];
  if (!definition) return { unlocked: false, equipped: false, canUnlock: false, reason: 'This form belongs to another race route.', multiplier: 1, level: 0 };
  const bandReady = c.earnedBands.includes(definition.bandId);
  const sagaReady = availableSaga(c, definition.originalSagaId);
  const ready = bandReady && sagaReady;
  return { unlocked, equipped: c.activeForm === formId && c.activeRelease!==true, canUnlock: !unlocked && ready, reason: unlocked ? 'Train in this form to deepen mastery.' : !sagaReady ? `Reach ${sagas.get(definition.originalSagaId)?.name || definition.originalSagaId} first.` : ready ? 'Your earned release supports this form.' : `Earn ${routeOf(c).tiers.find(t => t.bandId === definition.bandId)?.name || definition.bandId} first.`, multiplier: definition.multiplier, level: num(c.forms[formId]?.level), bandId: definition.bandId, ...getFormDevelopment(c,formId),combat:getFormCombat(c,formId) };
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
  c.echoForms=(c.echoForms || []).filter(fid=>fid!==formId);
  c.activeForm = formId;
  c.activeRelease = false;
  return getPower(c);
}
export function equipRelease(c) {
  if(getEarnedRelease(c).bandId==='base')fail('Earn a race release first.');
  c.activeRelease=true;
  c.activeForm='base';
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
  const signatureForms=tier.formIds.map(fid=>{const form=forms.get(fid);if(!form)return null;const state=getFormState(c,fid);return {id:fid,name:form.name,multiplier:num(form.powerMultiplier||form.mult,1),unlocked:state.unlocked,canUnlock:state.canUnlock,reason:state.reason,sagaId:form.reqs?.sagaId||null};}).filter(Boolean);
  return { ...tier, milestoneLabel:tier.name, signatureForms, earned, canUnlock: !earned && reason === 'Ready to awaken.', reason, requiredBase, requiredResource, coreRequired };
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
  const powerBefore=getPower(c);
  c.earnedBands.push(tier.bandId);
  for (const fid of tier.formIds) if (getFormState(c, fid).canUnlock) c.forms[fid] = { level: 1, xp: 0 };
  const signature = tier.formIds.find(fid => c.forms[fid]);
  if (signature) {c.activeForm = signature;c.activeRelease=false;}
  else {c.activeForm='base';c.activeRelease=true;}
  c.journal.push({ id: `awaken:${tier.bandId}`, kind: 'awakening', bandId: tier.bandId,at:new Date().toISOString(),powerBefore,powerAfter:getPower(c),reward: { ap: 2 + bands.findIndex(b => b.id === tier.bandId) } });
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
    c.coreTraits ||= {};
    const p=partners.get(partnerId); const chosen=Object.entries(p.effects?.stat || {}).sort((a,b)=>b[1]-a[1])[0];
    c.coreTraits[partnerId]={sourcePartnerId:partnerId,sourceLevel:c.partners[partnerId].level,stat:chosen?.[0] || 'TEC',value:Math.min(.12,.045+num(chosen?.[1])*1.8),copiedAt:new Date().toISOString(),provenance:'Copied from an owned, resting partner; trait remains bounded and does not consume their level.'};
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
export function getAllStoryEntries(c) {
  const unlocked=new Map(getStoryEntries(c).map(e=>[e.id,e])),result=[];
  const add=(entry,pack,kind,sagaId,sourceGroup)=>{
    const open=unlocked.get(entry.id);const reqs=[];
    if(kind==='saga'){
      if(!availableSaga(c,sagaId))reqs.push('Reach this saga through the previous story finale.');
      if(entry.phase==='resolution'&&!c.completedSagas.includes(sagaId))reqs.push('Clear this saga.');
      if(entry.phase==='mastery'&&!c.masteredSagas.includes(sagaId))reqs.push('Master this saga.');
      if(!open&&!reqs.length)reqs.push(`Earn ${Math.round(num(entry.focusRatio)*100)}% of this saga’s training focus.`);
    }else{
      for(const p of [...(entry.unlock?.partners||[]),...(entry.unlock?.partner?[entry.unlock.partner]:[])])if(!c.partners[p.id]||num(c.partners[p.id].level)<getStoryBondLevel(p.level))reqs.push(`${partners.get(p.id)?.name||p.id} at partner level ${getStoryBondLevel(p.level)}.`);
      const saga=entry.unlock?.saga;if(saga&&!storyUnlock(c,{saga}))reqs.push(`${saga.status==='mastered'?'Master':saga.status==='cleared'?'Clear':'Reach'} ${sagas.get(saga.id)?.name||saga.id}.`);
    }
    result.push({...open,id:entry.id,title:entry.title,text:open?.text||[entry.canonText||entry.trainingText,entry.characterText,entry.playerReflection].filter(Boolean).join('\n\n'),series:pack.series||'',sagaId,kind,sourceGroup,read:(c.storyRead||[]).includes(entry.id),sourceNote:pack.sourceNote||'',continuity:entry.continuity||pack.continuity||'game_original',locked:!open,reason:open?'Unlocked through your training and story progress.':reqs.join(' ')||'Continue training with the featured characters.',requirements:reqs});
  };
  for(const [sagaId,pack]of Object.entries(CATALOG.story.sagas||{}))for(const entry of pack.entries||[])add(entry,pack,'saga',sagaId,sagaId);
  for(const kind of ['characters','relationships'])for(const [group,pack]of Object.entries(CATALOG.story[kind]||{}))for(const entry of pack.beats||pack.entries||[])add(entry,pack,kind==='characters'?'character':'relationship',entry.unlock?.saga?.id||null,group);
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
  if(c.expeditionConverted)fail('The original expedition has been converted. Choose a wish from the restored Earth, Namek or Super search.');
  if (!['training', 'partners', 'technique'].includes(type)) fail('Choose training, partners, or technique for your wish.');
  const expedition = getExpedition(c);
  if (!expedition.canWish) fail('Find all seven Dragon Balls through training before making a wish.');
  const wish = { id: id('wish'), type, cost: expedition.goal, number: c.wishes.length + 1 };
  c.wishes.push(wish);
  c.journal.push({ id: wish.id, kind: 'wish', reward: type === 'technique' ? { ap: 8 } : type === 'partners' ? { tp: 30 } : { tp: 15 } });
  rebuildCharacter(c);
  return wish;
}

function objectiveMetrics(c,options={}) {
  const m=trainingMetrics(c,options), perDay={}, best={}, movementDays=new Set(),values={walkKm:0,runKm:0,chestSessions:0,legsSessions:0,strengthSessions:0,coreSessions:0,martialSessions:0,prCount:0,exerciseEntries:0};
  for(const w of c.workouts || []) {
    if(w.kind!=='training'||w.date<(options.from||'')||w.date>(options.to||'9999')||(options.onlyNew&&(w.legacy||num(w.receipt?.version)<2)))continue;
    perDay[w.date] ||= new Set();
    for(const e of w.entries||[]){const d=exercises.get(e.exerciseId);if(!d)continue;movementDays.add(`${w.date}:${e.exerciseId}`);if(d.group==='walking')values.walkKm+=num(e.distance);if(d.group==='running')values.runKm+=num(e.distance);
      const muscle=String(d.muscle||d.group||'').toLowerCase();if(/chest/.test(muscle))perDay[w.date].add('chest');if(/leg|squat|lunge/.test(muscle))perDay[w.date].add('legs');if(['weighted','bodyweight'].includes(d.type))perDay[w.date].add('strength');if(d.category==='core'||muscle==='core')perDay[w.date].add('core');if(d.category==='martial')perDay[w.date].add('martial');
      for(const s of e.sets||[]){const estimate=num(s.reps)>0&&num(s.reps)<=12&&num(s.weight)>0?num(s.weight)*(1+num(s.reps)/30):0;if(estimate>num(best[d.id])){if(best[d.id])values.prCount++;best[d.id]=estimate;}}
    }
  }
  for(const tags of Object.values(perDay))for(const key of ['chest','legs','strength','core','martial'])if(tags.has(key))values[`${key}Sessions`]++;
  values.exerciseEntries=movementDays.size;
  return {...m,...values,workoutDays:m.trainingDays,exercises:movementDays.size,cardioKm:m.distanceKm,partnerLevelTotal:sum(Object.values(c.partners||{}).map(p=>Math.max(0,num(p.level)-1))),abilityLevelTotal:sum(Object.keys(c.abilities||{}).map(a=>practiceState(c,a).level-1)),sagaClears:c.completedSagas.length,gpl:num(c.stats?.GKI),consistencyWeeks:m.weeks};
}
function setRequirements(def,cycle=0) {
  const factor=1+Math.min(4,cycle)*.12;
  const flexibleMinutes={earth:[90,210,300,180,180,180,240],namek:[630,900,750,540,450,600,750],super:[2400,3000,3000,1800,2400,1800,1800]};
  return def.balls.map((ball,i)=>({...ball,reqs:ball.reqs.map(req=>({...req,label:req.metric==='exercises'?`${Math.ceil(req.target*factor)} movement-days; each exercise counts once per date`:req.label,target:Math.ceil(req.target*(req.metric==='totalTXP'?.04:req.metric==='gpl'?.2:1)*factor)})),alternative:{metric:'minutes',target:Math.ceil(flexibleMinutes[def.id][i]*factor),label:`Or ${Math.ceil(flexibleMinutes[def.id][i]*factor)} minutes of any completed training`,unit:'min'}}));
}
export function getDragonBallSets(c,providedMetrics=null) {
  const metrics=providedMetrics||objectiveMetrics(c);
  return RESTORED.dragonBallSets.map(def=>{
    const search=c.dragonBallSets?.[def.id] || {},cycle=num(search.cycle),base=search.baseline||{weeks:sum(c.wishes.filter(w=>!w.setId).map(w=>num(w.cost,350)))/50};
    const unlocked=def.id==='earth'||(def.id==='namek'?availableSaga(c,def.unlockRequirement.sagaId):c.earnedBands.includes('divine'));
    const balls=setRequirements(def,cycle).map(ball=>{
      const requirements=ball.reqs.map(req=>({...req,current:Math.max(0,num(metrics[req.metric])-num(base[req.metric]))}));
      const current=Math.max(0,metrics.minutes-num(base.minutes));
      const native=Math.min(...requirements.map(r=>r.target?num(r.current)/r.target:1));
      const alternative={...ball.alternative,current};
      const credited=num(search.creditProgress?.[ball.star]);
      const minimumWeeks=ball.star*(def.id==='super'?3:def.id==='namek'?2:1),weeksCurrent=Math.max(0,num(metrics.weeks)-num(base.weeks));
      const progress=clamp(Math.max(credited,Math.min(weeksCurrent/minimumWeeks,Math.max(native,current/alternative.target))),0,1);
      return {...ball,requirements,alternative,minimumWeeks,weeksCurrent,progress,collected:progress>=1,credited:credited>0};
    });
    const remaining=num(search.remainingWishes),canSummon=unlocked&&balls.every(b=>b.collected);
    return {...def,cycle,balls,collected:balls.filter(b=>b.collected).length,progress:sum(balls.map(b=>b.progress))/7,unlocked,canSummon,remainingWishes:remaining,canWish:unlocked&&(remaining>0||canSummon),history:(c.wishes||[]).filter(w=>w.setId===def.id||(def.id==='earth'&&!w.setId)).map(w=>({...w,provenance:w.legacy?'Original v6 wish; rewards retained in the opening balance.':!w.setId?'Original v7 expedition wish; original reward receipt retained.':'Restored set wish'})),wishes:(RESTORED.wishes[def.id]||[]).map(w=>({...w,used:remaining>0&&(search.currentWishIds||[]).includes(w.id),effectiveReward:wishReward(c,w),effectiveDescription:describeWish(wishReward(c,w))})),conversion:search.conversion||null,description:'Each ball accepts its themed objective or equivalent accumulated exercise minutes, plus distinct weeks of practice. Progress carries across breaks; no streak is required.'};
  });
}
function wishReward(c,wish) {
  const r=wish.reward||{},set=wish.id.split('_')[0];
  const ceiling=set==='super'?1200:set==='namek'?250:100;
  return {tp:num(r.tp),ap:num(r.ap),xp:Math.min(ceiling,num(r.txp)+num(r.nextLevelTXP)*getLevel(c).xpNeeded),storyXP:Math.min(50,num(r.storyXP)),abilityXP:Math.min(set==='super'?900:set==='namek'?180:60,num(r.abilityXP)),partnerXP:Math.min(set==='super'?1800:set==='namek'?360:120,num(r.partnerXP))};
}
function describeWish(r) {return [r.tp?`${r.tp} TP`:'',r.ap?`${r.ap} AP`:'',r.xp?`${Math.round(r.xp)} player XP`:'',r.storyXP?`${r.storyXP} Story XP`:'',r.abilityXP?`${r.abilityXP} XP to each currently prepared technique`:'',r.partnerXP?`${r.partnerXP} XP to each currently active partner`:''].filter(Boolean).join(' · ');}
export function selectDragonBallSet(c,setId) {if(!RESTORED.dragonBallSets.some(d=>d.id===setId))fail('Choose Earth, Namek or Super Dragon Balls.');c.activeDragonBallSet=setId;return getDragonBallSets(c).find(d=>d.id===setId);}
export function makeSetWish(c,setId,wishId) {
  ensureDevelopment(c);const set=getDragonBallSets(c).find(s=>s.id===setId),choice=set?.wishes.find(w=>w.id===wishId);
  if(!choice)fail('Choose a wish offered by this Dragon.');if(!set.canWish)fail('Find all seven balls in this unlocked set before making a wish.');if(choice.used)fail('Choose a different wish during this summon.');
  const search=c.dragonBallSets[setId] ||= {cycle:0,baseline:{},creditProgress:{}};
  if(!num(search.remainingWishes)) {search.remainingWishes=set.wishCount;search.cycle=num(search.cycle)+1;search.baseline=objectiveMetrics(c);search.creditProgress={};search.currentWishIds=[];let banked=num(search.bankedExpeditionPoints);for(let star=1;star<=7&&banked>0;star++){const credit=Math.min(1,banked/50);search.creditProgress[star]=credit;banked-=credit*50;}search.bankedExpeditionPoints=banked;}
  search.remainingWishes--;search.currentWishIds||=[];search.currentWishIds.push(wishId);c.expeditionConverted=true;
  const reward=choice.effectiveReward;
  const wish={id:id('wish'),setId,wishId,type:reward.abilityXP?'technique':reward.partnerXP?'partners':'training',cost:0,number:c.wishes.length+1,cycle:search.cycle,createdAt:new Date().toISOString(),description:describeWish(reward)};
  c.wishes.push(wish);c.journal.push({id:wish.id,kind:'set-wish',setId,wishId,at:wish.createdAt,reward,activePartners:c.activePartners.slice(0,getPartnerSlots(c)),activeAbilities:c.activeAbilities.slice(0,getAbilitySlots(c))});
  rebuildCharacter(c);return wish;
}
function collectionState(c,def,kind) {
  const original=def.ids||def.memberIds||[],ids=kind==='transformation'?original.filter(fid=>forms.has(fid)&&compatible(c,forms.get(fid))):original;
  const inventory=kind==='partner'?c.partners:kind==='ability'?c.abilities:c.forms;
  const found=ids.filter(id=>inventory[id]);
  const eligible=ids.length>0;
  return {...def,kind,memberIds:ids,originalMemberIds:original,compatible:eligible,owned:found.length,total:ids.length,progress:ids.length?found.length/ids.length:0,complete:eligible&&found.length===ids.length,reward:boundedLegacyReward(def,'collection'),description:kind==='transformation'?'Complete the forms compatible with your selected race and discipline.':def.desc};
}
function achievementState(c,def,m,collections,sets) {
  const q=def.condition||{},target=num(q.target,1);let current=0,eligible=true,description=def.desc;
  switch(q.kind){
    case 'workouts':current=m.trainingDays;description=`Train on ${target} distinct days. Splitting logs does not create extra days.`;break;
    case 'sagas':current=c.completedSagas.length;break;
    case 'saga':current=c.completedSagas.includes(q.sagaId)?1:0;break;
    case 'storyPower':current=getPowerPotential(c);description=`Develop ${target.toLocaleString()} available power through your base stats and owned forms or earned native releases. Changing form does not remove this milestone.`;break;
    case 'stat':current=num(c.stats[q.stat]);break;
    case 'allStats':current=Math.min(...STATS.filter(s=>s!=='GKI').map(s=>num(c.stats[s])));description=`Develop all six ordinary stats to ${target}. God Ki has its own unlock.`;break;
    case 'currentStreak':case 'longestStreak':current=new Set([...m.dates,...m.recoveryDates]).size;description=`Record ${target} distinct training or recovery days in total. Breaks never erase this goal.`;break;
    case 'abilities':current=Object.keys(c.abilities).length;break;
    case 'form':eligible=!!forms.get(q.formId)&&compatible(c,forms.get(q.formId));current=c.forms[q.formId]?1:0;break;
    case 'forms':current=Object.keys(c.forms).length;eligible=CATALOG.transformations.filter(f=>compatible(c,f)).length+1>=target;break;
    case 'series':{const ss=CATALOG.sagas.filter(s=>String(s.series).toUpperCase()===String(q.series).toUpperCase());current=ss.length&&ss.every(s=>c.completedSagas.includes(s.id))?1:0;break;}
    case 'partnerCollection':current=collections.find(x=>x.id===q.collectionId)?.complete?1:0;break;
    case 'godKi':current=c.earnedBands.includes('divine')?1:0;break;
    case 'dragonBalls':current=q.setId?(sets.find(s=>s.id===q.setId)?.collected||0):Math.max(0,...sets.map(s=>s.collected));if((c.wishes||[]).some(w=>q.setId?w.setId===q.setId:w.setId))current=7;break;
    case 'wishes':current=c.wishes.length;break;
  }
  return {...def,description,current,target,compatible:eligible,progress:clamp(current/target,0,1),complete:eligible&&current>=target,reward:q.kind==='partnerCollection'?{tp:0,ap:0,xp:0}:boundedLegacyReward(def,'achievement'),rewardNote:q.kind==='partnerCollection'?'The matching collection grants this reward once.':null};
}
export function getRewardLadders(c) {
  const m=objectiveMetrics(c),sets=getDragonBallSets(c,m);
  const partnerCollections=RESTORED.partnerCollections.map(d=>collectionState(c,d,'partner'));
  const abilityCollections=RESTORED.abilityCollections.map(d=>collectionState(c,d,'ability'));
  const transformationCollections=RESTORED.transformationCollections.map(d=>collectionState(c,d,'transformation'));
  const achievements=RESTORED.achievements.map(d=>achievementState(c,d,m,partnerCollections,sets));
  return {achievements,partnerCollections,abilityCollections,transformationCollections,arcs:getTrainingArcs(c),levelRewards:{nextLevel:getLevel(c).level+1,reward:levelReward(getLevel(c).level+1),description:'Each new player level grants TP/AP; fifth, tenth and later milestones add a bounded bonus.'},counts:{achievements:achievements.filter(a=>a.complete).length,totalAchievements:achievements.filter(a=>a.compatible).length,allAchievements:achievements.length}};
}
function levelReward(level){return {tp:2+(level%10===0?8:level%5===0?3:0),ap:level%10===0?3:level%5===0?2:1,xp:0};}
function rewardEntitlement(c,id,kind,complete,reward,extra={}) {
  let event=c.journal.find(e=>e.id===id),changed=false;
  if(!event&&complete){event={id,kind,entitlement:true,active:true,at:new Date().toISOString(),reward,...extra};c.journal.push(event);changed=true;}
  else if(event&&event.entitlement&&event.active!==complete){event.active=complete;changed=true;}
  return changed;
}
function reconcileDevelopmentRewards(c) {
  if(!c.workouts.some(w=>!w.legacy&&num(w.receipt?.version)>=2)){let changed=false;for(const event of c.journal){if(event.entitlement&&event.active!==false){event.active=false;changed=true;}}return changed;}
  let changed=false;const ladders=getRewardLadders(c),baseline=c.rewardMigration||{};
  for(const [kind,list] of [['achievement',ladders.achievements],['partner-collection',ladders.partnerCollections],['ability-collection',ladders.abilityCollections],['form-collection',ladders.transformationCollections]])for(const item of list){if((baseline.achievementIds||[]).includes(item.id)||(baseline.collectionIds||[]).includes(item.id))continue;changed=rewardEntitlement(c,`restored:${kind}:${item.id}`,kind,item.complete,item.reward,{label:item.name})||changed;}
  const level=getLevel(c).level,maximum=Math.max(level,...c.journal.filter(e=>e.kind==='player-level').map(e=>num(e.level)));
  for(let l=Math.max(2,num(baseline.playerLevel,1)+1);l<=maximum;l++)changed=rewardEntitlement(c,`restored:player-level:${l}`,'player-level',level>=l,levelReward(l),{level:l,label:`Player level ${l}`})||changed;
  for(const pid of Object.keys(c.partners))for(const milestone of partnerMilestones(c,pid))changed=rewardEntitlement(c,`restored:partner-milestone:${milestone.id}`,'partner-milestone',milestone.earned,{tp:0,ap:0,xp:0},{partnerId:pid,level:milestone.level,label:milestone.name,effect:milestone.bonus})||changed;
  for(const arc of ladders.arcs)if(!arc.historicalComplete)changed=rewardEntitlement(c,`restored:arc:${arc.id}`,'training-arc',arc.complete,arc.reward,{label:arc.name})||changed;
  for(const e of c.journal.filter(e=>e.kind==='objective'&&e.entitlement&&(c._objectiveChangedDates||[]).some(date=>e.objectiveId?.startsWith('weekly:')?weekKey(date)===weekKey(e.periodDate):date===e.periodDate))){const objective=getTrainingObjectives(c,e.periodDate).all.find(o=>o.id===e.objectiveId);const active=!!objective?.complete;if(e.active!==active){e.active=active;changed=true;}}
  const paidDays=new Set();for(const e of c.journal.filter(e=>e.kind==='objective'&&e.objectiveId?.startsWith('daily:')&&e.active!==false)){const day=e.objectiveId.split(':')[1];if(paidDays.has(day)){e.active=false;changed=true;}else paidDays.add(day);}
  return changed;
}
export function getTrainingArcs(c) {
  return RESTORED.trainingArcs.map((arc,index)=>{
    const historicalComplete=(c.legacyArcProgress?.completed||[]).includes(arc.id),active=c.legacyArcProgress?.active?.id===arc.id;
    const relevant=(c.workouts||[]).filter(w=>w.kind==='training'&&(!w.legacy&&num(w.receipt?.version)>=2||active&&w.date>=c.legacyArcProgress.active.startDate));
    const perWeek=new Map();
    for(const w of relevant){
      const wk=weekKey(w.date);if(!perWeek.has(wk))perWeek.set(wk,{days:new Set(),strength:false,cardio:false,mind:false});
      const week=perWeek.get(wk),ds=(w.entries||[]).map(e=>exercises.get(e.exerciseId));
      const strength=ds.some(e=>['weighted','bodyweight'].includes(e?.type)),cardio=ds.some(e=>e?.category==='cardio'),mind=ds.some(e=>['martial','flexibility','meditation'].includes(e?.category)||e?.id==='meditation');
      week.strength||=strength;week.cardio||=cardio;week.mind||=mind;
      const matches=index===0?strength:index===1?cardio:true;if(matches)week.days.add(w.date);
    }
    const needed=3,weeks=[...perWeek.values()].filter(week=>week.days.size>=needed&&(index!==2||week.strength&&week.cardio&&week.mind)).length;
    const effectiveWeeks=historicalComplete?Math.max(arc.weeks,weeks):weeks;
    const description=historicalComplete?'Completed in v6; its original reward remains in the opening balance.':index===2?'Four accumulated weeks with three training dates, strength and cardio, plus martial, flexibility or meditation work in each qualifying week. Weeks need not be consecutive.':index===3?'Six flexible weeks of three training days. Recovery and breaks are welcome; no daily streak is required.':`${arc.weeks} accumulated weeks with ${needed} ${index===0?'strength':'cardio'} days. Weeks need not be consecutive.`;
    return {...arc,description,active,historicalComplete,originalStartDate:active?c.legacyArcProgress.active.startDate:null,qualifyingWeeks:effectiveWeeks,weeksRequired:arc.weeks,progress:clamp(effectiveWeeks/arc.weeks,0,1),complete:historicalComplete||weeks>=arc.weeks,reward:historicalComplete?{tp:0,ap:0,xp:0}:boundedLegacyReward(arc,'arc'),checklist:[`${Math.min(effectiveWeeks,arc.weeks)} / ${arc.weeks} qualifying weeks`,`${needed} relevant training dates per qualifying week`,...(index===2?['Strength + cardio + martial/flexibility/meditation in each qualifying week']:[])],requirements:{workoutsPerWeek:needed,exerciseTypes:arc.requirements.exerciseTypes,weeklyVariety:index===2?['strength','cardio','martial or flexibility or meditation']:[]}};
  });
}
function missionRequirement(c,req,date) {
  if(req.all){const states=req.all.map(r=>missionRequirement(c,r,date));return {current:states.filter(s=>s.complete).length,target:states.length,complete:states.every(s=>s.complete),parts:states};}
  const sessions=(c.workouts||[]).filter(w=>!w.legacy&&num(w.receipt?.version)>=2&&w.date===date&&w.kind==='training');
  let rows=sessions.flatMap(w=>(w.entries||[]).map((e,entryIndex)=>({...e,definition:exercises.get(e.exerciseId),snapshot:w.receipt.snapshot.source,receipt:w.receipt.entries?.[entryIndex]}))).filter(e=>e.definition);
  if(req.categories)rows=rows.filter(e=>req.categories.includes(e.definition.category));
  if(req.muscles)rows=rows.filter(e=>req.muscles.includes(e.definition.muscle||e.definition.group));
  if(req.nameIncludesAny)rows=rows.filter(e=>req.nameIncludesAny.some(name=>e.definition.name.toLowerCase().includes(name)));
  const unique=new Set(rows.map(e=>e.exerciseId));let values=[];
  switch(req.metric){
    case 'exerciseCount':case 'categoryCount':case 'muscleCount':values=[unique.size];break;
    case 'distinctExercises':values=[unique.size];break;
    case 'distinctMuscles':values=[new Set(rows.map(e=>e.definition.muscle||e.definition.group)).size];break;
    case 'distinctCategories':values=[new Set(rows.map(e=>e.definition.category)).size];break;
    case 'weightedExerciseCount':values=[new Set(rows.filter(e=>e.sets.some(s=>num(s.weight)>num(req.weightGreaterThan))).map(e=>e.exerciseId)).size];break;
    case 'setVolumeKg':values=rows.flatMap(e=>e.sets.map(s=>num(s.reps)*num(s.weight)));break;
    case 'setReps':case 'reps':values=rows.flatMap(e=>e.sets.map(s=>num(s.reps)));break;
    case 'setSeconds':values=rows.flatMap(e=>e.sets.map(s=>num(s.seconds)));break;
    case 'distanceKm':values=rows.map(e=>num(e.distance));break;
    case 'durationMinutes':values=rows.map(e=>num(e.duration));break;
    case 'speedKph':values=rows.filter(e=>num(e.duration)>0).map(e=>num(e.distance)/(num(e.duration)/60));break;
    case 'statExerciseCount':values=[new Set(rows.filter(e=>req.stats.some(stat=>num((req.source==='gains'?e.receipt?.stats:e.definition.stat||e.definition.weights)?.[stat])>0)).map(e=>e.exerciseId)).size];break;
    case 'activePartners':values=rows.map(e=>e.snapshot.activePartners?.length||0);break;
    case 'mainMentor':values=rows.map(e=>e.snapshot.mainMentor?1:0);break;
  }
  const current=req.aggregation==='max'?Math.max(0,...values):sum(values),target=num(req.target,1);
  return {current,target,complete:req.aggregation==='positive'?current>0:current>=target};
}
export function getTrainingObjectives(c,date=localDate()) {
  const day=localDate(date),weekEnd=new Date(`${weekKey(day)}T12:00:00Z`);weekEnd.setUTCDate(weekEnd.getUTCDate()+6);
  const m=objectiveMetrics(c,{from:weekKey(day),to:weekEnd.toISOString().slice(0,10),onlyNew:true});
  const rotation=Math.floor(new Date(`${day}T12:00:00Z`).getTime()/86400000);
  const chosen=[0,17,33].map(offset=>RESTORED.dailyMissions[(rotation+offset)%RESTORED.dailyMissions.length]);
  const daily=chosen.map(def=>{const state=missionRequirement(c,def.condition.requirement,day);return {id:`daily:${day}:${def.id}`,kind:'daily',name:def.desc,description:def.desc,...state,reward:{tp:1,ap:.15,xp:0},periodDate:day,claimed:!!c.journal.find(e=>e.objectiveId===`daily:${day}:${def.id}`&&e.active!==false)};});
  const recovery=!!c.workouts.find(w=>w.date===day&&w.kind==='rest'&&!w.legacy&&num(w.receipt?.version)>=2);
  daily.push({id:`daily:${day}:recovery`,kind:'daily',name:'Recovery check-in',description:'A recorded rest day can fulfil the daily reward. Training is optional.',current:recovery?1:0,target:1,complete:recovery,reward:{tp:1,ap:.15,xp:0},periodDate:day,claimed:!!c.journal.find(e=>e.objectiveId===`daily:${day}:recovery`&&e.active!==false)});
  const weekly=[{key:'minutes',name:'Accumulate 150 training minutes',current:m.minutes,target:150},{key:'consistency',name:'Three training or recovery days',current:new Set([...m.dates,...m.recoveryDates]).size,target:3},{key:'variety',name:'Explore three activity categories',current:m.categories,target:3}].map(o=>({...o,id:`weekly:${weekKey(day)}:${o.key}`,kind:'weekly',description:'Flexible within the week; no consecutive-day requirement.',complete:o.current>=o.target,reward:{tp:3,ap:.5,xp:0},periodDate:day,claimed:!!c.journal.find(e=>e.objectiveId===`weekly:${weekKey(day)}:${o.key}`&&e.active!==false)}));
  const dailyPaid=c.journal.some(e=>e.kind==='objective'&&e.objectiveId?.startsWith(`daily:${day}:`)&&e.active!==false);
  daily.forEach(o=>{o.canClaim=o.complete&&!o.claimed&&!dailyPaid;o.rewardLimit='One daily reward total; choose training or recovery.';});
  weekly.forEach(o=>{o.canClaim=o.complete&&!o.claimed;});
  return {daily,weekly,all:[...daily,...weekly],dailyRewardLimit:1,weeklyRewardLimit:3};
}
export function claimObjective(c,objectiveId,date=localDate()) {const objective=getTrainingObjectives(c,date).all.find(o=>o.id===objectiveId);if(!objective?.canClaim)fail('Complete an available objective; each reward can be claimed once.');const previous=c.journal.find(e=>e.objectiveId===objectiveId||e.id===`restored:objective:${objectiveId}`);if(previous){previous.active=true;previous.reward=objective.reward;previous.lastClaimedAt=new Date().toISOString();}else c.journal.push({id:`restored:objective:${objectiveId}`,kind:'objective',objectiveId,periodDate:localDate(date),entitlement:true,active:true,at:new Date().toISOString(),reward:objective.reward});rebuildCharacter(c);return objective;}

export function restoreCharacterDevelopment(c,{existing=true,legacy=null}={}) {
  if(c.developmentVersion===1&&c.developmentMigrated)return c;
  delete c.developmentVersion;
  c.rewardMigration={playerLevel:getLevel(c).level,achievementIds:[...new Set([...(c.achievements||[]),...(legacy?.achievements||[])])],collectionIds:[...new Set([...(Array.isArray(legacy?.collectionRewards)?legacy.collectionRewards:Object.keys(legacy?.collectionRewards||{})),...(Array.isArray(legacy?.claimedCollections)?legacy.claimedCollections:Object.keys(legacy?.claimedCollections||{}))].filter(v=>typeof v==='string'))]};
  ensureDevelopment(c,{existing,legacy});
  if(!legacy&&existing&&getEarnedRelease(c).multiplier>=1000)c.disciplineChoiceCredit=true;
  if(legacy){
    c.legacyArcProgress={completed:(Array.isArray(legacy.completedArcs)?legacy.completedArcs:[]).filter(id=>RESTORED.trainingArcs.some(a=>a.id===id)),active:legacy.activeArc&&RESTORED.trainingArcs.some(a=>a.id===legacy.activeArc.id)&&/^\d{4}-\d{2}-\d{2}$/.test(legacy.activeArc.startDate||'')?clone(legacy.activeArc):null};
    c.divineDiscipline=['native','instinct','destruction'].includes(legacy.raceProgression?.divineDiscipline)?legacy.raceProgression.divineDiscipline:'native';
    for(const [aid,rank] of Object.entries(c.abilities)){
      const old=legacy.abilityLevels?.[aid]||{};
      const sourceRank=num(legacy.purchasedAbilities?.[aid],rank);
      const level=clamp(num(old.level,sourceRank),1,100),a=abilities.get(aid);
      const oldNeeded=Math.round((60+level*2.4+level**1.5*.30)*num(a?.levelBalance?.xpTax,1));
      const partial=level>=100?0:clamp(num(old.xp)/Math.max(1,oldNeeded),0,.999999)*3*(2*level-1);
      c.abilityPractice[aid]={xp:partial,level,baselineLevel:level,baselineXP:0,legacyXP:num(old.totalXp,old.xp),legacyLevel:level};
      c.baseline.abilityXP ||= {};c.baseline.abilityXP[aid]=partial;
      // Original purchases were overwritten with practice levels. Preserve those as practice,
      // and retain only the authored AP breakthrough count in the new purchase field.
      c.abilities[aid]=Math.min(num(a?.purchaseRanks,1),Math.max(1,rank));
    }
    for(const [pid,p] of Object.entries(c.partners)){const original=legacy.partnerLevels?.[pid];if(original?.activeForm&&getPartnerForms(c,pid).some(f=>f.id===original.activeForm&&f.unlocked))p.activeForm=original.activeForm;}
    for(const [fid,progress] of Object.entries(c.forms)){const old=legacy.transformationMastery?.[fid];if(old===undefined)continue;const xp=num(typeof old==='object'?old.xp:old);const rank=(RESTORED.transformationProgression.masteryRanks||[]).filter(r=>xp>=r.xp).length-1;const restoredLevel=[1,3,5,8,12,18,25,35,50,70][Math.max(0,rank)];c.baseline.formLevels||={};c.baseline.formLevels[fid]=Math.max(num(c.baseline.formLevels[fid],1),restoredLevel);progress.level=c.baseline.formLevels[fid]+Math.floor(Math.sqrt(Math.max(0,progress.xp-num(c.baseline.formXP?.[fid]))/50));progress.legacyMasteryRank=RESTORED.transformationProgression.masteryRanks[rank]?.key||'G';}
    const cores=[...(legacy.raceProgression?.absorptionCores||[]),...(legacy.raceProgression?.adaptationTemplates||[]),...Object.values(legacy.raceAbsorptions?.[c.race==='majin'?'majin':'android']?.absorbed||{})];
    for(const core of cores){const pid=core.sourcePartnerId||core.partnerId;if(!c.cores.includes(pid))continue;const effects=core.effects||core.trait||{};const stat=core.stat||core.statKey||Object.keys(effects.stat||{})[0]||'TEC';c.coreTraits[pid]={sourcePartnerId:pid,sourceLevel:num(core.sourceLevel,c.partners[pid]?.level),stat:STATS.includes(stat)?stat:'TEC',value:clamp(num(core.value??effects.stat?.[stat],.045),0,.12),provenance:'Bounded copied trait restored from the original v6 core archive.',original:clone(core)};}
  }
  if(c.mainMentor&&!c.activePartners.includes(c.mainMentor))c.mainMentor=null;
  const metrics=objectiveMetrics(c),spent=sum(c.wishes.filter(w=>!w.setId).map(w=>num(w.cost,350))),unspent=Math.max(0,num(c.expeditionPoints)-spent);
  for(const set of RESTORED.dragonBallSets){
    if(c.dragonBallSets[set.id]?.conversion)continue;
    const old=legacy?.dragonBalls?.sets?.[set.id];
    const creditProgress={};
    if(old){
      const raceScale=c.race==='frieza_race'?2:c.race==='namekian'?.5:c.race==='earthling'?.75:1;
      const oldMetrics=legacySearchMetrics(legacy);
      for(const ball of set.balls)creditProgress[ball.star]=clamp(Math.min(...ball.reqs.map(req=>Math.max(0,num(oldMetrics[req.metric])-num(old.metricBaseline?.[req.metric]))/Math.max(1,Math.ceil(req.target*raceScale*set.scale**num(old.cycle))))),0,1);
      // Explicit stored stars are retained when a legacy fixture/version supplied them.
      for(const star of old.collected||old.collectedStars||[])if(Number(star)>=1&&Number(star)<=7)creditProgress[star]=1;
    }
    let banked=set.id==='earth'?unspent:0;
    if(set.id==='earth')for(let star=1;star<=7&&banked>0;star++){const added=Math.min(1-num(creditProgress[star]),banked/50);creditProgress[star]=num(creditProgress[star])+added;banked-=added*50;}
    const remainingWishes=old&&num(old.summonWishCount)>0?Math.max(0,set.wishCount-num(old.summonWishCount)):0;
    c.dragonBallSets[set.id]={cycle:num(old?.cycle)+(remainingWishes?1:0),baseline:clone(metrics),creditProgress:remainingWishes?{}:creditProgress,bankedExpeditionPoints:banked,remainingWishes,currentWishIds:clone(old?.currentWishIds||[]),conversion:{at:new Date().toISOString(),source:old?'v6 individual objectives and v7 expedition':'v7 expedition',expeditionPoints:set.id==='earth'?unspent:0,description:'Existing partial objectives and collected stars were converted once. Original v7 expedition points fill remaining gaps; excess points carry into later searches. Past wish rewards remain in the opening balance; this conversion grants no currency or XP.'}};
  }
  for(const [index,wish] of (legacy?.dragonBalls?.wishHistory||[]).entries()){
    const wid=`legacy-wish-${index}`;if(c.wishes.some(w=>w.id===wid))continue;
    c.wishes.push({...clone(wish),id:wid,type:'training',setId:wish.setId||wish.set||'earth',wishId:wish.wishId||wish.id||'legacy',cost:0,legacy:true,rewardsIncludedInBaseline:true});
  }
  const baselineLadders=getRewardLadders(c);c.rewardMigration.achievementIds=[...new Set([...c.rewardMigration.achievementIds,...baselineLadders.achievements.filter(a=>a.complete).map(a=>a.id)])];c.rewardMigration.collectionIds=[...new Set([...c.rewardMigration.collectionIds,...[...baselineLadders.partnerCollections,...baselineLadders.abilityCollections,...baselineLadders.transformationCollections].filter(a=>a.complete).map(a=>a.id)])];
  c.expeditionConverted=true;c.developmentMigrated=true;
  return c;
}
function legacySearchMetrics(legacy){
  const logs=Array.isArray(legacy.workoutLog)?legacy.workoutLog:[],defs=new Map(CATALOG.exercises.map(e=>[e.name.toLowerCase(),e]));
  const godKi=CATALOG.sagas.some(s=>(s.id.startsWith('dbs_')||s.id.startsWith('daima_'))&&((legacy.completedSagas||[]).includes(s.id)||['unlocked','current','cleared','mastered'].includes(legacy.sagaProgress?.[s.id]?.status)));
  const activeForm=forms.get(legacy.activeTransformation);
  const gpl=godKi?Math.max(1,Math.round((1+Math.sqrt(num(legacy.stats?.GKI))*.075+Math.log10(1+num(legacy.stats?.SPI)+num(legacy.stats?.TEC))*.08+(activeForm?.tags?.includes('god')?Math.sqrt(num(activeForm.powerMultiplier,1))*.05:0))*1000)/1000):0;
  const metrics={workoutDays:new Set(logs.map(w=>w.date)).size,exercises:0,totalTXP:num(legacy.totalTXP),sagaClears:(legacy.completedSagas||[]).length,gpl,prCount:Object.keys(legacy.personalRecords||{}).length,partnerLevelTotal:sum(Object.values(legacy.partnerLevels||{}).map(p=>Math.max(0,num(p.level,1)-1))),abilityLevelTotal:sum(Object.values(legacy.purchasedAbilities||{}).map(v=>Math.max(0,num(v)-1))),runKm:0,walkKm:0,swimKm:0,rowKm:0,meditationMinutes:0};
  for(const group of ['chest','back','shoulders','arms','legs','core','cardio','strength','martial','flexibility'])metrics[`${group}Sessions`]=0;
  for(const w of logs){const groups=new Set();for(const e of w.exercises||[]){metrics.exercises++;const name=String(e.name||'').toLowerCase(),d=defs.get(name),distance=num(e.inputs?.distance??e.inputs?.distanceKm??e.distance),duration=num(e.inputs?.duration??e.inputs?.durationMinutes??e.inputs?.minutes??e.duration);if(/walk/.test(name))metrics.walkKm+=distance;else if(/run/.test(name))metrics.runKm+=distance;else if(/swim/.test(name))metrics.swimKm+=distance;else if(/row/.test(name))metrics.rowKm+=distance;if(/meditation|breath/.test(name))metrics.meditationMinutes+=duration;const group=String(d?.muscle||e.muscle||d?.group||e.category||d?.category||'').toLowerCase(),category=String(e.category||d?.category||group).toLowerCase();groups.add(group);groups.add(category);if(['chest','back','shoulders','arms','legs','core'].includes(group))groups.add('strength');}for(const group of groups)if(owned(metrics,`${group}Sessions`))metrics[`${group}Sessions`]++;}
  metrics.cardioKm=metrics.runKm+metrics.walkKm+metrics.swimKm+metrics.rowKm;
  return metrics;
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
