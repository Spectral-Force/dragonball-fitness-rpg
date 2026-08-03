(function installDragonBallFitnessV6Config(root) {
    'use strict';

    const sagaTargetWeeks = Object.freeze({
        db_pilaf: 0,
        db_tournament: 3,
        db_red_ribbon: 6,
        db_general_blue: 9,
        db_commander_red: 12,
        db_baba: 15,
        db_tien: 18,
        db_king_piccolo: 21,
        db_piccolo_jr: 24,
        dbz_raditz: 29,
        dbz_vegeta: 33,
        dbz_namek: 39,
        dbz_ginyu: 45,
        dbz_frieza: 51,
        dbz_garlic: 56,
        dbz_trunks: 60,
        dbz_androids: 65,
        dbz_cell_imperfect: 69,
        dbz_cell_perfect: 74,
        dbz_cell_games: 78,
        dbz_other_world: 82,
        dbz_great_saiyaman: 86,
        dbz_world_tournament: 89,
        dbz_babidi: 93,
        dbz_buu: 97,
        dbz_fusion: 101,
        dbz_kid_buu: 105,
        daima_demon: 110,
        daima_supreme_kai: 113,
        daima_true_form: 116,
        dbs_beerus: 120,
        dbs_golden_frieza: 125,
        dbs_universe6: 129,
        dbs_copy_vegeta: 134,
        dbs_future_trunks: 138,
        dbs_universe_survival: 144,
        dbs_galactic_patrol: 150,
        dbs_granolah: 156
    });

    const transformationMasteryRanks = Object.freeze([
        { key: 'G', xp: 0, effectMod: -0.20, label: 'Rank G' },
        { key: 'F', xp: 225, effectMod: -0.15, label: 'Rank F' },
        { key: 'E', xp: 638, effectMod: -0.10, label: 'Rank E' },
        { key: 'D', xp: 1350, effectMod: -0.05, label: 'Rank D' },
        { key: 'C', xp: 2400, effectMod: 0.00, label: 'Rank C' },
        { key: 'B', xp: 3900, effectMod: 0.05, label: 'Rank B' },
        { key: 'A', xp: 6150, effectMod: 0.10, label: 'Rank A' },
        { key: 'S', xp: 9375, effectMod: 0.20, label: 'Rank S' },
        { key: 'Z', xp: 13500, effectMod: 0.35, label: 'Rank Z' },
        { key: 'SUPER', xp: 18000, effectMod: 0.50, label: 'Super Rank' }
    ]);

    const racePowerPaths = Object.freeze({
        earthling: {
            label: 'Earthling',
            route: 'Technique, Kaioken, Potential Unlocked and divine control',
            stateLabel: 'Potential State',
            identity: 'Efficient partners and abilities with low-fatigue power states'
        },
        saiyan: {
            label: 'Saiyan',
            route: 'Kaioken, Super Saiyan forms, God Ki and instinct/ego paths',
            stateLabel: 'Transformation',
            identity: 'Large battle multipliers balanced by mastery and control'
        },
        hybrid: {
            label: 'Saiyan-Human Hybrid',
            route: 'Rage, Potential Unlocked, Super Saiyan and Beast-style awakenings',
            stateLabel: 'Awakening',
            identity: 'Explosive potential spikes with strong Spirit growth'
        },
        namekian: {
            label: 'Namekian',
            route: 'Assimilation, warrior fusion, Giant, Potential and Orange forms',
            stateLabel: 'Assimilation State',
            identity: 'Permanent assimilation growth with durable battle states'
        },
        android: {
            label: 'Android',
            route: 'Choose an Infinite Energy reactor path or a Bio-Android adaptation path',
            stateLabel: 'Evolution State',
            identity: 'Stable power and recovery, or bounded partner-trait adaptation'
        },
        frieza_race: {
            label: "Frieza's Race",
            route: 'Suppression release, evolved forms, Golden and Black states',
            stateLabel: 'Released Form',
            identity: 'Efficient transformations and extreme late-game scaling'
        },
        majin: {
            label: 'Majin',
            route: 'Regeneration mastery, partner absorption and copied techniques',
            stateLabel: 'Absorption State',
            identity: 'Flexible power states assembled from absorbed allies'
        }
    });

    const statWeights = Object.freeze({
        STR: 1.10,
        END: 0.95,
        AGI: 1.00,
        VIT: 0.90,
        SPI: 1.15,
        TEC: 1.05,
        GKI: 3.00
    });

    const earlyCampaignBaseTargets = Object.freeze([
        [0, 12],
        [3, 90],
        [6, 110],
        [9, 125],
        [12, 140],
        [15, 155],
        [18, 190],
        [21, 260],
        [24, 416]
    ]);

    function interpolateLogarithmically(fromValue, toValue, progress) {
        const bounded = Math.max(0, Math.min(1, Number(progress) || 0));
        return fromValue * Math.pow(toValue / fromValue, bounded);
    }

    function basePowerTargetForWeek(rawWeek) {
        const week = Math.max(0, Math.min(156, Number(rawWeek) || 0));
        if (week <= 24) {
            const upperIndex = earlyCampaignBaseTargets.findIndex(([targetWeek]) => targetWeek >= week);
            if (upperIndex <= 0) return earlyCampaignBaseTargets[0][1];
            const [upperWeek, upperValue] = earlyCampaignBaseTargets[upperIndex];
            const [lowerWeek, lowerValue] = earlyCampaignBaseTargets[upperIndex - 1];
            const progress = (week - lowerWeek) / Math.max(1, upperWeek - lowerWeek);
            return Math.round(lowerValue + (upperValue - lowerValue) * progress);
        }
        // The late campaign asks an optimal Tim-plan player to grow durable
        // base fitness PL from 416 to about 75,000. The anime-sized numbers
        // still come from the equipped transformation or race-equivalent state.
        return Math.round(interpolateLogarithmically(416, 75000, (week - 24) / 132));
    }

    function weightedScore(stats, includeGodKi = false) {
        const source = stats || {};
        return Object.entries(statWeights).reduce((total, [stat, weight]) => {
            if (stat === 'GKI' && !includeGodKi) return total;
            const value = Number(source[stat]);
            return total + (Number.isFinite(value) ? value : 0) * weight;
        }, 0);
    }

    function basePower(stats, startingStats, includeGodKi = false, seed = 5) {
        const delta = Math.max(0, weightedScore(stats, includeGodKi) - weightedScore(startingStats, false));
        return Math.max(1, seed + delta);
    }

    function effectivePower(basePL, equippedStateMultiplier = 1) {
        return Math.max(1, Number(basePL || 0) * Math.max(1, Number(equippedStateMultiplier || 1)));
    }

    function cappedBucketMultiplier(rawBonus, cap = 1.5) {
        const bonus = Math.max(0, Number(rawBonus || 0));
        const safeCap = Math.max(0.01, Number(cap || 1.5));
        return 1 + safeCap * (1 - Math.exp(-bonus / safeCap));
    }

    function targetWeekForSaga(sagaId) {
        return sagaTargetWeeks[sagaId] ?? null;
    }

    root.DBZ_V6_CONFIG = Object.freeze({
        version: 'v6.4',
        schemaVersion: 33,
        campaignWeeks: 156,
        campaignYears: 3,
        expectedGoodRouteWeeks: Object.freeze([180, 210]),
        casualRouteWeeks: Object.freeze([220, 300]),
        weeklyStoryXPCap: 50,
        sagaTargetWeeks,
        transformationMasteryRanks,
        racePowerPaths,
        statWeights,
        recovery: Object.freeze({
            permanentDecayEnabled: false,
            noTrainingGraceDays: 14,
            weeklyConsistencyTarget: 3,
            highLoadDayThreshold: 4,
            readinessFloor: 35
        }),
        inputLimits: Object.freeze({
            reps: 1000,
            weightKg: 1000,
            seconds: 14400,
            durationMinutes: 1440,
            distanceKm: 500,
            speedKph: 150
        }),
        balanceAcceptance: Object.freeze({
            targetBasePowerAtFinale: 75000,
            timPlanBaseGainPerActiveWeek: 240,
            optimal: Object.freeze({ attendance: 0.92, boundedGrowthMultiplier: 2.22, expectedWeeks: 156 }),
            sensible: Object.freeze({ attendance: 0.86, boundedGrowthMultiplier: 1.82, expectedWeeks: 200 }),
            casual: Object.freeze({ attendance: 0.78, boundedGrowthMultiplier: 1.45, expectedWeeks: 277 }),
            raw: Object.freeze({ attendance: 0.92, boundedGrowthMultiplier: 1.00, expectedWeeks: 340 })
        }),
        weightedScore,
        basePower,
        effectivePower,
        cappedBucketMultiplier,
        basePowerTargetForWeek,
        targetWeekForSaga
    });
})(globalThis);
