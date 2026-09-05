import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { startUpdateChecks } from '../v7/register-worker.js';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function fixture({controlled=true, safe=async()=>true}={}) {
  const events = {}, workerEvents = {}, documentEvents = {}, calls = [];
  const registration = {update:async()=>{calls.push('update');}};
  const env = {
    location:{protocol:'https:',reload:()=>calls.push('reload')},
    navigator:{onLine:true,serviceWorker:{controller:controlled?{}:null,
      addEventListener:(name,fn)=>workerEvents[name]=fn,
      register:async(url,options)=>{calls.push({url,options});return registration;}}},
    document:{readyState:'loading',visibilityState:'visible',addEventListener:(name,fn)=>documentEvents[name]=fn},
    addEventListener:(name,fn)=>events[name]=fn
  };
  const updates=startUpdateChecks({environment:env,beforeReload:async()=>{calls.push('save');return safe();},onDeferred:()=>calls.push('deferred')});
  return {env,events,workerEvents,documentEvents,calls,updates};
}

test('all installed entry points use v7 while manifests preserve the existing app identity',()=>{
  const canonical=read('DragonBall_Fitness_RPG_v7.0.html');
  for(const file of ['index.html','DragonBall_Fitness_RPG_v6.0.html'])assert.equal(read(file),canonical);
  const release=JSON.parse(read('v7/release.json'));
  for(const file of ['manifest.webmanifest','manifest-v6.webmanifest','manifest-v7.webmanifest']){
    const manifest=JSON.parse(read(file));
    assert.equal(manifest.id,'./DragonBall_Fitness_RPG_v6.0.html');
    assert.equal(manifest.start_url,'./DragonBall_Fitness_RPG_v7.0.html');
    assert.equal(manifest.scope,'./');
    assert.ok(release.precache.includes(file));
  }
  assert.ok(release.precache.includes('DragonBall_Fitness_RPG_v6.0.html'));
  for(const file of ['dbz-sw-v5.0.js','dbz-sw-v6.0.js'])assert.ok(read(file).includes(`importScripts('./dbz-sw-v7.js?build=${release.build}')`));
});

test('installed apps check on launch and return online without re-registering on every focus',async()=>{
  const f=fixture(); f.events.load(); await setImmediate();
  assert.deepEqual(f.calls[0],{url:'./dbz-sw-v7.js',options:{scope:'./',updateViaCache:'none'}});
  f.events.focus();await setImmediate();
  assert.equal(f.calls.filter(c=>c==='update').length,1);
  f.events.online();await setImmediate();
  assert.equal(f.calls.filter(c=>c==='update').length,2);
  assert.equal(f.calls.filter(c=>c?.url).length,1);
});

test('an activated update waits for the save and reloads only once',async()=>{
  let releaseSave; const f=fixture({safe:()=>new Promise(resolve=>releaseSave=resolve)});
  f.workerEvents.controllerchange();await setImmediate();
  assert.deepEqual(f.calls,['save']);
  f.workerEvents.controllerchange();await setImmediate();
  assert.deepEqual(f.calls,['save']);
  releaseSave(true);await setImmediate();
  assert.deepEqual(f.calls,['save','reload']);
  assert.equal(await f.updates.applyReady(),false);
});

test('editing or a failed save defers reload and can be retried safely',async()=>{
  let safe=false;const f=fixture({safe:async()=>safe});
  f.workerEvents.controllerchange();await setImmediate();
  assert.deepEqual(f.calls,['save','deferred']);
  safe=true;assert.equal(await f.updates.applyReady(),true);
  assert.deepEqual(f.calls,['save','deferred','save','reload']);
});

test('a rejected save and a hidden page never trigger an immediate reload',async()=>{
  const f=fixture({safe:async()=>{throw Error('Storage failure');}});
  f.workerEvents.controllerchange();await setImmediate();
  assert.deepEqual(f.calls,['save','deferred']);
  const hidden=fixture();hidden.env.document.visibilityState='hidden';
  hidden.workerEvents.controllerchange();await setImmediate();
  assert.deepEqual(hidden.calls,['deferred']);
  hidden.env.document.visibilityState='visible';
  assert.equal(await hidden.updates.applyReady(),true);
});

test('first installation avoids a pointless reload but later updates in the same session still apply',async()=>{
  const f=fixture({controlled:false});
  f.workerEvents.controllerchange();await setImmediate();assert.deepEqual(f.calls,[]);
  f.workerEvents.controllerchange();await setImmediate();assert.deepEqual(f.calls,['save','reload']);
});

test('offline and unsupported environments remain playable',async()=>{
  const f=fixture();f.env.navigator.onLine=false;await f.updates.check(true);assert.deepEqual(f.calls,[]);
  const unavailable=startUpdateChecks({environment:{navigator:{},location:{protocol:'file:'}}});
  await unavailable.check();assert.equal(await unavailable.applyReady(),false);
});
