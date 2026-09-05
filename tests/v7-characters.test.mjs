import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, createCharacter } from '../v7/engine.js';
import { deleteCharacter, startFresh } from '../v7/characters.js';
import { createStorage } from '../v7/storage.js';
import { createDraftRecovery } from '../v7/draft-recovery.js';
import { blankPlan, planForCharacter } from '../v7/planner.js';

const memory=()=>{const items=new Map();return {getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,v),removeItem:k=>items.delete(k)};};
function fixture(){
  const s=createState();createCharacter(s,{id:'a',name:'First',routeId:'saiyan'});createCharacter(s,{id:'b',name:'Second',routeId:'namekian'});
  s.activeCharacterId='a';s.characters.a.draft={date:'2026-09-05',kind:'training',name:'Protected draft',entries:[],notes:'Old draft'};
  s.templates=[{id:'my-routine',name:'My routine',entries:[]}];s.plan={name:'Four-week plan'};
  return s;
}
test('deleting active and inactive characters preserves the other character and shared routines',()=>{
  const original=fixture(),before=structuredClone(original);
  const active=deleteCharacter(original,'a');assert.deepEqual(original,before);assert.equal(active.activeCharacterId,'b');assert.deepEqual(active.characters.b,before.characters.b);assert.deepEqual(active.templates,before.templates);
  const inactive=deleteCharacter(original,'b');assert.equal(inactive.activeCharacterId,'a');assert.deepEqual(inactive.characters.a,before.characters.a);
  const last=deleteCharacter(active,'b');assert.equal(last.activeCharacterId,null);assert.deepEqual(last.characters,{});
  assert.throws(()=>deleteCharacter(last,'b'),/no longer available/);assert.throws(()=>deleteCharacter(last,'__proto__'),/no longer available/);
});
test('fresh start resets all character progress, carries the save token and supports preserving training setup',()=>{
  const old=fixture();old.revision=14;old.savedAt='2026-09-05T12:00:00Z';old.settings={motion:false,sound:true,migrationDismissed:true};old.migration={original:{private:'Legacy evidence'}};
  for(const keepTrainingSetup of [true,false]){
    const next=startFresh(old,{keepTrainingSetup});assert.equal(next.revision,14);assert.equal(next.savedAt,old.savedAt);assert.equal(next.activeCharacterId,null);assert.deepEqual(next.characters,{});assert.equal(next.migration,null);assert.deepEqual(next.settings,{motion:false,sound:true});
    assert.deepEqual(next.templates,keepTrainingSetup?old.templates:[]);assert.deepEqual(next.plan,keepTrainingSetup?planForCharacter(old.characters.a,old):{});
  }
  assert.equal(Object.keys(old.characters).length,2);
});
test('keeping training setup carries the active character plan and load settings into the new origin',()=>{
  const old=fixture(),plan=blankPlan();plan.name='My personal training';plan.oneRepMaxes={'Bench Press':85};plan.weeks[0].days[0].notes='My weekly cues';
  old.characters.a.fitnessPlan=plan;
  const next=startFresh(old,{keepTrainingSetup:true});createCharacter(next,{name:'A new origin',routeId:'majin'});
  const kept=planForCharacter(next.characters[next.activeCharacterId],next);
  assert.equal(kept.name,plan.name);assert.equal(kept.oneRepMaxes['Bench Press'],85);assert.equal(kept.weeks[0].days[0].notes,'My weekly cues');
  assert.equal(next.characters[next.activeCharacterId].xp,0);assert.deepEqual(next.characters[next.activeCharacterId].workouts,[]);
});
test('empty v7 after last-character deletion wins over legacy saves and can restore its recovery snapshot',async()=>{
  const localStorage=memory(),storage=createStorage({localStorage});
  const legacy={schemaVersion:33,characters:{legacy:{name:'Old hero',race:'saiyan',stats:{STR:10,END:7,AGI:7,VIT:7,SPI:7,TEC:6,GKI:0}}},activeCharacter:'legacy'};
  localStorage.setItem('dbfitness_save',JSON.stringify(legacy));
  const previous=(await storage.saveGame(fixture())).state;
  const next=deleteCharacter(deleteCharacter(previous,'a'),'b');
  await storage.saveGame(next,{checkpoint:true,requireCheckpoint:true});
  const loaded=await createStorage({localStorage}).loadGame();assert.deepEqual(loaded.state.characters,{});assert.equal(loaded.state.activeCharacterId,null);assert.equal(localStorage.getItem('dbfitness_save'),JSON.stringify(legacy));
  const snapshots=await storage.listSnapshots(),manual=snapshots.find(s=>s.id.startsWith('snapshot:manual:'));
  const restored=await storage.restoreSnapshot(manual.id);assert.deepEqual(restored.characters.a,previous.characters.a);assert.deepEqual(restored.characters.b,previous.characters.b);
});
test('fresh starts cannot recover deleted drafts or overwrite a newer save from another tab',async()=>{
  const localStorage=memory(),sessionStorage=memory(),storage=createStorage({localStorage});
  const previous=(await storage.saveGame(fixture())).state;
  const drafts=createDraftRecovery({sessionStorage});previous.characters.a.draft.notes='Final old keystrokes';assert.equal(drafts.checkpoint(previous,'a').ok,true);
  const reset=(await storage.saveGame(startFresh(previous),{checkpoint:true,requireCheckpoint:true})).state;
  const recovered=drafts.recover(reset);assert.deepEqual(recovered.recovered,[]);assert.deepEqual(recovered.state.characters,{});
  createCharacter(reset,{name:'First',routeId:'saiyan'});assert.notEqual(reset.activeCharacterId,'a');assert.deepEqual(drafts.recover(reset).recovered,[]);
  await assert.rejects(storage.saveGame(deleteCharacter(previous,'a'),{checkpoint:true,requireCheckpoint:true}),/Another tab/);
});
