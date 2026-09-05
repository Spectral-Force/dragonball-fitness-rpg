import { CATALOG } from './catalog.js';

export const DRAFT_RECOVERY_PREFIX = 'dbfitness_v7_draft_checkpoint:';
export const MAX_DRAFT_CHECKPOINT_BYTES = 1024 * 1024;
const exerciseIds = new Set(CATALOG.exercises.map(item => item.id));
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = message => { throw new Error(message); };
const text = (value, label, max, fallback = '') => {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'string' || value.length > max) fail(`${label} is invalid or too long.`);
    return value;
};
const number = (value, label, min, max, nullable = false) => {
    if (nullable && (value === undefined || value === null || value === '')) return null;
    const normalized = value === undefined || value === '' ? 0 : Number(value);
    if ((typeof value !== 'number' && typeof value !== 'string' && value !== undefined) || !Number.isFinite(normalized) || normalized < min || normalized > max) fail(`${label} is outside its allowed range.`);
    return normalized;
};

/** Editing validation deliberately permits empty exercises/sets and a blank date.
 * Finishing a workout still uses the stricter earning validator in engine.js.
 * Only physical/editor fields enter this checkpoint: never receipts or rewards. */
export function validateDraftCheckpoint(input) {
    if (input === null || input === undefined) return null;
    if (!plain(input)) fail('The workout draft must be an object.');
    const date = text(input.date, 'Draft date', 10);
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)) fail('The draft date is invalid.');
    const kind = input.kind || 'training';
    if (!['training', 'rest'].includes(kind)) fail('The draft session type is invalid.');
    if (input.entries !== undefined && !Array.isArray(input.entries) || (input.entries || []).length > 100) fail('The workout draft may contain at most 100 exercises.');
    const entries = (input.entries || []).map(entry => {
        if (!plain(entry) || !exerciseIds.has(entry.exerciseId)) fail('The draft contains an unknown exercise.');
        if (entry.sets !== undefined && !Array.isArray(entry.sets) || (entry.sets || []).length > 100) fail('A draft exercise may contain at most 100 sets.');
        const result = {
            exerciseId: entry.exerciseId,
            sets: (entry.sets || []).map(set => {
                if (!plain(set)) fail('A draft set is invalid.');
                return { reps: number(set.reps, 'Repetitions', 0, 1000), weight: number(set.weight, 'Load', 0, 1000), seconds: number(set.seconds, 'Hold seconds', 0, 14400) };
            }),
            duration: number(entry.duration, 'Duration', 0, 1440),
            distance: number(entry.distance, 'Distance', 0, 500)
        };
        if (entry.notes !== undefined) result.notes = text(entry.notes, 'Exercise notes', 2000);
        if (entry.restSeconds !== undefined) result.restSeconds = number(entry.restSeconds, 'Rest seconds', 0, 3600);
        return result;
    });
    const result = {
        date, kind, name: text(input.name, 'Session name', 120), notes: text(input.notes, 'Session notes', 6000),
        rpe: number(input.rpe, 'RPE', 1, 10, true), rir: number(input.rir, 'RIR', 0, 20, true), entries,
        recovery: { illness: input.recovery?.illness === true, injury: input.recovery?.injury === true, deload: input.recovery?.deload === true }
    };
    for (const key of ['id', 'editId', 'legacyCorrectionId']) if (input[key] !== undefined) {
        const value = text(input[key], key, 100);
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) fail(`The draft ${key} is invalid.`);
        result[key] = value;
    }
    if (result.editId && result.legacyCorrectionId) fail('A draft cannot edit two types of history at once.');
    if (input.correctionReason !== undefined) result.correctionReason = text(input.correctionReason, 'Correction reason', 2000);
    if (input.timerEnds !== undefined) result.timerEnds = number(input.timerEnds, 'Timer end', 0, 8640000000000000);
    return result;
}

