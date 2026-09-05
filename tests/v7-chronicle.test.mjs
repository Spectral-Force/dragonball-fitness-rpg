import test from 'node:test';
import assert from 'node:assert/strict';
import {createCharacter,createState,getPower,equipRelease} from '../v7/engine.js';
import {STATS} from '../v7/catalog.js';
import {statTimeline,selectTimeline,periodBounds,statChanges,trainingAnalysis,historyExport} from '../v7/chronicle.js';
import {createLegacyCorrection} from '../v7/history-corrections.js';

const today='2026-09-05',stats=value=>Object.fromEntries(STATS.map(stat=>[stat,value]));
const hero=()=>createCharacter(createState(),{id:'chronicle',name:'Chronicle',routeId:'saiyan'},new Date('2026-09-01T12:00:00Z'));
const source=c=>({race:c.race,routeId:c.routeId,activeForm:'base',forms:{base:{level:1}},earnedBands:['base']});
function receipt(c,id,date,gains,extra={}){return {id,date,name:id,kind:'training',createdAt:`${date}T12:00:00Z`,entries:[],receipt:{stats:gains,snapshot:{source:source(c)}},...extra};}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('legacy physical corrections update analytics and date filters while keeping receipts and stat history unchanged',()=>{
  const c=hero();c.workouts=[{id:'legacy-press',date:'2026-08-20',kind:'training',name:'Old press',legacy:true,entries:[{exerciseId:'bench_press',sets:[{reps:10,weight:50}]}],receipt:{minutes:1.8,stats:{STR:123}}}];
  const original=structuredClone(c.workouts[0]),timelineBefore=statTimeline(c,{},today);
  const corrected=createLegacyCorrection(c,original.id,{date:'2026-09-02',entries:[{exerciseId:'bench_press',sets:[{reps:5,weight:60}]}]},'Corrected the transcribed date and working set');
  c.workouts[0]=corrected.workout;
  const current=trainingAnalysis(c,{start:'2026-09-01',end:today}),oldPeriod=trainingAnalysis(c,{start:'2026-08-01',end:'2026-08-31'});
  assert.equal(current.sessions,1);assert.equal(current.totalVolume,300);assert.equal(oldPeriod.sessions,0);
  const pr=current.records.find(r=>r.key==='e1rm');close(pr.value,70);assert.equal(pr.date,'2026-09-02');assert.equal(pr.originalDate,'2026-08-20');assert.equal(pr.physicalCorrection.sequence,1);
  assert.deepEqual(c.workouts[0].receipt,original.receipt);assert.deepEqual(c.workouts[0].entries,original.entries);assert.deepEqual(statTimeline(c,{},today),timelineBefore);
  assert.equal(statChanges(c,'30',today).period.STR,0);
  const exported=historyExport(c,{start:'2026-09-01',end:today});assert.equal(exported.workouts[0].date,'2026-08-20');assert.equal(exported.physicalRecords[0].date,'2026-09-02');assert.equal(exported.workouts[0].physicalCorrections.length,1);
  exported.physicalRecords[0].entries[0].sets[0].weight=999;assert.equal(c.workouts[0].physicalCorrections[0].after.entries[0].sets[0].weight,60);
});

test('v6 snapshots keep recorded power, unknown stat fields, and an explicit migration boundary',()=>{
  const c=hero();c.legacy={originalCharacterId:'oldHero'};c.baseline.stats=stats(100);c.stats={...stats(100),STR:102};
  c.workouts=[receipt(c,'new','2026-09-05',{STR:2}),{...receipt(c,'old','2026-09-01',{STR:900}),legacy:true}];
  const state={migration:{migratedAt:'2026-09-04T11:00:00Z',original:{characters:{oldHero:{history:[{date:'2026-08-01',stats:{STR:90},pl:777},{date:'2026-02-31',stats:stats(2),pl:123},{date:'2026-09-05',stats:stats(999),pl:999}]}}}}};
  const timeline=statTimeline(c,state,today),legacy=timeline.points.filter(row=>row.legacy);
  assert.equal(legacy.length,1);assert.equal(legacy[0].power,777);assert.equal(legacy[0].base,null);assert.equal(legacy[0].stats.TEC,null);
  assert.equal(timeline.migrationDate,'2026-09-04');assert.equal(timeline.hasLegacyHistory,true);
  const boundary=timeline.points.find(row=>row.boundary);assert.equal(boundary.date,'2026-09-04');assert.equal(boundary.stats.STR,100);assert.equal(boundary.power,null);
  assert.equal(timeline.points.find(row=>row.workoutId==='new').stats.STR,102);
  assert.equal(timeline.missingStatHistory,false);
  assert.equal(timeline.events.filter(row=>row.kind==='migration').length,1);
});

