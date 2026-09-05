import { validateState, migrateLegacy, MAX_SAVE_BYTES } from './migration.js';

export { validateState, migrateLegacy } from './migration.js';
export const STORAGE_KEYS = Object.freeze({ database: 'dbz-fitness-rpg-v7', store: 'saves', primary: 'primary', fallback: 'dbfitness_save_v7_fallback', snapshots: 'dbfitness_save_v7_snapshots', signal: 'dbfitness_save_v7_signal', lease: 'dbfitness_save_v7_lease' });
const LEGACY_KEYS = ['dbfitness_save_v6_fallback', 'dbfitness_save'];
const clone = value => JSON.parse(JSON.stringify(value));
const newest = values => values.sort((a, b) => b.state.revision - a.state.revision || Date.parse(b.state.savedAt || 0) - Date.parse(a.state.savedAt || 0))[0] || null;
const timestamp = state => Date.parse(state?.savedAt || state?.lastSavedAt || state?.migration?.migratedAt || '') || 0;
const conflict = () => Object.assign(new Error('Another tab has saved a newer game. Export this tab as a backup, then reload the latest save before continuing.'), { code: 'SAVE_CONFLICT' });

function parseCandidate(value, source) {
    try {
        const wrapper = typeof value === 'string' ? JSON.parse(value) : value;
        if (!wrapper) return null;
        const state = validateState(wrapper.format === 'dbz-fitness-rpg-v7' ? wrapper.state : wrapper);
        if (wrapper.format === 'dbz-fitness-rpg-v7' && (wrapper.revision !== state.revision || wrapper.savedAt !== state.savedAt)) return null;
        return { state, source, envelope: wrapper };
    } catch { return null; }
}

