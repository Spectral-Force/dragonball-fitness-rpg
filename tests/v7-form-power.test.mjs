import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as E from '../v7/engine.js';
import { CATALOG, STATS } from '../v7/catalog.js';
import { applyFormPowerRules } from '../v7/form-rules.js';
import { renderFormCombat, renderTierPower } from '../v7/form-ui.js';
import { validateState } from '../v7/migration.js';
import { statTimeline } from '../v7/chronicle.js';
import { escapeHTML as esc, number as num, button as btn, progress as meter, tag, empty } from '../v7/ui-kit.js';

const now=new Date('2026-09-05T12:00:00Z');
function fixture(routeId='saiyan') {
  const state=E.createState(),c=E.createCharacter(state,{id:'forms',name:'Forms',routeId},now);
  c.completedSagas=CATALOG.sagas.map(s=>s.id);
  c.earnedBands=CATALOG.routes[routeId].tiers.map(t=>t.bandId);
  for(const f of CATALOG.transformations)if(E.getFormState(c,f.id).canUnlock)E.unlockForm(c,f.id);
  return {state,c};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const expected={kaioken_x1:2,kaioken_x3:3,kaioken_x10:10,kaioken_x20:20,kaioken_x50:50,kaioken_x100:100,false_ss:5,ascended_ss:55,mastered_ss:60,ultra_ss:65,golden_great_ape:500,ssb_kaioken_x10:20000,ssb_kaioken_x20:40000};

test('all requested multipliers agree in catalog, cards and actual equipped power, even after the finale',()=>{
  const {c}=fixture();c.stats.STR+=100;
  for(const [id,multiplier] of Object.entries(expected)){
    const form=CATALOG.transformations.find(f=>f.id===id);
    assert.equal(form.powerMultiplier,multiplier,id);assert.equal(form.mult,multiplier,id);
    assert.equal(E.getFormState(c,id).multiplier,multiplier,id);
    const power=E.equipForm(c,id);assert.equal(power.multiplier,multiplier,id);near(power.effective,power.base*multiplier);
    assert.equal(power.activeRelease,false);assert.equal(E.getEarnedRelease(c).multiplier,80000);
  }
  assert.equal(CATALOG.transformations.find(f=>f.id==='kaioken_x1').name,'Kaioken ×2');
  assert.equal(E.equipForm(c,'base').multiplier,1);
  assert.equal(E.equipRelease(c).multiplier,80000);
});

test('shared Kaioken stages have the same exact power across compatible races',()=>{
  for(const route of ['saiyan','earthling','hybrid','namekian']){
    const {c}=fixture(route);
    for(const [id,multiplier]of Object.entries(expected).filter(([id])=>id.startsWith('kaioken_'))){
      assert.equal(E.getFormState(c,id).multiplier,multiplier,`${route}/${id}`);
      assert.equal(E.equipForm(c,id).multiplier,multiplier,`${route}/${id}`);
    }
  }
});

test('reproducible build rules derive Blue Kaioken from Blue instead of a separate stale constant',()=>{
  const changed=CATALOG.transformations.map(f=>f.id==='super_saiyan_blue'?{...f,mult:3000,powerMultiplier:3000}:f);
  const output=applyFormPowerRules(changed);
  assert.equal(output.find(f=>f.id==='ssb_kaioken_x10').powerMultiplier,30000);
  assert.equal(output.find(f=>f.id==='ssb_kaioken_x20').powerMultiplier,60000);
  assert.deepEqual(applyFormPowerRules(CATALOG.transformations),CATALOG.transformations);
});

test('Ultra Super Saiyan trades 45 percent of speed and stamina for exact x65 burst power',()=>{
  const {c}=fixture();c.stats.AGI=100;c.stats.END=200;c.stats.VIT=300;
  const permanent=structuredClone(c.stats),power=E.equipForm(c,'ultra_ss'),combat=power.combat;
  assert.equal(power.multiplier,65);assert.equal(combat.speed,.55);assert.equal(combat.stamina,.55);assert.equal(combat.health,1);
  near(combat.temporaryStats.AGI,55);near(combat.temporaryStats.END,110);near(combat.temporaryStats.VIT,300);
  near(power.sustained,power.effective*Math.cbrt(.55*.55));
  assert.ok(power.sustainedMultiplier<60,'Full Power Super Saiyan should be better for sustained output.');
  assert.deepEqual(c.stats,permanent);
  E.equipForm(c,'mastered_ss');assert.deepEqual(E.getFormCombat(c).temporaryStats,permanent);
  assert.deepEqual(c.stats,permanent);
});

test('Blue Kaioken x20 has larger endurance and health costs than x10, with truthful composition UI',()=>{
  const {c}=fixture(),ten=E.equipForm(c,'ssb_kaioken_x10'),twenty=E.equipForm(c,'ssb_kaioken_x20');
  assert.equal(ten.multiplier,2000*10);assert.equal(twenty.multiplier,2000*20);
  assert.equal(ten.combat.stamina,.75);assert.equal(ten.combat.health,.85);
  assert.equal(twenty.combat.stamina,.55);assert.equal(twenty.combat.health,.70);
  assert.ok(twenty.combat.sustainFactor<ten.combat.sustainFactor);
  near(twenty.sustained,twenty.effective*Math.cbrt(.55*.70));
  const html=renderFormCombat(c,'ssb_kaioken_x20');
  assert.match(html,/Super Saiyan Blue ×2,000 × Kaioken 20 = ×40,000/);
  assert.match(html,/stamina −45%/);assert.match(html,/VIT −30%/);
  assert.match(html,/Permanent/);assert.match(html,/Sustained combat estimate/);
  assert.match(renderFormCombat(c,'ultra_ss',{compact:true}),/Speed \/ AGI −45%/);
});

test('previous v7 native Base saves retain their earned power explicitly, while named forms are corrected',()=>{
  const {state,c}=fixture('earthling');delete c.activeRelease;
  const restored=validateState(state),copy=restored.characters.forms;
  assert.equal(copy.activeRelease,true);assert.equal(E.getPower(copy).multiplier,80000);
  assert.equal(validateState(restored).characters.forms.activeRelease,true);
  E.equipForm(copy,'kaioken_x1');assert.equal(copy.activeRelease,false);assert.equal(E.getPower(copy).multiplier,2);
  assert.equal(validateState(restored).characters.forms.activeRelease,false);
  const named=fixture();named.c.activeForm='kaioken_x1';delete named.c.activeRelease;
  assert.equal(E.getPower(validateState(named.state).characters.forms).multiplier,2);
  const bad=structuredClone(restored);bad.characters.forms.activeRelease='yes';assert.throws(()=>validateState(bad),/native release selection/);
});

test('native release selection does not unlock named forms or bypass saga and race requirements',()=>{
  const state=E.createState(),c=E.createCharacter(state,{id:'fresh',routeId:'saiyan'},now);
  assert.throws(()=>E.equipRelease(c),/Earn a race release/);
  c.earnedBands.push('first_break');E.equipRelease(c);
  assert.equal(E.getFormState(c,'ssb_kaioken_x20').canUnlock,false);
  assert.equal(E.getFormState(c,'black_frieza').canUnlock,false);
  assert.equal(E.getSagaState(c,'dbz_frieza').canClear,false);
  assert.throws(()=>E.equipForm(c,'ssb_kaioken_x20'),/Unlock/);
});

test('changing selected form cannot revoke available-power achievements or discipline eligibility',()=>{
  const {c}=fixture();c.stats.STR+=10000;
  const before=E.getRewardLadders(c).achievements.filter(a=>a.condition.kind==='storyPower').map(a=>[a.id,a.current,a.complete]);
  E.equipForm(c,'kaioken_x1');
  assert.deepEqual(E.getRewardLadders(c).achievements.filter(a=>a.condition.kind==='storyPower').map(a=>[a.id,a.current,a.complete]),before);
  assert.equal(E.getDivineDiscipline(c).visible,true);assert.equal(E.getDivineDiscipline(c).locked,true);
});

test('combat strain does not touch earned stats and physical corrections preserve the original training build',()=>{
  const {c}=fixture();E.equipForm(c,'ssb_kaioken_x20');
  const before=structuredClone(c.stats),work=E.logWorkout(c,{date:'2026-09-04',kind:'training',entries:[{exerciseId:'meditation',duration:20}]},now),receipt=structuredClone(work.receipt);
  assert.equal(receipt.snapshot.source.powerRulesVersion,2);assert.equal(receipt.snapshot.source.activeRelease,false);
  for(const stat of STATS)assert.ok(c.stats[stat]>=before[stat]);
  E.equipForm(c,'base');E.editWorkout(c,work.id,{notes:'The old receipt is fixed.'},now);
  assert.deepEqual(c.workouts.find(w=>w.id===work.id).receipt,receipt);
  const corrected=E.editWorkout(c,work.id,{entries:[{exerciseId:'meditation',duration:10}]},now);
  assert.equal(corrected.receipt.snapshot.source.activeForm,'ssb_kaioken_x20');
  for(const stat of STATS)near(corrected.receipt.stats[stat],receipt.stats[stat]/2);
});

test('old power-history receipts retain their route floor and new receipts record the actual form',()=>{
  const {c}=fixture();E.equipForm(c,'kaioken_x1');
  const oldSource={race:c.race,routeId:c.routeId,activeForm:'kaioken_x1',forms:{kaioken_x1:{level:1}},earnedBands:[...c.earnedBands]};
  c.workouts=[{id:'old',name:'Old',date:'2026-09-03',kind:'training',receipt:{stats:{STR:1},snapshot:{source:oldSource}}},
    {id:'new',name:'New',date:'2026-09-04',kind:'training',receipt:{stats:{STR:1},snapshot:{source:{...oldSource,powerRulesVersion:2,activeRelease:false}}}}];
  c.stats.STR+=2;
  const points=statTimeline(c,{},'2026-09-05').points;
  const old=points.find(p=>p.workoutId==='old'),fresh=points.find(p=>p.workoutId==='new');
  near(old.power,old.base*80000);near(fresh.power,fresh.base*2);
});

// Execute the production render functions with image-only stubs. This checks
// arithmetic and current state without depending on concurrently generated art.
function renderer(c,name,file,nextName,extra={}){
  const source=fs.readFileSync(new URL(`../v7/${file}`,import.meta.url),'utf8');
  const start=source.indexOf(`function ${name}(`),end=source.indexOf(`\n${nextName}`,start);
  assert.ok(start>=0&&end>start,`${name} must be extractable`);
  return vm.runInNewContext(`${source.slice(start,end)};${name}`,{CATALOG,E,esc,num,btn,meter,tag,empty,renderFormCombat,renderTierPower,character:()=>c,
    FORM_ART:{},imagePath:value=>value,picture:()=>'<img alt="">',auraColour:()=>'',formImage:id=>id,
    equipmentPicture:()=>'',renderEquipmentLoadout:()=>'',abilityPicture:()=>'',partnerImage:id=>id,
    name:(items,id)=>items.find(item=>item.id===id)?.name||id,...extra});
}

test('production collection and active-form renderers expose current multipliers, costs and updated mastery',()=>{
  const {c}=fixture();c.activePartners=[];c.activeAbilities=[];E.equipForm(c,'ultra_ss');
  const item=CATALOG.transformations.find(f=>f.id==='ultra_ss');
  const collection=renderer(c,'collectionCard','app.js','function renderRace');
  const build=renderer(c,'renderBuild','dashboard.js','export function renderDashboard');
  let card=collection('forms',item,E.getFormState(c,item.id)),dashboard=build(c);
  assert.match(card,/×65 power/);assert.match(card,/Speed \/ AGI −45%/);assert.match(card,/sustained estimate/);
  assert.match(dashboard,/Mastery Level 1 · ×65 story power/);
  E.logWorkout(c,{date:'2026-09-04',kind:'training',entries:[{exerciseId:'meditation',duration:60}]},now);
  const current=E.getFormState(c,item.id);assert.ok(current.level>1);
  card=collection('forms',item,current);dashboard=build(c);
  assert.match(card,new RegExp(`Mastery ${current.level}`));
  assert.match(dashboard,new RegExp(`Mastery Level ${current.level} · ×65 story power`));
  const blue=CATALOG.transformations.find(f=>f.id==='ssb_kaioken_x20');
  assert.match(collection('forms',blue,E.getFormState(c,blue.id)),/Super Saiyan Blue ×2,000 × Kaioken 20 = ×40,000/);
  c.forms.base.level=11;E.equipRelease(c);
  assert.match(build(c),/Base mastery level 11 · ×80,000 story power/);
  assert.doesNotMatch(build(c),/sustained estimate/);
});

test('race release control exposes a separate choice while selected form power stays exact',()=>{
  const {c}=fixture();E.equipForm(c,'kaioken_x1');
  const renderRace=renderer(c,'renderRace','app.js','function renderRecords',{routeCopy:{saiyan:['Saiyan']},portraitAttributes:()=>'',icon:()=>'',sagaName:id=>id});
  const before=renderRace();assert.match(before,/Current state: Kaioken ×2 · ×2 power/);
  assert.match(before,/data-action="equip-release"/);assert.match(before,/Use native release/);
  E.equipRelease(c);assert.match(renderRace(),/Native release active/);
  E.equipForm(c,'base');assert.match(renderRace(),/Current state: Base · ×1 power/);
});

test('route signatures keep each named form multiplier distinct from campaign potential',()=>{
  for(const route of Object.keys(CATALOG.routes)){
    const {c}=fixture(route),tiers=E.getRouteState(c).tiers;
    for(const tier of tiers)for(const signature of tier.signatureForms){
      assert.equal(signature.multiplier,CATALOG.transformations.find(f=>f.id===signature.id).powerMultiplier,`${route}/${signature.id}`);
      assert.equal(signature.unlocked,E.getFormState(c,signature.id).unlocked);
    }
    E.equipRelease(c);const release=E.getEarnedRelease(c);
    assert.equal(release.milestoneLabel,CATALOG.routes[route].tiers.at(-1).name);
    assert.equal(E.getPower(c).formName,release.name);assert.match(release.name,/native release$/);
  }
  const {c}=fixture(),primal=E.getRouteState(c).tiers.find(t=>t.bandId==='ascendant_mortal'),html=renderTierPower(primal);
  assert.match(html,/Golden Great Ape<\/span><b>×500/);
  assert.match(html,/Super Saiyan 4<\/span><b>×800/);
  assert.match(html,/Earned route potential<\/span><b>×800/);
  assert.doesNotMatch(html,/Golden Great Ape<\/span><b>×800/);
});

test('race path signature labels never pretend a future or merely available form is already unlocked',()=>{
  const c=E.createCharacter(E.createState(),{routeId:'saiyan'},now);
  let tier=E.getRouteState(c).tiers.find(t=>t.bandId==='ascendant_mortal');
  assert.ok(tier.signatureForms.every(f=>!f.unlocked&&!f.canUnlock));
  assert.match(renderTierPower(tier),/Not unlocked/);assert.doesNotMatch(renderTierPower(tier),/>Unlocked</);
  assert.match(renderTierPower(tier),/Route potential when earned/);
  c.earnedBands=CATALOG.routes.saiyan.tiers.map(t=>t.bandId);c.completedSagas=CATALOG.sagas.map(s=>s.id);
  tier=E.getRouteState(c).tiers.find(t=>t.bandId==='ascendant_mortal');
  assert.match(renderTierPower(tier),/Available to unlock/);assert.doesNotMatch(renderTierPower(tier),/>Unlocked</);
  E.unlockForm(c,'golden_great_ape');
  tier=E.getRouteState(c).tiers.find(t=>t.bandId==='ascendant_mortal');
  assert.equal(tier.signatureForms.find(f=>f.id==='golden_great_ape').unlocked,true);
  assert.equal(tier.signatureForms.find(f=>f.id==='super_saiyan_4').unlocked,false);
});

test('temporary combat estimates do not change existing saga-clear gates or workout readiness',()=>{
  const {c}=fixture();const final=CATALOG.sagas.at(-1);c.completedSagas.pop();c.stats.STR=1e7;c.storyXP=1e7;c.sagaFocus[final.id]=1e7;
  E.equipForm(c,'mastered_ss');const saga=E.getSagaState(c,final.id),readiness=E.getReadiness(c,now);
  assert.equal(saga.canClear,true);
  E.equipForm(c,'ultra_ss');assert.deepEqual(E.getSagaState(c,final.id),saga);assert.deepEqual(E.getReadiness(c,now),readiness);
  E.equipForm(c,'ssb_kaioken_x20');assert.deepEqual(E.getSagaState(c,final.id),saga);assert.deepEqual(E.getReadiness(c,now),readiness);
});
