import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRaceSimulationReport, simulateAllProfiles } from '../analysis/v6_race_simulator.mjs';

test('all eight route variants finish the optimal campaign in the three-year window', () => {
    const report = buildRaceSimulationReport();
    assert.equal(report.profiles.optimal.length, 8);
    report.profiles.optimal.forEach(result => assert.ok(result.finaleWeek >= 153 && result.finaleWeek <= 159, `${result.route}: ${result.finaleWeek}`));
    assert.ok(report.optimalSpread <= 6);
});

test('sensible and casual timelines remain deliberately slower but viable', () => {
    const profiles = simulateAllProfiles();
    profiles.sensible.forEach(result => assert.ok(result.finaleWeek >= 180 && result.finaleWeek <= 210));
    profiles.casual.forEach(result => assert.ok(result.finaleWeek >= 240 && result.finaleWeek <= 300));
});

test('ignoring the RPG progression systems stalls instead of receiving free target scaling', () => {
    const profiles = simulateAllProfiles();
    assert.ok(profiles.noRpgSystems.every(result => result.finaleWeek === null));
});
