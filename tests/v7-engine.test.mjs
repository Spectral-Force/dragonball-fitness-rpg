import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../v7/engine.js';
import { CATALOG, STATS } from '../v7/catalog.js';

const now = new Date('2026-09-05T12:00:00');
const hero = (routeId = 'saiyan') => E.createCharacter(E.createState(), { name: 'Test hero', routeId }, now);
const training = (extra = {}) => ({ date: '2026-09-04', kind: 'training', name: 'Practice', rpe: 7, rir: 0, entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 40 }, { reps: 10, weight: 40 }] }, { exerciseId: 'outdoor_run', duration: 30, distance: 5, sets: [] }], ...extra });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} differs from ${b}`);

test('records ignore obsolete fields from other exercise types', () => {
  const c = hero();
  E.logWorkout(c, training({ entries: [{ exerciseId:'meditation', duration:10, distance:2, sets:[{reps:10,weight:5,seconds:30}] }, {exerciseId:'plank', sets:[{seconds:60,reps:10,weight:5}]}] }), now);
  assert.deepEqual(E.getRecords(c).map(r => `${r.name}:${r.unit}`), ['Meditation:min','Plank:sec']);
});

test('learning specialties affect earned XP and bonds, are bounded, and survive receipt edits', () => {
  const plain = hero(), invested = hero();
  invested.equipment.weighted_mastery = 5;
  const learning = E.getLearningBoosts(invested);
  const baseLearning = E.getLearningBoosts(plain);
  assert.ok(learning.xp > 1 && learning.bond > 1);
  const baseline = E.logWorkout(plain, training(), now);
  const saved = E.logWorkout(invested, training(), now);
  close(saved.receipt.xp, baseline.receipt.xp * learning.xp / baseLearning.xp);
  close(saved.receipt.partnerXP, baseline.receipt.partnerXP * learning.bond / baseLearning.bond);
  invested.equipment.weighted_mastery = 10000;
  assert.ok(Object.values(E.getLearningBoosts(invested)).every(v => v >= 1 && v <= 2.5));
  const edited = E.editWorkout(invested, saved.id, { entries: [training().entries[0]] }, now);
  close(edited.receipt.xp, edited.receipt.minutes * 4 * learning.xp);
  close(edited.receipt.partnerXP, edited.receipt.minutes * 1.4 * learning.bond);
});

test('character story bond milestones use the v7 scale and still require their saga', () => {
  assert.deepEqual([1, 10, 25, 50, 80].map(E.getStoryBondLevel), [1, 3, 6, 11, 18]);
  const c = hero();
  c.partners.kid_goku = { level: 3, xp: 100 };
  assert.ok(!E.getStoryEntries(c).some(e => e.id === 'kid_goku_character_02'));
  c.completedSagas.push('db_pilaf');
  assert.ok(E.getStoryEntries(c).some(e => e.id === 'kid_goku_character_02'));
  c.partners.kid_goku.level = 2;
  assert.ok(!E.getStoryEntries(c).some(e => e.id === 'kid_goku_character_02'));
});

test('all eight independent races begin at power five with distinct route development', () => {
  const state = E.createState();
  const values = Object.keys(CATALOG.routes).map(routeId => {
    const c = E.createCharacter(state, { routeId, name: routeId }, now);
    assert.equal(E.getPower(c).base, 5);
    assert.equal(c.workouts.length, 0);
    assert.equal(E.getRouteState(c).tiers.length, 14);
    return E.getBoosts(c).race;
  });
  assert.equal(Object.keys(state.characters).length, 8);
  assert.ok(new Set(values).size >= 6);
});

test('all preserved forms have a reachable race and every collection points to a real saga', () => {
  const finishedRoutes = Object.keys(CATALOG.routes).map(routeId => {
    const c = hero(routeId);
    c.completedSagas = CATALOG.sagas.map(s => s.id);
    c.earnedBands = CATALOG.routes[routeId].tiers.map(t => t.bandId);
    return c;
  });
  for (const form of CATALOG.transformations) assert.ok(finishedRoutes.some(c => E.getFormState(c, form.id).canUnlock || E.getFormState(c, form.id).unlocked), form.id);
  for (const partner of CATALOG.partners) assert.ok(CATALOG.sagas.some(s => s.id === partner.sagaReq), partner.id);
  for (const ability of CATALOG.abilities) assert.ok(CATALOG.sagas.some(s => s.id === ability.sagaId), ability.id);
});
test('numeric strings receive the same bounds as numeric inputs and impossible dates fail', () => {
  for (const weight of ['1001', Infinity, -1, 'NaN']) assert.throws(() => E.validateWorkout(training({ entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight }] }] }), now));
  assert.throws(() => E.validateWorkout(training({ date: '2026-02-30' }), now), /real calendar/);
  assert.throws(() => E.validateWorkout(training({ date: '2026-09-06' }), now), /future/);
  assert.equal(E.validateWorkout(training(), now).rir, 0);
  assert.equal(E.validateWorkout(training({ rpe: null }), now).rpe, null);
});
test('linear volume earns real stats, and rest never grants artificial stats or duplicated currency', () => {
  const c = hero();
  const initial = structuredClone(c.stats), tp = c.tp;
  E.logWorkout(c, { date: '2026-09-04', kind: 'rest', entries: [] }, now);
  assert.deepEqual(c.stats, initial); assert.equal(c.tp, tp);
  assert.throws(() => E.logWorkout(c, { date: '2026-09-04', kind: 'rest' }, now), /already/);
  E.logWorkout(c, training(), now);
  assert.ok(c.stats.STR > initial.STR && c.stats.END > initial.END);
  assert.ok(c.xp > 0 && c.tp > tp);
});
test('splitting a session does not generate extra stats, currencies, partner XP, or story', () => {
  const full = hero(), split = hero();
  const input = training();
  E.logWorkout(full, input, now);
  for (const entry of input.entries) E.logWorkout(split, training({ entries: [entry] }), now);
  for (const stat of STATS) close(full.stats[stat], split.stats[stat]);
  for (const key of ['xp', 'tp', 'ap', 'storyXP', 'raceResource']) close(full[key], split[key]);
  close(full.partners.bulma.xp, split.partners.bulma.xp);
  close(full.sagaFocus.db_pilaf, split.sagaFocus.db_pilaf);
});
test('split sets and same-day loadout changes cannot reroll training rewards', () => {
  const full = hero(), split = hero();
  const entry = training().entries[0];
  E.logWorkout(full, training({ entries: [entry] }), now);
  E.logWorkout(split, training({ entries: [{ ...entry, sets: entry.sets.slice(0, 1) }] }), now);
  E.buyEquipment(split, 'weighted_wristbands');
  E.logWorkout(split, training({ entries: [{ ...entry, sets: entry.sets.slice(1) }] }), now);
  for (const stat of STATS) close(full.stats[stat], split.stats[stat]);
});
test('backdating returns and rewards the requested stable workout ID', () => {
  const c = hero();
  const later = E.logWorkout(c, training({ date: '2026-09-05', id: 'later' }), now);
  const earlier = E.logWorkout(c, training({ date: '2026-08-01', id: 'earlier', entries: [{ exerciseId: 'meditation', duration: 15 }] }), now);
  assert.equal(earlier.id, 'earlier'); assert.equal(c.workouts.at(-1).id, later.id);
  assert.ok(earlier.receipt.stats.SPI > earlier.receipt.stats.STR);
  assert.throws(() => E.logWorkout(c, training({ id: 'earlier' }), now), /already/);
});
test('editing notes or RIR preserves the receipt even after equipment purchases', () => {
  const c = hero(), workout = E.logWorkout(c, training(), now);
  const receipt = structuredClone(workout.receipt), stats = structuredClone(c.stats), xp = c.xp;
  E.buyEquipment(c, 'weighted_wristbands');
  E.editWorkout(c, workout.id, { notes: 'Better form today', rir: 0 }, now);
  assert.deepEqual(c.workouts[0].receipt, receipt);
  assert.deepEqual(c.stats, stats); assert.equal(c.xp, xp);
});
test('editing physical work uses original loadout; deleting the only workout restores earned balances', () => {
  const c = hero();
  const workout = E.logWorkout(c, training(), now);
  E.editWorkout(c, workout.id, { entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 40 }] }] }, now);
  assert.ok(c.xp < workout.receipt.xp);
  E.deleteWorkout(c, workout.id);
  assert.deepEqual(c.stats, c.baseline.stats); assert.equal(c.xp, 0); assert.equal(c.tp, 12); assert.equal(c.ap, 2);
  assert.equal(c.storyXP, 0); assert.equal(c.partners.bulma.xp, 0);
});
test('spent rewards removed from the ledger create explicit debt without destroying purchases', () => {
  const c = hero();
  const workout = E.logWorkout(c, training({ entries: [{ exerciseId: 'meditation', duration: 180 }] }), now);
  for (let n = 0; n < 3; n++) E.buyEquipment(c, 'weighted_wristbands');
  E.buyEquipment(c, 'weighted_boots');
  E.deleteWorkout(c, workout.id);
  assert.ok(c.currencyDebt.tp > 0); assert.equal(c.tp, 0); assert.equal(c.equipment.weighted_boots, 1);
  assert.equal(E.getEquipmentState(c, 'weighted_boots').canBuy, false);
});
test('weekly story accounting is capped on aggregate work and responds correctly to date edits', () => {
  const c = hero();
  const first = E.logWorkout(c, training({ date: '2026-09-01', entries: [{ exerciseId: 'meditation', duration: 300 }] }), now);
  E.logWorkout(c, training({ date: '2026-09-02', entries: [{ exerciseId: 'meditation', duration: 300 }] }), now);
  close(c.storyXP, 50);
  E.editWorkout(c, first.id, { date: '2026-08-01' }, now);
  close(c.storyXP, 100);
  E.editWorkout(c, first.id, { date: '2026-09-01' }, now);
  close(c.storyXP, 50);
});
test('starting stats and history are never replaced by calendar target values', () => {
  const c = hero();
  const initial = E.getPower(c).base;
  E.getSagaState(c, CATALOG.sagas.at(-1).id);
  E.getReadiness(c, new Date('2040-01-01T12:00:00'));
  assert.equal(E.getPower(c).base, initial);
  assert.equal(c.storyXP, 0);
});
test('legacy baseline and archived workouts are preserved without re-awarding', () => {
  const c = hero();
  c.baseline = { ...c.baseline, stats: { ...c.stats, STR: 1000 }, xp: 200, tp: 500, ap: 20, storyXP: 900, partnerXP: { bulma: 2400 }, formXP: { base: 500 }, sagaFocus: { db_pilaf: 99 }, raceResource: 42 };
  c.workouts.push({ id: 'legacy', legacy: true, date: '2020-01-01', receipt: { xp: 99999, tp: 99999, stats: { STR: 99999 } } });
  E.rebuildCharacter(c);
  assert.equal(c.stats.STR, 1000); assert.equal(c.xp, 200); assert.equal(c.tp, 500); assert.equal(c.raceResource, 42);
  assert.equal(c.partners.bulma.level, 11); assert.equal(c.sagaFocus.db_pilaf, 99);
});
test('recovery before local noon includes today and illness overrides optimistic history', () => {
  const c = hero();
  for (const date of ['2026-09-03', '2026-09-04', '2026-09-05']) E.logWorkout(c, training({ date }), now);
  const morning = E.getReadiness(c, new Date('2026-09-05T08:00:00'));
  assert.notEqual(morning.score, null);
  c.recovery.illness = true;
  assert.equal(E.getReadiness(c, now).score, null);
  assert.equal(E.getReadiness(c, now).label, 'Illness reported');
  assert.equal(E.getReadiness(hero(), now).score, null);
});
test('partners, equipment, abilities and Namekian choices really change stat-specific growth', () => {
  const c = hero('namekian'), ex = CATALOG.exercises.find(x => x.id === 'bench_press');
  const before = E.getBoosts(c, ex).total;
  E.recruitPartner(c, 'kid_goku'); E.buyEquipment(c, 'weighted_wristbands'); E.buyAbility(c, 'ki_blast');
  assert.ok(E.getBoosts(c, ex).total > before);
  E.setBranch(c, 'warrior'); const warrior = E.getBoosts(c, { ...ex, _stat: 'STR' }).race;
  E.setBranch(c, 'dragon'); const dragon = E.getBoosts(c, { ...ex, _stat: 'STR' }).race;
  assert.ok(warrior > dragon);
});
test('late partner, gear and abilities remain saga locked even with huge unspent currency', () => {
  const c = hero(); c.tp = 1e8; c.ap = 1e8;
  assert.equal(E.getPartnerState(c, 'frieza_black_form').canBuy, false);
  assert.equal(E.getEquipmentState(c, 'chamber_access').canBuy, false);
  const late = CATALOG.abilities.find(a => a.sagaId === 'dbs_universe_survival');
  assert.equal(E.getAbilityState(c, late.id).canBuy, false);
  assert.equal(E.getFormState(c, 'super_saiyan').canUnlock, false);
});
test('named forms use their own power and earned native releases remain separately available', () => {
  for (const routeId of Object.keys(CATALOG.routes)) {
    const c = hero(routeId); c.earnedBands = CATALOG.stateBands.map(b => b.id);
    const before = E.equipRelease(c);
    for (const form of CATALOG.transformations) {
      const fs = E.getFormState(c, form.id);
      if (fs.canUnlock) E.unlockForm(c, form.id);
      if (E.getFormState(c, form.id).unlocked) { E.equipForm(c, form.id); assert.equal(E.getPower(c).multiplier, form.powerMultiplier); }
    }
    assert.equal(before.multiplier, 80000);
    assert.equal(E.equipRelease(c).multiplier,80000);
  }
});
test('Infinite Android cannot inherit biological Cell transformations from an imported inventory', () => {
  const c = hero('android_infinite');
  c.completedSagas = CATALOG.sagas.map(s => s.id); c.earnedBands = CATALOG.stateBands.map(b => b.id);
  c.forms.perfect_form = { level: 999, xp: 9999 };
  assert.equal(E.getFormState(c, 'perfect_form').unlocked, false);
  assert.throws(() => E.equipForm(c, 'perfect_form'), /Unlock/);
  const b = hero('android_bio'); b.completedSagas = [...c.completedSagas]; b.earnedBands = [...c.earnedBands];
  assert.equal(E.getFormState(b, 'perfect_form').canUnlock, true);
});
test('cores are bounded and required for later Majin and Bio-Android development', () => {
  for (const routeId of ['majin', 'android_bio']) {
    const c = hero(routeId);
    c.partners.kid_goku = { level: 1, xp: 0 }; c.partners.launch = { level: 1, xp: 0 }; c.partners.oolong = { level: 1, xp: 0 };
    assert.throws(() => E.equipCore(c, 'bulma'), /Rest this active/);
    E.togglePartner(c, 'bulma');
    for (const pid of ['bulma', 'kid_goku', 'launch']) E.equipCore(c, pid);
    assert.throws(() => E.equipCore(c, 'oolong'), /three/);
    assert.throws(() => E.togglePartner(c, 'bulma'), /Remove this partner/);
    assert.ok(E.getBoosts(c).race > E.getBoosts(hero(routeId)).race);
  }
});
test('migrated partner and form levels never shrink when the first v7 workout arrives', () => {
  const c = hero();
  c.baseline.partnerXP = { bulma: 100 }; c.baseline.partnerLevels = { bulma: 90 };
  c.baseline.formXP = { base: 100 }; c.baseline.formLevels = { base: 35 };
  E.logWorkout(c, training(), now);
  assert.ok(c.partners.bulma.level >= 90); assert.ok(c.forms.base.level >= 35);
});
test('late saga clears require the actual route release even if all numerical requirements are met', () => {
  const c = hero();
  const target = CATALOG.sagas.find(s => s.id === 'dbz_frieza');
  c.completedSagas = CATALOG.sagas.slice(0, CATALOG.sagas.indexOf(target)).map(s => s.id);
  c.stats.STR = 1e7; c.storyXP = 1e7; c.sagaFocus.dbz_frieza = 1e7;
  assert.equal(E.getSagaState(c, target.id).canClear, false);
  assert.match(E.getSagaState(c, target.id).reason, /Awaken/);
  c.earnedBands.push('z_state');
  assert.equal(E.getSagaState(c, target.id).canClear, true);
});
test('date-only strings retain their local calendar day and split sessions cannot establish readiness history', () => {
  assert.equal(E.localDate('2026-09-05'), '2026-09-05');
  assert.throws(() => E.localDate('2026-02-30'), /real calendar/);
  const c = hero();
  for (let n = 0; n < 4; n++) E.logWorkout(c, training(), now);
  assert.equal(E.getReadiness(c, now).score, null);
});
test('no non-base transformation can be awakened on character creation', () => {
  for (const routeId of Object.keys(CATALOG.routes)) {
    const c = hero(routeId);
    for (const form of CATALOG.transformations.filter(f => f.id !== 'base')) assert.equal(E.getFormState(c, form.id).canUnlock, false, `${routeId}:${form.id}`);
  }
});
test('fresh awakenings retain earned mastery and dormant cross-race imported forms confer no boost', () => {
  const c = hero();
  c.forms.base.level = 20;
  c.completedSagas = CATALOG.sagas.slice(0, CATALOG.sagas.findIndex(s => s.id === 'dbz_frieza')).map(s => s.id);
  c.earnedBands.push('first_break', 'surge', 'mastered_surge', 'z_state');
  const baseMastery = E.getBoosts(c).mastery;
  E.unlockForm(c, 'super_saiyan'); E.equipForm(c, 'super_saiyan');
  assert.ok(E.getBoosts(c).mastery >= baseMastery);
  const valid = E.getBoosts(c).mastery;
  c.forms.orange_piccolo = { level: 999, xp: 99999 };
  c.forms.black_frieza = { level: 999, xp: 99999 };
  assert.equal(E.getBoosts(c).mastery, valid);
  c.forms.super_saiyan.level = 10;
  assert.ok(E.getBoosts(c).mastery > valid);
});
test('Dragon Ball expeditions are repeatable at a stable cost and cannot duplicate a wish', () => {
  const c = hero();
  for (let week = 0; week < 14; week++) {
    const date = new Date(2026, 0, 5 + week * 7, 12);
    E.logWorkout(c, training({ date: E.localDate(date), entries: [{ exerciseId: 'meditation', duration: 150 }] }), now);
  }
  assert.equal(E.getExpedition(c).progress, 700);
  E.makeWish(c, 'training'); E.makeWish(c, 'partners');
  assert.equal(E.getExpedition(c).progress, 0);
  assert.throws(() => E.makeWish(c, 'technique'), /seven/);
});
test('opening story is available, late story requires actual saga and relationship progress', () => {
  const c = hero();
  const entries = E.getStoryEntries(c);
  assert.ok(entries.some(s => s.id === 'db_pilaf_story_01'));
  assert.ok(!entries.some(s => s.sagaId === 'dbs_granolah'));
  assert.ok(!entries.some(s => s.id === 'kid_goku_character_01'));
  E.recruitPartner(c, 'kid_goku');
  assert.ok(E.getStoryEntries(c).some(s => s.id === 'kid_goku_character_01'));
  E.markStoryRead(c, 'db_pilaf_story_01');
  assert.equal(E.getStoryEntries(c).find(s => s.id === 'db_pilaf_story_01').read, true);
});
test('records are recomputed from surviving entries and removed when deleted', () => {
  const c = hero(), w = E.logWorkout(c, training(), now);
  assert.ok(E.getRecords(c).some(r => r.name === 'Bench Press' && r.value === 40 && r.unit === 'kg'));
  E.deleteWorkout(c, w.id);
  assert.deepEqual(E.getRecords(c), []);
});
test('saga replays require new focused training, spend it once, and keep the same replay cost', () => {
  const c = hero();
  for (const date of ['2026-01-05', '2026-01-12']) E.logWorkout(c, training({ date, entries: [{ exerciseId: 'meditation', duration: 150 }] }), now);
  assert.ok(E.getSagaState(c, 'db_pilaf').canClear);
  E.clearSaga(c, 'db_pilaf');
  assert.throws(() => E.replaySaga(c, 'db_pilaf'), /more replay focus/);
  assert.throws(() => E.setFocusSaga(c, 'dbs_granolah'), /already cleared/);
  E.setFocusSaga(c, 'db_pilaf');
  const w = E.logWorkout(c, training({ date: '2026-01-19', entries: [{ exerciseId: 'meditation', duration: 150 }] }), now);
  assert.equal(w.receipt.sagaId, 'db_pilaf');
  assert.ok(E.getSagaState(c, 'db_pilaf').canReplay);
  E.replaySaga(c, 'db_pilaf');
  assert.equal(E.getSagaState(c, 'db_pilaf').replayCount, 1);
  assert.equal(E.getSagaState(c, 'db_pilaf').replayRequired, 100);
  assert.throws(() => E.replaySaga(c, 'db_pilaf'), /more replay focus/);
  E.setFocusSaga(c, null);
  const next = E.logWorkout(c, training({ date: '2026-01-26', entries: [{ exerciseId: 'meditation', duration: 150 }] }), now);
  assert.equal(next.receipt.sagaId, 'db_tournament');
});
