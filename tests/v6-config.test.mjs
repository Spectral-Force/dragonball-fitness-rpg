import test from "node:test";
import assert from "node:assert/strict";
import "../dbz-v6-config.js";

const config = globalThis.DBZ_V6_CONFIG;

test("v6 reports one consistent campaign and schema version", () => {
    assert.equal(config.version, "v6.0");
    assert.equal(config.schemaVersion, 31);
    assert.equal(config.campaignWeeks, 156);
    assert.equal(config.targetWeekForSaga("dbs_granolah"), 156);
});

test("saga target weeks and base-power targets rise monotonically", () => {
    const rows = Object.entries(config.sagaTargetWeeks);
    assert.ok(rows.length >= 35);
    let previousWeek = -1;
    let previousPower = 0;
    for (const [id, week] of rows) {
        assert.ok(week > previousWeek, `${id} week must rise`);
        const power = config.basePowerTargetForWeek(week);
        assert.ok(power > previousPower, `${id} base target must rise`);
        previousWeek = week;
        previousPower = power;
    }
    assert.equal(config.basePowerTargetForWeek(156), 75000);
});

test("base fitness power is linear and boost buckets have diminishing returns", () => {
    const start = { STR: 10, END: 7, AGI: 7, VIT: 7, SPI: 7, TEC: 6, GKI: 0 };
    const plusTen = { ...start, STR: 20 };
    const plusTwenty = { ...start, STR: 30 };
    const first = config.basePower(plusTen, start);
    const second = config.basePower(plusTwenty, start);
    assert.equal(second - 5, 2 * (first - 5));
    assert.ok(config.cappedBucketMultiplier(100, 0.5) < 1.501);
});

test("all seven supported races have an explicit progression identity", () => {
    assert.deepEqual(
        Object.keys(config.racePowerPaths).sort(),
        ["android", "earthling", "frieza_race", "hybrid", "majin", "namekian", "saiyan"].sort()
    );
    Object.values(config.racePowerPaths).forEach(path => {
        assert.ok(path.route.length > 20);
        assert.ok(path.stateLabel);
    });
});
