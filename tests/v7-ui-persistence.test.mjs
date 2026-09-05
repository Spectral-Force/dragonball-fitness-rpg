import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as E from '../v7/engine.js';
import { CATALOG, STATS } from '../v7/catalog.js';
import { createStorage, STORAGE_KEYS } from '../v7/storage.js';
import { cacheArtwork } from '../v7/offline.js';
import { renderDashboard, renderStatSheet, renderGrowthPlot, abilityPicture, equipmentPicture, picture } from '../v7/dashboard.js';
import { FORM_ART, partnerImage, formImage, imagePath, auraColour } from '../v7/art.js';
import { createPlannerUI } from '../v7/planner-ui.js';
import { templateLibrary, normalizeTemplate, workoutFromDay } from '../v7/planner.js';
import { createRestoredUI } from '../v7/restored-ui.js';
import { createLegacyCorrection, getEffectivePhysicalRecord } from '../v7/history-corrections.js';
import { createDraftRecovery } from '../v7/draft-recovery.js';
import { renderFormCombat, renderTierPower } from '../v7/form-ui.js';

const uiSource = fs.readFileSync(new URL('../v7/app.js', import.meta.url), 'utf8').replace(/^import .*;\s*$/gm, '').replace(/\bboot\(\);\s*$/, '');
const copy = value => JSON.parse(JSON.stringify(value));
function memory() {
    const items = new Map();
    return { items, getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) };
}
function fixture() {
    const state = E.createState();
    E.createCharacter(state, { id: 'a', name: 'Character A', routeId: 'earthling' });
    E.createCharacter(state, { id: 'b', name: 'Character B', routeId: 'saiyan' });
    state.activeCharacterId = 'a';
    state.characters.a.draft = { date: E.localDate(), kind: 'training', name: 'Training', notes: 'Saved draft', rpe: null, rir: 0, entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 50 }] }] };
    return state;
}
function fakeElement() {
    return { textContent: '', innerHTML: '', value: '', files: [], dataset: {}, hidden: false, disabled: false,
        classList: { add() {}, remove() {}, toggle() {} }, querySelector() { return fakeElement(); }, focus() {}, setAttribute() {}, remove() {}, addEventListener() {} };
}
function harness(storage, initial, draftSession = memory()) {
    const nodes = new Map(), events = new Map(), timers = new Map(), notifications = [], rewards = [];
    const location = { hash: '#today' };
    const history = { pushState(_state, _title, url) { location.hash = url; }, replaceState(_state, _title, url) { location.hash = url; } };
    let timerId = 0;
    const node = selector => { if (!nodes.has(selector)) nodes.set(selector, fakeElement()); return nodes.get(selector); };
    const document = { documentElement: { dataset: {} }, querySelector: selector=>selector==='dialog[open]'?(document.dialogOpen?node(selector):null):node(selector), querySelectorAll: () => [], getElementById: id => node(`#${id}`),
        addEventListener(name, fn) { events.set(name, fn); }, dispatchEvent() {}, activeElement: null, visibilityState: 'visible' };
    // vm is a separate JavaScript realm; normalize objects at its boundary to model the browser's single realm.
    const S = { ...storage, saveGame: (state, options) => storage.saveGame(copy(state), options), exportGame: state => storage.exportGame(copy(state)) };
    const context = vm.createContext({ E, S, CATALOG, STATS, structuredClone, Date, Promise, initial,
        startUpdateChecks:()=>({check:async()=>{},applyReady:async()=>false}), cacheArtwork, renderDashboard, renderStatSheet, renderGrowthPlot, abilityPicture, equipmentPicture, picture,
        FORM_ART, partnerImage, formImage, imagePath, auraColour, createPlannerUI, templateLibrary, normalizeTemplate, workoutFromDay,
        createLegacyCorrection, getEffectivePhysicalRecord, createDraftRecovery, renderFormCombat, renderTierPower, sessionStorage:draftSession,
        createRestoredUI: host => ({ ...createRestoredUI(host), showReceipt: id => rewards.push({ id, receipt: copy(host.getCharacter().workouts.find(w => w.id === id)?.receipt) }) }),
        CustomEvent: class {}, HTMLImageElement: class {}, crypto: globalThis.crypto,
        FormData: class { constructor(form) { this.values = form.values || {}; } get(key) { return this.values[key] ?? null; } },
        setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); }, setInterval() {}, clearInterval() {},
        document, window: { addEventListener() {}, scrollTo() {}, scrollY: 0, location, history }, console,
        collectNotification: value => notifications.push(value), collectReward: (...args) => rewards.push(args)
    });
    vm.runInContext(`${uiSource}\n
      state=initial;
      render=()=>{};
      notify=collectNotification;
      showReward=collectReward;
      closeDialog=()=>{};
      globalThis.probe={persist,touchDraft,commit,boot,prepareUpdateReload,handleAction,syncPageURL,renderDevelop,renderAdventure,renderRecords,renderTrain,exerciseResults,get:()=>({state,ui}),flush:()=>saveChain,
        setState:value=>state=value};
    `, context);
    return { ...context.probe, node, events, timers, notifications, rewards, location, document,
        async submitImport(text) { node('#import-text').value = text; const form = { id: 'import-form', values: {}, querySelector: () => node('#import-submit') }; return events.get('submit')({ target: form, preventDefault() {} }); }
    };
}

