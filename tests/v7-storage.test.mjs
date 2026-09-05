import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, STORAGE_KEYS } from '../v7/storage.js';
import { createState, createCharacter } from '../v7/engine.js';

function fixture() {
    const state = createState();
    createCharacter(state, { name: 'Hero', routeId: 'earthling', id: 'hero' });
    return state;
}
function localMemory() {
    const items = new Map();
    return { items, fail: false, getItem(key) { return items.get(key) ?? null; }, setItem(key, value) { if (this.fail) throw new Error('Quota exceeded'); items.set(key, value); }, removeItem(key) { items.delete(key); } };
}

/** An asynchronous transactional mock, including rollback, to run production storage code. */
function indexedMemory() {
    const databases = new Map();
    const api = { databases, unavailable: false, failWrites: false, open(name) {
        const request = {};
        queueMicrotask(() => {
            if (api.unavailable) { request.error = new Error('Injected database outage'); request.onerror?.(); return; }
            const isNew = !databases.has(name);
            if (isNew) databases.set(name, { stores: new Map() });
            const data = databases.get(name);
            const db = {
                close() {}, objectStoreNames: { contains: key => data.stores.has(key) },
                createObjectStore(key) { data.stores.set(key, new Map()); },
                transaction(key, mode) {
                    if (!data.stores.has(key)) throw new Error('Unknown store');
                    const working = new Map([...data.stores.get(key)].map(([k, v]) => [k, structuredClone(v)]));
                    let pending = 0, finished = false;
                    const transaction = {
                        error: null,
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
                                            if (mode === 'readwrite') data.stores.set(key, working);
                                            transaction.oncomplete?.();
                                        }
                                    });
                                });
                                return result;
                            };
                            return {
                                get: k => operation(() => structuredClone(working.get(k))),
                                getAll: () => operation(() => [...working.values()].map(value => structuredClone(value))),
                                put: (value, k) => operation(() => { if (api.failWrites) throw new Error('Injected write failure'); working.set(k, structuredClone(value)); return k; }),
                                delete: k => operation(() => working.delete(k))
                            };
                        }
                    };
                    return transaction;
                }
            };
            request.result = db;
            let aborted = false;
            request.transaction = { abort() { aborted = true; databases.delete(name); } };
            if (isNew) request.onupgradeneeded?.();
            if (aborted) { request.error = new Error('No legacy database'); request.onerror?.(); }
            else request.onsuccess?.();
        });
        return request;
    } };
    api.seed = (name, key, value) => {
        if (!databases.has(name)) databases.set(name, { stores: new Map([['saves', new Map()]]) });
        databases.get(name).stores.get('saves').set(key, structuredClone(value));
    };
    return api;
}
function environment() {
    const events = new Map();
    let lockQueue = Promise.resolve();
    return {
        localStorage: localMemory(), indexedDB: indexedMemory(), crypto: globalThis.crypto,
        navigator: { locks: { request(_name, _options, fn) { const next = lockQueue.then(fn, fn); lockQueue = next.catch(() => {}); return next; } } },
        addEventListener(name, fn) { events.set(name, fn); }, removeEventListener(name) { events.delete(name); },
        emit(event) { events.get('storage')?.(event); }
    };
}

test('normal save is verified in IndexedDB and preserves entered draft data on reload', async () => {
    const env = environment();
    const store = createStorage(env);
    assert.equal((await store.loadGame()).state, null);
    const state = fixture();
    state.characters.hero.draft = { date: '2026-09-03', notes: 'Finish the last set', entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 45 }] }], rir: 0 };
    const saved = await store.saveGame(state);
    assert.equal(saved.backend, 'indexedDB');
    assert.equal(saved.state.revision, 1);
    assert.equal(state.revision, 0, 'The caller is not silently mutated');
    const loaded = await createStorage(env).loadGame();
    assert.equal(loaded.state.characters.hero.draft.notes, 'Finish the last set');
    assert.equal(loaded.state.characters.hero.draft.rir, 0);
});

