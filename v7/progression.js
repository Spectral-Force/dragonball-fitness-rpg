import * as Content from './catalog.js';
import { RESTORATION } from './restoration-content.js';

// Restoration rules are pure data/receipts. This module never reads browser storage.
export const RESTORED = RESTORATION;
const { CATALOG } = Content;
const n = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const copy = v => JSON.parse(JSON.stringify(v));
export const PARTNER_MILESTONE_LEVELS = Object.freeze([3, 6, 11, 20, 32, 48, 70]);
export const PRACTICE_XP_SCALE = 3;
export const MASTERY_STAGES = Object.freeze([{level:1,name:'Awakened'}, {level:5,name:'Controlled'}, {level:12,name:'Practiced'}, {level:25,name:'Mastered'}, {level:45,name:'Second nature'}, {level:70,name:'Perfected'}]);
export const abilityLevelXP = level => PRACTICE_XP_SCALE * (Math.max(1, Math.min(100, level)) - 1) ** 2;
export function ensureDevelopment(c, { existing = false, legacy = null } = {}) {
  if (c.developmentVersion === 1) return c;
  c.developmentVersion = 1;
  c.abilityPractice ||= {};
  c.abilitySlots = Math.min(7, Math.max(existing ? 4 : 2, n(c.abilitySlots), (c.activeAbilities || []).length));
  c.partnerSlots = Math.min(7, Math.max(2, n(c.partnerSlots), (c.activePartners || []).length));
  c.mainMentor = c.mainMentor || null;
  c.echoForms ||= [];
  c.divineDiscipline ||= 'native';
  c.coreTraits ||= {};
  c.claimedObjectives ||= [];
  c.rewardMigration ||= { playerLevel: Math.floor(Math.sqrt(Math.max(0, n(c.xp)) / 160)) + 1, achievementIds: [...(c.achievements || [])] };
  c.dragonBallSets ||= {};
  c.activeDragonBallSet ||= 'earth';
  for (const aid of Object.keys(c.abilities || {})) {
    const old = legacy?.abilityLevels?.[aid] || legacy?.abilityProgress?.[aid] || {};
    const level = Math.min(100, Math.max(1, n(old.level, 1)));
    c.abilityPractice[aid] ||= { xp: 0, level, baselineLevel: level, baselineXP: 0, legacyXP: n(old.totalXp ?? old.xp) };
  }
  if (legacy) {
    c.abilitySlots = Math.min(7, Math.max(c.abilitySlots, n(legacy.abilitySlots), n(legacy.maxEquippedAbilities), n(legacy.purchasedAbilitySlots) + 2));
    c.partnerSlots = Math.min(7, Math.max(c.partnerSlots, n(legacy.partnerSlots), n(legacy.maxActivePartners), n(legacy.purchasedPartnerSlots) + 2));
    c.mainMentor = legacy.mainPartner || legacy.mainMentor || null;
    if (!c.partners[c.mainMentor]) c.mainMentor = null;
    c.echoForms = [...new Set(legacy.equippedTransformations || legacy.transformationEchoes || [])].filter(fid => c.forms[fid] && fid !== c.activeForm && fid !== 'base').slice(0, 2);
    c.legacyDevelopment = copy({ dragonBalls: legacy.dragonBalls, partnerLevels: legacy.partnerLevels, abilityLevels: legacy.abilityLevels, collections: legacy.collectionRewards, completedArcs:legacy.completedArcs,activeArc:legacy.activeArc, trainingArcs: legacy.trainingArcs, raceAbsorptions: legacy.raceAbsorptions });
  }
  return c;
}
export function practiceState(c, aid) {
  const p = c.abilityPractice?.[aid] || { xp: 0, level: 1 };
  const base = Math.max(1, n(p.baselineLevel, 1));
  const earned = Math.max(0, n(p.xp) - n(p.baselineXP));
  const level = Math.min(100, 1 + Math.floor(Math.sqrt(earned / PRACTICE_XP_SCALE + (base - 1) ** 2)));
  const floor = PRACTICE_XP_SCALE * ((level - 1) ** 2 - (base - 1) ** 2);
  const ceiling = PRACTICE_XP_SCALE * (level ** 2 - (base - 1) ** 2);
  return { level, xp: n(p.xp), xpInto: level >= 100 ? 0 : earned - floor, xpNeeded: level >= 100 ? 0 : ceiling - floor, nextXP: level >= 100 ? 0 : ceiling - earned, progress: level >= 100 ? 1 : (earned - floor) / (ceiling - floor), maximum: 100, multiplier: 1 + (level - 1) * .008 };
}
export function partnerMilestones(c, pid) {
  const authored = RESTORED.partnerMilestones?.[pid] || [];
  return PARTNER_MILESTONE_LEVELS.map((level, index) => ({ ...authored[index], id: authored[index]?.id || `${pid}_milestone_${index + 1}`, name: authored[index]?.name || ['First lesson','Trusted student','School specialist','Mastery lesson','Signature discipline','Living tradition','Legendary teacher'][index], legacyLevel: authored[index]?.level, level, bonus: .015 * (index + 1), earned: n(c.partners?.[pid]?.level) >= level }));
}
export function boonEffect(c, pid, exercise, stat) {
  const partner = CATALOG.partners.find(p => p.id === pid);
  if (!partner || !c.partners?.[pid]) return 0;
  const milestones = partnerMilestones(c, pid).filter(m => m.earned);
  const project=effects=>n(effects.statAll)+(stat?n(effects.stat?.[stat]):Object.values(effects.stat||{}).reduce((a,b)=>a+n(b),0)/6)+n(effects.category?.[exercise?.category])+n(effects.type?.[exercise?.type]);
  const boons=(RESTORED.boonTracks?.[partner.boonTrack]||[]).filter((b,i)=>n(c.partners[pid].level)>=PARTNER_MILESTONE_LEVELS[Math.min(i,6)]);
  return Math.min(.30,milestones.reduce((v,m)=>v+project(m.effects||{})*1.8,0)+boons.reduce((v,b)=>v+project(b.effects||{}),0));
}
export function abilitySpecialtyData(a) {
  const effects = a.levelBalance?.baseEffects || a.effectsByRank?.[0] || a.effects || a.effectsPerRank || {};
  const result = {};
  for (const stat of Content.STATS) if (n((effects.statGain || effects.stat)?.[stat])) result[stat] = Math.min(.16, Math.abs(n((effects.statGain || effects.stat)[stat])) * 4);
  if (!Object.keys(result).length) {
    const authored = a.levelBalance?.statWeights || a.levelBalance?.stats || a.statWeights || {};
    for (const stat of Content.STATS) if (n(authored[stat])) result[stat] = Math.min(.10, n(authored[stat]) * .06);
  }
  // Catalog build provides every technique's authored effects. This neutral floor covers old receipts only.
  return result;
}
export function abilityResonance(c, ability, exercise, stat) {
  const tags = new Set(ability.tags || []);
  const active = new Set(c.activePartners || []);
  let synergy = 0;
  for (const rule of ability.synergies || []) {
    const matched=(rule.withPartner&&active.has(rule.withPartner))||(rule.withPartnerTag&&[...active].some(pid=>CATALOG.partners.find(p=>p.id===pid)?.tags?.includes(rule.withPartnerTag)))||(rule.withTransformationTag&&CATALOG.transformations.find(f=>f.id===c.activeForm)?.tags?.includes(rule.withTransformationTag));
    if(matched){const gain=rule.bonus?.statGain||{};synergy+=stat?n(gain[stat]):Object.values(gain).reduce((a,b)=>a+n(b),0)/6;}
    if ((rule.partnerIds || rule.partners || []).some(pid => active.has(pid))) synergy += .025;
    if (rule.partnerId && active.has(rule.partnerId)) synergy += .025;
    if (rule.tags?.some(tag => [...active].some(pid => CATALOG.partners.find(p => p.id === pid)?.tags?.includes(tag)))) synergy += .02;
  }
  // Shared authored tags are a small teachable school affinity, never a substitute for named specialties.
  if ([...active].some(pid => CATALOG.partners.find(p => p.id === pid)?.tags?.some(tag => tags.has(tag)))) synergy += .015;
  const saga = c.focusSagaId || CATALOG.sagas.find(s => !c.completedSagas.includes(s.id))?.id;
  const matches=(RESTORED.abilityProgression?.sagaResonance?.[saga]||[]).filter(rule=>rule.ids?.includes(ability.id)||rule.tags?.some(tag=>tags.has(tag)));
  const resonance = matches.length?Math.min(.08,(Math.max(...matches.map(r=>n(r.scale,1)))-1)*.035):ability.sagaId===saga?.015:0;
  return { synergy: Math.min(.10, synergy), resonance, total: Math.min(.10, synergy) + resonance };
}
function monday(date) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0,10); }
export function trainingMetrics(c, { from = '', to = '9999', onlyNew = false } = {}) {
  const metrics = { sessions:0, workouts:0, trainingDays:0, minutes:0, activeMinutes:0, recoveryDays:0, categories:0, exercises:0, cardioMinutes:0, strengthSets:0, strengthReps:0, totalReps:0, distanceKm:0, volumeKg:0, meditationMinutes:0, martialMinutes:0, flexibilityMinutes:0, totalTXP:n(c.xp), totalXP:n(c.xp), storyXP:n(c.storyXP), partners:Object.keys(c.partners || {}).length, abilities:Object.keys(c.abilities || {}).length, transformations:Object.keys(c.forms || {}).length, sagas:c.completedSagas.length, wishes:(c.wishes || []).length, maxPartnerLevel:Math.max(1,...Object.values(c.partners || {}).map(p=>n(p.level))), maxAbilityLevel:Math.max(1,...Object.keys(c.abilities || {}).map(a=>practiceState(c,a).level)), maxFormLevel:Math.max(1,...Object.values(c.forms || {}).map(f=>n(f.level))) };
  const dates = new Set(), recovery = new Set(), categories = new Set(), exerciseNames = new Set(), weeks = new Set();
  const perExercise = {}, perCategory = {};
  for (const w of c.workouts || []) {
    if (w.date < from || w.date > to || (onlyNew && (w.legacy || n(w.receipt?.version) < 2))) continue;
    if (w.kind === 'rest') { recovery.add(w.date); continue; }
    let minutes = n(w.receipt?.minutes);
    if (!minutes && w.legacy) minutes = (w.entries || []).reduce((v,e)=>v+n(e.duration)+(e.sets || []).reduce((s,row)=>s+n(row.reps)*.18+n(row.seconds)/60,0),0);
    if (minutes > 0) { dates.add(w.date); weeks.add(monday(w.date)); }
    metrics.sessions++; metrics.workouts++; metrics.minutes += minutes;
    for (const [entryIndex,e] of (w.entries || []).entries()) {
      const def = CATALOG.exercises.find(d=>d.id===e.exerciseId); if (!def) continue;
      categories.add(def.category); exerciseNames.add(def.id);
      const receiptEntry = w.receipt?.entries?.[entryIndex];
      const em = n(receiptEntry?.minutes, n(e.duration));
      const reps = (e.sets || []).reduce((v,s)=>v+n(s.reps),0);
      const seconds = (e.sets || []).reduce((v,s)=>v+n(s.seconds),0);
      const sets = (e.sets || []).filter(s=>n(s.reps)>0 || n(s.seconds)>0).length;
      const volume = (e.sets || []).reduce((v,s)=>v+n(s.reps)*n(s.weight),0);
      metrics.totalReps += reps; metrics.distanceKm += n(e.distance); metrics.volumeKg += volume;
      if (['weighted','bodyweight'].includes(def.type)) { metrics.strengthSets += sets; metrics.strengthReps += reps; }
      if (def.category === 'cardio') metrics.cardioMinutes += em;
      if (def.category === 'martial') metrics.martialMinutes += em;
      if (def.category === 'flexibility') metrics.flexibilityMinutes += em;
      if (def.id === 'meditation') metrics.meditationMinutes += em;
      perExercise[def.id] ||= { reps:0,seconds:0,minutes:0,distance:0,sets:0,volume:0 }; const m=perExercise[def.id];
      m.reps+=reps;m.seconds+=seconds;m.minutes+=em;m.distance+=n(e.distance);m.sets+=sets;m.volume+=volume;
      perCategory[def.category]=(perCategory[def.category]||0)+em;
    }
  }
  metrics.activeMinutes=metrics.minutes; metrics.trainingDays=dates.size; metrics.recoveryDays=recovery.size; metrics.categories=categories.size; metrics.exercises=exerciseNames.size; metrics.weeks=weeks.size;
  return { ...metrics, perExercise, perCategory, dates:[...dates].sort(), recoveryDates:[...recovery].sort(), stats:{...c.stats} };
}
export function scaledReward(reward = {}, fallback = {}) {
  return { tp: Math.max(0, n(reward.tp, n(reward.trainingPoints, n(fallback.tp)))), ap: Math.max(0, n(reward.ap, n(reward.sp, n(reward.rewardSP, n(fallback.ap))))), xp: Math.max(0, n(reward.xp, n(reward.txp, n(reward.rewardTXP, n(fallback.xp))))) };
}
export function boundedLegacyReward(def, kind) {
  const raw = def.reward || { sp:def.rewardSP, txp:def.rewardTXP };
  const r=scaledReward(raw);
  // Side rewards cannot fund the entire campaign: their legacy currencies used another scale.
  return { tp: Math.min(kind==='arc'?35:15, Math.max(2, Math.round((r.tp+r.xp*.025)*.2))), ap: Math.min(kind==='arc'?5:2, Math.max(1, Math.ceil(r.ap*.2))), xp:0 };
}
export function developmentReceipt(c) {
  return {playerLevel:Math.floor(Math.sqrt(Math.max(0,n(c.xp))/160))+1,stats:{...c.stats},partners:Object.fromEntries((c.activePartners || []).map(id=>[id,{level:c.partners[id]?.level,xp:c.partners[id]?.xp}])), abilities:Object.fromEntries((c.activeAbilities || []).slice(0,c.abilitySlots || 4).map(id=>[id,{level:practiceState(c,id).level,xp:practiceState(c,id).xp}])), forms:{[c.activeForm]:{level:c.forms?.[c.activeForm]?.level,xp:c.forms?.[c.activeForm]?.xp}} };
}
