import test from 'node:test';
import assert from 'node:assert/strict';
import {createLegacyCorrection,getEffectivePhysicalRecord} from '../v7/history-corrections.js';
import {createState,createCharacter,rebuildCharacter,logWorkout} from '../v7/engine.js';
import {validateState} from '../v7/migration.js';

function fixture(){const state=createState(),c=createCharacter(state,{id:'archive',name:'Archive',routeId:'earthling'},new Date('2026-01-01T12:00:00Z'));c.baseline.stats.STR=100;c.stats.STR=100;c.workouts=[{id:'legacy_archive_1',legacy:true,date:'2025-12-01',name:'Original workout',kind:'training',notes:'Original note',rpe:null,rir:null,entries:[{exerciseId:'bench_press',sets:[{weight:40,reps:10,seconds:0}],duration:0,distance:0}],receipt:{version:'legacy-opening-balance',stats:{STR:0,END:0,AGI:0,VIT:0,SPI:0,TEC:0,GKI:0},xp:0,tp:0,ap:0,storyXP:0,legacyXP:100},legacyRaw:{unrecognisedOriginalField:'retained'}}];return {state,c};}
const correctedEntries=[{exerciseId:'bench_press',sets:[{weight:45,reps:8}],notes:'Verified from notebook',restSeconds:90}];

test('creating a correction is pure and preserves original archive fields and rewards',()=>{
  const {c}=fixture(),before=structuredClone(c),result=createLegacyCorrection(c,'legacy_archive_1',{entries:correctedEntries},'The old import copied the wrong load.');assert.deepEqual(c,before);assert.deepEqual(result.workout.entries,before.workouts[0].entries);assert.deepEqual(result.workout.receipt,before.workouts[0].receipt);assert.deepEqual(result.workout.legacyRaw,before.workouts[0].legacyRaw);assert.equal(result.effective.entries[0].sets[0].weight,45);assert.equal(result.correction.rewardsChanged,false);assert.deepEqual(result.correction.rewardAdjustment,{xp:0,tp:0,ap:0,storyXP:0});assert.ok(Number.isFinite(Date.parse(result.correction.at)));
});
test('effective date and values change for physical analysis while original date and receipt remain',()=>{
  const {c}=fixture(),result=createLegacyCorrection(c,'legacy_archive_1',{date:'2025-11-28',entries:correctedEntries},'Correct date and completed set.');const effective=getEffectivePhysicalRecord(result.workout);assert.equal(effective.date,'2025-11-28');assert.equal(effective.originalDate,'2025-12-01');assert.equal(result.workout.date,'2025-12-01');assert.equal(effective.receipt.legacyXP,100);assert.equal(effective.entries[0].restSeconds,90);assert.equal(effective.physicalCorrection.reason,'Correct date and completed set.');
});
test('correction chains have stable distinct IDs and each before-state is the previous effective record',()=>{
  const {c}=fixture();const first=createLegacyCorrection(c,'legacy_archive_1',{entries:correctedEntries},'Load correction');c.workouts[0]=first.workout;const second=createLegacyCorrection(c,'legacy_archive_1',{date:'2025-11-28'},'Calendar correction');assert.equal(second.correction.sequence,2);assert.notEqual(second.correction.id,first.correction.id);assert.equal(second.correction.before.entries[0].sets[0].weight,45);assert.equal(second.workout.physicalCorrections[0].id,first.correction.id);assert.equal(getEffectivePhysicalRecord(JSON.parse(JSON.stringify(second.workout))).physicalCorrection.id,second.correction.id);
});
test('persisted corrections survive state validation and rebuilding without changing XP, stats or currency',()=>{
  const {state,c}=fixture(),before={stats:structuredClone(c.stats),xp:c.xp,tp:c.tp,ap:c.ap};c.workouts[0]=createLegacyCorrection(c,'legacy_archive_1',{entries:correctedEntries},'Paper log confirmed actual set.').workout;const restored=validateState(JSON.parse(JSON.stringify(state))).characters.archive;rebuildCharacter(restored);assert.deepEqual(restored.stats,before.stats);for(const key of ['xp','tp','ap'])assert.equal(restored[key],before[key]);assert.equal(getEffectivePhysicalRecord(restored.workouts[0]).entries[0].sets[0].weight,45);
});
test('new v7 sessions use their normal reward-reconciling editor',()=>{
  const {c}=fixture(),w=logWorkout(c,{date:'2026-08-01',entries:[{exerciseId:'meditation',duration:10,sets:[]}]},new Date('2026-09-05T12:00:00Z'));assert.throws(()=>createLegacyCorrection(c,w.id,{notes:'Changed'},'Reason'),/normal workout editor/);
});
test('identity, rewards, impossible dates and invalid exercise measurements cannot be patched',()=>{
  const {c}=fixture();for(const patch of [{id:'other'},{receipt:{}},{stats:{STR:999}},{xp:100},{legacy:false}])assert.throws(()=>createLegacyCorrection(c,'legacy_archive_1',patch,'Reason'),/physical-record fields/);assert.throws(()=>createLegacyCorrection(c,'legacy_archive_1',{date:'2025-02-30'},'Reason'),/real calendar/);assert.throws(()=>createLegacyCorrection(c,'legacy_archive_1',{entries:[{exerciseId:'bench_press',sets:[{weight:1001,reps:5}]}]},'Reason'),/1000/);assert.throws(()=>createLegacyCorrection(c,'legacy_archive_1',{entries:correctedEntries},''),/Explain/);
});
test('saving unchanged normalized physical data does not add an empty audit event',()=>{
  const {c}=fixture();assert.throws(()=>createLegacyCorrection(c,'legacy_archive_1',{entries:c.workouts[0].entries},'No real change'),/no physical-record changes/);
});
test('an unknown legacy movement can be explicitly mapped without destroying the original row',()=>{
  const {c}=fixture();c.workouts[0].entries[0].exerciseId='legacy_unmapped_lift';const result=createLegacyCorrection(c,'legacy_archive_1',{entries:correctedEntries},'Map the retired name to Bench Press.');assert.equal(result.workout.entries[0].exerciseId,'legacy_unmapped_lift');assert.equal(result.effective.entries[0].exerciseId,'bench_press');
});
