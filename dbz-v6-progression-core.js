(function installDragonBallFitnessProgressionCore(root) {
    'use strict';

    const config = root.DBZ_V6_PROGRESSION_CONFIG;
    if (!config) throw new Error('DBZ_V6_PROGRESSION_CONFIG must load before the progression core.');

    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
    const clamp = (value, min, max) => Math.max(min, Math.min(max, number(value)));
    const unique = values => [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
    const raceAliases = {
        human: 'earthling', half_saiyan: 'hybrid', 'half-saiyan': 'hybrid', frieza: 'frieza_race',
        friezas_race: 'frieza_race', "frieza's_race": 'frieza_race', perfect_android: 'android',
        bio_android: 'android'
    };
    const rankPoints = { G: 0, F: 5, E: 10, D: 15, C: 20, B: 25, A: 29, S: 32, Z: 34, SUPER: 35 };
    const statusRank = { locked: 0, unlocked: 1, cleared: 2, mastered: 3 };
    const sagaById = Object.fromEntries(config.sagas.map(saga => [saga.id, saga]));
    const bandIndexById = Object.fromEntries(config.stateBands.map((band, index) => [band.id, index]));

    function normalizeRaceKey(race) {
        const key = String(race || 'earthling').trim().toLowerCase().replace(/[-\s]+/g, '_');
        return raceAliases[key] || key;
    }

    function hasMeaningfulProgress(char) {
        return number(char?.totalTXP) > 0
            || (Array.isArray(char?.workoutLog) && char.workoutLog.length > 0)
            || (Array.isArray(char?.history) && char.history.length > 0)
            || (Array.isArray(char?.completedSagas) && char.completedSagas.length > 0)
            || number(char?.storyXP) > 0;
    }

    function routeIdForCharacter(char) {
        const race = normalizeRaceKey(char?.race);
        if (race !== 'android') return config.routeKeyByRace[race] || 'earthling';
        const chosen = char?.raceProgression?.androidPath;
        if (chosen === 'bio' || chosen === 'infinite') return `android_${chosen}`;
        const legacyAbsorptions = Object.keys(char?.raceAbsorptions?.android?.absorbed || {}).length;
        return legacyAbsorptions ? 'android_bio' : 'android_infinite';
    }

    function routeForCharacter(char) {
        return config.routes[routeIdForCharacter(char)] || config.routes.earthling;
    }

    function canonicalTransformationId(id) {
        return config.transformationAliases[id] || id;
    }

    function isRaceCompatible(char, transformation) {
        if (!transformation) return false;
        const id = canonicalTransformationId(transformation.id);
        const race = normalizeRaceKey(char?.race);
        const routeId = routeIdForCharacter(char);
        if (id === 'base') return true;
        if (race === 'majin') return false;

        if (config.sharedTechniques.kaioken.includes(id)) {
            return ['earthling', 'saiyan', 'hybrid', 'namekian'].includes(race);
        }
        if (config.sharedTechniques.instinct.includes(id)) {
            if (['saiyan', 'hybrid'].includes(race)) return true;
            return ['earthling', 'namekian', 'android'].includes(race)
                && char?.raceProgression?.divineDiscipline === 'instinct';
        }
        if (config.sharedTechniques.destruction.includes(id)) {
            if (race === 'saiyan') return true;
            return ['earthling', 'hybrid', 'namekian', 'android'].includes(race)
                && char?.raceProgression?.divineDiscipline === 'destruction';
        }
        if (routeId === 'android_infinite' && normalizeRaceKey(transformation.race) === 'android') return false;
        if (routeId === 'android_bio' && normalizeRaceKey(transformation.race) === 'android') return true;
        if (transformation.race === 'universal') return true;
        if (race === 'hybrid' && transformation.race === 'saiyan') {
            return !['oozaru', 'golden_great_ape', 'super_saiyan_4', 'legendary_super_saiyan', 'full_power_broly',
                'super_saiyan_god', 'super_saiyan_blue', 'super_saiyan_rose', 'ssb_evolved',
                'ssb_kaioken_x10', 'ssb_kaioken_x20'].includes(id);
        }
        return normalizeRaceKey(transformation.race) === race;
    }

    function requiredTierForTransformation(char, transformationId) {
        const route = routeForCharacter(char);
        const canonicalId = canonicalTransformationId(transformationId);
        return route.tiers.find(tier => tier.formIds.map(canonicalTransformationId).includes(canonicalId)) || null;
    }

    function highestEarnedTierIndex(char) {
        const route = routeForCharacter(char);
        const earned = new Set(char?.raceProgression?.earnedTiers || ['base']);
        let highest = 0;
        route.tiers.forEach((tier, index) => {
            if (earned.has(tier.bandId) || earned.has(tier.id)) highest = Math.max(highest, index);
        });
        return highest;
    }

    function isTransformationUsable(char, transformation, options = {}) {
        if (!isRaceCompatible(char, transformation)) return false;
        if (options.ignoreTier || transformation?.id === 'base') return true;
        const requiredTier = requiredTierForTransformation(char, transformation?.id);
        if (!requiredTier) return true;
        return highestEarnedTierIndex(char) >= bandIndexById[requiredTier.bandId];
    }

    function getUsableTransformationIds(char, transformations = []) {
        const discovered = unique(char?.unlockedTransformations || ['base']);
        const byId = new Map(transformations.map(transformation => [transformation.id, transformation]));
        return discovered.filter(id => {
            const transformation = byId.get(id);
            return transformation && isTransformationUsable(char, transformation);
        });
    }

    function sanitizePrimaryState(char, transformations = []) {
        const usable = new Set(getUsableTransformationIds(char, transformations));
        const raw = unique(Array.isArray(char?.equippedTransformations) && char.equippedTransformations.length
            ? char.equippedTransformations
            : [char?.activeTransformation || 'base']);
        const primaryId = usable.has(raw[0]) ? raw[0] : 'base';
        const echoes = raw.slice(1).filter(id => id !== primaryId && usable.has(id));
        const slotLimit = Math.max(1, Math.floor(number(char?.transformationSlots, 1)));
        const equippedIds = [primaryId, ...echoes].slice(0, slotLimit);
        if (char) {
            const removed = raw.filter(id => !equippedIds.includes(id));
            char.equippedTransformations = equippedIds;
            char.activeTransformation = primaryId;
            if (removed.length) {
                char.raceProgression = char.raceProgression || {};
                char.raceProgression.dormantTransformationIds = unique([
                    ...(char.raceProgression.dormantTransformationIds || []),
                    ...removed.filter(id => id !== 'base')
                ]);
            }
        }
        return { primaryId, echoIds: echoes.slice(0, Math.max(0, slotLimit - 1)), equippedIds };
    }

    function getPrimaryStateMultiplier(char, transformations = []) {
        const state = sanitizePrimaryState(char, transformations);
        const transformation = transformations.find(item => item.id === state.primaryId);
        return Math.max(1, number(transformation?.powerMultiplier ?? transformation?.mult, 1));
    }

    function masteryRankKey(char, primaryId, context = {}) {
        if (!primaryId || primaryId === 'base') return 'G';
        if (typeof context.getMasteryRank === 'function') {
            const rank = context.getMasteryRank(char, primaryId);
            return String(rank?.key || rank || 'G').toUpperCase();
        }
        const xp = number(char?.transformationMastery?.[primaryId]?.xp ?? char?.transformationMastery?.[primaryId]);
        const ranks = root.DBZ_V6_CONFIG?.transformationMasteryRanks || [];
        return String([...ranks].reverse().find(rank => xp >= rank.xp)?.key || 'G').toUpperCase();
    }

    function getResourceDevelopment(char, context = {}) {
        const routeId = routeIdForCharacter(char);
        const progression = char?.raceProgression || {};
        const campaignXP = config.campaignWeeks * number(root.DBZ_V6_CONFIG?.weeklyStoryXPCap, 50);
        const timeDevelopment = clamp(number(char?.storyXP) / Math.max(1, campaignXP) * 100, 0, 100);
        const explicit = clamp(progression.resourceMastery, 0, 100);
        let mechanic = 0;
        if (routeId === 'android_bio') {
            mechanic = (progression.adaptationTemplates || []).slice(0, 3)
                .reduce((sum, template) => sum + clamp(template.quality, 0, 100), 0) / 3;
        } else if (routeId === 'majin') {
            mechanic = (progression.absorptionCores || []).slice(0, 3)
                .reduce((sum, core) => sum + clamp(core.quality, 0, 100), 0) / 3;
        } else if (routeId === 'namekian') {
            mechanic = progression.namekianBranch ? 20 : 0;
        } else if (routeId === 'android_infinite') {
            mechanic = clamp(number(char?.totalTXP) / 500, 0, 100);
        } else if (routeId === 'frieza_race') {
            mechanic = clamp(number(char?.totalTXP) / 420, 0, 100);
        } else {
            mechanic = clamp(number(char?.totalTXP) / 600, 0, 100);
        }
        return clamp(Math.max(explicit, timeDevelopment * 0.78 + mechanic * 0.22), 0, 100);
    }

    function getSupportQuality(char, context = {}) {
        const transformations = context.transformations || [];
        const equippedPrimaryId = sanitizePrimaryState(char, transformations).primaryId;
        const routeTier = highestEarnedTier(char);
        const usesRaceState = equippedPrimaryId === 'base' && routeTier?.bandId !== 'base';
        const rankKey = usesRaceState ? 'ROUTE' : masteryRankKey(char, equippedPrimaryId, context);
        const routeMastery = clamp(
            char?.raceProgression?.routeMastery ?? (number(char?.storyXP) / Math.max(1, config.campaignWeeks * 50) * 35),
            0,
            35
        );
        const mastery = usesRaceState ? routeMastery : (rankPoints[rankKey] ?? 0);
        const primaryId = usesRaceState ? `route:${routeTier.bandId}` : equippedPrimaryId;

        const abilityIds = unique(char?.equippedAbilities || []).slice(0, 3);
        const abilityData = context.abilities || [];
        const abilityById = new Map(abilityData.map(ability => [ability.id, ability]));
        const routeRace = routeForCharacter(char).race;
        const ability = abilityIds.reduce((sum, id) => {
            const level = clamp(char?.abilityLevels?.[id]?.level ?? char?.purchasedAbilities?.[id], 0, 5);
            const data = abilityById.get(id);
            const tags = new Set([...(data?.tags || []), data?.race].filter(Boolean));
            const relevance = !data || tags.has(routeRace) || tags.has('god') || tags.has('universal') ? 1 : 0.65;
            return sum + (level / 5) * relevance;
        }, 0) / 3 * 25;

        const partnerIds = unique(typeof context.getActivePartnerIds === 'function'
            ? context.getActivePartnerIds(char)
            : (char?.activePartners || [])).slice(0, 3);
        const partner = partnerIds.reduce((sum, id) => {
            const level = Math.max(1, number(char?.partnerLevels?.[id]?.level, 1));
            const developed = clamp((level - 1) / 99, 0, 1);
            return sum + 0.08 + developed * 0.92;
        }, 0) / 3 * 20;

        const resourceDevelopment = getResourceDevelopment(char, context);
        const resource = resourceDevelopment / 100 * 20;
        const total = clamp(mastery + ability + partner + resource, 0, 100);
        return {
            total: +total.toFixed(1),
            components: {
                mastery: +mastery.toFixed(1),
                abilities: +ability.toFixed(1),
                partners: +partner.toFixed(1),
                resource: +resource.toFixed(1)
            },
            primaryId,
            masteryRank: rankKey,
            resourceDevelopment: +resourceDevelopment.toFixed(1)
        };
    }

    function sagaStatus(char, sagaId) {
        // Never delegate back to the generated saga gate here. That gate asks
        // this progression engine for Effective PL, so delegation would create
        // a saga -> power -> breakthrough -> saga recursion in the browser.
        const explicit = char?.sagaProgress?.[sagaId]?.status;
        if (explicit) return explicit;
        if ((char?.completedSagas || []).includes(sagaId)) return 'cleared';
        const saga = sagaById[sagaId];
        if (!saga || number(char?.storyXP) < number(saga.storyUnlockXP)) return 'locked';
        const sagaIndex = config.sagas.indexOf(saga);
        if (sagaIndex > 0) {
            const previous = config.sagas[sagaIndex - 1];
            const previousExplicit = char?.sagaProgress?.[previous.id]?.status;
            const previousCleared = (char?.completedSagas || []).includes(previous.id)
                || statusRank[previousExplicit] >= statusRank.cleared;
            if (!previousCleared) return 'locked';
        }
        return 'unlocked';
    }

    function getBasePower(char, context = {}) {
        if (Number.isFinite(Number(context.basePower))) return Number(context.basePower);
        if (typeof context.getBasePower === 'function') return number(context.getBasePower(char), 1);
        return number(char?.basePower, 1);
    }

    function getBreakthroughStatus(char, tierOrBandId, context = {}) {
        const route = routeForCharacter(char);
        const tier = route.tiers.find(item => item.id === tierOrBandId || item.bandId === tierOrBandId);
        if (!tier) return { ok: false, earned: false, blockers: ['Unknown race tier'] };
        if (tier.bandId === 'base') return { ok: true, earned: true, blockers: [], tier };
        const progression = char?.raceProgression || {};
        const earned = (progression.earnedTiers || []).includes(tier.bandId)
            || (progression.earnedTiers || []).includes(tier.id);
        if (earned) return { ok: true, earned: true, blockers: [], tier };

        const index = route.tiers.indexOf(tier);
        const previous = route.tiers[index - 1];
        const blockers = [];
        if (previous && !(progression.earnedTiers || []).some(id => id === previous.bandId || id === previous.id)) {
            blockers.push(`Earn ${previous.name} first`);
        }
        if (statusRank[sagaStatus(char, tier.sagaId, context)] < statusRank.unlocked) {
            blockers.push(`Reach ${tier.sagaId.replace(/_/g, ' ')}`);
        }
        const saga = sagaById[tier.sagaId];
        const baseRequired = Math.round(number(saga?.baseEndPL, 1) * number(tier.baseShare, 0));
        const basePower = getBasePower(char, context);
        if (basePower < baseRequired) blockers.push(`Base PL ${Math.round(basePower)} / ${baseRequired}`);
        const focusXP = number(char?.sagaProgress?.[tier.sagaId]?.focusXP);
        if (focusXP < number(tier.focusXP)) blockers.push(`Focus XP ${Math.round(focusXP)} / ${tier.focusXP}`);
        const support = getSupportQuality(char, context);
        if (support.total < number(tier.support)) blockers.push(`Support ${support.total} / ${tier.support}`);
        if (support.resourceDevelopment < number(tier.resource)) {
            blockers.push(`${route.resourceLabel} ${support.resourceDevelopment} / ${tier.resource}`);
        }
        return {
            ok: blockers.length === 0,
            earned: false,
            blockers,
            tier,
            metrics: { basePower, baseRequired, focusXP, support }
        };
    }

    function legacyTraitFromEffects(effects = {}) {
        const statSource = effects.statBonus || effects.stat || effects.stats || {};
        const stat = Object.entries(statSource)
            .filter(([, value]) => number(value) > 0)
            .sort((a, b) => number(b[1]) - number(a[1]))[0];
        if (stat) return { type: 'stat', key: stat[0], value: number(stat[1]) };
        const scalarKeys = ['txpBonus', 'tpBonus', 'spBonus', 'characterXPBonus'];
        const scalar = scalarKeys.map(key => [key, number(effects[key])]).sort((a, b) => b[1] - a[1])[0];
        return scalar && scalar[1] > 0 ? { type: 'scalar', key: scalar[0], value: scalar[1] } : { type: 'stat', key: 'VIT', value: 0.02 };
    }

    function convertLegacyAbsorptions(char, progression) {
        if (progression.legacyAbsorptionsConverted) return;
        progression.legacyAbsorptions = progression.legacyAbsorptions || {};
        ['android', 'majin'].forEach(kind => {
            const absorbed = char?.raceAbsorptions?.[kind]?.absorbed || {};
            if (!Object.keys(absorbed).length) return;
            progression.legacyAbsorptions[kind] = JSON.parse(JSON.stringify(absorbed));
            const destination = kind === 'majin' ? progression.absorptionCores : progression.adaptationTemplates;
            Object.values(absorbed).slice(0, 3).forEach((entry, index) => {
                const trait = legacyTraitFromEffects(entry.effects);
                const quality = clamp(20 + number(entry.level) * 0.6, 20, 85);
                const copyCap = kind === 'majin' ? 0.12 : 0.08;
                const boundedTrait = {
                    ...trait,
                    value: +clamp(number(trait.value) * (kind === 'majin' ? 0.35 : 0.22), 0.005, copyCap).toFixed(4)
                };
                const boundedEffects = {
                    statBonus: {}, typeBonus: {}, categoryBonus: {}, txpBonus: 0, tpBonus: 0,
                    spBonus: 0, spFlat: 0, characterXPBonus: 0
                };
                if (boundedTrait.type === 'stat') boundedEffects.statBonus[boundedTrait.key] = boundedTrait.value;
                else boundedEffects[boundedTrait.key] = boundedTrait.value;
                destination.push({
                    id: `migrated_${kind}_${index + 1}`,
                    sourcePartnerId: entry.partnerId,
                    sourcePartnerName: entry.partnerName || entry.partnerId,
                    trait: boundedTrait,
                    effects: boundedEffects,
                    quality,
                    mastery: 0,
                    active: true,
                    migrated: true,
                    createdAt: entry.absorbedAt || new Date().toISOString()
                });
                entry.effects = boundedEffects;
                entry.boundedCore = true;
                if (entry.partnerId) {
                    char.activePartners = (char.activePartners || []).filter(id => id !== entry.partnerId);
                    if (char.mainPartner === entry.partnerId) char.mainPartner = null;
                }
            });
        });
        progression.absorptionCores = progression.absorptionCores.slice(0, config.maxAbsorptionCores);
        progression.adaptationTemplates = progression.adaptationTemplates.slice(0, config.maxAdaptationTemplates);
        progression.legacyAbsorptionsConverted = true;
    }

    function ensureCharacterProgression(char, context = {}) {
        if (!char) return null;
        char.race = normalizeRaceKey(char.race);
        const progression = char.raceProgression && typeof char.raceProgression === 'object' && !Array.isArray(char.raceProgression)
            ? char.raceProgression
            : {};
        char.raceProgression = progression;
        progression.version = config.version;
        progression.androidPath = config.androidPaths.includes(progression.androidPath)
            ? progression.androidPath
            : (Object.keys(char?.raceAbsorptions?.android?.absorbed || {}).length ? 'bio' : 'infinite');
        progression.divineDiscipline = config.divineDisciplines.includes(progression.divineDiscipline)
            ? progression.divineDiscipline
            : 'native';
        progression.namekianBranch = config.namekianBranches.includes(progression.namekianBranch)
            ? progression.namekianBranch
            : null;
        progression.routeId = routeIdForCharacter(char);
        progression.earnedTiers = unique(['base', ...(progression.earnedTiers || [])]);
        progression.breakthroughs = progression.breakthroughs && typeof progression.breakthroughs === 'object'
            ? progression.breakthroughs
            : {};
        progression.absorptionCores = Array.isArray(progression.absorptionCores) ? progression.absorptionCores.slice(0, 3) : [];
        progression.adaptationTemplates = Array.isArray(progression.adaptationTemplates) ? progression.adaptationTemplates.slice(0, 3) : [];
        progression.dormantTransformationIds = unique(progression.dormantTransformationIds || []);
        convertLegacyAbsorptions(char, progression);

        if (hasMeaningfulProgress(char)) {
            char.raceLockedAt = char.raceLockedAt || char.startedAt || char.workoutLog?.[0]?.date || new Date().toISOString();
            char.raceLockedRace = normalizeRaceKey(char.raceLockedRace || char.race);
            if (normalizeRaceKey(char.race) !== char.raceLockedRace) char.race = char.raceLockedRace;
        }

        if (!progression.schema32MigratedAt) {
            const route = routeForCharacter(char);
            const completed = new Set(char.completedSagas || []);
            route.tiers.forEach(tier => {
                if (tier.bandId === 'base' || completed.has(tier.sagaId)) progression.earnedTiers.push(tier.bandId);
            });
            progression.earnedTiers = unique(progression.earnedTiers);
            progression.schema32MigratedAt = new Date().toISOString();
            progression.migrationReceipt = {
                schema: 32,
                routeId: route.id,
                repairedEquipment: [],
                preservedDiscoveries: unique(char.unlockedTransformations || ['base']).length,
                legacyAbsorptionsConverted: progression.absorptionCores.length + progression.adaptationTemplates.length
            };
        }

        // A partially-written or manually edited save may carry the migration
        // timestamp without its receipt. Keep equipment repair idempotent even
        // for that recovery case instead of failing during boot.
        if (!progression.migrationReceipt || typeof progression.migrationReceipt !== 'object') {
            progression.migrationReceipt = {
                schema: 32,
                routeId: progression.routeId,
                repairedEquipment: [],
                preservedDiscoveries: unique(char.unlockedTransformations || ['base']).length,
                legacyAbsorptionsConverted: progression.absorptionCores.length + progression.adaptationTemplates.length
            };
        }

        if (context.transformations) {
            const before = unique(char.equippedTransformations || [char.activeTransformation || 'base']);
            const sanitized = sanitizePrimaryState(char, context.transformations);
            const removed = before.filter(id => !sanitized.equippedIds.includes(id));
            if (removed.length) progression.migrationReceipt.repairedEquipment = unique([
                ...(progression.migrationReceipt.repairedEquipment || []), ...removed
            ]);
        }
        return progression;
    }

    function syncCharacterProgression(char, context = {}) {
        const progression = ensureCharacterProgression(char, context);
        const route = routeForCharacter(char);
        const transformations = context.transformations || [];
        const byId = new Map(transformations.map(transformation => [transformation.id, transformation]));
        let changed = false;
        route.tiers.forEach(tier => {
            const status = getBreakthroughStatus(char, tier.id, context);
            if (!status.ok || status.earned) return;
            progression.earnedTiers.push(tier.bandId);
            progression.earnedTiers = unique(progression.earnedTiers);
            progression.breakthroughs[tier.bandId] = {
                id: tier.id,
                completedAt: new Date().toISOString(),
                sagaId: tier.sagaId,
                multiplier: tier.multiplier,
                supportQuality: status.metrics?.support?.total || 0
            };
            tier.formIds.forEach(id => {
                const transformation = byId.get(id);
                if (transformation && isTransformationUsable(char, transformation, { ignoreTier: true })) {
                    char.unlockedTransformations = unique([...(char.unlockedTransformations || ['base']), id]);
                }
            });
            changed = true;
        });
        return { changed, progression, route };
    }

    function highestEarnedTier(char) {
        const route = routeForCharacter(char);
        return route.tiers[highestEarnedTierIndex(char)] || route.tiers[0];
    }

    function calculateRaceTierMultiplier(char) {
        return Math.max(1, number(highestEarnedTier(char)?.multiplier, 1));
    }

    function getRacePowerState(char, context = {}) {
        syncCharacterProgression(char, context);
        const route = routeForCharacter(char);
        const tier = highestEarnedTier(char);
        const primaryMultiplier = getPrimaryStateMultiplier(char, context.transformations || []);
        const multiplier = Math.max(primaryMultiplier, number(tier.multiplier, 1));
        const primaryId = sanitizePrimaryState(char, context.transformations || []).primaryId;
        const primary = (context.transformations || []).find(item => item.id === primaryId);
        return {
            multiplier,
            equippedMultiplier: primaryMultiplier,
            tierMultiplier: tier.multiplier,
            label: multiplier === primaryMultiplier && primaryId !== 'base' ? (primary?.name || tier.name) : tier.name,
            equippedName: primary?.name || 'Base Form',
            source: multiplier === primaryMultiplier && primaryId !== 'base'
                ? 'sanitized primary transformation'
                : `${route.label} fixed tier`,
            routeId: route.id,
            tier,
            support: getSupportQuality(char, context)
        };
    }

    function calculateEffectivePower(basePower, racePowerState) {
        const multiplier = typeof racePowerState === 'object' ? racePowerState.multiplier : racePowerState;
        return Math.max(1, Math.round(number(basePower, 1) * Math.max(1, number(multiplier, 1))));
    }

    function calculateGodPowerRoute(char, context = {}) {
        const state = getRacePowerState(char, context);
        if (state.multiplier < 1000) return Math.max(0, number(context.rawGodPower));
        const basePower = getBasePower(char, context);
        const nativePower = basePower * Math.pow(state.multiplier / 1000, 0.72) * (0.65 + state.support.total / 200);
        return Math.max(Math.round(nativePower), Math.max(0, number(context.rawGodPower)));
    }

    function getNextRaceMilestone(char, context = {}) {
        const route = routeForCharacter(char);
        const index = highestEarnedTierIndex(char);
        const current = route.tiers[index] || route.tiers[0];
        const next = route.tiers[index + 1] || null;
        return {
            route,
            current,
            next,
            nextStatus: next ? getBreakthroughStatus(char, next.id, context) : null,
            support: getSupportQuality(char, context)
        };
    }

    function canChangeRace(char, newRace) {
        const canonical = normalizeRaceKey(newRace);
        if (!config.routeKeyByRace[canonical]) return { ok: false, reason: 'Unsupported race.' };
        if (canonical === normalizeRaceKey(char?.race)) return { ok: true };
        if (char?.raceLockedAt || hasMeaningfulProgress(char)) {
            return { ok: false, reason: 'Race is locked after training begins. Create another character to play a different route.' };
        }
        return { ok: true };
    }

    function calculateAbsorptionQuality(partner, progress = {}, kind = 'majin') {
        const level = Math.max(1, number(progress.level, 1));
        const bond = clamp(Math.log10(1 + Math.max(0, number(progress.totalXp))) / 5, 0, 1);
        const canon = clamp(Math.log10(1 + Math.max(1, number(partner?.canonPL, 1))) / 12, 0, 1);
        const levelScore = clamp((level - 1) / 99, 0, 1);
        const routeBias = kind === 'bio' ? 0.95 : 1;
        return +clamp((levelScore * 58 + bond * 24 + canon * 18) * routeBias, 5, 100).toFixed(1);
    }

    function findStrongestPartnerTrait(partner = {}) {
        const effects = partner.effects || {};
        const statSource = effects.statBonus || effects.stat || effects.stats || {};
        const stat = Object.entries(statSource)
            .filter(([, value]) => number(value) > 0)
            .sort((a, b) => number(b[1]) - number(a[1]))[0];
        if (stat) return { type: 'stat', key: stat[0], sourceValue: number(stat[1]) };
        const candidates = ['txpBonus', 'tpBonus', 'spBonus', 'characterXPBonus']
            .map(key => ({ type: 'scalar', key, sourceValue: number(effects[key]) }))
            .sort((a, b) => b.sourceValue - a.sourceValue);
        return candidates[0]?.sourceValue > 0 ? candidates[0] : { type: 'stat', key: 'VIT', sourceValue: 0.02 };
    }

    function buildAbsorptionCore(partner, progress, kind = 'majin') {
        const quality = calculateAbsorptionQuality(partner, progress, kind);
        const source = findStrongestPartnerTrait(partner);
        const copyCap = kind === 'bio' ? 0.08 : 0.12;
        const copyRate = kind === 'bio' ? 0.22 : 0.35;
        const value = clamp(Math.max(0.005, source.sourceValue * copyRate) * (0.45 + quality / 180), 0.005, copyCap);
        const trait = { type: source.type, key: source.key, value: +value.toFixed(4) };
        const effects = {
            statBonus: {}, typeBonus: {}, categoryBonus: {}, txpBonus: 0, tpBonus: 0,
            spBonus: 0, spFlat: 0, characterXPBonus: 0
        };
        if (trait.type === 'stat') effects.statBonus[trait.key] = trait.value;
        else effects[trait.key] = trait.value;
        return {
            id: `${kind}_${partner?.id || 'partner'}_${Date.now()}`,
            sourcePartnerId: partner?.id,
            sourcePartnerName: partner?.name || partner?.id || 'Partner',
            trait,
            effects,
            quality,
            mastery: 0,
            active: true,
            createdAt: new Date().toISOString()
        };
    }

    function installAbsorptionCore(char, core, kind = 'majin', slot = null) {
        const progression = ensureCharacterProgression(char);
        const key = kind === 'bio' ? 'adaptationTemplates' : 'absorptionCores';
        const limit = kind === 'bio' ? config.maxAdaptationTemplates : config.maxAbsorptionCores;
        const entries = progression[key];
        const existingIndex = entries.findIndex(entry => entry.sourcePartnerId === core.sourcePartnerId);
        if (existingIndex >= 0) entries[existingIndex] = core;
        else if (slot !== null && slot >= 0 && slot < limit) entries[slot] = core;
        else if (entries.length < limit) entries.push(core);
        else entries[limit - 1] = core;
        progression[key] = entries.filter(Boolean).slice(0, limit);
        return progression[key];
    }

    function isPartnerSuppressedByCore(char, partnerId) {
        const progression = char?.raceProgression || {};
        return [...(progression.absorptionCores || []), ...(progression.adaptationTemplates || [])]
            .some(core => core.active !== false && core.sourcePartnerId === partnerId);
    }

    function getTransformationStatus(char, transformation, context = {}) {
        if (!transformation) return { key: 'locked', blockers: ['Unknown transformation'] };
        if (!isRaceCompatible(char, transformation)) return { key: 'discovered', blockers: ['Wrong race or route'] };
        const unlocked = unique(char?.unlockedTransformations || ['base']).includes(transformation.id);
        const usable = isTransformationUsable(char, transformation);
        const equipped = sanitizePrimaryState(char, context.transformations || []).equippedIds;
        if (equipped[0] === transformation.id) return { key: 'primary', blockers: [] };
        if (equipped.slice(1).includes(transformation.id)) return { key: 'echo', blockers: [] };
        if (unlocked && usable) return { key: 'usable', blockers: [] };
        const tier = requiredTierForTransformation(char, transformation.id);
        if (tier) {
            const breakthrough = getBreakthroughStatus(char, tier.id, context);
            return {
                key: breakthrough.ok ? 'breakthrough' : 'locked',
                blockers: breakthrough.blockers,
                discovered: unlocked,
                tier,
                breakthrough
            };
        }
        return { key: unlocked ? 'usable' : 'locked', blockers: [] };
    }

    root.DBZ_V6_PROGRESSION = Object.freeze({
        normalizeRaceKey,
        hasMeaningfulProgress,
        routeIdForCharacter,
        routeForCharacter,
        isRaceCompatible,
        isTransformationUsable,
        getUsableTransformationIds,
        sanitizePrimaryState,
        getPrimaryStateMultiplier,
        getSupportQuality,
        getResourceDevelopment,
        getBreakthroughStatus,
        ensureCharacterProgression,
        syncCharacterProgression,
        highestEarnedTier,
        calculateRaceTierMultiplier,
        getRacePowerState,
        calculateEffectivePower,
        calculateGodPowerRoute,
        getNextRaceMilestone,
        canChangeRace,
        calculateAbsorptionQuality,
        buildAbsorptionCore,
        installAbsorptionCore,
        isPartnerSuppressedByCore,
        getTransformationStatus
    });
})(globalThis);
