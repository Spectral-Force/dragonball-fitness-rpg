import test from "node:test";
import assert from "node:assert/strict";
import "../dbz-v6-config.js";
import {
    boundedExploitGrowthMultiplier,
    raceParityMatrix,
    simulateProfiles
} from "../analysis/v6_balance_model.mjs";

const config = globalThis.DBZ_V6_CONFIG;

function acceptanceWeek(profile) {
    const target = config.balanceAcceptance.targetBasePowerAtFinale - 5;
    return Math.ceil(target / (
        config.balanceAcceptance.timPlanBaseGainPerActiveWeek *
        profile.attendance *
        profile.boundedGrowthMultiplier
    ));
}

test("optimal Tim-plan route lands near the three-year target", () => {
    const week = acceptanceWeek(config.balanceAcceptance.optimal);
    assert.ok(week >= 148 && week <= 160, `optimal finale was week ${week}`);
});

test("sensible and casual routes progress more slowly", () => {
    const sensible = acceptanceWeek(config.balanceAcceptance.sensible);
    const casual = acceptanceWeek(config.balanceAcceptance.casual);
    assert.ok(sensible >= 180 && sensible <= 210, `sensible finale was week ${sensible}`);
    assert.ok(casual >= 240 && casual <= 300, `casual finale was week ${casual}`);
    assert.ok(casual > sensible);
});

test("raw Tim-plan training cannot clear near week 156", () => {
    const raw = acceptanceWeek(config.balanceAcceptance.raw);
    assert.ok(raw > 300);
    const baseAt156 = 5 + 156 *
        config.balanceAcceptance.timPlanBaseGainPerActiveWeek *
        config.balanceAcceptance.raw.attendance;
    assert.ok(baseAt156 < config.balanceAcceptance.targetBasePowerAtFinale * 0.5);
});

test("missed weeks, deloads and illness remain bounded delays rather than decay", () => {
    const matrix = simulateProfiles().timPlan;
    assert.ok(matrix.normalMissedWeeks >= matrix.uninterrupted);
    assert.ok(matrix.deloads >= matrix.normalMissedWeeks);
    assert.ok(matrix.illnessAndHoliday > matrix.deloads);
    assert.ok(matrix.illnessAndHoliday - matrix.uninterrupted < 30);
});

test("race routes are explicit and extreme stacking is capped", () => {
    const parity = raceParityMatrix();
    assert.equal(parity.length, 7);
    assert.ok(parity.every(row => row.competitive && row.targetWeek === 156));
    assert.equal(parity.find(row => row.race === "android").requiredAbsorptions, 3);
    assert.equal(parity.find(row => row.race === "majin").requiredAbsorptions, 3);
    assert.equal(boundedExploitGrowthMultiplier(100, 100, 100), 2.6);
});