test('newer fallback wins over an older primary after an outage and remains after recovery', async () => {
    const env = environment(); const store = createStorage(env);
    const first = await store.saveGame(fixture());
    env.indexedDB.unavailable = true;
    first.state.characters.hero.name = 'Newest recovery';
    const fallback = await store.saveGame(first.state);
    assert.equal(fallback.backend, 'localStorage-fallback');
    assert.equal(fallback.state.revision, 2);
    env.indexedDB.unavailable = false;
    const reopened = createStorage(env);
    const loaded = await reopened.loadGame();
    assert.equal(loaded.source, 'localStorage-fallback');
    assert.equal(loaded.state.characters.hero.name, 'Newest recovery');
    const next = await reopened.saveGame(loaded.state);
    assert.equal(next.backend, 'indexedDB');
    assert.equal(next.state.revision, 3);
    assert.equal((await createStorage(env).loadGame()).state.characters.hero.name, 'Newest recovery');
});

test('a newer invalid backend is skipped in favor of a valid save', async () => {
    const env = environment(); const store = createStorage(env);
    const saved = await store.saveGame(fixture());
    const corrupt = structuredClone(saved.state); corrupt.revision = 500; corrupt.characters.hero.stats.STR = -1;
    env.localStorage.setItem(STORAGE_KEYS.fallback, JSON.stringify(corrupt));
    const loaded = await store.loadGame();
    assert.equal(loaded.state.revision, 1);
    assert.match(loaded.warning, /damaged/);
});

test('stale secondary tabs cannot overwrite a newer committed revision', async () => {
    const env = environment(); const one = createStorage(env), two = createStorage(env);
    const first = await one.saveGame(fixture());
    const stale = structuredClone((await two.loadGame()).state);
    first.state.characters.hero.name = 'Current';
    await one.saveGame(first.state);
    stale.characters.hero.name = 'Stale';
    await assert.rejects(two.saveGame(stale), error => error.code === 'SAVE_CONFLICT');
    assert.equal((await two.loadGame()).state.characters.hero.name, 'Current');
});

test('save failures reject truthfully; import failure preserves the previous primary', async () => {
    const env = environment(); const store = createStorage(env);
    const saved = await store.saveGame(fixture());
    const candidate = structuredClone(saved.state); candidate.characters.hero.name = 'Must not replace';
    env.indexedDB.failWrites = true; env.localStorage.fail = true;
    await assert.rejects(store.importGame(JSON.stringify(candidate)), /could not be saved/);
    env.indexedDB.failWrites = false; env.localStorage.fail = false;
    assert.equal((await store.loadGame()).state.characters.hero.name, 'Hero');
});

test('import has a recoverable checkpoint and restoration keeps revisions monotonic', async () => {
    const env = environment(); const store = createStorage(env);
    const saved = await store.saveGame(fixture());
    const candidate = fixture(); candidate.characters.hero.name = 'Imported'; candidate.revision = 0;
    const imported = await store.importGame(JSON.stringify(candidate));
    assert.equal(imported.state.revision, saved.state.revision + 1);
    const points = await store.listSnapshots();
    assert.equal(points[0].characters[0].name, 'Hero');
    const restored = await store.restoreSnapshot(points[0].id);
    assert.equal(restored.characters.hero.name, 'Hero');
    assert.ok(restored.revision > imported.state.revision);
    assert.ok((await store.listSnapshots()).some(point => point.characters[0].name === 'Imported'));
});

test('newest valid legacy backend migrates without modifying or deleting either original', async () => {
    const env = environment(); const store = createStorage(env);
    const legacy = { schemaVersion: 33, activeCharacter: 'tim', lastSavedAt: '2026-09-01T12:00:00Z', characters: { tim: { name: 'Old database', race: 'earthling', stats: { STR: 10, END: 7, AGI: 7, VIT: 7, SPI: 7, TEC: 6, GKI: 0 } } } };
    env.indexedDB.seed('dbz-fitness-rpg-v6', 'primary', legacy);
    const fallback = structuredClone(legacy); fallback.lastSavedAt = '2026-09-03T12:00:00Z'; fallback.characters.tim.name = 'New fallback';
    env.localStorage.setItem('dbfitness_save_v6_fallback', JSON.stringify(fallback));
    const loaded = await store.loadGame();
    assert.equal(loaded.state.characters.tim.name, 'New fallback');
    await store.saveGame(loaded.state);
    assert.equal(env.localStorage.getItem('dbfitness_save_v6_fallback'), JSON.stringify(fallback));
    assert.deepEqual(env.indexedDB.databases.get('dbz-fitness-rpg-v6').stores.get('saves').get('primary'), legacy);
});

