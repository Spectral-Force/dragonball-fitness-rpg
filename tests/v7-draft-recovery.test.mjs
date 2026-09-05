import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftRecovery, validateDraftCheckpoint, DRAFT_RECOVERY_PREFIX } from '../v7/draft-recovery.js';
import { createState, createCharacter } from '../v7/engine.js';
import { createStorage } from '../v7/storage.js';

function memory() {
    const items = new Map();
    return { items, fail: false, getItem(key) { return items.get(key) ?? null; }, setItem(key, value) { if (this.fail) throw new Error('Injected quota failure'); items.set(key, value); }, removeItem(key) { if (this.fail) throw new Error('Injected removal failure'); items.delete(key); } };
}
function environment(localStorage = memory()) { return { localStorage, sessionStorage: memory(), crypto: globalThis.crypto }; }
function draft(weight = 40) { return { date: '2026-09-04', name: 'Strength & control', notes: 'Finish the final set', kind: 'training', rpe: 7, rir: 2, entries: [{ exerciseId: 'bench_press', sets: [{ reps: 8, weight, seconds: 0 }], duration: 0, distance: 0, notes: 'Pause at chest', restSeconds: 120 }], recovery: { deload: true }, timerEnds: 1788520500000 }; }
function fixture() {
    const state = createState();
    createCharacter(state, { id: 'hero', name: 'Hero', routeId: 'earthling' }, new Date('2026-08-01T12:00:00Z'));
    state.characters.hero.draft = draft();
    state.revision = 4; state.savedAt = '2026-09-04T12:00:00.000Z';
    return state;
}
function committed(state) { const saved = structuredClone(state); saved.revision++; saved.savedAt = '2026-09-04T12:01:00.000Z'; return saved; }
const checkpointKeys = backend => [...backend.items.keys()].filter(key => key.startsWith(DRAFT_RECOVERY_PREFIX));

test('a synchronous checkpoint survives immediate reload before the debounce or any save promise', async () => {
    const env = environment(), storage = createStorage(env);
    const baseline = (await storage.saveGame(fixture())).state;
    const working = structuredClone(baseline), recovery = createDraftRecovery(env);
    working.characters.hero.draft.entries[0].sets[0].weight = 45;
    working.characters.hero.draft.notes = 'New notes immediately before reload';
    const status = recovery.checkpoint(working);
    assert.equal(status.ok, true);
    assert.equal(typeof status.then, 'undefined', 'The write must complete synchronously');
    const loaded = await createStorage(env).loadGame();
    assert.equal(loaded.state.characters.hero.draft.entries[0].sets[0].weight, 40, 'The full save has intentionally not run');
    const result = createDraftRecovery(env).recover(loaded.state);
    assert.deepEqual(result.recovered, ['hero']);
    assert.equal(result.state.characters.hero.draft.entries[0].sets[0].weight, 45);
    assert.equal(result.state.characters.hero.draft.notes, 'New notes immediately before reload');
    assert.equal(result.state.characters.hero.draft.entries[0].notes, 'Pause at chest');
    assert.equal(result.state.characters.hero.draft.entries[0].restSeconds, 120);
    assert.equal(result.state.characters.hero.draft.timerEnds, 1788520500000);
});

test('recovery changes only a copy of the draft and never restores reward fields from its payload', () => {
    const env = environment(), recovery = createDraftRecovery(env), baseline = fixture(), working = structuredClone(baseline);
    working.characters.hero.draft.notes = 'Literal <script>text</script>';
    working.characters.hero.draft.receipt = { xp: 9000, stats: { STR: 1e6 } };
    working.characters.hero.draft.xp = 999;
    const before = JSON.stringify(baseline);
    recovery.checkpoint(working);
    const result = recovery.recover(baseline);
    assert.equal(JSON.stringify(baseline), before);
    assert.equal(result.state.characters.hero.draft.receipt, undefined);
    assert.equal(result.state.characters.hero.draft.xp, undefined);
    assert.equal(result.state.characters.hero.draft.notes, 'Literal <script>text</script>');
    for (const key of ['stats', 'xp', 'tp', 'ap', 'journal', 'workouts', 'baseline']) assert.deepEqual(result.state.characters.hero[key], baseline.characters.hero[key]);
});

