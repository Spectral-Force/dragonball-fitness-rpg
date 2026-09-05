import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as E from '../v7/engine.js';
import { createStorage, STORAGE_KEYS } from '../v7/storage.js';
import { createDraftRecovery } from '../v7/draft-recovery.js';

const LEGACY_DATABASE = 'dbz-fitness-rpg-v6';
const LEGACY_KEYS = ['dbfitness_save_v6_fallback', 'dbfitness_save', 'dbfitness_save_pointer', 'dbfitness_pre_schema_33'];
function memory() {
    const items = new Map();
    return { items, fail: false, getItem: key => items.get(key) ?? null,
        setItem(key, value) { if (this.fail) throw new Error('Injected quota failure'); items.set(key, value); },
        removeItem: key => items.delete(key) };
}

// A narrow read/write IndexedDB double records every transaction against the old
// database, including attempts that would otherwise leave the same final bytes.
function databaseMemory() {
    const databases = new Map(), transactions = [];
    const api = { databases, transactions, failWrites: false, open(name) {
        const request = {};
        queueMicrotask(() => {
            const isNew = !databases.has(name);
            if (isNew) databases.set(name, new Map());
            const stores = databases.get(name);
            request.result = {
                close() {}, objectStoreNames: { contains: key => stores.has(key) },
                createObjectStore(key) { stores.set(key, new Map()); },
                transaction(key, mode) {
                    transactions.push({ name, key, mode });
                    if (!stores.has(key)) throw new Error('Unknown object store');
                    const working = new Map([...stores.get(key)].map(([k, v]) => [k, structuredClone(v)]));
                    let pending = 0, finished = false;
                    const transaction = { error: null,
                        abort() { if (finished) return; finished = true; queueMicrotask(() => transaction.onabort?.()); },
                        objectStore() {
                            const operation = fn => {
                                const result = {}; pending++;
                                queueMicrotask(() => {
                                    if (finished) return;
                                    try { result.result = fn(); result.onsuccess?.(); }
                                    catch (error) { result.error = error; transaction.error = error; result.onerror?.(); transaction.abort(); }
                                    pending--;
                                    queueMicrotask(() => {
                                        if (!pending && !finished) {
                                            finished = true;
                                            if (mode === 'readwrite') stores.set(key, working);
                                            transaction.oncomplete?.();
                                        }
                                    });
                                });
                                return result;
                            };
                            return {
                                get: key => operation(() => structuredClone(working.get(key))),
                                getAll: () => operation(() => [...working.values()].map(value => structuredClone(value))),
                                put: (value, key) => operation(() => { if (api.failWrites) throw new Error('Injected database write failure'); working.set(key, structuredClone(value)); return key; }),
                                delete: key => operation(() => working.delete(key))
                            };
                        }
                    };
                    return transaction;
                }
            };
            let aborted = false;
            request.transaction = { abort() { aborted = true; databases.delete(name); } };
            if (isNew) request.onupgradeneeded?.();
            if (aborted) { request.error = new Error('Legacy database does not exist'); request.onerror?.(); }
            else request.onsuccess?.();
        });
        return request;
    } };
    api.seed = (name, key, value) => {
        if (!databases.has(name)) databases.set(name, new Map([['saves', new Map()]]));
        databases.get(name).get('saves').set(key, structuredClone(value));
    };
    return api;
}

function legacy(name = 'Upgrade fixture', date = '2026-09-01T12:00:00Z') {
    return { version: '6.4.0', schemaVersion: 33, lastSavedAt: date, activeCharacter: 'hero',
        characters: { hero: {
            name, race: 'saiyan', stats: { STR: 100, END: 70, AGI: 60, VIT: 50, SPI: 40, TEC: 30, GKI: 0 },
            totalTXP: 5400, trainingPoints: 1300, tpSpent: 240, abilityPointsEarned: 90, abilityPointsSpent: 20,
            ownedPartners: ['bulma'], activePartners: ['bulma'], partnerLevels: { bulma: { level: 6, totalXp: 500 } },
            workoutLog: [{ date: '2026-09-01', totalTXP: 400, notes: 'Synthetic migration test record', exercises: [{ name: 'Bench Press', sets: [{ reps: 10, weight: 50 }] }] }],
            unknownArchivedField: { retained: true }
        } }
    };
}
function environment() { return { localStorage: memory(), indexedDB: databaseMemory() }; }
function oldContents(env) {
    return { local: LEGACY_KEYS.map(key => [key, env.localStorage.getItem(key)]), database: structuredClone(env.indexedDB.databases.get(LEGACY_DATABASE)) };
}
function assertLegacyUntouched(env, original) {
    assert.deepEqual(oldContents(env), original);
    assert.ok(env.indexedDB.transactions.filter(t => t.name === LEGACY_DATABASE).every(t => t.mode === 'readonly'));
}