test('corrupt primaries recover from snapshots; no valid recovery rejects without destroying data', async () => {
    const env = environment(); const store = createStorage(env);
    const first = await store.saveGame(fixture());
    await store.saveGame(first.state);
    env.indexedDB.seed(STORAGE_KEYS.database, 'primary', { broken: true });
    assert.equal((await store.loadGame()).source, 'recovery-snapshot');
    const damaged = environment();
    damaged.localStorage.setItem(STORAGE_KEYS.fallback, '{not json');
    await assert.rejects(createStorage(damaged).loadGame(), /no valid copy/);
    assert.equal(damaged.localStorage.getItem(STORAGE_KEYS.fallback), '{not json');
});

test('external change notifications contain only revision metadata and unsubscribe correctly', () => {
    const env = environment(); const store = createStorage(env); const received = [];
    const unsubscribe = store.subscribeToExternalChanges(value => received.push(value));
    const event = { key: STORAGE_KEYS.signal, newValue: JSON.stringify({ tabId: 'another', revision: 10, savedAt: '2026-09-03T12:00:00Z' }) };
    env.emit(event); assert.equal(received.length, 1);
    unsubscribe(); env.emit(event); assert.equal(received.length, 1);
});

test('fallback-only browsers preserve the prior copy if quota is exhausted', async () => {
    const env = environment(); delete env.indexedDB; delete env.navigator;
    const store = createStorage(env);
    const first = await store.saveGame(fixture());
    assert.equal(first.backend, 'localStorage-fallback');
    env.localStorage.fail = true;
    first.state.characters.hero.name = 'Cannot persist';
    await assert.rejects(store.saveGame(first.state), /could not be saved/);
    env.localStorage.fail = false;
    const loaded = await store.loadGame();
    assert.equal(loaded.state.characters.hero.name, 'Hero');
    assert.equal(loaded.state.revision, 1);
});

test('database-only browsers still save when localStorage is disabled', async () => {
    const env = environment(); delete env.localStorage; delete env.navigator;
    const store = createStorage(env);
    const first = await store.saveGame(fixture());
    assert.equal(first.backend, 'indexedDB');
    assert.equal((await store.loadGame()).state.revision, 1);
});

test('cooperating fallback writers respect the lease when Web Locks are absent', async () => {
    const env = environment(); delete env.indexedDB; delete env.navigator;
    const one = createStorage(env), two = createStorage(env);
    const first = await one.saveGame(fixture());
    const a = structuredClone(first.state), b = structuredClone(first.state);
    a.characters.hero.name = 'Writer A'; b.characters.hero.name = 'Writer B';
    const outcomes = await Promise.allSettled([one.saveGame(a), two.saveGame(b)]);
    assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(item => item.status === 'rejected' && item.reason.code === 'SAVE_CONFLICT').length, 1);
});

test('daily recovery history rotates without truncating the primary game', async () => {
    const env = environment(); const store = createStorage(env);
    let current = fixture();
    for (let day = 1; day <= 15; day++) {
        current.savedAt = `2026-08-${String(day).padStart(2, '0')}T12:00:00Z`;
        env.indexedDB.seed(STORAGE_KEYS.database, 'primary', current);
        current = (await store.saveGame(current)).state;
    }
    const snapshots = await store.listSnapshots();
    assert.equal(snapshots.length, 10);
    assert.ok(snapshots.every(item => item.id.startsWith('snapshot:daily:')));
    assert.equal((await store.loadGame()).state.revision, 15);
    assert.deepEqual((await store.loadGame()).state.characters.hero.stats, current.characters.hero.stats);
});
