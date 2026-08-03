import '../dbz-v6-config.js';
import '../dbz-v6-progression-config.js';
import '../dbz-v6-progression-core.js';
import { timPlanWeeklyFixture, timPlanWeek } from './v6_tim_plan_fixture.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const baseConfig = globalThis.DBZ_V6_CONFIG;
const config = globalThis.DBZ_V6_PROGRESSION_CONFIG;
const progression = globalThis.DBZ_V6_PROGRESSION;

export const simulationProfiles = Object.freeze({
    optimal: { attendance: 1, support: 1, systems: true, targetRange: [153, 159] },
    sensible: { attendance: 0.78, support: 0.86, systems: true, targetRange: [180, 210] },
    casual: { attendance: 0.56, support: 0.72, systems: true, targetRange: [240, 300] },
    noRpgSystems: { attendance: 0.92, support: 0.08, systems: false, targetRange: [301, Infinity] }
});

export const simulatedRoutes = Object.freeze([
    { race: 'earthling' },
    { race: 'saiyan' },
    { race: 'hybrid' },
    { race: 'namekian', namekianBranch: 'balanced' },
    { race: 'android', androidPath: 'infinite' },
    { race: 'android', androidPath: 'bio' },
    { race: 'majin' },
    { race: 'frieza_race' }
]);

const transformations = [{ id: 'base', race: 'universal', name: 'Base Form', mult: 1, powerMultiplier: 1 }];
const abilities = [{ id: 'route_ability_1' }, { id: 'route_ability_2' }, { id: 'route_ability_3' }];

function buildCharacter(route) {
    const char = {
        race: route.race,
        storyXP: 0,
        totalTXP: 0,
        completedSagas: [],
        sagaProgress: {},
        unlockedTransformations: ['base'],
        equippedTransformations: ['base'],
        activeTransformation: 'base',
        transformationSlots: 1,
        transformationMastery: { base: { xp: 18000 } },
        purchasedAbilities: {},
        abilityLevels: {},
        equippedAbilities: [],
        activePartners: [],
        partnerLevels: {},
        workoutLog: [],
        raceProgression: {
            androidPath: route.androidPath,
            namekianBranch: route.namekianBranch,
            divineDiscipline: 'native'
        }
    };
    progression.ensureCharacterProgression(char, { transformations });
    return char;
}

function updateSupport(char, campaignProgress, profile, route) {
    if (!profile.systems) return;
    const development = Math.min(1, campaignProgress / 138) * profile.support;
    const abilityLevel = Math.max(1, Math.min(5, Math.ceil(development * 5)));
    char.equippedAbilities = abilities.map(ability => ability.id);
    abilities.forEach(ability => {
        char.purchasedAbilities[ability.id] = abilityLevel;
        char.abilityLevels[ability.id] = { level: abilityLevel };
    });
    char.activePartners = ['route_partner_1', 'route_partner_2', 'route_partner_3'];
    const partnerLevel = Math.max(1, Math.round(1 + development * 99));
    char.activePartners.forEach(id => { char.partnerLevels[id] = { level: partnerLevel, totalXp: partnerLevel * partnerLevel * 20 }; });

    const routeId = progression.routeIdForCharacter(char);
    if (['android_bio', 'majin'].includes(routeId)) {
        const key = routeId === 'android_bio' ? 'adaptationTemplates' : 'absorptionCores';
        const desired = campaignProgress >= 120 ? 3 : campaignProgress >= 78 ? 2 : campaignProgress >= 45 ? 1 : 0;
        while (char.raceProgression[key].length < desired) {
            const index = char.raceProgression[key].length + 1;
            char.raceProgression[key].push({
                id: `${routeId}_${index}`,
                sourcePartnerId: `route_partner_${index}`,
                sourcePartnerName: `Route Partner ${index}`,
                trait: { type: 'stat', key: index === 1 ? 'VIT' : index === 2 ? 'SPI' : 'TEC', value: 0.05 },
                quality: Math.round(55 + development * 40),
                active: true
            });
        }
    }
    if (route.race === 'namekian') char.raceProgression.namekianBranch = route.namekianBranch || 'balanced';
}

function sagaStatusAtProgress(saga, campaignProgress) {
    if (campaignProgress >= saga.clearWeek) return 'cleared';
    if (campaignProgress >= saga.unlockWeek) return 'unlocked';
    return 'locked';
}

export function simulateRoute(route, profileName = 'optimal', maxWeeks = 420) {
    const profile = simulationProfiles[profileName];
    if (!profile) throw new Error(`Unknown profile: ${profileName}`);
    const char = buildCharacter(route);
    const trace = [];
    let finaleWeek = null;

    for (let week = 0; week <= maxWeeks; week += 1) {
        const plan = timPlanWeek(Math.max(1, week));
        const campaignProgress = Math.min(156, week * profile.attendance);
        const basePower = baseConfig.basePowerTargetForWeek(campaignProgress);
        char.storyXP = Math.min(7800, campaignProgress * 50);
        char.totalTXP = campaignProgress * timPlanWeeklyFixture.rawBasePowerGain;
        char.completedSagas = [];
        config.sagas.forEach(saga => {
            const status = sagaStatusAtProgress(saga, campaignProgress);
            const focusXP = Math.max(0, (campaignProgress - saga.unlockWeek) * 50);
            char.sagaProgress[saga.id] = { status, focusXP };
            if (status === 'cleared') char.completedSagas.push(saga.id);
        });
        updateSupport(char, campaignProgress, profile, route);
        const context = {
            transformations,
            abilities,
            basePower,
            getSagaStatus: (candidate, id) => candidate.sagaProgress[id]?.status || 'locked',
            getActivePartnerIds: candidate => candidate.activePartners || [],
            getMasteryRank: () => 'G'
        };
        const result = progression.syncCharacterProgression(char, context);
        const milestone = progression.getNextRaceMilestone(char, context);
        const powerState = progression.getRacePowerState(char, context);
        trace.push({
            week,
            planWeek: plan.week,
            campaignProgress: +campaignProgress.toFixed(2),
            basePower,
            storyXP: char.storyXP,
            routeId: result.route.id,
            tier: milestone.current.bandId,
            multiplier: powerState.multiplier,
            support: milestone.support.total,
            blockers: milestone.nextStatus?.blockers || []
        });
        if (milestone.current.bandId === 'finale' && char.storyXP >= 7800) {
            finaleWeek = week;
            break;
        }
    }
    return { route: progression.routeIdForCharacter(char), profile: profileName, finaleWeek, trace };
}

export function simulateAllProfiles() {
    return Object.fromEntries(Object.keys(simulationProfiles).map(profileName => [
        profileName,
        simulatedRoutes.map(route => simulateRoute(route, profileName))
    ]));
}

export function buildRaceSimulationReport() {
    const profiles = simulateAllProfiles();
    const optimalWeeks = profiles.optimal.map(result => result.finaleWeek).filter(Number.isFinite);
    return {
        version: config.version,
        campaignWeeks: config.campaignWeeks,
        profiles: Object.fromEntries(Object.entries(profiles).map(([name, results]) => [name, results.map(result => ({ route: result.route, finaleWeek: result.finaleWeek }))])),
        optimalSpread: optimalWeeks.length ? Math.max(...optimalWeeks) - Math.min(...optimalWeeks) : null
    };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    console.log(JSON.stringify(buildRaceSimulationReport(), null, 2));
}
