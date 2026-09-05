import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildManifest, walkFiles, PROJECT_ROOT, SHELL_BUDGET_BYTES } from '../analysis/build_v7_release.mjs';
import { getArtworkPaths, cacheArtwork, ART_CACHE } from '../v7/offline.js';
import { FORM_ART, ABILITY_ART } from '../v7/art.js';

test('read-only manifest inspection includes recursive reward-rule modules without rebuilding the release',()=>{
 const watched=['v7/release.json','dbz-sw-v7.js','index.html'];
 const before=watched.map(file=>fs.readFileSync(path.join(PROJECT_ROOT,file),'utf8'));
 const report=buildManifest();
 assert.ok(report.precache.includes('v7/rules-v1/engine.js'));assert.ok(report.precache.includes('v7/rules-v1/catalog.js'));
 assert.ok(report.precache.includes('v7/planner-ui.js'));assert.ok(report.precache.includes('v7/planner.css'));
 assert.deepEqual(watched.map(file=>fs.readFileSync(path.join(PROJECT_ROOT,file),'utf8')),before);
 assert.ok(report.precacheBytes<SHELL_BUDGET_BYTES,`${report.precacheBytes} bytes`);
});

test('all relative JavaScript imports are included in the planned installed shell',()=>{
 const report=buildManifest();
 for(const file of report.runtimeModules.filter(file=>file.endsWith('.js'))){
   const source=fs.readFileSync(path.join(PROJECT_ROOT,file),'utf8');
   for(const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](\.[^'"]+)['"]/g)){
     const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));
     assert.ok(report.precache.includes(target),`${file} imports ${target}`);
   }
 }
});

test('collection key art ships as optional responsive WebP without installing generation masters',()=>{
 const report=buildManifest(),all=walkFiles(path.join(PROJECT_ROOT,'images/v7'),'images/v7');
 for(const file of all.filter(file=>/\/(form|tech)-.*\.webp$/.test(file))){assert.ok(report.optionalArt.includes(file),file);assert.ok(!report.precache.includes(file),file);}
 assert.ok(!report.precache.some(file=>file.startsWith('images/v7/')&&file.endsWith('.png')));
});

test('full-art inventory includes every semantic form and ability assignment with responsive collection variants',()=>{
 const paths=getArtworkPaths();
 for(const raw of [...Object.values(FORM_ART),...Object.values(ABILITY_ART).map(a=>a.art)]){
   assert.ok(paths.includes(raw),raw);
   if(/^images\/v7\/(form|tech)-/.test(raw))assert.ok(paths.includes(raw.replace(/\.webp$/,'-mobile.webp')),raw);
 }
 assert.equal(paths.length,new Set(paths).size);
 assert.ok(paths.includes('images/v7/portrait-namekian-mobile.webp'));
 assert.ok(paths.includes('images/partners/frieza_final_form_5%.webp'));
});

test('optional art download caches the full registry and encodes percent filenames exactly once',async()=>{
 const old={caches:globalThis.caches,fetch:globalThis.fetch,document:globalThis.document};
 const saved=new Map(),requests=[];let cacheName;
 globalThis.document={baseURI:'https://example.test/game/'};
 globalThis.caches={open:async name=>{cacheName=name;return{match:async url=>saved.get(url),put:async(url,response)=>saved.set(url,response)}}};
 globalThis.fetch=async url=>{requests.push(url);return new Response('image bytes')};
 try{
   const report=await cacheArtwork();assert.equal(cacheName,ART_CACHE);assert.equal(report.total,getArtworkPaths().length);assert.equal(report.downloaded,report.total);assert.deepEqual(report.failures,[]);
   assert.ok(requests.some(url=>url.endsWith('/frieza_final_form_5%25.webp')));assert.ok(!requests.some(url=>url.includes('%2525')));
   const again=await cacheArtwork();assert.equal(again.downloaded,0);assert.equal(requests.length,report.total);
 }finally{Object.assign(globalThis,old)}
});