test('completed actions keep the reload route on their actual page', () => {
    const ui = harness(createStorage({ localStorage: memory() }), fixture());
    ui.get().ui.page = 'train'; ui.syncPageURL();
    assert.equal(ui.location.hash, '#train');
    ui.get().state.characters.a.draft = null;
    ui.get().ui.page = 'today'; ui.syncPageURL();
    assert.equal(ui.location.hash, '#today');
    assert.equal(ui.get().state.characters.a.draft, null);
});

test('immediate reload recovers the last typed load and notes before the debounce fires', async () => {
    const local = memory(), session = memory(), storage = createStorage({localStorage:local});
    const saved = (await storage.saveGame(fixture())).state;
    const originalRewards = {xp:saved.characters.a.xp,tp:saved.characters.a.tp,ap:saved.characters.a.ap,stats:copy(saved.characters.a.stats)};
    const first = harness(storage,copy(saved),session);
    first.get().state.characters.a.draft.entries[0].sets[0].weight = 45;
    first.get().state.characters.a.draft.notes = 'Last keystrokes before reload';
    first.touchDraft();
    // No scheduled timer or pagehide promise is executed before the new page starts.
    const reloaded = harness(storage,E.createState(),session);
    await reloaded.boot();
    const c=reloaded.get().state.characters.a;
    assert.equal(c.draft.entries[0].sets[0].weight,45);
    assert.equal(c.draft.notes,'Last keystrokes before reload');
    assert.deepEqual({xp:c.xp,tp:c.tp,ap:c.ap,stats:c.stats},originalRewards);
    const persisted=(await storage.loadGame()).state;
    assert.equal(persisted.characters.a.draft.notes,'Last keystrokes before reload');
    assert.ok(reloaded.notifications.some(text=>text.includes('recovered and saved')));
});

test('every development collection renders real catalog items and the logger excludes rest-only entries', () => {
    const ui = harness(createStorage({ localStorage: memory() }), fixture());
    for (const kind of ['partners', 'equipment', 'abilities', 'race', 'forms']) {
        ui.get().ui.develop = kind;
        const html = ui.renderDevelop();
        assert.ok(html.length > 1000, `${kind} must render its collection or race path`);
        if (kind === 'equipment') {
            assert.match(html, /Weighted Wristbands/);
            assert.match(html, /Gravity Level/);
            assert.doesNotMatch(html, /Level undefined/);
        }
    }
    assert.doesNotMatch(ui.exerciseResults(''), /data-id="rest_day"/);
    for (const render of [ui.renderTrain, ui.renderRecords, ui.renderAdventure]) assert.ok(render().length > 1000);
});

test('every exercise opens compatible inputs and a valid default entry, including holds, mobility and burpees', async () => {
    const ui = harness(createStorage({ localStorage: memory() }), fixture());
    for (const exercise of CATALOG.exercises.filter(ex => ex.type !== 'recovery_rest')) {
        ui.get().state.characters.a.draft = null;
        await ui.handleAction('add-exercise', { dataset: { id: exercise.id } });
        const draft = ui.get().state.characters.a.draft;
        assert.doesNotThrow(() => E.validateWorkout(draft), exercise.name);
        const html = ui.renderTrain();
        if (exercise.type === 'timed_hold') assert.match(html, new RegExp(`${exercise.name} set 1 seconds`));
        else if (exercise.type.startsWith('cardio_')) {
            assert.match(html, /Duration · minutes/);
            assert.equal(draft.entries[0].sets.length, 0);
            if (exercise.type === 'cardio_duration') assert.doesNotMatch(html, /Distance · km/);
        }
        else assert.match(html, new RegExp(`${exercise.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} set 1 reps`));
    }
});