test('newer committed, imported, discarded and finished states never receive an old checkpoint', () => {
    for (const action of ['save', 'import', 'discard', 'finish']) {
        const env = environment(), recovery = createDraftRecovery(env), baseline = fixture(), working = structuredClone(baseline);
        working.characters.hero.draft = draft(45); recovery.checkpoint(working);
        const newer = committed(baseline);
        if (action !== 'save') newer.characters.hero.draft = null;
        if (action === 'import') newer.revision += 20;
        if (action === 'finish') newer.characters.hero.workouts.push({ id: 'finished', date: '2026-09-04' });
        const result = createDraftRecovery(env).recover(newer);
        assert.deepEqual(result.recovered, [], action);
        assert.deepEqual(result.state, newer, action);
        assert.equal(checkpointKeys(env.sessionStorage).length, 1, 'Recovery does not broadly delete unmatched drafts');
    }
});

test('same revision with a different save timestamp or character identity is also rejected', () => {
    const env = environment(), recovery = createDraftRecovery(env), baseline = fixture(), working = structuredClone(baseline);
    working.characters.hero.draft = draft(45); recovery.checkpoint(working);
    const differentCommit = structuredClone(baseline); differentCommit.savedAt = '2026-09-04T12:00:00.001Z';
    assert.deepEqual(recovery.recover(differentCommit).recovered, []);
    const differentHero = structuredClone(baseline); differentHero.characters.hero.createdAt = '2026-08-02T12:00:00Z';
    assert.deepEqual(recovery.recover(differentHero).recovered, []);
});

test('a verified save clears exactly the checkpoint version it contains', () => {
    const env = environment(), recovery = createDraftRecovery(env), working = fixture();
    working.characters.hero.draft = draft(45);
    recovery.checkpoint(working);
    const ticket = recovery.beginSave(working), saved = committed(working);
    assert.deepEqual(recovery.confirmSave(ticket, saved).cleared, ['hero']);
    assert.equal(checkpointKeys(env.sessionStorage).length, 0);
    assert.deepEqual(recovery.recover(saved).recovered, []);
});

test('an edit made during a pending save is rebased and survives reload over that completed save', () => {
    const env = environment(), recovery = createDraftRecovery(env), working = fixture();
    working.characters.hero.draft = draft(45);
    const ticket = recovery.beginSave(working), saved = committed(working);
    working.characters.hero.draft.entries[0].sets[0].weight = 50;
    working.characters.hero.draft.notes = 'Typed during database commit';
    recovery.checkpoint(working);
    const confirmed = recovery.confirmSave(ticket, saved);
    assert.deepEqual(confirmed.cleared, []);
    assert.deepEqual(confirmed.rebased, ['hero']);
    const result = createDraftRecovery(env).recover(saved);
    assert.equal(result.state.characters.hero.draft.entries[0].sets[0].weight, 50);
    assert.equal(result.state.characters.hero.draft.notes, 'Typed during database commit');
    const secondTicket = recovery.beginSave(result.state);
    assert.deepEqual(recovery.confirmSave(secondTicket, committed(result.state)).cleared, ['hero']);
});

test('a failed or mismatched save cannot clear the checkpoint', () => {
    const env = environment(), recovery = createDraftRecovery(env), working = fixture();
    working.characters.hero.draft = draft(45);
    const ticket = recovery.beginSave(working);
    assert.deepEqual(recovery.confirmSave(ticket, working).cleared, []);
    const mismatch = committed(working); mismatch.characters.hero.draft = draft(60);
    assert.deepEqual(recovery.confirmSave(ticket, mismatch).cleared, []);
    const unrelated = committed(working); unrelated.revision += 10;
    assert.deepEqual(recovery.confirmSave(ticket, unrelated).cleared, [], 'An unrelated force/import commit is not this ticket’s ordinary save');
    assert.equal(checkpointKeys(env.sessionStorage).length, 1);
});