test('invalid legacy history is not advertised as usable and null power is not converted to zero',()=>{
  const c=hero(),state={migration:{migratedAt:'2026-09-04T12:00:00Z',original:{characters:{chronicle:{history:[{date:'2026-02-31',stats:{STR:1}},{date:'2026-09-01',stats:{},pl:null}]}}}}};
  assert.equal(statTimeline(c,state,today).hasLegacyHistory,false);
  state.migration.original.characters.chronicle.history=[{date:'2026-08-20',stats:{STR:1},pl:null}];
  assert.equal(statTimeline(c,state,today).points.find(row=>row.legacy).power,null);
});

test('a post-migration entry backdated into v6 does not manufacture pre-migration balances',()=>{
  const c=hero(),state={migration:{migratedAt:'2026-09-04T12:00:00Z',original:{characters:{chronicle:{history:[{date:'2026-08-01',stats:{STR:20},pl:100}]}}}}};
  c.baseline.stats=stats(30);c.stats={...stats(30),STR:32};c.workouts=[receipt(c,'backdated','2026-08-02',{STR:2},{createdAt:'2026-09-05T12:00:00Z'})];
  const timeline=statTimeline(c,state,today),point=timeline.points.find(row=>row.workoutId==='backdated');
  assert.equal(point.date,'2026-09-05');assert.equal(point.workoutDate,'2026-08-02');assert.equal(point.stats.STR,32);assert.match(point.source,/credited after migration/);
  assert.equal(timeline.points.filter(row=>row.date<'2026-09-04'&&!row.legacy).length,0);
  assert.equal(statChanges(c,'7',today,state).period.STR,2);
  assert.equal(statChanges(c,'7','2026-08-05',state).period.STR,0);
});

test('receipts accumulate exact permanent gains without inheriting a current transformation',()=>{
  const c=hero(),opening=structuredClone(c.stats);c.workouts=[receipt(c,'b','2026-09-04',{STR:3}),receipt(c,'a','2026-09-02',{STR:2})];
  c.stats.STR+=5;c.earnedBands.push('z_state');equipRelease(c);
  const history=statTimeline(c,{},today);
  const a=history.points.find(row=>row.workoutId==='a'),b=history.points.find(row=>row.workoutId==='b');
  close(a.stats.STR,opening.STR+2);close(b.stats.STR,opening.STR+5);close(a.power,a.base);close(b.power,b.base);
  close(history.points.at(-1).power,b.base*50);assert.equal(history.points.find(row=>row.baseline).power,5);
  delete c.workouts[0].receipt.snapshot.source.earnedBands;
  assert.equal(statTimeline(c,{},today).points.find(row=>row.workoutId==='b').power,null);
});

test('dated journal gains reconcile and undated gains produce a visible history gap',()=>{
  const c=hero(),initial=c.stats.STR;c.workouts=[receipt(c,'training','2026-09-02',{STR:2})];
  c.journal=[{id:'gain',kind:'milestone',at:'2026-09-03T12:00:00Z',reward:{stats:{STR:3}}},{id:'off',kind:'milestone',at:'2026-09-03T13:00:00Z',entitlement:true,active:false,reward:{stats:{STR:100}}},{id:'old-awakening',kind:'awakening',reward:{ap:1}}];
  c.stats.STR+=5;
  const history=statTimeline(c,{},today);
  assert.equal(history.points.find(row=>row.eventId==='gain').stats.STR,initial+5);
  assert.equal(history.events.filter(row=>row.kind==='milestone').length,1);
  assert.equal(history.undatedEvents.length,1);assert.equal(history.missingStatHistory,false);
  c.journal.push({id:'undated',kind:'milestone',reward:{stats:{STR:4}}});c.stats.STR+=4;
  const gap=statTimeline(c,{},today);assert.equal(gap.missingStatHistory,true);assert.equal(gap.points.at(-1).boundary,true);assert.match(gap.points.at(-1).source,/lack dated records/);
});

test('periods use inclusive calendar dates across leap days and custom inputs are normalized',()=>{
  assert.deepEqual(periodBounds('7','','','2026-03-29'),{start:'2026-03-23',end:'2026-03-29'});
  assert.deepEqual(periodBounds('30','','','2024-03-01'),{start:'2024-02-01',end:'2024-03-01'});
  assert.deepEqual(periodBounds('year','','',today),{start:'2025-09-06',end:today});
  assert.deepEqual(periodBounds('custom','2026-09-05','2026-08-01',today),{start:'2026-08-01',end:today});
  assert.deepEqual(periodBounds('custom','2026-02-31','2026-09-01',today),{start:'1970-01-01',end:'2026-09-01'});
});

