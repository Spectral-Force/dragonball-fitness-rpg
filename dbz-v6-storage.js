(function installV6Storage(root) {
    'use strict';

    const DB_NAME = 'dbz-fitness-rpg-v6';
    const DB_VERSION = 1;
    const STORE = 'saves';
    const PRIMARY_KEY = 'primary';
    const LEGACY_KEY = 'dbfitness_save';
    const FALLBACK_KEY = 'dbfitness_save_v6_fallback';
    const POINTER_KEY = 'dbfitness_save_pointer';
    const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
    const MAX_HISTORY_ROWS = 10000;
    const IMPORT_NUMBER_LIMITS = Object.freeze({
        reps: 1000,
        weight: 1000,
        weightKg: 1000,
        bodyWeight: 1000,
        seconds: 14400,
        duration: 1440,
        durationMinutes: 1440,
        distance: 500,
        distanceKm: 500,
        speed: 150,
        speedKph: 150
    });
    const IMPORT_DATE_KEYS = new Set([
        'date', 'startedAt', 'lastSavedAt', 'savedAt', 'migratedAt',
        'updatedAt', 'unlockedAt', 'clearedAt', 'masteredAt', 'until',
        'lastWorkoutDate', 'lastRestDate'
    ]);
    let queue = Promise.resolve();
    let bootstrapping = true;

    root.addEventListener('unhandledrejection', event => {
        console.error('Unhandled v6 error:', event.reason);
    });

    function announce(status, detail) {
        if (document.documentElement) document.documentElement.dataset.dbzStorageStatus = status;
        document.dispatchEvent(new CustomEvent('dbz-save-status', { detail: { status, detail } }));
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in root)) {
                reject(new Error('IndexedDB is not available in this browser.'));
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not open the save database.'));
        });
    }

    async function transact(mode, operation) {
        const db = await openDatabase();
        try {
            return await new Promise((resolve, reject) => {
                const transaction = db.transaction(STORE, mode);
                const store = transaction.objectStore(STORE);
                let result;
                try {
                    result = operation(store, transaction);
                } catch (error) {
                    reject(error);
                    return;
                }
                transaction.oncomplete = () => resolve(result);
                transaction.onerror = () => reject(transaction.error || new Error('Save transaction failed.'));
                transaction.onabort = () => reject(transaction.error || new Error('Save transaction was cancelled.'));
            });
        } finally {
            db.close();
        }
    }

    async function readKey(key) {
        const db = await openDatabase();
        try {
            return await new Promise((resolve, reject) => {
                const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
                request.onsuccess = () => resolve(request.result ?? null);
                request.onerror = () => reject(request.error || new Error('Could not read the save.'));
            });
        } finally {
            db.close();
        }
    }

    async function trimSnapshots() {
        const db = await openDatabase();
        try {
            const keys = await new Promise((resolve, reject) => {
                const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAllKeys();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
            const snapshots = keys
                .filter(key => String(key).startsWith('snapshot:'))
                .sort()
                .reverse();
            if (snapshots.length <= 3) return;
            await transact('readwrite', store => {
                snapshots.slice(3).forEach(key => store.delete(key));
            });
        } finally {
            db.close();
        }
    }

    function localFallbackSave(value) {
        localStorage.setItem(FALLBACK_KEY, JSON.stringify(value));
        localStorage.setItem(POINTER_KEY, JSON.stringify({
            backend: 'localStorage-fallback',
            version: value?.version || 'v6.0',
            savedAt: value?.lastSavedAt || new Date().toISOString()
        }));
    }

    async function saveNow(value, options = {}) {
        const payload = structuredClone(value);
        const savedAt = payload.lastSavedAt || new Date().toISOString();
        try {
            await transact('readwrite', store => {
                store.put(payload, PRIMARY_KEY);
                if (options.snapshot !== false) store.put(payload, `snapshot:${savedAt}`);
            });
            localStorage.setItem(POINTER_KEY, JSON.stringify({
                backend: 'indexedDB',
                version: payload.version || 'v6.0',
                savedAt
            }));
            localStorage.removeItem(FALLBACK_KEY);
            localStorage.removeItem(LEGACY_KEY);
            trimSnapshots().catch(error => console.warn('Could not trim save snapshots:', error));
            announce('saved', `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
            return true;
        } catch (error) {
            console.error('IndexedDB save failed; using local fallback:', error);
            try {
                localFallbackSave(payload);
                announce('fallback', 'Saved locally; browser database unavailable');
                return true;
            } catch (fallbackError) {
                announce('error', 'Save failed — export a backup now');
                throw fallbackError;
            }
        }
    }

    function save(value, options = {}) {
        // Several legacy DOMContentLoaded listeners render and save immediately.
        // Ignore those default-state writes until the authoritative v6 load has
        // completed, otherwise they can overwrite IndexedDB during page startup.
        if (bootstrapping) return Promise.resolve(false);
        const queuedSnapshot = structuredClone(value);
        queue = queue.then(() => saveNow(queuedSnapshot, options), () => saveNow(queuedSnapshot, options));
        return queue;
    }

    function finishBootstrap() {
        bootstrapping = false;
    }

    async function load() {
        try {
            const primary = await readKey(PRIMARY_KEY);
            if (primary) {
                announce('loaded', 'Save loaded from browser database');
                return primary;
            }
        } catch (error) {
            console.warn('IndexedDB load failed:', error);
        }

        for (const key of [FALLBACK_KEY, LEGACY_KEY]) {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            try {
                const parsed = JSON.parse(raw);
                announce(key === LEGACY_KEY ? 'migrating' : 'loaded', key === LEGACY_KEY ? 'Migrating legacy save to v6' : 'Loaded recovery save');
                return parsed;
            } catch (error) {
                console.error(`Could not parse ${key}:`, error);
            }
        }
        return null;
    }

    async function hasSave() {
        if (localStorage.getItem(FALLBACK_KEY) || localStorage.getItem(LEGACY_KEY)) return true;
        try {
            return !!(await readKey(PRIMARY_KEY));
        } catch {
            return false;
        }
    }

    async function clear() {
        try {
            await transact('readwrite', store => store.clear());
        } catch (error) {
            console.warn('Could not clear IndexedDB save:', error);
        }
        [LEGACY_KEY, FALLBACK_KEY, POINTER_KEY, 'dbfitness_p2'].forEach(key => localStorage.removeItem(key));
        announce('cleared', 'Local game data cleared');
    }

    function isPlainObject(value) {
        if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
        const proto = Object.getPrototypeOf(value);
        return proto === Object.prototype || proto === null;
    }

    function validImportDate(value) {
        if (value === null || value === undefined || value === '') return true;
        if (typeof value !== 'string' || value.length > 40) return false;
        const timestamp = Date.parse(value.length === 10 ? `${value}T12:00:00Z` : value);
        if (!Number.isFinite(timestamp)) return false;
        const year = new Date(timestamp).getUTCFullYear();
        return year >= 1970 && year <= 2300;
    }

    function validateNode(value, path = 'save', depth = 0) {
        if (depth > 20) throw new Error(`${path} is nested too deeply.`);
        if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1e18)) {
            throw new Error(`${path} contains an invalid number.`);
        }
        if (typeof value === 'number') {
            const leaf = path.match(/\.([a-zA-Z0-9_]+)$/)?.[1];
            const limit = leaf ? IMPORT_NUMBER_LIMITS[leaf] : null;
            if (limit && (value < 0 || value > limit)) throw new Error(`${path} is outside the accepted range.`);
        }
        if (typeof value === 'string' && value.length > 200000) {
            throw new Error(`${path} contains an unexpectedly large text value.`);
        }
        if (Array.isArray(value)) {
            if (value.length > MAX_HISTORY_ROWS) throw new Error(`${path} contains too many entries.`);
            value.forEach((item, index) => validateNode(item, `${path}[${index}]`, depth + 1));
            return;
        }
        if (isPlainObject(value)) {
            for (const [key, child] of Object.entries(value)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`${path} contains an unsafe property.`);
                if (IMPORT_DATE_KEYS.has(key) && !validImportDate(child)) throw new Error(`${path}.${key} is not a valid game date.`);
                validateNode(child, `${path}.${key}`, depth + 1);
            }
        }
    }

    function validateImportedSave(candidate, fileSize = 0) {
        if (fileSize > MAX_IMPORT_BYTES) throw new Error('The import is larger than the 10 MB safety limit.');
        if (!isPlainObject(candidate)) throw new Error('The import must be a game-save object.');
        const schema = Number(candidate.schemaVersion || 1);
        const currentSchema = Number(root.DBZ_V6_CONFIG?.schemaVersion || 32);
        if (!Number.isInteger(schema) || schema < 1 || schema > currentSchema) {
            throw new Error(`Unsupported save schema: ${candidate.schemaVersion}.`);
        }
        if (!isPlainObject(candidate.characters)) throw new Error('The import has no valid characters collection.');
        const characterEntries = Object.entries(candidate.characters);
        if (!characterEntries.length || characterEntries.length > 10) throw new Error('The import has an invalid number of characters.');
        if (candidate.activeCharacter && !candidate.characters[candidate.activeCharacter]) {
            throw new Error('The active character ID is missing from the save.');
        }
        for (const [id, character] of characterEntries) {
            if (!/^[a-z0-9_-]{1,64}$/i.test(id)) throw new Error(`Invalid character ID: ${id}`);
            if (!isPlainObject(character)) throw new Error(`Character ${id} is invalid.`);
            const raceKey = String(character.race || 'earthling').toLowerCase().replace(/[-\s]+/g, '_');
            const raceAliases = { human: 'earthling', half_saiyan: 'hybrid', frieza: 'frieza_race', friezas_race: 'frieza_race' };
            const canonicalRace = raceAliases[raceKey] || raceKey;
            if (!root.DBZ_V6_CONFIG?.racePowerPaths?.[canonicalRace]) throw new Error(`Character ${id} has an unsupported race.`);
            if (character.stats !== undefined) {
                if (!isPlainObject(character.stats)) throw new Error(`Character ${id} has invalid stats.`);
                for (const [stat, value] of Object.entries(character.stats)) {
                    if (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 1e12) {
                        throw new Error(`Character ${id} has an invalid ${stat} stat.`);
                    }
                }
            }
            if (character.workoutLog && !Array.isArray(character.workoutLog)) throw new Error(`Character ${id} has an invalid workout history.`);
            if (character.raceProgression !== undefined) {
                if (!isPlainObject(character.raceProgression)) throw new Error(`Character ${id} has invalid race progression.`);
                const progression = character.raceProgression;
                const progressionConfig = root.DBZ_V6_PROGRESSION_CONFIG;
                if (progression.routeId && progressionConfig && !progressionConfig.routes?.[progression.routeId]) {
                    throw new Error(`Character ${id} has an unsupported race route.`);
                }
                if (progression.androidPath && !['infinite', 'bio'].includes(progression.androidPath)) {
                    throw new Error(`Character ${id} has an invalid Android path.`);
                }
                if (progression.divineDiscipline && !['native', 'instinct', 'destruction'].includes(progression.divineDiscipline)) {
                    throw new Error(`Character ${id} has an invalid divine discipline.`);
                }
                if (progression.namekianBranch && !['warrior', 'dragon', 'balanced'].includes(progression.namekianBranch)) {
                    throw new Error(`Character ${id} has an invalid Namekian branch.`);
                }
                if (progression.earnedTiers && (!Array.isArray(progression.earnedTiers) || progression.earnedTiers.length > 20)) {
                    throw new Error(`Character ${id} has invalid earned race tiers.`);
                }
                if (progression.absorptionCores && (!Array.isArray(progression.absorptionCores) || progression.absorptionCores.length > 3)) {
                    throw new Error(`Character ${id} has too many absorption cores.`);
                }
                if (progression.adaptationTemplates && (!Array.isArray(progression.adaptationTemplates) || progression.adaptationTemplates.length > 3)) {
                    throw new Error(`Character ${id} has too many adaptation templates.`);
                }
                if (progression.breakthroughs && !isPlainObject(progression.breakthroughs)) {
                    throw new Error(`Character ${id} has invalid breakthrough records.`);
                }
            }
        }
        validateNode(candidate);
        return structuredClone(candidate);
    }

    root.DBZV6Storage = Object.freeze({
        save,
        load,
        hasSave,
        clear,
        finishBootstrap,
        validateImportedSave,
        maxImportBytes: MAX_IMPORT_BYTES
    });

    root.v6Alert = function v6Alert(message, type = 'info') {
        const detail = { message: String(message || ''), type };
        document.dispatchEvent(new CustomEvent('dbz-toast', { detail }));
        if (!document.body) console.info(detail.message);
    };
})(globalThis);
