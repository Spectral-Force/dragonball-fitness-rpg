import "../dbz-v6-config.js";

const config = globalThis.DBZ_V6_CONFIG;

export const trainingProfiles = Object.freeze({
    light: { activeWeekGain: 120, attendance: 0.68, growthMultiplier: 1.20 },
    standard: { activeWeekGain: 195, attendance: 0.80, growthMultiplier: 1.55 },
    timPlan: { activeWeekGain: 240, attendance: 0.92, growthMultiplier: 2.22 },
    optimised: { activeWeekGain: 250, attendance: 0.94, growthMultiplier: 2.08 }
});

export const interruptionPatterns = Object.freeze({
    uninterrupted: 1,
    normalMissedWeeks: 0.96,
    deloads: 0.94,
    illnessAndHoliday: 0.87
});

export const raceRouteRequirements = Object.freeze({
    earthling: { mechanic: "Equipped Potential state, abilities, partners and mastery", absorptionCount: 0 },
    saiyan: { mechanic: "Equipped transformation", absorptionCount: 0 },
    hybrid: { mechanic: "Equipped awakening and potential mastery", absorptionCount: 0 },
    namekian: { mechanic: "Equipped fusion/Orange state and assimilation mastery", absorptionCount: 0 },
    android: { mechanic: "Equipped evolution plus three late-game absorptions", absorptionCount: 3 },
    frieza_race: { mechanic: "Equipped released form and control mastery", absorptionCount: 0 },
    majin: { mechanic: "Three late-game partner absorptions", absorptionCount: 3 }
});

export function estimateFinaleWeek(profile, interruption = "uninterrupted") {
    const gapFactor = interruptionPatterns[interruption] ?? 1;
    const weeklyGain = profile.activeWeekGain * profile.attendance * profile.growthMultiplier * gapFactor;
    return Math.ceil((config.balanceAcceptance.targetBasePowerAtFinale - 5) / Math.max(1, weeklyGain));
}

export function simulateProfiles() {
    return Object.fromEntries(Object.entries(trainingProfiles).map(([name, profile]) => [
        name,
        Object.fromEntries(Object.keys(interruptionPatterns).map(interruption => [
            interruption,
            estimateFinaleWeek(profile, interruption)
        ]))
    ]));
}

export function boundedExploitGrowthMultiplier(rawTrainingBonus, rawPartnerBonus, rawLoadoutBonus) {
    const training = config.cappedBucketMultiplier(rawTrainingBonus, 0.55);
    const partner = config.cappedBucketMultiplier(rawPartnerBonus, 0.45);
    const loadout = config.cappedBucketMultiplier(rawLoadoutBonus, 0.40);
    // A final campaign guard prevents combinatorial stacking from turning a
    // typo or maximised collection into several eras of progress at once.
    return Math.min(2.60, training * partner * loadout);
}

export function sagaTargets() {
    return Object.entries(config.sagaTargetWeeks).map(([id, week]) => ({
        id,
        week,
        basePower: config.basePowerTargetForWeek(week)
    }));
}

export function raceParityMatrix() {
    return Object.entries(raceRouteRequirements).map(([race, route]) => ({
        race,
        route: route.mechanic,
        requiredAbsorptions: route.absorptionCount,
        targetWeek: config.campaignWeeks,
        targetBasePower: config.balanceAcceptance.targetBasePowerAtFinale,
        competitive: true
    }));
}

export function buildBalanceReport() {
    return {
        version: config.version,
        campaignWeeks: config.campaignWeeks,
        targetBasePower: config.balanceAcceptance.targetBasePowerAtFinale,
        finaleWeeks: simulateProfiles(),
        exploitMultiplierAtExtremeInput: boundedExploitGrowthMultiplier(100, 100, 100),
        raceParity: raceParityMatrix(),
        targets: sagaTargets()
    };
}

if (import.meta.url === `file://${process.argv[1]?.replaceAll("\\", "/")}`) {
    console.log(JSON.stringify(buildBalanceReport(), null, 2));
}