test('production storage snapshots and checkpoint rebasing retain input typed while the asynchronous save runs', async () => {
    const env = environment(), storage = createStorage(env), recovery = createDraftRecovery(env);
    const working = (await storage.saveGame(fixture())).state;
    working.characters.hero.draft = draft(45);
    const ticket = recovery.beginSave(working), pending = storage.saveGame(working);
    working.characters.hero.draft.entries[0].sets[0].weight = 55;
    working.characters.hero.draft.notes = 'A new cue typed during the real save';
    recovery.checkpoint(working);
    const saved = await pending;
    assert.equal(saved.state.characters.hero.draft.entries[0].sets[0].weight, 45);
    assert.deepEqual(recovery.confirmSave(ticket, saved.state).rebased, ['hero']);
    const loaded = await createStorage(env).loadGame();
    const recovered = createDraftRecovery(env).recover(loaded.state);
    assert.equal(recovered.state.characters.hero.draft.entries[0].sets[0].weight, 55);
    assert.equal(recovered.state.characters.hero.draft.notes, 'A new cue typed during the real save');
});

test('a committed finish or discard clears the captured old checkpoint but a new next-session draft survives', () => {
    const env = environment(), recovery = createDraftRecovery(env), working = fixture();
    recovery.checkpoint(working);
    working.characters.hero.draft = null;
    const discardTicket = recovery.beginSave(working), discarded = committed(working);
    assert.deepEqual(recovery.confirmSave(discardTicket, discarded).cleared, ['hero']);
    const next = structuredClone(discarded); next.characters.hero.draft = draft(45); recovery.checkpoint(next);
    next.characters.hero.draft = null;
    const finishTicket = recovery.beginSave(next), finished = committed(next);
    next.characters.hero.draft = { ...draft(30), name: 'Next session' }; recovery.checkpoint(next);
    assert.deepEqual(recovery.confirmSave(finishTicket, finished).rebased, ['hero']);
    assert.equal(createDraftRecovery(env).recover(finished).state.characters.hero.draft.name, 'Next session');
});

test('session checkpoints isolate simultaneous tabs and an external newer save wins', () => {
    const shared = memory(), envA = environment(shared), envB = environment(shared), a = createDraftRecovery(envA), b = createDraftRecovery(envB);
    const baseline = fixture(), workingA = structuredClone(baseline), workingB = structuredClone(baseline);
    workingA.characters.hero.draft = draft(45); workingB.characters.hero.draft = draft(65);
    a.checkpoint(workingA); b.checkpoint(workingB);
    assert.equal(createDraftRecovery(envA).recover(baseline).state.characters.hero.draft.entries[0].sets[0].weight, 45);
    assert.equal(createDraftRecovery(envB).recover(baseline).state.characters.hero.draft.entries[0].sets[0].weight, 65);
    assert.deepEqual(a.recover(committed(workingB)).recovered, []);
    assert.equal(checkpointKeys(shared).length, 0, 'Normal checkpoints stay in their own tab');
});

test('localStorage fallback works, and a stale tab cannot overwrite a newer checkpoint', () => {
    const env = environment(); env.sessionStorage.fail = true;
    const a = createDraftRecovery(env), baseline = fixture();
    baseline.characters.hero.draft = draft(45);
    assert.equal(a.checkpoint(baseline).backend, 'localStorage');
    assert.equal(createDraftRecovery(env).recover(fixture()).state.characters.hero.draft.entries[0].sets[0].weight, 45);
    const newer = committed(baseline); newer.characters.hero.draft = draft(65);
    const b = createDraftRecovery(env); assert.equal(b.checkpoint(newer).ok, true);
    assert.equal(a.checkpoint(baseline).ok, false);
    assert.equal(b.recover(newer).state.characters.hero.draft.entries[0].sets[0].weight, 65);
});