// Run the exact production boot and persistence functions. DOM rendering is
// stubbed; migration, validation, draft recovery and durable saves are real.
const appSource = fs.readFileSync(new URL('../v7/app.js', import.meta.url), 'utf8');
const bootSource = appSource.split(/\r?\n/).find(line => line.startsWith('async function boot()'));
const persistSource = appSource.split(/\r?\n/).find(line => line.startsWith('function persist()'));
function bootHarness(S) {
    assert.ok(bootSource && persistSource);
    const context = vm.createContext({ S, E, Date, Promise, clearTimeout, setInterval, createDraftRecovery,
        render() {}, saveIndicator() {}, notify() {}, updateTimer() {}, pageFromLocation: () => 'today', appUpdates: {applyReady: async()=>false} });
    vm.runInContext(`let state=E.createState(), ui={fatalLoad:false}, epoch=0, saveChain=Promise.resolve(), draftTimeout, timerInterval;
        const draftRecovery=createDraftRecovery({});
        const character=()=>state.characters[state.activeCharacterId];
        const settings=()=>state.settings;
        ${persistSource}
        ${bootSource}
        globalThis.probe={boot,persist,get:()=>({state,ui})};`, context);
    return context.probe;
}

test('installed v6 first boot chooses the newest valid legacy backend, saves v7 automatically, and never writes legacy storage', async () => {
    const env = environment();
    env.indexedDB.seed(LEGACY_DATABASE, 'primary', legacy('IndexedDB copy'));
    env.indexedDB.seed(LEGACY_DATABASE, 'snapshot:2026-08-01T12:00:00Z', legacy('Retained historical snapshot', '2026-08-01T12:00:00Z'));
    env.indexedDB.seed(LEGACY_DATABASE, 'pre-migration:schema-33:from-32', legacy('Retained pre-schema snapshot'));
    env.localStorage.setItem(LEGACY_KEYS[0], JSON.stringify(legacy('Fallback copy', '2026-09-02T12:00:00Z')));
    const newest = legacy('Newest local legacy copy', '2026-09-03T12:00:00Z');
    env.localStorage.setItem(LEGACY_KEYS[1], JSON.stringify(newest));
    env.localStorage.setItem(LEGACY_KEYS[2], JSON.stringify({ backend: 'indexedDB', savedAt: '2026-09-01T12:00:00Z' }));
    env.localStorage.setItem(LEGACY_KEYS[3], JSON.stringify(legacy('Retained local pre-schema snapshot')));
    const original = oldContents(env), storage = createStorage(env), app = bootHarness(storage);
    await app.boot();
    assert.equal(app.get().ui.fatalLoad, false);
    const loaded = await createStorage(env).loadGame();
    assert.equal(loaded.source, 'indexedDB');
    assert.equal(loaded.state.revision, 1);
    assert.equal(loaded.state.characters.hero.name, newest.characters.hero.name);
    assert.equal(loaded.state.characters.hero.tp, 1060);
    assert.equal(loaded.state.characters.hero.ap, 70);
    assert.deepEqual(loaded.state.migration.original, newest);
    assertLegacyUntouched(env, original);
});