test('all adventure and records sections render, including granted wish history', () => {
    const ui = harness(createStorage({ localStorage: memory() }), fixture());
    ui.get().state.characters.a.wishes = [{id:'wish-render',type:'training',number:1,cost:350,setId:'earth',name:'Preserved training wish'}];
    for (const section of ['journey','story','expedition']) {
        ui.get().ui.adventure = section;
        const html = ui.renderAdventure();
        assert.ok(html.length > 1000);
        if (section === 'expedition') { assert.match(html, /Wish history/); assert.match(html, /Preserved training wish/); }
    }
    for (const section of ['history','records','body','stats']) {
        ui.get().ui.records = section;
        assert.ok(ui.renderRecords().length > 1000);
    }
});

test('failed boot offers a load retry that leaves unreadable saves untouched', async () => {
    const localStorage = memory();
    const original = '{damaged but potentially recoverable original';
    localStorage.setItem(STORAGE_KEYS.fallback, original);
    const store = createStorage({ localStorage });
    const ui = harness(store, E.createState());
    await ui.boot();
    assert.match(ui.get().ui.error, /no valid copy/);
    const retry = ui.node('#save-error').innerHTML.match(/data-action="([^"]*retry[^"]*)"/)?.[1];
    assert.ok(retry, 'The failed-load screen must expose a retry action');
    await ui.handleAction(retry, { dataset: {} });
    assert.equal(localStorage.getItem(STORAGE_KEYS.fallback), original, 'Retry must never replace the failed save with initial state');
});

test('import flushes a debounced draft into the recovery point before replacing state', async () => {
    const localStorage = memory(), store = createStorage({ localStorage });
    const saved = await store.saveGame(fixture());
    const ui = harness(store, saved.state);
    ui.get().state.characters.a.draft.notes = 'Unsaved last set detail'; ui.touchDraft();
    const imported = fixture(); imported.characters.a.name = 'Imported character';
    await ui.submitImport(store.exportGame(imported));
    assert.equal(ui.get().state.characters.a.name, 'Imported character');
    const snapshots = JSON.parse(localStorage.getItem(STORAGE_KEYS.snapshots));
    assert.ok(snapshots.some(point => point.state.characters.a.draft?.notes === 'Unsaved last set detail'), 'The pre-import recovery must contain the latest draft');
    assert.equal(ui.get().ui.error, '');
    assert.equal(ui.get().ui.migration, null, 'A v7 import must not claim to be a v6 migration');
});

test('restoration flushes a pending draft before preserving the current adventure', async () => {
    const localStorage = memory(), store = createStorage({ localStorage });
    let state = (await store.saveGame(fixture())).state;
    state.characters.a.name = 'Later character'; state = (await store.saveGame(state)).state;
    const point = (await store.listSnapshots())[0];
    const ui = harness(store, state);
    ui.get().state.characters.a.draft.notes = 'Newest pre-restore draft'; ui.touchDraft();
    await ui.handleAction('restore-snapshot', { dataset: { id: point.id } });
    assert.equal(ui.get().state.characters.a.name, 'Character A');
    const snapshots = JSON.parse(localStorage.getItem(STORAGE_KEYS.snapshots));
    assert.ok(snapshots.some(item => item.state.characters.a.draft?.notes === 'Newest pre-restore draft'));
});

test('typing and switching while a save is pending preserve both characters and newest draft', async () => {
    const localStorage = memory(), store = createStorage({ localStorage });
    let release, started; const gate = new Promise(resolve => release = resolve), entered = new Promise(resolve => started = resolve); let calls = 0;
    const delayed = { ...store, async saveGame(state, options) { const saved = await store.saveGame(state, options); if (++calls === 1) { started(); await gate; } return saved; } };
    const ui = harness(delayed, fixture());
    const pending = ui.persist(); await entered;
    ui.get().state.characters.a.draft.notes = 'Typed while saving'; ui.touchDraft();
    const switched = ui.handleAction('switch-character', { dataset: { id: 'b' } });
    release(); await Promise.all([pending, switched]);
    const loaded = (await store.loadGame()).state;
    assert.equal(loaded.activeCharacterId, 'b');
    assert.equal(loaded.characters.a.draft.notes, 'Typed while saving');
    assert.equal(Object.keys(loaded.characters).length, 2);
});

test('double Finish commits one workout and leaves no phantom draft', async () => {
    const localStorage = memory(), store = createStorage({ localStorage });
    const ui = harness(store, fixture());
    await Promise.all([ui.handleAction('finish-workout', { dataset: {} }), ui.handleAction('finish-workout', { dataset: {} })]);
    assert.equal(ui.get().state.characters.a.workouts.length, 1);
    assert.equal(ui.get().state.characters.a.draft, null);
    assert.equal(ui.rewards.length, 1, 'Successful completion opens exactly one saved receipt');
    assert.equal(ui.rewards[0].id, ui.get().state.characters.a.workouts[0].id);
    assert.deepEqual(ui.rewards[0].receipt, copy((await store.loadGame()).state.characters.a.workouts[0].receipt));
});

