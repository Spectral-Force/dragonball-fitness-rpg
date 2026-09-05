import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../v7/engine.js';
import * as V1 from '../v7/rules-v1/engine.js';
import { CATALOG, STATS } from '../v7/catalog.js';
import { RESTORATION } from '../v7/restoration-content.js';
import { validateState, migrateLegacy } from '../v7/migration.js';
import { trainingMetrics } from '../v7/progression.js';

const now=new Date('2026-09-05T12:00:00Z');
const make=(routeId='saiyan')=>{const state=E.createState(),c=E.createCharacter(state,{id:'fixture',name:'Restoration fixture',routeId},now);return {state,c};};
const workout=(date='2026-09-01',duration=45)=>({date,name:'Practice',kind:'training',entries:[{exerciseId:'meditation',duration,sets:[]}]});
const grant=(c,tp=100000,ap=100000)=>{c.baseline.tp+=tp;c.baseline.ap+=ap;E.rebuildCharacter(c);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function weeks(c,count,minutes=150){for(let week=0;week<count;week++){const d=new Date(Date.UTC(2025,0,6+week*7,12));E.logWorkout(c,workout(d.toISOString().slice(0,10),minutes),now);}}
function veteranSource(extra={}){return {schemaVersion:33,activeCharacter:'fixture',characters:{fixture:{name:'Veteran',race:'saiyan',stats:{STR:20,END:20,AGI:20,VIT:20,SPI:20,TEC:20,GKI:0},totalTXP:1000,trainingPoints:100,tpSpent:10,abilityPointsEarned:20,abilityPointsSpent:5,ownedPartners:['bulma','kid_goku'],activePartners:['bulma'],partnerLevels:{bulma:{level:12,totalXp:500}},purchasedAbilities:{ki_blast:100},abilityLevels:{ki_blast:{level:100,xp:0,totalXp:40000}},equippedAbilities:['ki_blast'],unlockedTransformations:['base'],workoutLog:[],...extra}}};}

test('fresh characters develop two technique slots to seven; existing v7 saves retain four',()=>{
  const {state,c}=make();assert.equal(E.getAbilitySlots(c),2);grant(c);E.buyAbilitySlot(c);assert.equal(E.getAbilitySlots(c),3);
  assert.throws(()=>E.buyAbilitySlot(c),/sagas/);c.completedSagas=CATALOG.sagas.map(s=>s.id);while(E.getAbilitySlots(c)<7)E.buyAbilitySlot(c);assert.throws(()=>E.buyAbilitySlot(c),/seven/);
  const old=V1.createState();V1.createCharacter(old,{id:'fixture',name:'Original v7',routeId:'saiyan'},now);const migrated=validateState(old);assert.equal(E.getAbilitySlots(migrated.characters.fixture),4);assert.equal(migrated.schemaVersion,70);assert.equal(validateState(state).characters.fixture.abilitySlots,7);
});
test('partner slot investment previews and spends TP once without changing automatic earned slots',()=>{
  const {c}=make();grant(c);const before=c.tp,s=E.getSlotDevelopment(c).partners;E.buyPartnerSlot(c);near(c.tp,before-s.cost);assert.equal(E.getPartnerSlots(c),3);c.completedSagas=CATALOG.sagas.slice(0,35).map(s=>s.id);assert.equal(E.getPartnerSlots(c),7);
});
test('prepared practice earns real levels to 100 and AP purchase ranks remain separate',()=>{
  const {c}=make();E.buyAbility(c,'ki_blast');const before=E.getAbilityState(c,'ki_blast');E.logWorkout(c,workout(),now);const after=E.getAbilityState(c,'ki_blast');assert.equal(after.rank,1);assert.ok(after.practiceLevel>before.practiceLevel);near(after.practiceXP,36);assert.ok(after.contribution>before.contribution);assert.equal(after.maxRank,1);assert.match(after.reason,/practice/);
  c.baseline.abilityXP={ki_blast:3*99**2};E.rebuildCharacter(c);assert.equal(E.getAbilityDevelopment(c,'ki_blast').level,100);assert.equal(E.getAbilityDevelopment(c,'ki_blast').nextXP,0);
});
test('splitting logs cannot create extra practice XP or player-level rewards',()=>{
  const one=make().c,two=make().c;for(const c of [one,two])E.buyAbility(c,'ki_blast');E.logWorkout(one,workout('2026-09-01',90),now);E.logWorkout(two,workout('2026-09-01',40),now);E.logWorkout(two,workout('2026-09-01',50),now);near(one.abilityPractice.ki_blast.xp,two.abilityPractice.ki_blast.xp);for(const key of ['xp','ap','tp'])near(one[key],two[key]);
});
test('partner milestones expose the exact selected-stat contribution delta',()=>{
  const {c}=make();c.partners.bulma.level=2;const exercise={...CATALOG.exercises.find(e=>e.id==='meditation'),_stat:'TEC'};const detail=E.getPartnerDevelopment(c,'bulma',exercise),next=detail.nextMilestone;assert.equal(next.level,3);const before=E.getBoosts(c,exercise);c.partners.bulma.level=3;const after=E.getBoosts(c,exercise);near(after.partners-before.partners,next.levelUpContributionDelta);assert.equal(E.getPartnerDevelopment(c,'bulma',exercise).milestones.filter(m=>m.earned).length,1);
});
test('main mentor changes own contribution and own XP; removing the mentor remains saveable',()=>{
  const {state,c}=make();c.partners.kid_goku={xp:0,level:1};c.activePartners=['bulma','kid_goku'];const before=E.getPartnerDevelopment(c,'kid_goku').contribution;E.setMainMentor(c,'kid_goku');assert.ok(E.getPartnerDevelopment(c,'kid_goku').contribution>before);const log=E.logWorkout(c,workout(),now);assert.ok(log.receipt.partnerXPById.kid_goku>log.receipt.partnerXPById.bulma);E.togglePartner(c,'kid_goku');assert.equal(c.mainMentor,null);assert.doesNotThrow(()=>validateState(state));
});
test('named Kamehameha and Kid Goku synergy changes the correct XP recipient',()=>{
  const {c}=make();c.completedSagas=['db_pilaf'];grant(c);c.partners.kid_goku={xp:0,level:1};c.activePartners=['kid_goku','bulma'];E.buyAbility(c,'kamehameha');const w=E.logWorkout(c,workout(),now);assert.ok(w.receipt.partnerXPById.kid_goku>w.receipt.partnerXPById.bulma);assert.ok(E.getAbilityDevelopment(c,'kamehameha',{_stat:'SPI'}).affinity.synergy>0);
});
test('authored saga resonance identifies signature techniques beyond their purchase saga',()=>{
  const {c}=make();c.completedSagas=CATALOG.sagas.slice(0,CATALOG.sagas.findIndex(s=>s.id==='dbz_frieza')).map(s=>s.id);c.abilities.spirit_bomb=1;assert.ok(E.getAbilityDevelopment(c,'spirit_bomb').affinity.resonance>0);const first=E.getAbilityDevelopment(c,'spirit_bomb').affinity.resonance;c.focusSagaId='db_pilaf';assert.ok(E.getAbilityDevelopment(c,'spirit_bomb').affinity.resonance<first);
});
test('Kid Goku forms are selectable specialties and require actual saga clears',()=>{
  const {c}=make();c.partners.kid_goku={xp:0,level:70};c.activePartners=['kid_goku'];c.completedSagas=CATALOG.sagas.slice(0,13).map(s=>s.id);assert.throws(()=>E.setPartnerForm(c,'kid_goku','super_saiyan'),/Clear/);c.completedSagas.push('dbz_frieza');E.setPartnerForm(c,'kid_goku','super_saiyan');const power=E.getPower(c).effective,spi=E.getPartnerDevelopment(c,'kid_goku',{_stat:'SPI'}).contribution;E.setPartnerForm(c,'kid_goku','turtle_school_prodigy');assert.notEqual(E.getPartnerDevelopment(c,'kid_goku',{_stat:'SPI'}).contribution,spi);near(E.getPower(c).effective,power);assert.equal(E.getPartnerForms(c,'kid_goku').length,7);
});
test('primary form and training echoes remain separate from Story PL',()=>{
  const {c}=make();c.completedSagas=CATALOG.sagas.map(s=>s.id);c.earnedBands=CATALOG.routes.saiyan.tiers.map(t=>t.bandId);c.forms.super_saiyan={xp:1000,level:10};c.forms.super_saiyan_2={xp:1000,level:12};E.equipForm(c,'super_saiyan_2');const p=E.getPower(c).effective,b=E.getBoosts(c).mastery;E.toggleEcho(c,'super_saiyan');near(E.getPower(c).effective,p);assert.ok(E.getBoosts(c).mastery>b);assert.equal(E.getFormDevelopment(c,'super_saiyan').stage,'Controlled');E.equipForm(c,'super_saiyan');assert.ok(!c.echoForms.includes('super_saiyan'));
});
test('Divine Discipline obeys race exclusions, visible choice and commitment',()=>{
  for(const routeId of ['majin','frieza_race'])assert.equal(E.getDivineDiscipline(make(routeId).c).supported,false);
  const {c}=make('earthling');assert.throws(()=>E.setDivineDiscipline(c,'instinct'),/800/);const tier=CATALOG.routes.earthling.tiers.find(t=>t.multiplier===800);assert.ok(tier);c.earnedBands.push(tier.bandId);E.setDivineDiscipline(c,'instinct');assert.equal(E.getDivineDiscipline(c).selected,'instinct');c.earnedBands.push(CATALOG.routes.earthling.tiers.find(t=>t.multiplier===1000).bandId);assert.throws(()=>E.setDivineDiscipline(c,'destruction'),/committed/);
});
test('copied cores keep source trait provenance and leave partner levels intact',()=>{
  const {c}=make('majin');c.partners.kid_goku={xp:800,level:6};E.equipCore(c,'kid_goku');const core=E.getCoreTraits(c)[0];assert.equal(core.sourceLevel,6);assert.ok(core.value<=.12);assert.equal(c.partners.kid_goku.level,6);assert.match(core.provenance,/Copied/);assert.throws(()=>E.togglePartner(c,'kid_goku'),/core/);
});
test('three Dragon Ball sets have 21 individually tracked goals and ten exact wish descriptions',()=>{
  const sets=E.getDragonBallSets(make().c);assert.equal(sets.length,3);assert.equal(sets.flatMap(s=>s.balls).length,21);assert.equal(sets.flatMap(s=>s.wishes).length,10);assert.ok(sets.every(s=>s.balls.every(b=>b.minimumWeeks>0&&b.alternative.target>0)));assert.equal(sets[0].unlocked,true);assert.equal(sets[1].unlocked,false);assert.ok(sets.every(s=>s.wishes.every(w=>w.effectiveDescription.length>0)));
});
test('seven accumulated weeks earn Earth balls through any exercise and wishes do not duplicate',()=>{
  const {c}=make();E.buyAbility(c,'ki_blast');weeks(c,6);assert.equal(E.getDragonBallSets(c)[0].canWish,false);weeks(c,1);assert.equal(E.getDragonBallSets(c)[0].canWish,false,'same week does not become an extra search week');E.logWorkout(c,workout('2025-02-17',150),now);assert.equal(E.getDragonBallSets(c)[0].canWish,true);const before=c.abilityPractice.ki_blast.xp,w=E.makeSetWish(c,'earth','earth_ability');near(c.abilityPractice.ki_blast.xp,before+60);assert.match(w.description,/60 XP/);assert.throws(()=>E.makeSetWish(c,'earth','earth_ability'),/seven/);assert.throws(()=>E.makeWish(c,'technique'),/converted/);const ap=c.ap;E.rebuildCharacter(c);near(c.ap,ap);
});
test('Porunga grants three distinct choices and then requires another full search',()=>{
  const {c}=make();c.completedSagas=CATALOG.sagas.map(s=>s.id);c.earnedBands=CATALOG.routes.saiyan.tiers.map(t=>t.bandId);weeks(c,14);const set=E.getDragonBallSets(c).find(s=>s.id==='namek');assert.equal(set.canWish,true);E.makeSetWish(c,'namek','namek_ability');assert.equal(E.getDragonBallSets(c)[1].remainingWishes,2);assert.throws(()=>E.makeSetWish(c,'namek','namek_ability'),/different/);E.makeSetWish(c,'namek','namek_training');E.makeSetWish(c,'namek','namek_partner');assert.equal(E.getDragonBallSets(c)[1].remainingWishes,0);assert.throws(()=>E.makeSetWish(c,'namek','namek_balance'),/seven/);
});
test('Super wish grants exactly the displayed bounded XP to its recorded active team',()=>{
  const {c}=make();c.completedSagas=CATALOG.sagas.map(s=>s.id);c.earnedBands=CATALOG.routes.saiyan.tiers.map(t=>t.bandId);weeks(c,21);const s=E.getDragonBallSets(c)[2],r=s.wishes.find(w=>w.id==='super_divine_bond').effectiveReward;assert.equal(s.canWish,true);const xp=c.partners.bulma.xp;E.makeSetWish(c,'super','super_divine_bond');near(c.partners.bulma.xp,xp+r.partnerXP);assert.equal(r.partnerXP,1800);
});
test('legacy ability level100 and purchased slots migrate as usable development without free rewards',()=>{
  const source=veteranSource({abilitySlots:7,partnerSlots:6});const state=migrateLegacy(source).state,c=state.characters.fixture;assert.equal(c.abilityPractice.ki_blast.level,100);assert.equal(c.abilities.ki_blast,1);assert.equal(E.getAbilitySlots(c),7);assert.equal(c.partnerSlots,6);near(c.tp,90);near(c.ap,15);const before=JSON.stringify(c);const restored=validateState(state).characters.fixture;assert.equal(restored.abilityPractice.ki_blast.level,100);near(restored.ap,15);assert.ok(before.length>0);
});
test('legacy partial practice preserves its fraction toward the next actual level',()=>{
  const source=veteranSource({purchasedAbilities:{ki_blast:25},abilityLevels:{ki_blast:{level:25,xp:50,totalXp:2000}}});const c=migrateLegacy(source).state.characters.fixture;const p=E.getAbilityDevelopment(c,'ki_blast');assert.equal(p.level,25);assert.ok(p.xpInto>0);assert.ok(p.xpNeeded>100);E.rebuildCharacter(c);near(E.getAbilityDevelopment(c,'ki_blast').xpInto,p.xpInto);
});
test('legacy partial ball searches and unused Porunga wishes survive repeated migration',()=>{
  const source=veteranSource({dragonBalls:{sets:{earth:{cycle:0,collectedStars:[1,3],metricBaseline:{}},namek:{cycle:2,metricBaseline:{},summonWishCount:1,currentWishIds:['namek_training']}},wishHistory:[{id:'previous',setId:'namek',wishId:'namek_training'}]}});const first=migrateLegacy(source).state,c=first.characters.fixture;assert.equal(c.dragonBallSets.earth.creditProgress[1],1);assert.equal(c.dragonBallSets.earth.creditProgress[3],1);assert.equal(c.dragonBallSets.namek.remainingWishes,2);assert.equal(c.wishes.length,1);const again=migrateLegacy(first).state.characters.fixture;assert.equal(again.wishes.length,1);near(again.tp,c.tp);near(again.ap,c.ap);
});
test('a migrated partially used Porunga summon cannot reuse the already-consumed seven balls',()=>{
  const source=veteranSource({completedSagas:CATALOG.sagas.slice(0,12).map(s=>s.id),dragonBalls:{sets:{namek:{cycle:1,collectedStars:[1,2,3,4,5,6,7],summonWishCount:1,currentWishIds:['namek_training']}},wishHistory:[]}});const c=migrateLegacy(source).state.characters.fixture;E.makeSetWish(c,'namek','namek_ability');E.makeSetWish(c,'namek','namek_partner');assert.equal(E.getDragonBallSets(c)[1].canWish,false);assert.throws(()=>E.makeSetWish(c,'namek','namek_balance'),/seven/);
});
test('mixed v6 and v7 search credit adds once and banks excess original expedition progress',()=>{
  const old=V1.createState(),c=V1.createCharacter(old,{id:'fixture',name:'Mixed history',routeId:'saiyan'},now);old.migration={original:veteranSource({dragonBalls:{sets:{earth:{collectedStars:[1,3],metricBaseline:{}}},wishHistory:[]}})};c.legacy={originalCharacterId:'fixture'};c.expeditionPoints=400;const r=validateState(old).characters.fixture;assert.equal(E.getDragonBallSets(r)[0].collected,7);assert.equal(r.dragonBallSets.earth.bankedExpeditionPoints,150);E.makeSetWish(r,'earth','earth_ability');assert.equal(E.getDragonBallSets(r)[0].collected,3);assert.equal(r.dragonBallSets.earth.bankedExpeditionPoints,0);assert.equal(E.getDragonBallSets(r)[0].canWish,false);
});
test('current v7 expedition conversion grants no rewards and preserves current workouts and partial ball',()=>{
  const old=V1.createState(),c=V1.createCharacter(old,{id:'fixture',name:'V7',routeId:'saiyan'},now);for(let w=0;w<2;w++)V1.logWorkout(c,workout(`2026-08-${String(3+w*7).padStart(2,'0')}`,150),now);V1.logWorkout(c,workout('2026-08-17',75),now);const before={tp:c.tp,ap:c.ap,stats:structuredClone(c.stats),workouts:c.workouts.length};const restored=validateState(old).characters.fixture;near(restored.tp,before.tp);near(restored.ap,before.ap);assert.deepEqual(restored.stats,before.stats);assert.equal(restored.workouts.length,before.workouts);assert.equal(restored.dragonBallSets.earth.creditProgress[1],1);assert.equal(restored.dragonBallSets.earth.creditProgress[2],1);near(restored.dragonBallSets.earth.creditProgress[3],.5);assert.throws(()=>E.makeWish(restored,'technique'),/converted/);
});
test('old rules1 physical edits use the exact frozen engine and catalog after restoration',()=>{
  const old=V1.createState(),c=V1.createCharacter(old,{id:'fixture',name:'Original',routeId:'earthling'},now);c.abilities.ki_blast=1;c.activeAbilities=['ki_blast'];const w=V1.logWorkout(c,workout('2026-09-01',60),now),reference=structuredClone(c);const restored=validateState(old).characters.fixture;const patch={entries:workout('2026-09-01',30).entries};const expected=V1.editWorkout(reference,w.id,patch,now),actual=E.editWorkout(restored,w.id,patch,now);assert.equal(actual.receipt.version,1);for(const stat of STATS)near(actual.receipt.stats[stat],expected.receipt.stats[stat]);for(const key of ['xp','tp','ap','partnerXP','formXP'])near(actual.receipt[key],expected.receipt[key]);assert.equal(actual.receipt.abilityXP,0);
});
test('achievement and player-level entitlements reconcile deletion and cannot pay twice',()=>{
  const {c}=make();const original={tp:c.tp,ap:c.ap};const w=E.logWorkout(c,workout('2026-09-01',90),now);assert.ok(c.journal.some(e=>e.kind==='achievement'&&e.active));const paid={tp:c.tp,ap:c.ap};E.rebuildCharacter(c);near(c.tp,paid.tp);near(c.ap,paid.ap);E.deleteWorkout(c,w.id);near(c.tp,original.tp);near(c.ap,original.ap);E.logWorkout(c,workout('2026-09-01',90),now);near(c.tp,paid.tp);near(c.ap,paid.ap);assert.equal(new Set(c.journal.map(e=>e.id)).size,c.journal.length);
});
test('reward inventory restores all definitions and excludes cross-race form requirements',()=>{
  for(const routeId of Object.keys(CATALOG.routes)){const c=make(routeId).c,ladder=E.getRewardLadders(c);assert.equal(ladder.achievements.length,82);assert.equal(ladder.partnerCollections.length,8);assert.equal(ladder.abilityCollections.length,6);assert.equal(ladder.transformationCollections.length,6);assert.equal(ladder.arcs.length,4);for(const group of ladder.transformationCollections)assert.ok(group.memberIds.every(fid=>E.getFormState({...c,earnedBands:CATALOG.routes[routeId].tiers.map(t=>t.bandId),completedSagas:CATALOG.sagas.map(s=>s.id)},fid).reason!=='This form belongs to another race route.'));}
});
test('daily recovery competes with training for one optional reward and deletion reverses it',()=>{
  const {c}=make();const w=E.logWorkout(c,{date:'2026-09-01',kind:'rest',entries:[]},now);const d=E.getTrainingObjectives(c,'2026-09-01').daily.find(o=>o.name==='Recovery check-in'),tp=c.tp;E.claimObjective(c,d.id,'2026-09-01');near(c.tp,tp+1);assert.throws(()=>E.claimObjective(c,d.id,'2026-09-01'),/once/);assert.ok(E.getTrainingObjectives(c,'2026-09-01').daily.every(o=>!o.canClaim));E.deleteWorkout(c,w.id);near(c.tp,tp);
});
test('weekly mission reward ignores log splitting and reconciles physical corrections',()=>{
  const {c}=make();const a=E.logWorkout(c,workout('2026-09-01',80),now),b=E.logWorkout(c,workout('2026-09-01',70),now);const o=E.getTrainingObjectives(c,'2026-09-01').weekly.find(o=>o.key==='minutes');assert.ok(o.canClaim);E.claimObjective(c,o.id,'2026-09-01');const event=c.journal.find(e=>e.objectiveId===o.id);E.editWorkout(c,b.id,{entries:workout('2026-09-01',5).entries},now);assert.equal(event.active,false);assert.equal(E.getTrainingObjectives(c,'2026-09-01').weekly.find(o=>o.key==='consistency').current,1);
});
test('weekly reclaim after a correction and later restoration cannot duplicate its journal reward',()=>{
  const {state,c}=make();const a=E.logWorkout(c,workout('2026-09-01',150),now),id=E.getTrainingObjectives(c,'2026-09-01').weekly.find(o=>o.key==='minutes').id;E.claimObjective(c,id,'2026-09-01');E.editWorkout(c,a.id,{entries:workout('2026-09-01',30).entries},now);E.logWorkout(c,workout('2026-09-03',150),now);const again=E.getTrainingObjectives(c,'2026-09-03').weekly.find(o=>o.key==='minutes');assert.equal(again.claimed,true);assert.throws(()=>E.claimObjective(c,id,'2026-09-03'),/once/);E.editWorkout(c,a.id,{entries:workout('2026-09-01',150).entries},now);assert.equal(c.journal.filter(e=>e.objectiveId===id).length,1);assert.equal(c.journal.filter(e=>e.objectiveId===id&&e.active).reduce((v,e)=>v+e.reward.tp,0),3);assert.doesNotThrow(()=>validateState(state));
});
test('training and recovery on the same date count once toward lifetime consistency',()=>{
  const {c}=make();for(const date of ['2026-09-01','2026-09-02','2026-09-03','2026-09-04']){E.logWorkout(c,workout(date,10),now);E.logWorkout(c,{date,kind:'rest',entries:[]},now);}const goal=E.getRewardLadders(c).achievements.find(a=>a.id==='streak_7');assert.equal(goal.current,4);assert.equal(goal.complete,false);
});
test('form rules2 mastery is measured in years, while frozen rules1 receipts retain their original XP',()=>{
  const {c}=make();const w=E.logWorkout(c,workout('2026-09-01',60),now);assert.equal(w.receipt.formXP,300);const weeksToPerfect=50*69**2/(210*E.RULES.formXPPerMinute);assert.ok(weeksToPerfect>200&&weeksToPerfect<250);
});
test('legacy mastered forms, selected partner form and one-time missing v7 discipline restore explicitly',()=>{
  const source=veteranSource({partnerLevels:{kid_goku:{level:200,totalXp:12000,activeForm:'super_saiyan'}},completedSagas:CATALOG.sagas.slice(0,14).map(s=>s.id),unlockedTransformations:['base','super_saiyan'],activeTransformation:'super_saiyan',transformationMastery:{super_saiyan:{xp:18000}},equippedTransformations:['super_saiyan','base']});const c=migrateLegacy(source).state.characters.fixture;assert.equal(c.forms.super_saiyan.level,70);assert.equal(c.forms.super_saiyan.legacyMasteryRank,'SUPER');assert.equal(c.partners.kid_goku.activeForm,'super_saiyan');assert.deepEqual(c.echoForms,[]);
  const old=V1.createState(),o=V1.createCharacter(old,{id:'fixture',name:'Existing v7',routeId:'earthling'},now);o.earnedBands=CATALOG.routes.earthling.tiers.map(t=>t.bandId);const r=validateState(old).characters.fixture;assert.equal(E.getDivineDiscipline(r).locked,false);assert.equal(E.getDivineDiscipline(r).oneTimeRestorationChoice,true);E.setDivineDiscipline(r,'instinct');assert.equal(E.getDivineDiscipline(r).locked,true);
});
test('form and boon learning channels apply as described, and corrections show true before/after totals',()=>{
  const {c}=make();c.partners.kid_goku={xp:0,level:5};c.activePartners=['kid_goku'];const before=E.getLearningBoosts(c);c.partners.kid_goku.level=6;const after=E.getLearningBoosts(c);assert.ok(after.xp-before.xp>=.01);assert.ok(after.tp-before.tp>=.01);c.forms.super_saiyan={xp:800,level:5};c.completedSagas=CATALOG.sagas.map(s=>s.id);c.earnedBands=CATALOG.routes.saiyan.tiers.map(t=>t.bandId);const ordinary=E.getLearningBoosts(c);E.equipForm(c,'super_saiyan');assert.ok(E.getLearningBoosts(c).xp>ordinary.xp);const w=E.logWorkout(c,workout('2026-09-01',60),now);assert.ok(w.receipt.development.after.stats.SPI>w.receipt.development.before.stats.SPI);const edited=E.editWorkout(c,w.id,{entries:workout('2026-09-01',10).entries},now);assert.equal(edited.receipt.development.correction,true);assert.ok(edited.receipt.development.after.stats.SPI<edited.receipt.development.before.stats.SPI);
});
test('four training arcs accept accumulated weeks, avoid compulsory streaks and pay once',()=>{
  const {c}=make();for(let wk=0;wk<6;wk++)for(const day of [0,2,4]){const d=new Date(Date.UTC(2025,0,6+wk*14+day,12));E.logWorkout(c,{date:d.toISOString().slice(0,10),kind:'training',entries:[{exerciseId:'bench_press',sets:[{reps:10,weight:50}]},{exerciseId:'outdoor_run',duration:30,distance:4,sets:[]},{exerciseId:'meditation',duration:5,sets:[]}]},now);}const arcs=E.getTrainingArcs(c);assert.ok(arcs.every(a=>a.complete));const journal=c.journal.filter(e=>e.kind==='training-arc');assert.equal(journal.length,4);const tp=c.tp;E.rebuildCharacter(c);near(c.tp,tp);
});
test('repeated movement rows retain their corresponding receipt durations and do not farm search counts',()=>{
  const {c}=make();E.logWorkout(c,{date:'2026-09-01',entries:[{exerciseId:'meditation',duration:10,sets:[]},{exerciseId:'meditation',duration:20,sets:[]}]},now);const m=trainingMetrics(c);near(m.minutes,30);near(m.meditationMinutes,30);near(m.perExercise.meditation.minutes,30);const earth=E.getDragonBallSets(c)[0];assert.equal(earth.balls[6].requirements[0].current,1);assert.match(earth.balls[6].requirements[0].label,/once per date/);E.logWorkout(c,workout('2026-09-01',10),now);assert.equal(E.getDragonBallSets(c)[0].balls[6].requirements[0].current,1);
});
test('Kami requires actual weekly variety while completed and active legacy arcs are retained without repayment',()=>{
  const {c}=make();for(let wk=0;wk<4;wk++)for(const day of [0,2,4]){const d=new Date(Date.UTC(2025,0,6+wk*7+day,12));E.logWorkout(c,{date:d.toISOString().slice(0,10),entries:[{exerciseId:'bench_press',sets:[{weight:40,reps:10}]}]},now);}assert.equal(E.getTrainingArcs(c).find(a=>a.id==='gravity_chamber').complete,true);assert.equal(E.getTrainingArcs(c).find(a=>a.id==='kamis_lookout').complete,false);
  const source=veteranSource({completedArcs:['gravity_chamber'],activeArc:{id:'nimbus_sprint',startDate:'2025-01-06'},workoutLog:['2025-01-06','2025-01-08','2025-01-10'].map(date=>({date,exercises:[{name:'Outdoor Run',category:'cardio',inputs:{duration:30,distance:5},sets:[]}]}))});const r=migrateLegacy(source).state.characters.fixture;const arcs=E.getTrainingArcs(r);assert.equal(arcs.find(a=>a.id==='gravity_chamber').historicalComplete,true);assert.deepEqual(arcs.find(a=>a.id==='gravity_chamber').reward,{tp:0,ap:0,xp:0});assert.equal(arcs.find(a=>a.id==='nimbus_sprint').qualifyingWeeks,1);assert.equal(arcs.find(a=>a.id==='nimbus_sprint').originalStartDate,'2025-01-06');E.logWorkout(r,workout(),now);assert.ok(!r.journal.some(e=>e.id==='restored:arc:gravity_chamber'));
});
test('legacy search conversion uses original per-workout metrics and respects the original God Ki lock',()=>{
  const source=veteranSource({workoutLog:[0,1].map(()=>({date:'2025-01-06',exercises:[{name:'Bench Press',category:'strength',muscle:'chest',sets:[{weight:40,reps:10}]}]})),dragonBalls:{sets:{earth:{metricBaseline:{}},super:{metricBaseline:{}}},wishHistory:[]}});const c=migrateLegacy(source).state.characters.fixture;near(c.dragonBallSets.earth.creditProgress[4],.4);near(c.dragonBallSets.super.creditProgress[7],0);
});
test('complete story browser includes locked requirements and continuity without marking them read',()=>{
  const {c}=make();const all=E.getAllStoryEntries(c),unlocked=E.getStoryEntries(c);assert.equal(all.length,418);assert.ok(all.length>unlocked.length);assert.ok(all.some(e=>e.locked&&e.reason.length));assert.ok(all.every(e=>e.sourceGroup&&e.continuity));assert.throws(()=>E.markStoryRead(c,all.find(e=>e.locked).id),/unlocked/);
});
test('exercise notes and rest defaults survive validation without changing physical gains',()=>{
  const {state,c}=make();const input=workout();input.entries[0].notes='Slow breathing';input.entries[0].restSeconds=75;const w=E.logWorkout(c,input,now);const restored=validateState(state).characters.fixture.workouts[0];assert.equal(restored.entries[0].notes,'Slow breathing');assert.equal(restored.entries[0].restSeconds,75);assert.deepEqual(restored.receipt.stats,w.receipt.stats);
});