test('a failed migration commit remains retryable in memory and leaves every original recoverable', async () => {
    const env = environment(), source = legacy();
    env.indexedDB.seed(LEGACY_DATABASE, 'primary', source);
    env.localStorage.setItem(LEGACY_KEYS[0], JSON.stringify(source));
    const original = oldContents(env);
    env.indexedDB.failWrites = true; env.localStorage.fail = true;
    const app = bootHarness(createStorage(env));
    await app.boot();
    assert.equal(app.get().ui.fatalLoad, false);
    assert.equal(app.get().ui.saveStatus, 'Changes not saved');
    assert.match(app.get().ui.error, /could not be saved/);
    assert.deepEqual(app.get().state.migration.original, source);
    assertLegacyUntouched(env, original);
    env.indexedDB.failWrites = false; env.localStorage.fail = false;
    assert.equal(await app.persist(), true);
    assert.equal((await createStorage(env).loadGame()).state.characters.hero.xp, 5400);
    assertLegacyUntouched(env, original);
});

test('reopening v7 preserves later progress instead of reimporting a newer legacy timestamp or repeating archived rewards', async () => {
    const env = environment(), source = legacy();
    env.indexedDB.seed(LEGACY_DATABASE, 'primary', source);
    await bootHarness(createStorage(env)).boot();
    const storage = createStorage(env), saved = await storage.loadGame();
    saved.state.characters.hero.name = 'Continued in v7';
    E.logWorkout(saved.state.characters.hero, { date: '2026-09-02', name: 'New v7 training', kind: 'training', entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 50 }] }] });
    const continued = (await storage.saveGame(saved.state)).state;
    env.indexedDB.seed(LEGACY_DATABASE, 'primary', legacy('A stale old app saved later', '2026-09-04T12:00:00Z'));
    const reopened = bootHarness(createStorage(env));
    await reopened.boot();
    const actual = reopened.get().state.characters.hero, expected = continued.characters.hero;
    assert.equal(actual.name, 'Continued in v7');
    for (const key of ['xp', 'tp', 'ap', 'stats', 'workouts']) assert.deepEqual(actual[key], expected[key], key);
    assert.deepEqual(reopened.get().state.migration.original, source);
});

test('fallback-only migration survives reload, archive export and local quota failure without touching v6', async () => {
    const localStorage = memory(), source = legacy();
    localStorage.setItem(LEGACY_KEYS[0], JSON.stringify(source));
    const storage = createStorage({ localStorage }), app = bootHarness(storage);
    await app.boot();
    const loaded = await createStorage({ localStorage }).loadGame();
    assert.equal(loaded.source, 'localStorage-fallback');
    assert.deepEqual(JSON.parse(storage.exportGame(loaded.state)).migration.original, source);
    const durable = localStorage.getItem(STORAGE_KEYS.fallback);
    localStorage.fail = true;
    assert.equal(await app.persist(), false);
    assert.equal(localStorage.getItem(STORAGE_KEYS.fallback), durable);
    assert.equal(localStorage.getItem(LEGACY_KEYS[0]), JSON.stringify(source));
});

test('a malformed newest legacy candidate is skipped and unreadable legacy saves fail closed without initial-state writes', async () => {
    const env = environment(), source = legacy();
    env.indexedDB.seed(LEGACY_DATABASE, 'primary', source);
    env.localStorage.setItem(LEGACY_KEYS[0], JSON.stringify({ ...legacy('Unsupported future save', '2026-09-04T12:00:00Z'), schemaVersion: 999 }));
    env.localStorage.setItem(LEGACY_KEYS[1], '{damaged legacy data');
    const original = oldContents(env);
    await bootHarness(createStorage(env)).boot();
    assert.equal((await createStorage(env).loadGame()).state.characters.hero.name, source.characters.hero.name);
    assertLegacyUntouched(env, original);
    const broken = environment();
    broken.localStorage.setItem(LEGACY_KEYS[1], '{only damaged legacy data');
    const failed = bootHarness(createStorage(broken));
    await failed.boot();
    assert.equal(failed.get().ui.fatalLoad, true);
    assert.match(failed.get().ui.error, /no valid copy/);
    assert.equal(await failed.persist(), false);
    assert.equal(broken.localStorage.getItem(LEGACY_KEYS[1]), '{only damaged legacy data');
    assert.equal(broken.localStorage.getItem(STORAGE_KEYS.fallback), null);
    assert.ok(!broken.indexedDB.transactions.some(t => t.mode === 'readwrite'));
});