/** Environment injection keeps the actual persistence algorithm testable without a browser. */
export function createStorage(environment = globalThis) {
    const env = environment;
    let queue = Promise.resolve();
    let lastLoaded = null;
    const listeners = new Set();
    const token = () => env.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    const tabId = token();
    const getLocal = key => { try { return env.localStorage?.getItem(key) ?? null; } catch { return null; } };
    const setLocal = (key, value) => {
        if (!env.localStorage) throw new Error('Local browser storage is unavailable.');
        env.localStorage.setItem(key, value);
    };

    function openDatabase(name = STORAGE_KEYS.database, legacy = false) {
        return new Promise((resolve, reject) => {
            if (!env.indexedDB) return reject(new Error('IndexedDB is unavailable.'));
            let settled = false;
            const timer = setTimeout(() => finish(new Error('The save database is blocked. Close other versions of the game and try again.')), 4000);
            const finish = (error, db) => {
                if (settled) { db?.close(); return; }
                settled = true;
                clearTimeout(timer);
                if (error) reject(error); else resolve(db);
            };
            let request;
            try { request = env.indexedDB.open(name, 1); } catch (error) { finish(error); return; }
            request.onupgradeneeded = () => {
                if (legacy) { request.transaction.abort(); return; }
                const db = request.result;
                if (!db.objectStoreNames.contains(STORAGE_KEYS.store)) db.createObjectStore(STORAGE_KEYS.store);
            };
            request.onsuccess = () => finish(null, request.result);
            request.onerror = () => finish(request.error || new Error('The database could not be opened.'));
            request.onblocked = () => finish(new Error('The save database is blocked by another tab.'));
        });
    }

    async function readDatabase(name = STORAGE_KEYS.database, all = false) {
        const db = await openDatabase(name, name !== STORAGE_KEYS.database);
        try {
            return await new Promise((resolve, reject) => {
                let transaction;
                try { transaction = db.transaction(STORAGE_KEYS.store, 'readonly'); } catch (error) { reject(error); return; }
                const store = transaction.objectStore(STORAGE_KEYS.store);
                const request = all ? store.getAll() : store.get(STORAGE_KEYS.primary);
                request.onsuccess = () => resolve(request.result || (all ? [] : null));
                request.onerror = () => reject(request.error || new Error('The save could not be read.'));
            });
        } finally { db.close(); }
    }

    async function candidates() {
        const failures = [];
        let database = null;
        try { database = await readDatabase(); } catch (error) { failures.push(error.message); }
        const localRaw = getLocal(STORAGE_KEYS.fallback);
        const values = [parseCandidate(database, 'indexedDB'), parseCandidate(localRaw, 'localStorage-fallback')].filter(Boolean);
        const invalid = !!database && !values.some(item => item.source === 'indexedDB') || !!localRaw && !values.some(item => item.source === 'localStorage-fallback');
        return { values, failures, invalid };
    }

    async function loadGame() {
        const current = await candidates();
        const selected = newest(current.values);
        if (selected) {
            lastLoaded = clone(selected.state);
            const warnings = [];
            if (current.invalid) warnings.push('A damaged save copy was skipped. A valid copy was loaded.');
            if (selected.source === 'localStorage-fallback') warnings.push('Loaded the newest local recovery copy.');
            if (current.failures.length) warnings.push(current.failures[0]);
            return { state: selected.state, source: selected.source, migrationReport: selected.state.migration ? { ...selected.state.migration, original: undefined } : undefined, warning: warnings.join(' ') || undefined };
        }
        // A corrupt primary must not hide a recoverable v7 snapshot.
        const snapshots = await snapshotCandidates();
        const recovered = newest(snapshots);
        if (recovered) {
            lastLoaded = clone(recovered.state);
            return { state: recovered.state, source: 'recovery-snapshot', warning: 'The primary copies could not be used. A saved recovery point was loaded; review the history before saving.' };
        }
        const legacy = [];
        let oldDatabase;
        try { oldDatabase = await readDatabase('dbz-fitness-rpg-v6'); } catch { /* A missing v6 database is normal. */ }
        for (const [source, raw] of [['v6-indexedDB', oldDatabase], ...LEGACY_KEYS.map(key => [key, getLocal(key)])]) {
            if (!raw) continue;
            try {
                const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
                const migrated = migrateLegacy(value);
                legacy.push({ ...migrated, source, timestamp: timestamp(value) });
            } catch { /* Try every backend before rejecting an old save. */ }
        }
        legacy.sort((a, b) => b.timestamp - a.timestamp);
        if (legacy.length) {
            lastLoaded = null;
            return { state: legacy[0].state, source: legacy[0].source, migrationReport: legacy[0].report, warning: 'Migration is ready in memory. Save v7 to commit it; the original v6 save remains untouched.' };
        }
        const hasUnusableData = current.invalid || !!oldDatabase || LEGACY_KEYS.some(key => !!getLocal(key));
        if (hasUnusableData) throw new Error('Saved data exists but no valid copy could be loaded. Your existing saves were left untouched. Import a known backup or use another browser profile.');
        return { state: null, source: 'new', warning: current.failures.length ? 'Browser database is unavailable. A local fallback will be used if saving is permitted.' : undefined };
    }

    function makeEnvelope(state, extra = {}) {
        return { format: 'dbz-fitness-rpg-v7', schemaVersion: 70, revision: state.revision, savedAt: state.savedAt, commitId: token(), state, ...extra };
    }
    function meaningfulSnapshot(previous, manual) {
        if (!previous?.savedAt) return null;
        const day = previous.savedAt.slice(0, 10);
        const snapshotId = manual ? `snapshot:manual:${Date.now()}:${token()}` : `snapshot:daily:${day}`;
        return makeEnvelope(clone(previous), { snapshotId, kind: manual ? 'manual' : 'daily' });
    }
    function trimSnapshotValues(values) {
        const valid = values.filter(item => item?.snapshotId && parseCandidate(item, 'snapshot'));
        const byId = new Map(valid.map(item => [item.snapshotId, item]));
        const sorted = [...byId.values()].sort((a, b) => timestamp(b.state) - timestamp(a.state));
        return [...sorted.filter(item => item.kind === 'manual').slice(0, 4), ...sorted.filter(item => item.kind !== 'manual').slice(0, 10)];
    }

    async function databaseCommit(envelope, expectedRevision, checkpoint, force) {
        const db = await openDatabase();
        try {
            await new Promise((resolve, reject) => {
                const transaction = db.transaction(STORAGE_KEYS.store, 'readwrite');
                const store = transaction.objectStore(STORAGE_KEYS.store);
                let explicitError = null;
                transaction.oncomplete = resolve;
                transaction.onerror = () => reject(explicitError || transaction.error || new Error('Save transaction failed.'));
                transaction.onabort = () => reject(explicitError || transaction.error || new Error('Save transaction was interrupted.'));
                const request = store.get(STORAGE_KEYS.primary);
                request.onerror = () => { explicitError = request.error; transaction.abort(); };
                request.onsuccess = () => {
                    const current = parseCandidate(request.result, 'indexedDB');
                    if (!force && current && current.state.revision > expectedRevision) { explicitError = conflict(); transaction.abort(); return; }
                    store.put(envelope, STORAGE_KEYS.primary);
                    if (checkpoint) store.put(checkpoint, checkpoint.snapshotId);
                    const all = store.getAll();
                    all.onsuccess = () => {
                        const snapshots = all.result.filter(item => item?.snapshotId);
                        const retained = new Set(trimSnapshotValues(snapshots).map(item => item.snapshotId));
                        snapshots.filter(item => !retained.has(item.snapshotId)).forEach(item => store.delete(item.snapshotId));
                    };
                };
            });
        } finally { db.close(); }
        const verified = await readDatabase();
        if (verified?.commitId !== envelope.commitId) throw new Error('The saved game could not be verified. Export a backup before closing this tab.');
    }

    async function withLock(operation) {
        if (env.navigator?.locks?.request) return env.navigator.locks.request('dbz-fitness-rpg-v7-save', { mode: 'exclusive' }, operation);
        let acquired = false;
        const leaseId = token();
        try {
            let existing;
            try { existing = JSON.parse(getLocal(STORAGE_KEYS.lease) || 'null'); } catch { existing = null; }
            if (existing?.expires > Date.now()) throw conflict();
            try {
                setLocal(STORAGE_KEYS.lease, JSON.stringify({ id: leaseId, expires: Date.now() + 20000 }));
                acquired = JSON.parse(getLocal(STORAGE_KEYS.lease) || '{}').id === leaseId;
                if (!acquired) throw conflict();
            } catch (error) { if (error.code === 'SAVE_CONFLICT') throw error; /* IndexedDB CAS still protects database-only browsers. */ }
            return await operation();
        } finally {
            if (acquired) {
                try { if (JSON.parse(getLocal(STORAGE_KEYS.lease) || '{}').id === leaseId) env.localStorage.removeItem(STORAGE_KEYS.lease); } catch { /* Lease expires. */ }
            }
        }
    }

    async function saveNow(input, options) {
        return withLock(async () => {
            const candidate = validateState(input);
            const current = newest((await candidates()).values);
            const expectedRevision = candidate.revision;
            if (!options.force && current && (current.state.revision > expectedRevision || current.state.revision === expectedRevision && candidate.savedAt && current.state.savedAt !== candidate.savedAt)) throw conflict();
            // Recovery/import force creates a new revision; it never moves revision backwards.
            candidate.revision = Math.max(expectedRevision, current?.state.revision || 0) + 1;
            candidate.savedAt = new Date().toISOString();
            const envelope = makeEnvelope(candidate);
            const checkpoint = meaningfulSnapshot(current?.state || lastLoaded, options.force || options.checkpoint);
            let backend = 'indexedDB';
            let warning;
            try {
                await databaseCommit(envelope, expectedRevision, checkpoint, options.force);
            } catch (error) {
                if (error.code === 'SAVE_CONFLICT') throw error;
                backend = 'localStorage-fallback';
                // Recheck fallback before replacing it, including database failures mid-save.
                const fallback = parseCandidate(getLocal(STORAGE_KEYS.fallback), 'localStorage-fallback');
                if (!options.force && fallback?.state.revision > expectedRevision) throw conflict();
                try {
                    setLocal(STORAGE_KEYS.fallback, JSON.stringify(envelope));
                    const verified = JSON.parse(getLocal(STORAGE_KEYS.fallback) || 'null');
                    if (verified?.commitId !== envelope.commitId) throw new Error('Local fallback verification failed.');
                } catch (fallbackError) {
                    throw new Error(`The game could not be saved. Keep this tab open and export a backup. ${fallbackError.message}`);
                }
                warning = 'Saved to local fallback because the browser database is unavailable.';
                if (checkpoint) {
                    try {
                        const previous = JSON.parse(getLocal(STORAGE_KEYS.snapshots) || '[]');
                        setLocal(STORAGE_KEYS.snapshots, JSON.stringify(trimSnapshotValues([...previous.filter(item => item.snapshotId !== checkpoint.snapshotId), checkpoint])));
                    } catch { warning += ' Recovery history is full; export a backup.'; }
                }
            }
            lastLoaded = clone(candidate);
            // Only publish small metadata: no fitness history leaves local persistence.
            try { setLocal(STORAGE_KEYS.signal, JSON.stringify({ tabId, revision: candidate.revision, savedAt: candidate.savedAt })); } catch { /* Main save is already durable. */ }
            return { state: candidate, backend, savedAt: candidate.savedAt, warning };
        });
    }

    function saveGame(state, options = {}) {
        // Snapshot at invocation, before another user action mutates the working state.
        let input;
        try { input = validateState(state); } catch (error) { return Promise.reject(error); }
        const run = () => saveNow(input, options);
        const pending = queue.then(run, run);
        queue = pending.catch(() => {});
        return pending;
    }

    async function snapshotCandidates() {
        let database = [];
        try { database = await readDatabase(STORAGE_KEYS.database, true); } catch { /* Fallback may still contain recovery points. */ }
        let fallback = [];
        try { fallback = JSON.parse(getLocal(STORAGE_KEYS.snapshots) || '[]'); } catch { /* Ignore only invalid recovery data. */ }
        const byId = new Map();
        for (const envelope of [...database, ...(Array.isArray(fallback) ? fallback : [])]) {
            if (!envelope?.snapshotId) continue;
            const candidate = parseCandidate(envelope, 'snapshot');
            if (candidate && (!byId.has(envelope.snapshotId) || timestamp(candidate.state) > timestamp(byId.get(envelope.snapshotId).state))) byId.set(envelope.snapshotId, { ...candidate, id: envelope.snapshotId });
        }
        return [...byId.values()];
    }
    async function listSnapshots() {
        return (await snapshotCandidates()).sort((a, b) => timestamp(b.state) - timestamp(a.state)).map(item => ({ id: item.id, savedAt: item.state.savedAt, revision: item.state.revision, characters: Object.values(item.state.characters).map(character => ({ name: character.name, routeId: character.routeId, workouts: character.workouts.length })) }));
    }
    async function restoreSnapshot(snapshotId, { beforeRestore } = {}) {
        const snapshot = (await snapshotCandidates()).find(item => item.id === snapshotId);
        if (!snapshot) throw new Error('That recovery point is no longer available.');
        // Hold the selected payload before flushing current UI work. That flush may
        // rotate the daily/manual checkpoint with the same ID out of storage.
        if (beforeRestore) await beforeRestore();
        return (await saveGame(snapshot.state, { force: true, checkpoint: true })).state;
    }
    function exportGame(state) { return JSON.stringify(validateState(state)); }
    async function importGame(contents) {
        if (typeof contents !== 'string' || new TextEncoder().encode(contents).length > MAX_SAVE_BYTES) throw new Error('The import must be a JSON backup no larger than 40 MB.');
        let value;
        try { value = JSON.parse(contents); } catch { throw new Error('The file is not valid JSON.'); }
        if (value?.format === 'dbz-fitness-rpg-v7') value = value.state;
        const migrated = migrateLegacy(value);
        const saved = await saveGame(migrated.state, { force: true, checkpoint: true });
        return { state: saved.state, report: { ...migrated.report, backend: saved.backend, warning: saved.warning } };
    }
    const receive = event => {
        if (event.key !== STORAGE_KEYS.signal || !event.newValue) return;
        try {
            const detail = JSON.parse(event.newValue);
            if (detail.tabId !== tabId && Number.isInteger(detail.revision)) listeners.forEach(callback => callback(detail));
        } catch { /* Ignore unrelated/corrupt browser signals. */ }
    };
    function subscribeToExternalChanges(callback) {
        if (typeof callback !== 'function') throw new Error('A change callback is required.');
        if (!listeners.size) env.addEventListener?.('storage', receive);
        listeners.add(callback);
        return () => { listeners.delete(callback); if (!listeners.size) env.removeEventListener?.('storage', receive); };
    }
    return { loadGame, saveGame, listSnapshots, restoreSnapshot, exportGame, importGame, subscribeToExternalChanges };
}

const defaultStorage = createStorage();
export const { loadGame, saveGame, listSnapshots, restoreSnapshot, exportGame, importGame, subscribeToExternalChanges } = defaultStorage;