test('grouping keeps actual observation dates, an earlier reference, and migration boundaries',()=>{
  const timeline={points:[{date:'2026-09-05',stats:{STR:6},source:'latest'},{date:'2026-08-30',stats:{STR:1},legacy:true},{date:'2026-09-01',stats:{STR:2},legacy:true},{date:'2026-09-02',stats:{STR:3},baseline:true,boundary:true},{date:'2026-09-03',stats:{STR:4}},{date:'2026-09-04',stats:{STR:5}}],events:[]};
  const original=structuredClone(timeline);
  const selected=selectTimeline(timeline,{range:'custom',start:'2026-09-01',end:today,group:'month',today});
  assert.deepEqual(selected.points.map(row=>row.date),['2026-08-30','2026-09-01','2026-09-02','2026-09-05']);
  assert.equal(selected.points[0].reference,true);assert.equal(selected.points[2].boundary,true);
  assert.deepEqual(timeline,original);
  const sameDay=selectTimeline({points:[{date:today,stats:{STR:1},baseline:true},{date:today,stats:{STR:2}}],events:[]},{range:'7',today});assert.equal(sameDay.points.length,2);
});

test('period and last-session gains exclude legacy duplicates, rest logs and future entries',()=>{
  const c=hero();c.workouts=[receipt(c,'old','2026-08-01',{STR:100}),receipt(c,'now','2026-09-03',{STR:2}),receipt(c,'rest','2026-09-04',{}, {kind:'rest'}),receipt(c,'archived','2026-09-05',{STR:900},{legacy:true}),receipt(c,'future','2027-01-01',{STR:999})];
  c.journal=[{id:'award',at:'2026-09-04T12:00:00Z',reward:{stats:{STR:3}}}];
  const changes=statChanges(c,'7',today);assert.equal(changes.period.STR,5);assert.equal(changes.latest.STR,2);assert.equal(changes.latestWorkout.id,'now');
});

test('Epley estimates and max records retain the same valid completed set as evidence',()=>{
  const c=hero();c.workouts=[{id:'one',date:'2026-09-02',kind:'training',entries:[{exerciseId:'bench_press',sets:[{weight:100,reps:1},{weight:70,reps:10},{weight:20,reps:20},{weight:110,reps:0},{weight:300,reps:2.5},{weight:-5,reps:10}]}]},{id:'two',date:'2026-09-03',kind:'training',entries:[{exerciseId:'bench_press',sets:[{weight:90,reps:5}]}]}];
  const result=trainingAnalysis(c,{end:today}),record=key=>result.records.find(row=>row.name==='Bench Press'&&row.key===key);
  close(record('e1rm').value,105);assert.equal(record('e1rm').weight,90);assert.equal(record('e1rm').reps,5);assert.equal(record('e1rm').workoutId,'two');assert.equal(record('e1rm').setIndex,0);
  assert.equal(record('weight').value,100);assert.equal(record('weight').reps,1);assert.equal(record('reps').value,20);assert.equal(record('reps').weight,20);
  assert.equal(result.totalVolume,1650);
});

test('analytics ignore stale type fields and reconcile days, groups, weeks and exports',()=>{
  const c=hero();c.workouts=[{id:'a',date:'2026-09-01',kind:'training',receipt:{minutes:90},entries:[{exerciseId:'bench_press',duration:999,distance:999,sets:[{weight:40,reps:10,seconds:999}]},{exerciseId:'meditation',duration:30,distance:999,sets:[{weight:999,reps:99}]},{exerciseId:'plank',duration:999,sets:[{seconds:60,weight:50,reps:10},{seconds:60}]},{exerciseId:'outdoor_run',duration:20,distance:3,sets:[{weight:999,reps:999}]}]},{id:'b',date:'2026-09-01',kind:'training',entries:[{exerciseId:'bench_press',sets:[{weight:40,reps:5}]}]},{id:'rest',date:'2026-09-02',kind:'rest',entries:[]},{id:'bad',date:'2026-02-31',kind:'training',entries:[]}];
  const result=trainingAnalysis(c,{start:'2026-09-01',end:today});assert.equal(result.sessions,2);assert.equal(result.trainingDays,1);assert.equal(result.restDays,1);assert.equal(result.totalVolume,600);assert.equal(result.totalMinutes,52);assert.equal(result.estimatedEffortMinutes,90);
  assert.equal(result.days.reduce((sum,row)=>sum+row.volume,0),result.totalVolume);assert.equal(result.groups.reduce((sum,row)=>sum+row.volume,0),result.totalVolume);assert.equal(result.weeks.reduce((sum,row)=>sum+row.minutes,0),result.totalMinutes);
  assert.deepEqual(result.records.filter(row=>row.name==='Meditation').map(row=>row.key),['duration']);assert.deepEqual(result.records.filter(row=>row.name==='Plank').map(row=>row.key),['hold']);
  const exported=historyExport(c,{start:'2026-09-01',end:'2026-09-01'});assert.equal(exported.workouts.length,2);exported.workouts[0].entries[0].sets[0].weight=1;assert.equal(c.workouts[0].entries[0].sets[0].weight,40);
});