test('a failed completion save can be retried without awarding the workout twice', async () => {
    const localStorage = memory(), store = createStorage({ localStorage }); let fail = true;
    const flaky = { ...store, saveGame(state, options) { if (fail) return Promise.reject(new Error('Injected quota failure')); return store.saveGame(state, options); } };
    const ui = harness(flaky, fixture());
    await ui.handleAction('finish-workout', { dataset: {} });
    assert.match(ui.get().ui.error, /quota failure/);
    assert.equal(ui.get().state.characters.a.workouts.length, 1);
    assert.equal(ui.rewards.length, 0, 'A failed save must not celebrate an unpersisted workout');
    fail = false; await ui.handleAction('retry-save', { dataset: {} });
    assert.equal((await store.loadGame()).state.characters.a.workouts.length, 1);
});

test('failed boot still permits an explicitly validated backup import', async () => {
    const localStorage = memory(), store = createStorage({ localStorage });
    localStorage.setItem(STORAGE_KEYS.fallback, '{broken');
    let normalSaveCalls = 0;
    const tracked = { ...store, saveGame(state, options) { normalSaveCalls++; return store.saveGame(state, options); } };
    const ui = harness(tracked, E.createState());
    await ui.boot();
    await ui.submitImport(store.exportGame(fixture()));
    assert.equal(ui.get().state.characters.a.name, 'Character A');
    assert.equal(normalSaveCalls, 0, 'Import recovery must not first save an empty startup state');
    assert.equal((await store.loadGame()).state.activeCharacterId, 'a');
});

test('import stops if the latest working draft cannot be protected by a successful save', async () => {
    const localStorage = memory(), store = createStorage({ localStorage });
    const saved = await store.saveGame(fixture());
    const flaky = { ...store, saveGame() { return Promise.reject(new Error('Injected save failure')); } };
    const ui = harness(flaky, saved.state);
    ui.get().state.characters.a.draft.notes = 'Must not discard this draft'; ui.touchDraft();
    const imported = fixture(); imported.characters.a.name = 'Replacement';
    await ui.submitImport(store.exportGame(imported));
    assert.equal(ui.get().state.characters.a.name, 'Character A');
    assert.equal(ui.get().state.characters.a.draft.notes, 'Must not discard this draft');
    assert.equal((await store.loadGame()).state.characters.a.name, 'Character A');
});

test('update reload saves the working draft but waits for boot, dialogs, editors and unsafe operations', async()=>{
    const local=memory(), app=harness(createStorage({localStorage:local}),fixture());
    assert.equal(await app.prepareUpdateReload(),false);
    app.get().ui.booted=true;
    for(const flag of ['replacing','finishing','fatalLoad']){
        app.get().ui[flag]=true;assert.equal(await app.prepareUpdateReload(),false,flag);app.get().ui[flag]=false;
    }
    app.document.dialogOpen=true;assert.equal(await app.prepareUpdateReload(),false);app.document.dialogOpen=false;
    for(const tagName of ['INPUT','TEXTAREA','SELECT']){
        app.document.activeElement={tagName};assert.equal(await app.prepareUpdateReload(),false,tagName);
    }
    app.document.activeElement=null;
    app.get().state.characters.a.draft.notes='Protected before automatic update';app.touchDraft();
    assert.equal(await app.prepareUpdateReload(),true);
    const saved=await createStorage({localStorage:local}).loadGame();
    assert.equal(saved.state.characters.a.draft.notes,'Protected before automatic update');
});

test('update reload refuses storage failure and edits made while its save is pending',async()=>{
    const broken=harness({saveGame:async()=>{throw Error('Disk full');}},fixture());broken.get().ui.booted=true;
    assert.equal(await broken.prepareUpdateReload(),false);assert.match(broken.get().ui.error,/Disk full/);
    let release;const gate=new Promise(resolve=>release=resolve),storage=createStorage({localStorage:memory()});
    const app=harness({...storage,saveGame:async(...args)=>{await gate;return storage.saveGame(...args);}},fixture());
    app.get().ui.booted=true;const update=app.prepareUpdateReload();await Promise.resolve();
    app.get().state.characters.a.draft.notes='Typed during save';app.touchDraft();release();
    assert.equal(await update,false);assert.equal(app.get().state.characters.a.draft.notes,'Typed during save');
    assert.equal(await app.prepareUpdateReload(),true);
});