test('a newer fallback checkpoint wins over the older session copy after a quota failure', () => {
    const env = environment(), recovery = createDraftRecovery(env), baseline = fixture(), working = structuredClone(baseline);
    working.characters.hero.draft = draft(45); recovery.checkpoint(working);
    env.sessionStorage.fail = true;
    working.characters.hero.draft = draft(50); assert.equal(recovery.checkpoint(working).backend, 'localStorage');
    assert.equal(createDraftRecovery(env).recover(baseline).state.characters.hero.draft.entries[0].sets[0].weight, 50);
});

test('storage failures are reported without mutating the working draft or falsely saying it is protected', () => {
    const env = environment(), recovery = createDraftRecovery(env), state = fixture(), before = structuredClone(state);
    env.sessionStorage.fail = true; env.localStorage.fail = true;
    const result = recovery.checkpoint(state);
    assert.equal(result.ok, false); assert.equal(result.stored, false);
    assert.match(result.error, /Immediate draft recovery is unavailable/);
    assert.deepEqual(state, before);
    assert.equal(recovery.beginSave(state).warnings.length, 1);
});

test('draft validation preserves incomplete editing and literal text while rejecting unsafe shape or measurements', () => {
    assert.deepEqual(validateDraftCheckpoint({ date: '', name: '', entries: [{ exerciseId: 'bench_press', sets: [] }] }).entries[0].sets, []);
    assert.equal(validateDraftCheckpoint({ ...draft(), rpe: '', rir: '' }).rpe, null);
    for (const patch of [{ date: '2026-02-30' }, { date: 'not a date' }, { name: 'x'.repeat(121) }, { notes: 'x'.repeat(6001) }, { rpe: Infinity }, { entries: [{ exerciseId: 'missing', sets: [] }] }, { entries: [{ exerciseId: 'bench_press', sets: [{ reps: 8, weight: -1 }] }] }, { entries: [{ exerciseId: 'bench_press', sets: [{ reps: 8, weight: 'Infinity' }] }] }, { timerEnds: -1 }]) assert.throws(() => validateDraftCheckpoint({ ...draft(), ...patch }));
    const env = environment(), recovery = createDraftRecovery(env), state = fixture(); state.characters.hero.draft.rpe = Infinity;
    assert.equal(recovery.checkpoint(state).ok, false);
    assert.doesNotThrow(() => recovery.beginSave(state), 'Checkpoint validation must not prevent the normal save handler from running');
});

test('corrupt records are ignored and a history edit only recovers while its target still exists', () => {
    const env = environment(), recovery = createDraftRecovery(env), baseline = fixture(), working = structuredClone(baseline);
    env.sessionStorage.setItem(`${DRAFT_RECOVERY_PREFIX}hero`, '{broken');
    assert.deepEqual(recovery.recover(baseline).recovered, []);
    working.characters.hero.draft.editId = 'workout_one';
    working.characters.hero.draft.notes = 'Correction draft';
    recovery.checkpoint(working);
    assert.deepEqual(recovery.recover(baseline).recovered, []);
    baseline.characters.hero.workouts.push({ id: 'workout_one', legacy: false });
    assert.deepEqual(recovery.recover(baseline).recovered, ['hero']);
    working.characters.hero.draft = { ...draft(45), legacyCorrectionId: 'old_one', correctionReason: 'Correct a transcribed load' };
    recovery.checkpoint(working);
    baseline.characters.hero.workouts.push({ id: 'old_one', legacy: true });
    assert.equal(recovery.recover(baseline).state.characters.hero.draft.correctionReason, 'Correct a transcribed load');
});

test('each character retains a separate checkpoint', () => {
    const env = environment(), recovery = createDraftRecovery(env), baseline = fixture();
    createCharacter(baseline, { id: 'other', name: 'Other', routeId: 'saiyan' });
    const working = structuredClone(baseline); working.characters.hero.draft = draft(45); working.characters.other.draft = draft(70);
    recovery.checkpoint(working, 'hero'); recovery.checkpoint(working, 'other');
    const recovered = recovery.recover(baseline);
    assert.deepEqual(recovered.recovered.sort(), ['hero', 'other']);
    assert.equal(recovered.state.characters.hero.draft.entries[0].sets[0].weight, 45);
    assert.equal(recovered.state.characters.other.draft.entries[0].sets[0].weight, 70);
});
