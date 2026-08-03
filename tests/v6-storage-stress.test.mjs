import test from "node:test";
import assert from "node:assert/strict";
import "../dbz-v6-config.js";
import "../dbz-v6-progression-config.js";

globalThis.addEventListener = () => {};
globalThis.document = {
    documentElement: { dataset: {} },
    body: {},
    dispatchEvent: () => {}
};
globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
    }
};
globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
};

await import("../dbz-v6-storage.js");

function character(overrides = {}) {
    return {
        name: "Five Year Tester",
        race: "earthling",
        stats: { STR: 100, END: 100, AGI: 100, VIT: 100, SPI: 100, TEC: 100, GKI: 0 },
        workoutLog: [],
        ...overrides
    };
}

function saveWith(activeCharacter) {
    return {
        version: "v6.3",
        schemaVersion: 32,
        activeCharacter: "tim",
        characters: { tim: activeCharacter }
    };
}

test("a detailed five-year save remains comfortably below the import ceiling", () => {
    const workouts = Array.from({ length: 5 * 52 * 4 }, (_, index) => ({
        date: new Date(Date.UTC(2026, 0, 1 + Math.floor(index * 7 / 4))).toISOString().slice(0, 10),
        totalTXP: 250,
        notes: "Normal Tim-plan session",
        wellness: { rpe: 7, rir: 2, deload: index % 32 === 0 },
        exercises: Array.from({ length: 8 }, (__, exerciseIndex) => ({
            name: `Exercise ${exerciseIndex + 1}`,
            type: "weighted",
            inputs: { reps: 10, weight: 80 },
            statGains: { STR: 2.5, END: 1.5, AGI: 0.5, VIT: 1, SPI: 0.5, TEC: 0.5, GKI: 0 }
        }))
    }));
    const candidate = saveWith(character({ workoutLog: workouts }));
    const bytes = Buffer.byteLength(JSON.stringify(candidate));
    assert.ok(bytes < 5 * 1024 * 1024, `five-year save was ${bytes} bytes`);
    const validated = globalThis.DBZV6Storage.validateImportedSave(candidate, bytes);
    assert.equal(validated.characters.tim.workoutLog.length, workouts.length);
    assert.notEqual(validated, candidate);
});

test("malformed, future-schema, invalid-date and outlier imports are rejected", () => {
    assert.throws(
        () => globalThis.DBZV6Storage.validateImportedSave({ schemaVersion: 32, characters: [] }),
        /characters collection/
    );
    assert.throws(
        () => globalThis.DBZV6Storage.validateImportedSave({ ...saveWith(character()), schemaVersion: 33 }),
        /Unsupported save schema/
    );
    assert.throws(
        () => globalThis.DBZV6Storage.validateImportedSave(
            saveWith(character({ workoutLog: [{ date: "tomorrow-ish", exercises: [] }] }))
        ),
        /valid game date/
    );
    assert.throws(
        () => globalThis.DBZV6Storage.validateImportedSave(
            saveWith(character({ workoutLog: [{ date: "2026-07-24", exercises: [{ inputs: { distance: 999 } }] }] }))
        ),
        /accepted range/
    );
    assert.throws(
        () => globalThis.DBZV6Storage.validateImportedSave(
            saveWith(character({ stats: { STR: Number.NaN } }))
        ),
        /invalid STR stat/
    );
});
