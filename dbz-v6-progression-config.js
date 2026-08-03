(function installDragonBallFitnessProgressionConfig(root) {
    'use strict';

    const baseConfig = root.DBZ_V6_CONFIG;
    if (!baseConfig) throw new Error('DBZ_V6_CONFIG must load before the progression configuration.');

    const deepFreeze = value => {
        if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
        Object.values(value).forEach(deepFreeze);
        return Object.freeze(value);
    };

    const stateBands = [
        { id: 'base', multiplier: 1, sagaId: 'dbz_raditz', label: 'Base' },
        { id: 'first_break', multiplier: 3, sagaId: 'dbz_vegeta', label: 'First Break' },
        { id: 'surge', multiplier: 10, sagaId: 'dbz_namek', label: 'Surge' },
        { id: 'mastered_surge', multiplier: 20, sagaId: 'dbz_ginyu', label: 'Mastered Surge' },
        { id: 'z_state', multiplier: 50, sagaId: 'dbz_frieza', label: 'Z State' },
        { id: 'evolved_z', multiplier: 100, sagaId: 'dbz_cell_games', label: 'Evolved Z' },
        { id: 'ultimate_mortal', multiplier: 400, sagaId: 'dbz_buu', label: 'Ultimate Mortal' },
        { id: 'ascendant_mortal', multiplier: 800, sagaId: 'daima_true_form', label: 'Ascendant Mortal' },
        { id: 'divine', multiplier: 1000, sagaId: 'dbs_beerus', label: 'Divine' },
        { id: 'divine_mastery', multiplier: 2000, sagaId: 'dbs_golden_frieza', label: 'Divine Mastery' },
        { id: 'transcendent', multiplier: 3500, sagaId: 'dbs_future_trunks', label: 'Transcendent' },
        { id: 'tournament_apex', multiplier: 10000, sagaId: 'dbs_universe_survival', label: 'Tournament Apex' },
        { id: 'cosmic_mastery', multiplier: 50000, sagaId: 'dbs_galactic_patrol', label: 'Cosmic Mastery' },
        { id: 'finale', multiplier: 80000, sagaId: 'dbs_granolah', label: 'Finale' }
    ];

    const sagaBandById = {
        db_pilaf: 'base', db_tournament: 'base', db_red_ribbon: 'base', db_general_blue: 'base',
        db_commander_red: 'base', db_baba: 'base', db_tien: 'base', db_king_piccolo: 'base',
        db_piccolo_jr: 'base', dbz_raditz: 'base', dbz_vegeta: 'first_break', dbz_namek: 'surge',
        dbz_ginyu: 'mastered_surge', dbz_frieza: 'z_state', dbz_garlic: 'z_state', dbz_trunks: 'z_state',
        dbz_androids: 'z_state', dbz_cell_imperfect: 'z_state', dbz_cell_perfect: 'z_state',
        dbz_cell_games: 'evolved_z', dbz_other_world: 'evolved_z', dbz_great_saiyaman: 'evolved_z',
        dbz_world_tournament: 'evolved_z', dbz_babidi: 'evolved_z', dbz_buu: 'ultimate_mortal',
        dbz_fusion: 'ultimate_mortal', dbz_kid_buu: 'ultimate_mortal', daima_demon: 'ultimate_mortal',
        daima_supreme_kai: 'ultimate_mortal', daima_true_form: 'ascendant_mortal', dbs_beerus: 'divine',
        dbs_golden_frieza: 'divine_mastery', dbs_universe6: 'divine_mastery',
        dbs_copy_vegeta: 'divine_mastery', dbs_future_trunks: 'transcendent',
        dbs_universe_survival: 'tournament_apex', dbs_galactic_patrol: 'cosmic_mastery',
        dbs_granolah: 'finale'
    };

    const bandById = Object.fromEntries(stateBands.map(band => [band.id, band]));
    const sagaIds = Object.keys(baseConfig.sagaTargetWeeks);
    const sagas = sagaIds.map((id, index) => {
        const targetWeek = baseConfig.sagaTargetWeeks[id];
        const nextWeek = index + 1 < sagaIds.length ? baseConfig.sagaTargetWeeks[sagaIds[index + 1]] : targetWeek;
        const unlockWeek = id === 'dbs_granolah' ? Math.max(0, targetWeek - 3) : targetWeek;
        const clearWeek = index + 1 < sagaIds.length
            ? Math.max(targetWeek + 1, Math.round(targetWeek + (nextWeek - targetWeek) * 0.65))
            : targetWeek;
        const band = bandById[sagaBandById[id] || 'base'];
        const previousBand = index > 0 ? bandById[sagaBandById[sagaIds[index - 1]] || 'base'] : band;
        const baseEndPL = baseConfig.basePowerTargetForWeek(targetWeek);
        const godPowerRequirement = band.multiplier >= 1000
            ? Math.round(Math.pow(band.multiplier / 1000, 0.72) * Math.max(1, baseEndPL / 1200))
            : 0;
        return {
            id,
            targetWeek,
            unlockWeek,
            clearWeek,
            baseEndPL,
            stateBandId: band.id,
            stateMultiplier: band.multiplier,
            previousStateMultiplier: previousBand.multiplier,
            effectiveEndPL: Math.round(baseEndPL * band.multiplier),
            storyUnlockXP: unlockWeek * baseConfig.weeklyStoryXPCap,
            storyClearXP: clearWeek * baseConfig.weeklyStoryXPCap,
            focusClearXP: Math.max(20, Math.round(Math.max(1, clearWeek - targetWeek) * (id.startsWith('dbs_') ? 34 : id.startsWith('daima_') ? 32 : id.startsWith('dbz_') ? 30 : 20))),
            godPowerRequirement,
            breakthroughIds: stateBands.filter(candidate => candidate.sagaId === id).map(candidate => candidate.id)
        };
    });

    const requirementByBand = {
        base: { baseShare: 0, focusXP: 0, support: 0, resource: 0 },
        first_break: { baseShare: 0.72, focusXP: 20, support: 5, resource: 5 },
        surge: { baseShare: 0.74, focusXP: 35, support: 10, resource: 10 },
        mastered_surge: { baseShare: 0.76, focusXP: 45, support: 14, resource: 14 },
        z_state: { baseShare: 0.78, focusXP: 60, support: 18, resource: 18 },
        evolved_z: { baseShare: 0.79, focusXP: 75, support: 23, resource: 24 },
        ultimate_mortal: { baseShare: 0.80, focusXP: 90, support: 28, resource: 31 },
        ascendant_mortal: { baseShare: 0.80, focusXP: 95, support: 32, resource: 38 },
        divine: { baseShare: 0.81, focusXP: 105, support: 36, resource: 44 },
        divine_mastery: { baseShare: 0.81, focusXP: 110, support: 40, resource: 49 },
        transcendent: { baseShare: 0.82, focusXP: 115, support: 44, resource: 55 },
        tournament_apex: { baseShare: 0.82, focusXP: 120, support: 48, resource: 61 },
        cosmic_mastery: { baseShare: 0.82, focusXP: 125, support: 52, resource: 68 },
        finale: { baseShare: 0.82, focusXP: 130, support: 56, resource: 74 }
    };

    const routeNames = {
        saiyan: ['Base', 'Kaioken Break', 'Kaioken Surge', 'Kaioken Mastery', 'Super Saiyan', 'Super Saiyan 2', 'Super Saiyan 3', 'Primal Ascendant', 'Super Saiyan God', 'Super Saiyan Blue', 'Blue Evolution', 'Instinct Sign', 'Cosmic Saiyan Mastery', 'True Instinct'],
        earthling: ['Base', 'Full Potential', 'Technique Surge', 'Potential Unlocked', 'Human Limit Break', 'Master Martial State', 'Ultimate Human', 'Earthborn Ascendant', 'Divine Technique', 'God Ki Control', 'Perfected Discipline', 'Technique Apex', 'Earthborn Mastery', 'Limitless Human'],
        hybrid: ['Base', 'Rage Spark', 'Heritage Surge', 'Awakened Potential', 'Super Saiyan', 'Super Saiyan 2 Rage', 'Ultimate Potential', 'Beast Omen', 'Divine Potential', 'God Ki Awakening', 'Beast Spark', 'Beast Awakened', 'Beast Mastery', 'Perfected Beast'],
        namekian: ['Base', 'Power Expansion', 'Namekian Power', 'Warrior Fusion', 'Super Namekian', 'Super Namekian Mastery', 'Potential Awakened', 'Dragon Ascendant', 'Orange Awakening', 'Controlled Orange', 'Dragon Force', 'Orange Apex', 'Dragon Awakening', 'Orange Mastery'],
        android_infinite: ['Base Frame', 'Reactor Overclock', 'Infinite Drive', 'Drive Mastery', 'Combat Frame', 'Limitless Battery', 'Perfect Overclock', 'Ascendant Core', 'Divine Reactor', 'God Engine', 'Quantum Frame', 'Quantum Engine', 'Cosmic Core', 'Limitless Core'],
        android_bio: ['Base Genome', 'Adaptation Scan', 'Adaptive Drive', 'Template Mastery', 'Power Charge', 'Perfect Evolution', 'Super Perfect', 'Adaptive Apex', 'Divine Bio-Core', 'God Genome', 'Quantum Adaptation', 'Template Apex', 'Cosmic Adaptation', 'Perfected Genome'],
        majin: ['Base Body', 'Body Control', 'Regeneration Release', 'First Core', 'Absorption State', 'Core Fusion', 'Super Majin', 'Pure Majin Mastery', 'Divine Regeneration', 'God Body', 'Perfected Cores', 'Regeneration Apex', 'Cosmic Regeneration', 'Finale Core Mastery'],
        frieza_race: ['Suppressed Form', 'Controlled Release', 'Second Release', 'Third Release', 'Final Form Release', '100% Control', 'Evolved Form', 'Cooler Mastery', 'Golden Form', 'True Golden', 'Perfected Golden', 'Golden Apex', 'Black Form', 'Black Mastery']
    };

    const routeFormIds = {
        saiyan: [[], ['kaioken_x3'], ['kaioken_x10', 'oozaru'], ['kaioken_x20'], ['super_saiyan'], ['super_saiyan_2'], ['super_saiyan_3'], ['super_saiyan_4', 'golden_great_ape'], ['super_saiyan_god'], ['super_saiyan_blue'], ['ssb_evolved', 'super_saiyan_rage', 'super_saiyan_rose'], ['ultra_instinct_sign', 'legendary_super_saiyan'], ['mastered_ultra_instinct', 'ssb_kaioken_x20', 'ultra_ego'], ['ultra_instinct_selfishness']],
        earthling: [[], ['human_full_potential', 'kaioken_x3'], ['kaioken_x10'], ['human_potential_unlocked', 'kaioken_x20'], [], [], [], [], [], [], [], ['ultra_instinct_sign'], ['mastered_ultra_instinct'], ['ultra_instinct_selfishness']],
        hybrid: [[], ['kaioken_x3'], ['kaioken_x10'], ['kaioken_x20'], ['super_saiyan'], ['super_saiyan_2_gohan', 'super_saiyan_2'], ['potential_unlocked'], ['potential_unlocked'], [], [], [], ['beast_gohan'], ['beast_gohan'], ['beast_gohan']],
        namekian: [[], ['giant_namek'], ['giant_namek'], ['warrior_fusion'], ['super_namek'], ['super_namek'], [], [], ['orange_piccolo'], ['orange_piccolo'], ['orange_piccolo'], ['orange_piccolo'], ['orange_piccolo'], ['orange_piccolo']],
        android_infinite: [[], [], [], [], [], [], [], [], [], [], [], [], [], []],
        android_bio: [[], [], [], [], ['power_charge'], ['perfect_form'], ['super_perfect_form'], ['super_perfect_form'], [], [], [], [], [], []],
        majin: [[], [], [], [], [], [], [], [], [], [], [], [], [], []],
        frieza_race: [[], ['second_form'], ['second_form'], ['third_form'], ['final_form_5', 'final_form'], ['100_percent_frieza'], ['cooler_form'], ['cooler_form'], ['golden_frieza'], ['true_golden_frieza'], ['true_golden_frieza'], ['true_golden_frieza'], ['black_frieza'], ['black_frieza']]
    };

    const routeMetadata = {
        saiyan: { race: 'saiyan', label: 'Saiyan Battle Evolution', resourceLabel: 'Battle Control', color: '#f4b942', icon: 'S' },
        earthling: { race: 'earthling', label: 'Earthling Limit Break', resourceLabel: 'Technique Discipline', color: '#4ba3ff', icon: 'E' },
        hybrid: { race: 'hybrid', label: 'Hybrid Awakened Potential', resourceLabel: 'Potential Control', color: '#9c7cff', icon: 'H' },
        namekian: { race: 'namekian', label: 'Namekian Assimilation', resourceLabel: 'Assimilation Insight', color: '#60d36e', icon: 'N' },
        android_infinite: { race: 'android', label: 'Infinite Energy Android', resourceLabel: 'Reactor Charge', color: '#26d5d1', icon: 'I' },
        android_bio: { race: 'android', label: 'Bio-Android Adaptation', resourceLabel: 'Template Quality', color: '#7ddc7a', icon: 'B' },
        majin: { race: 'majin', label: 'Majin Body Evolution', resourceLabel: 'Body Control', color: '#ff76c8', icon: 'M' },
        frieza_race: { race: 'frieza_race', label: 'Release Control', resourceLabel: 'Release Control', color: '#c989ff', icon: 'F' }
    };

    const routes = Object.fromEntries(Object.entries(routeNames).map(([routeId, names]) => {
        const metadata = routeMetadata[routeId];
        return [routeId, {
            id: routeId,
            ...metadata,
            tiers: stateBands.map((band, index) => ({
                id: `${routeId}:${band.id}`,
                bandId: band.id,
                multiplier: band.multiplier,
                sagaId: band.sagaId,
                name: names[index],
                formIds: routeFormIds[routeId][index],
                ...(requirementByBand[band.id] || requirementByBand.base)
            }))
        }];
    }));

    const transformationAliases = {
        ascended_super_saiyan: 'ascended_ss',
        ultra_super_saiyan: 'ultra_ss',
        super_saiyan_full_power: 'mastered_ss',
        cooler: 'cooler_form',
        human_full_potential_unlocked: 'human_potential_unlocked'
    };

    const sharedTechniques = {
        kaioken: ['kaioken_x1', 'kaioken_x3', 'kaioken_x10', 'kaioken_x20', 'kaioken_x50', 'kaioken_x100'],
        instinct: ['ultra_instinct_sign', 'mastered_ultra_instinct', 'ultra_instinct_selfishness'],
        destruction: ['ultra_ego']
    };

    const routeKeyByRace = {
        earthling: 'earthling', saiyan: 'saiyan', hybrid: 'hybrid', namekian: 'namekian',
        android: 'android_infinite', majin: 'majin', frieza_race: 'frieza_race'
    };

    root.DBZ_V6_PROGRESSION_CONFIG = deepFreeze({
        version: '6.3.0',
        schemaVersion: 32,
        campaignWeeks: 156,
        stateBands,
        sagas,
        sagaBandById,
        routes,
        routeKeyByRace,
        transformationAliases,
        sharedTechniques,
        androidPaths: ['infinite', 'bio'],
        divineDisciplines: ['native', 'instinct', 'destruction'],
        namekianBranches: ['warrior', 'dragon', 'balanced'],
        maxAbsorptionCores: 3,
        maxAdaptationTemplates: 3,
        supportWeights: { mastery: 35, abilities: 25, partners: 20, resource: 20 },
        finaleAcceptance: {
            optimal: [153, 159],
            sensible: [180, 210],
            casual: [240, 300],
            maximumRaceSpread: 6,
            maximumMilestoneGap: 3
        }
    });
})(globalThis);