function stateToken(state) {
    if (state?.schemaVersion !== 70 || !Number.isSafeInteger(state.revision) || state.revision < 0) fail('A valid v7 save revision is required for draft recovery.');
    if (state.savedAt !== null && state.savedAt !== undefined && (typeof state.savedAt !== 'string' || !Number.isFinite(Date.parse(state.savedAt)))) fail('The draft baseline save time is invalid.');
    return { revision: state.revision, savedAt: state.savedAt || null };
}
const identity = character => ({ id: character.id, routeId: character.routeId, createdAt: character.createdAt });
const keyFor = id => `${DRAFT_RECOVERY_PREFIX}${encodeURIComponent(id)}`;
function validEditTarget(draft, character) {
    if (draft?.editId) return character.workouts.some(workout => workout.id === draft.editId && !workout.legacy);
    if (draft?.legacyCorrectionId) return character.workouts.some(workout => workout.id === draft.legacyCorrectionId && workout.legacy);
    return true;
}

/** Synchronous per-tab checkpoints close the debounce/pagehide gap. sessionStorage
 * survives reload and isolates simultaneous tabs; localStorage is the fallback.
 * Neither backend is used to store or reconcile game rewards. */
export function createDraftRecovery(environment = globalThis) {
    const token = () => environment.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    const owner = token();
    let sequence = 0;
    const storage = name => { try { return environment[name] || null; } catch { return null; } };
    const read = (id, backend) => {
        try {
            const raw = storage(backend)?.getItem(keyFor(id));
            if (!raw || raw.length > MAX_DRAFT_CHECKPOINT_BYTES) return null;
            const record = JSON.parse(raw);
            if (!plain(record) || record.format !== 'dbz-v7-draft' || record.version !== 1 || record.character?.id !== id || typeof record.id !== 'string' || typeof record.owner !== 'string') return null;
            if (!Number.isSafeInteger(record.sequence) || record.sequence < 1 || !Number.isFinite(Date.parse(record.at))) return null;
            stateToken({ ...record.base, schemaVersion: 70 });
            record.draft = validateDraftCheckpoint(record.draft);
            if (!record.draft) return null;
            return { record, raw, backend };
        } catch { return null; }
    };
    const readAll = id => ['sessionStorage', 'localStorage'].map(backend => read(id, backend)).filter(Boolean);
    const removeExact = checkpoint => {
        try {
            const backend = storage(checkpoint.backend), key = keyFor(checkpoint.record.character.id);
            if (backend?.getItem(key) !== checkpoint.raw) return false;
            backend.removeItem(key);
            return backend.getItem(key) === null;
        } catch { return false; }
    };
    function write(record, preferredBackend) {
        const raw = JSON.stringify(record);
        if (new TextEncoder().encode(raw).length > MAX_DRAFT_CHECKPOINT_BYTES) fail('The draft recovery checkpoint is too large.');
        let lastError;
        const backends = preferredBackend ? [preferredBackend] : ['sessionStorage', 'localStorage'];
        for (const backend of backends) {
            try {
                const target = storage(backend);
                if (!target) throw new Error(`${backend} is unavailable.`);
                target.setItem(keyFor(record.character.id), raw);
                if (target.getItem(keyFor(record.character.id)) !== raw) throw new Error('Draft checkpoint verification failed.');
                return { ok: true, stored: true, backend, id: record.id };
            } catch (error) { lastError = error; }
        }
        return { ok: false, stored: false, error: `Immediate draft recovery is unavailable. Keep this tab open until the main save completes. ${lastError?.message || ''}`.trim() };
    }
    function checkpoint(state, characterId = state.activeCharacterId) {
        try {
            const base = stateToken(state), character = state.characters?.[characterId];
            if (!character || !character.draft) return { ok: true, stored: false };
            const existing = readAll(characterId);
            if (existing.some(item => item.record.base.revision > base.revision || item.record.base.revision === base.revision && item.record.base.savedAt !== base.savedAt)) return { ok: false, stored: false, error: 'A draft checkpoint belongs to a newer or different saved game. Reload the latest game before continuing.' };
            const latestTime = Math.max(0, ...existing.map(item => Date.parse(item.record.at)));
            const record = { format: 'dbz-v7-draft', version: 1, id: token(), owner, sequence: ++sequence, at: new Date(Math.max(Date.now(), latestTime + 1)).toISOString(), base, character: identity(character), draft: validateDraftCheckpoint(character.draft) };
            return write(record);
        } catch (error) { return { ok: false, stored: false, error: error.message }; }
    }
    function recover(state) {
        const base = stateToken(state), recovered = [], ignored = [];
        let result = state;
        for (const [id, character] of Object.entries(state.characters || {})) {
            const candidates = readAll(id).sort((a, b) => Date.parse(b.record.at) - Date.parse(a.record.at) || b.record.sequence - a.record.sequence);
            const selected = candidates.find(item => same(item.record.base, base) && same(item.record.character, identity(character)) && validEditTarget(item.record.draft, character));
            if (!selected) {
                if (candidates.length) ignored.push({ characterId: id, reason: 'Checkpoint belongs to another save revision, character or removed workout.' });
                continue;
            }
            let existingDraft;
            try { existingDraft = validateDraftCheckpoint(character.draft); } catch { existingDraft = undefined; }
            if (same(selected.record.draft, existingDraft)) continue;
            if (result === state) result = { ...state, characters: { ...state.characters } };
            result.characters[id] = { ...character, draft: selected.record.draft };
            recovered.push(id);
        }
        return { state: result, recovered, ignored, warning: recovered.length ? 'Recovered an unfinished workout draft from before the reload. Save it to protect the latest changes.' : undefined };
    }
    function beginSave(state) {
        const base = stateToken(state), drafts = {}, warnings = [];
        for (const [id, character] of Object.entries(state.characters || {})) {
            const written = checkpoint(state, id);
            if (!written.ok) warnings.push(written.error);
            try {
                drafts[id] = { character: identity(character), draft: validateDraftCheckpoint(character.draft), checkpoints: readAll(id).map(item => ({ id: item.record.id, backend: item.backend })) };
            } catch (error) { warnings.push(error.message); }
        }
        return { owner, base, drafts, warnings };
    }
    function confirmSave(ticket, savedState) {
        const savedBase = stateToken(savedState), cleared = [], rebased = [], warnings = [];
        if (!ticket || ticket.owner !== owner || savedBase.revision !== ticket.base.revision + 1) return { cleared, rebased, warnings: ['Draft checkpoints were retained because the save confirmation did not match.'] };
        for (const [id, captured] of Object.entries(ticket.drafts)) {
            const character = savedState.characters?.[id];
            let savedDraft;
            try { savedDraft = validateDraftCheckpoint(character?.draft); } catch { continue; }
            if (!character || !same(identity(character), captured.character) || !same(savedDraft, captured.draft)) continue;
            for (const current of readAll(id)) {
                const record = current.record;
                if (record.owner !== owner || !same(record.base, ticket.base) || !same(record.character, captured.character)) continue;
                const included = captured.checkpoints.some(item => item.id === record.id && item.backend === current.backend);
                if (included || same(record.draft, captured.draft)) {
                    if (removeExact(current)) cleared.push(id);
                } else {
                    // A later input event happened while this exact save was pending.
                    // Move only that same-tab checkpoint to the verified new baseline.
                    try {
                        const target = storage(current.backend);
                        if (target?.getItem(keyFor(id)) !== current.raw) continue;
                        const written = write({ ...record, base: savedBase }, current.backend);
                        if (written.ok) rebased.push(id); else warnings.push(written.error);
                    } catch (error) { warnings.push(`The latest draft checkpoint could not follow the completed save. ${error.message}`); }
                }
            }
        }
        return { cleared: [...new Set(cleared)], rebased: [...new Set(rebased)], warnings };
    }
    return { checkpoint, recover, beginSave, confirmSave };
}
