import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildManifest, serviceWorkerSource, OPTIONAL_ART_CACHE, VISITED_ART_CACHE } from '../analysis/build_v7_release.mjs';
const root=new URL('../',import.meta.url);
const workerSource=()=>serviceWorkerSource(buildManifest());
const origin='https://example.test/game/';

function worker(){
 const listeners={},maps=new Map();let online=true,claimed=false;
 const key=r=>new URL(typeof r==='string'?r:r.url,origin).href;
 const caches={
   async open(name){if(!maps.has(name))maps.set(name,new Map());const map=maps.get(name);return {
    async addAll(urls){for(const url of urls){if(!online)throw Error('offline');map.set(key(url),new Response('cached:'+url));}},
    async match(url){return map.get(key(url))?.clone();},
    async put(url,response){map.set(key(url),response.clone());},
    async keys(){return [...map.keys()].map(url=>new Request(url));},
    async delete(url){return map.delete(key(url));}
   };},async keys(){return [...maps.keys()];},async delete(name){return maps.delete(name);}
 };
 const context=vm.createContext({URL,Response,Request,caches,fetch:async request=>{if(!online)throw Error('offline');return new Response('network:'+key(request));},self:{location:new URL(origin),addEventListener:(type,fn)=>listeners[type]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}}});
 vm.runInContext(workerSource(),context);
 async function lifecycle(type){const waits=[];listeners[type]({waitUntil:p=>waits.push(p)});await Promise.all(waits);}
 async function request(file,mode,cache){const waits=[];let response;listeners.fetch({request:{url:new URL(file,origin).href,method:'GET',mode:mode||'cors',cache},respondWith:p=>response=p,waitUntil:p=>waits.push(p)});const result=await response;await Promise.all(waits);return result;}
 return {caches,maps,lifecycle,request,offline(){online=false;},get claimed(){return claimed;}};
}

test('v7 installs its complete shell and claims old controlled tabs',async()=>{
 const w=worker();await w.lifecycle('install');await w.lifecycle('activate');assert.equal(w.claimed,true);
 const release=buildManifest();
 const shell=await w.caches.open('dbz-v7-shell-'+release.build);
 assert.equal((await shell.keys()).length,new Set(release.precache.map(file=>new URL(file,origin).href)).size);
});
test('offline navigations, modules and precached artwork all resolve',async()=>{
 const w=worker();await w.lifecycle('install');w.offline();
 for(const [file,mode] of [['unknown-route','navigate'],['DragonBall_Fitness_RPG_v6.0.html','navigate'],['manifest-v6.webmanifest'],['v7/catalog.js'],['v7/rules-v1/engine.js'],['v7/rules-v1/catalog.js'],['v7/planner-ui.js'],['images/v7/mountain-dawn-mobile.webp?h=old'],['images/v6/v6_hero.webp']]){
  const response=await w.request(file,mode);assert.equal(response.status,200,file);assert.match(await response.text(),/^cached:/);
 }
});
test('visited collection art is available offline under its canonical URL',async()=>{
 const w=worker();await w.lifecycle('install');await w.request('images/partners/vegeta.webp?v=7');w.offline();
 const response=await w.request('images/partners/vegeta.webp?v=8');assert.equal(response.status,200);assert.match(await response.text(),/^network:/);
});
test('activation removes only obsolete v7 shell caches',async()=>{
 const w=worker();await w.caches.open('dbz-v7-shell-old');await w.caches.open('dbz-v6-personal');await w.lifecycle('install');await w.lifecycle('activate');
 assert.equal(w.maps.has('dbz-v7-shell-old'),false);assert.equal(w.maps.has('dbz-v6-personal'),true);
});

test('visiting more artwork never evicts the explicitly downloaded full illustration pack', async()=>{
 const w=worker();await w.lifecycle('install');const pack=await w.caches.open(OPTIONAL_ART_CACHE);
 await pack.put(new URL('images/v7/tech-kamehameha.webp',origin).href,new Response('downloaded full-pack art'));
 for(let i=0;i<110;i++)await w.request(`images/partners/test-visit-${i}.webp`);
 assert.equal((await pack.keys()).length,1);
 assert.equal((await (await w.caches.open(VISITED_ART_CACHE)).keys()).length,96);
 w.offline();const response=await w.request('images/v7/tech-kamehameha.webp');assert.equal(await response.text(),'downloaded full-pack art');
});

test('explicit artwork reload refreshes a saved image instead of returning its old cached bytes',async()=>{
 const w=worker();await w.lifecycle('install');const pack=await w.caches.open(OPTIONAL_ART_CACHE);
 await pack.put(new URL('images/v7/tech-ki.webp',origin).href,new Response('old bytes'));
 const response=await w.request('images/v7/tech-ki.webp',undefined,'reload');assert.match(await response.text(),/^network:/);
 assert.match(await (await pack.match(new URL('images/v7/tech-ki.webp',origin).href)).text(),/^network:/);
});
