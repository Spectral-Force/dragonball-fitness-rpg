import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ANALYSIS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DESTINATION = path.resolve(ANALYSIS_DIRECTORY, "..");
const BUILD_ID = "6.3.0-20260803.1";
const LEGACY_SOURCE_COMMIT = "8ac683b";
const repositoryCandidates = [
  path.resolve(DESTINATION, "..", "..", "DragonBall-Fitness-RPG-Mobile"),
  DESTINATION
];
const MOBILE_REPOSITORY = repositoryCandidates.find(candidate =>
  fs.existsSync(path.join(candidate, ".git"))
);
const SOURCE = process.env.DBZ_V5_MOBILE_SOURCE
  ? path.resolve(process.env.DBZ_V5_MOBILE_SOURCE)
  : path.join(MOBILE_REPOSITORY || repositoryCandidates[0], "index.html");

function readLegacySource() {
  if (fs.existsSync(SOURCE)) {
    const candidate = fs.readFileSync(SOURCE, "utf8");
    if (candidate.includes("const EMBEDDED_ASSETS = ") && candidate.includes("<style>")) return candidate;
  }
  if (MOBILE_REPOSITORY) {
    return execFileSync(
      "git",
      ["-C", MOBILE_REPOSITORY, "show", `${LEGACY_SOURCE_COMMIT}:index.html`],
      { encoding: "utf8", maxBuffer: 100 * 1024 * 1024 }
    );
  }
  throw new Error(
    `Could not find the Mobile v5 source. Set DBZ_V5_MOBILE_SOURCE or provide Git commit ${LEGACY_SOURCE_COMMIT}.`
  );
}

const source = readLegacySource();
const styleMatch = source.match(/<style>([\s\S]*?)<\/style>/);
const scriptMatch = source.match(/<script>([\s\S]*?)<\/script>/);

if (!styleMatch || !scriptMatch) {
  throw new Error("The mobile source no longer has the expected single inline style and script.");
}

let css = styleMatch[1]
  .replace(/\bmin-width:\s*880px;/g, "min-width: 0;")
  .replace(/url\((["'])data:image\/[^)]*?\1\)/g, 'url("./images/cover_a.jpg")');
let javascript = scriptMatch[1];

// The mobile build was distributed as a 49 MB one-file bundle. Every embedded
// asset also exists in the project asset tree, so v6 deliberately uses those
// maintainable files instead.
const embeddedStart = javascript.indexOf("const EMBEDDED_ASSETS = ");
if (embeddedStart < 0) throw new Error("Could not find EMBEDDED_ASSETS.");
const embeddedLineStart = javascript.lastIndexOf("\n", embeddedStart) + 1;
const embeddedLineEnd = javascript.indexOf("\n", embeddedStart);
if (embeddedLineEnd < 0) throw new Error("Could not find the end of EMBEDDED_ASSETS.");
javascript =
  javascript.slice(0, embeddedLineStart) +
  "        const EMBEDDED_ASSETS = {};\n" +
  javascript.slice(embeddedLineEnd + 1);

// Replace the second legacy base64 bundle (keyed by game IDs) with a generated
// manifest of project files. File stems are the canonical lookup keys already
// used by transformations, abilities, partners, and saga cards.
const imageRoot = path.join(DESTINATION, "images");
const imageFiles = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(imageRoot, fullPath).replaceAll("\\", "/");
    if (/(^|\/)(?:optional_review|partners_review|client_email_files)(?:\/|$)/i.test(relative)) continue;
    if (entry.isDirectory()) visit(fullPath);
    else if (
      /\.(?:avif|gif|jpe?g|png|webp)$/i.test(entry.name) &&
      !/(?:_source\.png|contact_sheet\.(?:jpe?g|png|webp))$/i.test(entry.name)
    ) {
      imageFiles.push(fullPath);
    }
  }
};
visit(imageRoot);
const availableImagePaths = new Set(imageFiles.map(fullPath => fullPath.toLowerCase()));
const optimizedImageFiles = imageFiles.filter(fullPath => {
  const parsed = path.parse(fullPath);
  if (!/\.(?:jpe?g|png)$/i.test(parsed.ext)) return true;
  return ![".avif", ".webp"].some(extension =>
    availableImagePaths.has(path.join(parsed.dir, `${parsed.name}${extension}`).toLowerCase())
  );
});
imageFiles.splice(0, imageFiles.length, ...optimizedImageFiles);
imageFiles.sort((a, b) => a.localeCompare(b));
const diskImageMap = {};
for (const fullPath of imageFiles) {
  const key = path.basename(fullPath, path.extname(fullPath));
  const relative = "./" + path.relative(DESTINATION, fullPath).replaceAll("\\", "/");
  diskImageMap[key] = relative;
}
const generatedImageMap =
  "        const IMAGE_MAP = {\n" +
  Object.entries(diskImageMap)
    .map(([key, relative]) => `            ${JSON.stringify(key)}: versionedAsset(${JSON.stringify(relative)})`)
    .join(",\n") +
  "\n        };";
const imageMapDeclaration = javascript.indexOf("const IMAGE_MAP = {");
const imageMapStart = javascript.lastIndexOf("\n", imageMapDeclaration) + 1;
const imageMapAssign = javascript.indexOf("Object.assign(IMAGE_MAP", imageMapDeclaration);
const imageMapEnd = javascript.lastIndexOf("\n", imageMapAssign);
if (imageMapDeclaration < 0 || imageMapAssign < 0 || imageMapEnd < 0) throw new Error("Could not replace IMAGE_MAP.");
javascript =
  javascript.slice(0, imageMapStart) +
  generatedImageMap +
  javascript.slice(imageMapEnd);

function replaceRequired(value, search, replacement, label) {
  const next = value.replace(search, replacement);
  if (next === value) throw new Error(`Could not apply v6 migration: ${label}`);
  return next;
}

javascript = replaceRequired(javascript, "const GAME_VERSION = 'v5.0';", "const GAME_VERSION = window.DBZ_V6_CONFIG.version;", "game version");
javascript = replaceRequired(javascript, "const SAVE_SCHEMA_VERSION = 30;", "const SAVE_SCHEMA_VERSION = window.DBZ_V6_CONFIG.schemaVersion;", "save schema");
javascript = replaceRequired(
  javascript,
  "return getEmbeddedAsset(path) || `${path}?v=${encodeURIComponent(GAME_VERSION)}`;",
  "return getEmbeddedAsset(path) || window.DBZ_V6_ASSETS?.[normalizeAssetPath(path)] || `${path}?v=${encodeURIComponent(GAME_VERSION)}`;",
  "hashed asset manifest lookup"
);
[
  "android",
  "earthling",
  "frieza_race",
  "half_saiyan",
  "majin",
  "namekian",
  "saiyan"
].forEach(name => {
  javascript = javascript.replaceAll(
    `./images/race_portraits/${name}.webp`,
    `./images/v6/races/${name}.webp`
  );
});
javascript = replaceRequired(
  javascript,
  /const RECOVERY_CONFIG = \{[\s\S]*?\r?\n\s*\};/,
  `const RECOVERY_CONFIG = {
            restExerciseName: 'Rest Day',
            restMultiplierPerDay: 0.025,
            restMultiplierCap: 0.10,
            restLookbackCapDays: 4,
            noTrainingGraceDays: window.DBZ_V6_CONFIG.recovery.noTrainingGraceDays,
            dailyDecayRate: 0,
            weeklyRequiredExercises: 1,
            weeklyCategoryMaxDecay: 0,
            weeklyStatCap: 0,
            weeklyGroups: ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'cardio', 'martial', 'flexibility']
        };`,
  "recovery configuration"
);
javascript = replaceRequired(
  javascript,
  /const TRANSFORMATION_MASTERY_RANKS = \[[\s\S]*?\r?\n\s*\];/,
  "const TRANSFORMATION_MASTERY_RANKS = window.DBZ_V6_CONFIG.transformationMasteryRanks.map(rank => ({ ...rank }));",
  "transformation mastery curve"
);
javascript = replaceRequired(
  javascript,
  /const SAGA_TARGET_WEEKS = \{[\s\S]*?\r?\n\s*\};/,
  "const SAGA_TARGET_WEEKS = { ...window.DBZ_V6_CONFIG.sagaTargetWeeks };",
  "three-year saga schedule"
);
javascript = replaceRequired(
  javascript,
  /const SAGA_REBALANCE_ROWS = \[[\s\S]*?\r?\n\s*\];\r?\n\s*const SAGA_REBALANCE_BY_ID/,
  `const SAGA_REBALANCE_ROWS = window.DBZ_V6_PROGRESSION_CONFIG.sagas.map(row => ({
                id: row.id,
                week: row.targetWeek,
                unlockWeek: row.unlockWeek,
                baseEndPL: row.baseEndPL,
                transform: window.DBZ_V6_PROGRESSION_CONFIG.stateBands.find(band => band.id === row.stateBandId)?.label || 'Base',
                transformMultiplier: row.stateMultiplier,
                effectiveEndPL: row.effectiveEndPL,
                gplReq: row.godPowerRequirement
            }));
            const SAGA_REBALANCE_BY_ID`,
  "canonical saga power mapping"
);
javascript = replaceRequired(
  javascript,
  "const unlockWeek = row?.week ?? (SAGA_TARGET_WEEKS[saga.id] ?? Math.round(index * 5.5));",
  "const unlockWeek = row?.unlockWeek ?? row?.week ?? (SAGA_TARGET_WEEKS[saga.id] ?? Math.round(index * 5.5));",
  "signature form saga window"
);
javascript = replaceRequired(
  javascript,
  "STORY_CONFIG.finalSagaClearXP = STORY_CONFIG.finalSagaUnlockXP + Math.round(8 * STORY_CONFIG.weeklyStoryXPCap);",
  "STORY_CONFIG.finalSagaClearXP = window.DBZ_V6_PROGRESSION_CONFIG.sagas.find(saga => saga.id === 'dbs_granolah').storyClearXP;",
  "final story clear target"
);
javascript = replaceRequired(
  javascript,
  "STORY_CONFIG.finalSagaUnlockXP = Math.round((SAGA_TARGET_WEEKS.dbs_granolah || 208) * STORY_CONFIG.weeklyStoryXPCap);",
  "STORY_CONFIG.finalSagaUnlockXP = window.DBZ_V6_PROGRESSION_CONFIG.sagas.find(saga => saga.id === 'dbs_granolah').storyUnlockXP;",
  "final story unlock window"
);
javascript = replaceRequired(
  javascript,
  "const nextWeek = nextRow?.week ?? (unlockWeek + 8);",
  "const nextWeek = nextRow?.week ?? unlockWeek;",
  "final saga time window"
);
javascript = replaceRequired(
  javascript,
  "const clearWeek = row ? Math.max(unlockWeek + 1, Math.round(unlockWeek + (nextWeek - unlockWeek) * 0.65)) : Math.max(unlockWeek + 6, Math.round(unlockWeek * 1.45));",
  "const clearWeek = row ? (nextRow ? Math.max(unlockWeek + 1, Math.round(unlockWeek + (nextWeek - unlockWeek) * 0.65)) : (row.week ?? unlockWeek)) : Math.max(unlockWeek + 6, Math.round(unlockWeek * 1.45));",
  "final saga clear week"
);

javascript = replaceRequired(
  javascript,
  /function saveState\(\) \{[\s\S]*?\r?\n\s*\}/,
  `function saveState(options = {}) {
            Object.values(state.characters || {}).forEach(char => {
                window.DBZ_V6_PROGRESSION?.ensureCharacterProgression(char, { transformations: TRANSFORMATIONS });
            });
            state.version = GAME_VERSION;
            state.schemaVersion = SAVE_SCHEMA_VERSION;
            state.lastSavedAt = new Date().toISOString();
            return window.DBZV6Storage.save(state, options).catch(error => {
                console.error('Unable to save game state:', error);
                v6Alert('Save failed. Export a backup before closing the game.', 'error');
                return false;
            });
        }`,
  "IndexedDB save function"
);
javascript = replaceRequired(
  javascript,
  /function loadState\(\) \{[\s\S]*?\r?\n\s*\}\r?\n\r?\n\s*\/\/ ============ UI RENDERING ============/,
  `async function loadState() {
            const loaded = await window.DBZV6Storage.load();
            window.DBZV6Storage.finishBootstrap();
            if (!loaded) return false;
            try {
                const defaults = JSON.parse(JSON.stringify(state));
                const loadedSchema = Number(loaded.schemaVersion) || 1;
                if (loadedSchema < SAVE_SCHEMA_VERSION) backupLegacySave(JSON.stringify(loaded));
                const mergedState = { ...defaults, ...loaded };
                Object.keys(state).forEach(key => delete state[key]);
                Object.assign(state, mergedState);
                state.version = GAME_VERSION;
                state.schemaVersion = SAVE_SCHEMA_VERSION;
                if (!state.workoutTemplates) state.workoutTemplates = [];
                if (typeof ensureBuiltInWorkoutTemplates === 'function') ensureBuiltInWorkoutTemplates();
                if (typeof ensureFitnessPlanState === 'function') ensureFitnessPlanState();
                if (!state.statsGoal || !state.statsGoal.type || !state.statsGoal.id) state.statsGoal = defaults.statsGoal;
                if (!state.characters) state.characters = defaults.characters;
                Object.keys(defaults.characters).forEach(id => {
                    if (!state.characters[id]) state.characters[id] = defaults.characters[id];
                });
                Object.keys(state.characters).forEach(id => migrateCharacter(state.characters[id], loadedSchema));
                if (!state.characters[state.activeCharacter]) state.activeCharacter = 'tim';
                document.documentElement.dataset.dbzLoadedStateName = state.characters[state.activeCharacter]?.name || '';
                document.documentElement.dataset.dbzLoadedStateId = state.activeCharacter || '';
                if (typeof ensureFitnessPlanState === 'function') ensureFitnessPlanState();
                saveState({ snapshot: loadedSchema < SAVE_SCHEMA_VERSION });
                return true;
            } catch (error) {
                console.error('Error loading save:', error);
                v6Alert('The save could not be loaded. Your recovery snapshots were left untouched.', 'error');
                return false;
            }
        }

        // ============ UI RENDERING ============`,
  "asynchronous load function"
);
javascript = replaceRequired(
  javascript,
  /document\.addEventListener\('DOMContentLoaded', \(\) => \{\r?\n\s*const hadSavedState = !!localStorage\.getItem\('dbfitness_save'\);\r?\n\s*loadState\(\);/,
  "document.addEventListener('DOMContentLoaded', async () => {\n            const hadSavedState = await window.DBZV6Storage.hasSave();\n            await loadState();",
  "asynchronous startup"
);
javascript = replaceRequired(
  javascript,
  "            await loadState();\n            const templatesChanged",
  `            await loadState();
            // Inherited feature modules wrap loadState. Re-read the
            // authoritative record after that wrapper chain so their startup
            // normalizers cannot win a race against IndexedDB restoration.
            const authoritativeV6State = hadSavedState ? await window.DBZV6Storage.load() : null;
            if (authoritativeV6State) {
                Object.keys(state).forEach(key => delete state[key]);
                Object.assign(state, authoritativeV6State);
                state.version = GAME_VERSION;
                state.schemaVersion = SAVE_SCHEMA_VERSION;
                Object.values(state.characters || {}).forEach(char => migrateCharacter(char, Number(authoritativeV6State.schemaVersion) || 1));
                if (typeof ensureAllV5Characters === 'function') ensureAllV5Characters();
                if (typeof normalizeSupplementalState === 'function') normalizeSupplementalState();
                if (typeof ensureFitnessPlanState === 'function') ensureFitnessPlanState();
            }
            const templatesChanged`,
  "authoritative startup restoration"
);
javascript = replaceRequired(
  javascript,
  `            const v49_loadState = loadState;
            loadState = function() {
                v49_loadState();
                ensureAllV5Characters();
                saveState();
            };

            const v49_saveState = saveState;
            saveState = function() {
                ensureAllV5Characters();
                return v49_saveState();
            };`,
  `            const v49_loadState = loadState;
            loadState = async function() {
                const loaded = await v49_loadState();
                ensureAllV5Characters();
                await saveState({ snapshot: false });
                return loaded;
            };

            const v49_saveState = saveState;
            saveState = function(options = {}) {
                ensureAllV5Characters();
                return v49_saveState(options);
            };`,
  "awaited supplemental state wrappers"
);
javascript = replaceRequired(
  javascript,
  `            const s5_previousLoadState = loadState;
            loadState = function() {
                const result = s5_previousLoadState();
                normalizeSupplementalState();
                return result;
            };

            const s5_previousSaveState = saveState;
            saveState = function() {
                normalizeSupplementalState();
                return s5_previousSaveState();
            };`,
  `            const s5_previousLoadState = loadState;
            loadState = async function() {
                const result = await s5_previousLoadState();
                normalizeSupplementalState();
                return result;
            };

            const s5_previousSaveState = saveState;
            saveState = function(options = {}) {
                normalizeSupplementalState();
                return s5_previousSaveState(options);
            };`,
  "awaited story state wrappers"
);
javascript = replaceRequired(
  javascript,
  "function resetGame() {",
  "async function resetGame() {",
  "async reset"
);
javascript = replaceRequired(
  javascript,
  /            \/\/ Clear the save key used by this game\r?\n            localStorage\.removeItem\('dbfitness_save'\);\r?\n            \/\/ Reload the page — the game will initialise with a fresh default state\r?\n            location\.reload\(\);/,
  "            await window.DBZV6Storage.clear();\r\n            // Reload the page — the game will initialise with a fresh default state\r\n            location.reload();",
  "reset storage cleanup"
);
javascript = replaceRequired(
  javascript,
  /document\.getElementById\('importFile'\)\.addEventListener\('change', \(e\) => \{[\s\S]*?reader\.readAsText\(file\);\r?\n\s*\}\);/,
  `document.getElementById('importFile').addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > window.DBZV6Storage.maxImportBytes) {
                    v6Alert('Import rejected: the file is larger than 10 MB.', 'error');
                    e.target.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    try {
                        const imported = JSON.parse(evt.target.result);
                        if (isTemplateOnlySave(imported)) {
                            importTemplateLibrary(imported);
                            e.target.value = '';
                            return;
                        }
                        const importedState = window.DBZV6Storage.validateImportedSave(imported, file.size);
                        Object.keys(state).forEach(key => delete state[key]);
                        Object.assign(state, importedState);
                        await saveState({ snapshot: true });
                        v6Alert('Save imported and validated successfully.', 'success');
                        setTimeout(() => location.reload(), 300);
                    } catch (error) {
                        v6Alert('Import rejected: ' + error.message, 'error');
                    } finally {
                        e.target.value = '';
                    }
                };
                reader.onerror = () => v6Alert('The selected save file could not be read.', 'error');
                reader.readAsText(file);
            });`,
  "safe save import"
);

javascript = replaceRequired(javascript, "navigator.serviceWorker.register('./dbz-sw-v5.0.js')", "navigator.serviceWorker.register('./dbz-sw-v6.0.js')", "v6 service worker");
javascript = javascript.replace(/\balert\(/g, "v6Alert(");
javascript = replaceRequired(javascript, "📝 ${w.notes}", "📝 ${escapeHTML(w.notes)}", "escaped workout notes");
javascript = replaceRequired(javascript, '${w.notes || \'\'}', '${escapeHTML(w.notes || \'\')}', "escaped workout note editor");
javascript = replaceRequired(
  javascript,
  "label: req.label,",
  "label: target === Number(req.target) ? req.label : `${req.label} (race-adjusted ×${formatSignificantNumber(target / Math.max(1, Number(req.target)), 3)})`,",
  "race-adjusted Dragon Ball labels"
);
javascript = replaceRequired(
  javascript,
  /const s5_previousGetPowerLevel = typeof getPowerLevel === 'function' \? getPowerLevel : null;[\s\S]*?\r?\n\s*\};\r?\n\s*\}/,
  `// v6: partner strength improves earned stats, XP, AP and TP through the
            // bounded partner-effect system. It never multiplies displayed PL directly.`,
  "partner direct PL multiplier"
);
javascript = replaceRequired(
  javascript,
  /const partnerMult = typeof getActivePartnerPowerMultiplier === 'function' \? Math\.max\(1, dbzNum\(getActivePartnerPowerMultiplier\(char\), 1\)\) : 1;\r?\n\s*return Math\.max\(1, Math\.round\(base \* mult \* partnerMult\)\);/,
  "            return Math.max(1, Math.round(base * mult));",
  "dashboard partner PL preview"
);
javascript = replaceRequired(
  javascript,
  /function getSagaUnlockPowerLevel\(char\) \{[\s\S]*?\r?\n\s*\}\r?\n\s*window\.getSagaUnlockPowerLevel = getSagaUnlockPowerLevel;/,
  `function getV6EquippedState(char) {
                const sanitized = window.DBZ_V6_PROGRESSION.sanitizePrimaryState(char, TRANSFORMATIONS);
                const states = sanitized.equippedIds.map(id => getTransformationById(id)).filter(Boolean);
                const primary = getTransformationById(sanitized.primaryId) || getTransformationById('base');
                return {
                    ids: sanitized.equippedIds,
                    states,
                    strongest: primary,
                    primary,
                    multiplier: Math.max(1, Number(primary?.powerMultiplier || primary?.mult || 1))
                };
            }

            function getV6ProgressionContext(char, basePower = null) {
                return {
                    transformations: TRANSFORMATIONS,
                    abilities: ABILITIES,
                    basePower,
                    getBasePower: candidate => getBaseDisplayPowerFromStats(candidate?.stats || {}, false, getRaceStartingPowerScore(candidate?.race || 'earthling')),
                    getMasteryRank: (candidate, id) => getTransformationMasteryRank(candidate, id),
                    getActivePartnerIds: candidate => typeof getActivePartners === 'function' ? getActivePartners(candidate) : (candidate?.activePartners || [])
                };
            }

            function getRaceRoutePowerMultiplier(char) {
                const base = getBaseDisplayPowerFromStats(char?.stats || {}, false, getRaceStartingPowerScore(char?.race || 'earthling'));
                return window.DBZ_V6_PROGRESSION.getRacePowerState(char, getV6ProgressionContext(char, base));
            }

            function getSagaUnlockPowerLevel(char) {
                const base = typeof getBaseDisplayPowerFromStats === 'function'
                    ? getBaseDisplayPowerFromStats(char?.stats || {}, false, getRaceStartingPowerScore(char?.race || 'earthling'))
                    : (typeof getPowerLevelFromStats === 'function' ? getPowerLevelFromStats(char?.stats || {}) : 0);
                const route = window.DBZ_V6_PROGRESSION.getRacePowerState(char, getV6ProgressionContext(char, base));
                return window.DBZ_V6_PROGRESSION.calculateEffectivePower(base, route);
            }
            window.getRaceRoutePowerMultiplier = getRaceRoutePowerMultiplier;
            window.getV6ProgressionContext = getV6ProgressionContext;
            window.getSagaUnlockPowerLevel = getSagaUnlockPowerLevel;`,
  "race-equivalent power routes"
);
javascript = replaceRequired(
  javascript,
  /function getAvailableTransformations\(char\) \{[\s\S]*?\r?\n\s*\}/,
  `function getAvailableTransformations(char) {
            window.DBZ_V6_PROGRESSION.ensureCharacterProgression(char, { transformations: TRANSFORMATIONS });
            const usable = new Set(window.DBZ_V6_PROGRESSION.getUsableTransformationIds(char, TRANSFORMATIONS));
            return TRANSFORMATIONS.filter(trans => usable.has(trans.id));
        }`,
  "authoritative usable transformation list"
);
javascript = replaceRequired(
  javascript,
  /function unlockTransformationsAndAbilities\(char\) \{[\s\S]*?\r?\n\s*\}\r?\n\r?\n\s*function isSameDay/,
  `function unlockTransformationsAndAbilities(char) {
            const level = getLevel(char);
            if (!Array.isArray(char.unlockedTransformations)) char.unlockedTransformations = ['base'];
            const basePower = typeof getBasePowerLevel === 'function' ? getBasePowerLevel(char) : 1;
            window.DBZ_V6_PROGRESSION.syncCharacterProgression(char, {
                transformations: TRANSFORMATIONS,
                abilities: ABILITIES,
                basePower,
                getMasteryRank: (candidate, id) => typeof getTransformationMasteryRank === 'function' ? getTransformationMasteryRank(candidate, id) : 'G',
                getActivePartnerIds: candidate => typeof getActivePartners === 'function' ? getActivePartners(candidate) : (candidate.activePartners || [])
            });
            TRANSFORMATIONS.forEach(trans => {
                if (!window.DBZ_V6_PROGRESSION.isRaceCompatible(char, trans)) return;
                if (!char.unlockedTransformations.includes(trans.id)) {
                    const reqs = trans.reqs || {};
                    const sagaReady = !reqs.sagaId || (typeof isSagaAtLeast === 'function'
                        ? isSagaAtLeast(char, reqs.sagaId, 'unlocked')
                        : char.completedSagas.includes(reqs.sagaId));
                    const baseReady = !(reqs.PL || reqs.pl || reqs.powerLevel) || basePower >= Number(reqs.PL || reqs.pl || reqs.powerLevel);
                    if (sagaReady && (!reqs.level || level >= reqs.level) && baseReady &&
                        STATS.every(stat => !reqs[stat] || char.stats[stat] >= reqs[stat]) &&
                        window.DBZ_V6_PROGRESSION.isTransformationUsable(char, trans)) {
                        char.unlockedTransformations.push(trans.id);
                    }
                }
            });
            window.DBZ_V6_PROGRESSION.sanitizePrimaryState(char, TRANSFORMATIONS);
        }

        function isSameDay`,
  "authoritative automatic transformation unlock"
);
javascript = replaceRequired(
  javascript,
  `            function getPrimaryTransformationPowerMultiplier(char) {
                const id = getEquippedTransformations(char)[0] || 'base';
                const trans = getTransformationById(id);
                return Math.max(1, Number(trans?.powerMultiplier || trans?.mult || 1));
            }`,
  `            function getPrimaryTransformationPowerMultiplier(char) {
                return window.DBZ_V6_PROGRESSION.getPrimaryStateMultiplier(char, TRANSFORMATIONS);
            }`,
  "primary-only story multiplier"
);
javascript = replaceRequired(
  javascript,
  /function getEquippedTransformations\(char\) \{[\s\S]*?\r?\n\s*\}\r?\n\s*window\.getEquippedTransformations = getEquippedTransformations;/,
  `function getEquippedTransformations(char) {
                ensureV5CharacterShallow(char);
                return window.DBZ_V6_PROGRESSION.sanitizePrimaryState(char, TRANSFORMATIONS).equippedIds;
            }
            window.getEquippedTransformations = getEquippedTransformations;`,
  "sanitized transformation loadout"
);
javascript = replaceRequired(
  javascript,
  "                if (transformationId && !getUnlockedTransformationIds(char).includes(transformationId)) return v6Alert('Unlock that transformation first.');",
  `                if (transformationId && !getUnlockedTransformationIds(char).includes(transformationId)) return v6Alert('Unlock that transformation first.');
                const candidateTransformation = transformationId ? getTransformationById(transformationId) : null;
                if (candidateTransformation && !window.DBZ_V6_PROGRESSION.isTransformationUsable(char, candidateTransformation)) return v6Alert('That form is discovered but not usable by this race/path yet.');`,
  "slot race validation"
);
javascript = replaceRequired(
  javascript,
  `        function v5tRaceAllowed(char, trans) {
            return transformationAllowedForRace(char?.race || 'earthling', trans);
        }`,
  `        function v5tRaceAllowed(char, trans) {
            return window.DBZ_V6_PROGRESSION.isRaceCompatible(char, trans);
        }`,
  "manual transformation race validation"
);
javascript = replaceRequired(
  javascript,
  /function v5tStatusKey\(char, trans\) \{[\s\S]*?\r?\n\s*\}/,
  `function v5tStatusKey(char, trans) {
            const status = window.DBZ_V6_PROGRESSION.getTransformationStatus(char, trans, {
                transformations: TRANSFORMATIONS,
                abilities: ABILITIES,
                basePower: getBasePowerLevel(char),
                getMasteryRank: (candidate, id) => getTransformationMasteryRank(candidate, id),
                getActivePartnerIds: candidate => getActivePartners(candidate)
            });
            return status.key === 'echo' ? 'equipped' : status.key === 'usable' ? 'unlocked' : status.key;
        }`,
  "transformation card state"
);
javascript = replaceRequired(
  javascript,
  /function v5tUnlockTransformation\(id\) \{[\s\S]*?\r?\n\s*\}\r?\n\s*window\.unlockV5Transformation = v5tUnlockTransformation;/,
  `function v5tUnlockTransformation(id) {
            const char = getActiveCharacter();
            ensureV5Character(char);
            const trans = v5tFindTransformation(id);
            if (!trans) return;
            window.DBZ_V6_PROGRESSION.syncCharacterProgression(char, getV6ProgressionContext(char, getBasePowerLevel(char)));
            if (!char.unlockedTransformations.includes(id)) {
                const check = v5tTransformationRequirements(char, trans);
                if (!check.ok) return v6Alert(check.blockers.join('\\n'));
                if (!window.DBZ_V6_PROGRESSION.isTransformationUsable(char, trans)) return v6Alert('Complete the listed race breakthrough first.');
                char.unlockedTransformations.push(id);
            }
            saveState();
            renderTransformations();
            renderDashboard();
            if (typeof renderStats === 'function') renderStats();
            if (typeof showGameEvent === 'function') showGameEvent({ type: 'transform', title: 'New State', name: trans.name, detail: trans.desc, color: trans.color });
        }
        window.unlockV5Transformation = v5tUnlockTransformation;`,
  "manual breakthrough unlock"
);
javascript = replaceRequired(
  javascript,
  "            if (status === 'available') return `<button class=\"btn-small btn-success v5t-action\" onclick=\"unlockV5Transformation('${trans.id}')\">Unlock</button>`;",
  "            if (status === 'available' || status === 'breakthrough') return `<button class=\"btn-small btn-success v5t-action\" onclick=\"unlockV5Transformation('${trans.id}')\">${status === 'breakthrough' ? 'Complete Breakthrough' : 'Unlock'}</button>`;",
  "breakthrough action"
);
javascript = replaceRequired(
  javascript,
  "            if (status === 'race') return 'Race Locked';",
  "            if (status === 'race' || status === 'discovered') return 'Discovered · Wrong Path';\n            if (status === 'breakthrough') return 'Breakthrough Available';",
  "transformation status language"
);
javascript = replaceRequired(
  javascript,
  "            if (!getUnlockedTransformationIds(char).includes(id)) return v6Alert('Unlock that transformation first.');",
  `            if (!getUnlockedTransformationIds(char).includes(id)) return v6Alert('Unlock that transformation first.');
            const candidate = v5tFindTransformation(id);
            if (!window.DBZ_V6_PROGRESSION.isTransformationUsable(char, candidate)) return v6Alert('That discovered form is not usable by this race/path yet.');`,
  "manual equip race validation"
);
javascript = replaceRequired(
  javascript,
  /function changeRace\(newRace\) \{[\s\S]*?\r?\n\s*\}/,
  `function changeRace(newRace) {
            const char = getActiveCharacter();
            const permission = window.DBZ_V6_PROGRESSION.canChangeRace(char, newRace);
            if (!permission.ok) return v6Alert(permission.reason, 'warning');
            const shouldSwapStarterStats = !hasCharacterTrainingProgress(char) && isStarterStatProfile(char);
            char.race = window.DBZ_V6_PROGRESSION.normalizeRaceKey(newRace);
            if (shouldSwapStarterStats) applyStartingStatsForRace(char, char.race);
            char.raceProgression = null;
            window.DBZ_V6_PROGRESSION.ensureCharacterProgression(char, { transformations: TRANSFORMATIONS });
            char.setupComplete = true;
            saveState();
            renderRacePanel();
            renderDashboard();
        }`,
  "race permanence"
);
javascript = replaceRequired(
  javascript,
  `                            <button type="button" class="race-picker-button" onclick="toggleRacePicker(event)">`,
  `                            <button type="button" class="race-picker-button" onclick="toggleRacePicker(event)" \${char.raceLockedAt ? 'disabled aria-describedby="raceLockExplanation"' : ''}>`,
  "locked race picker button"
);
javascript = replaceRequired(
  javascript,
  `                        <div class="race-desc" style="font-size:0.8rem;color:#888;margin-top:0.3rem;">\${info.desc}</div>`,
  `                        <div class="race-desc" style="font-size:0.8rem;color:#888;margin-top:0.3rem;">\${info.desc}</div>
                        \${char.raceLockedAt ? '<div id="raceLockExplanation" class="race-desc">Race locked after training began. Create another character to try a different route.</div>' : ''}`,
  "race lock explanation"
);
javascript = replaceRequired(
  javascript,
  `            getPowerLevel = function(char) {
                ensureV5CharacterShallow(char);
                const base = getBasePowerLevel(char);
                const mult = getPrimaryTransformationPowerMultiplier(char);
                return Math.max(1, roundToSignificantNumber(base * mult, 6));
            };`,
  `            getPowerLevel = function(char) {
                ensureV5CharacterShallow(char);
                const base = getBasePowerLevel(char);
                const route = typeof window.getRaceRoutePowerMultiplier === 'function'
                    ? window.getRaceRoutePowerMultiplier(char)
                    : { multiplier: getPrimaryTransformationPowerMultiplier(char) };
                return Math.max(1, roundToSignificantNumber(base * Math.max(1, Number(route.multiplier) || 1), 6));
            };`,
  "route-aware displayed power"
);
javascript = replaceRequired(
  javascript,
  /getGodPowerLevel = function\(char\) \{[\s\S]*?\r?\n\s*\};/,
  `getGodPowerLevel = function(char) {
                if (!isGodKiUnlocked(char)) return 0;
                const trans = getActiveTransformation(char);
                const godMult = trans?.tags?.includes('god') ? Math.max(1, Math.sqrt(Number(trans.powerMultiplier || trans.mult || 1)) / 6) : 1;
                const rawGodPower = Math.round(getGodPowerLevelFromStats(char?.stats || {}) * godMult);
                const basePower = getBasePowerLevel(char);
                return window.DBZ_V6_PROGRESSION.calculateGodPowerRoute(char, {
                    ...getV6ProgressionContext(char, basePower),
                    rawGodPower
                });
            };`,
  "native God Power routes"
);
javascript = replaceRequired(
  javascript,
  `                if (!isGodKiUnlocked(char)) char.stats.GKI = 0;
                return char;`,
  `                if (!isGodKiUnlocked(char)) char.stats.GKI = 0;
                window.DBZ_V6_PROGRESSION.ensureCharacterProgression(char, { transformations: TRANSFORMATIONS });
                return char;`,
  "schema 32 race progression migration"
);
javascript = replaceRequired(
  javascript,
  `function getRaceAbsorptionKind(char) {
                const race = normalizeRaceKey(char?.race);
                if (race === 'android') return 'android';
                if (race === 'majin') return 'majin';
                return null;
            }`,
  `function getRaceAbsorptionKind(char) {
                const routeId = window.DBZ_V6_PROGRESSION.routeIdForCharacter(char);
                if (routeId === 'android_bio') return 'android';
                if (routeId === 'majin') return 'majin';
                return null;
            }`,
  "Android route split"
);
javascript = replaceRequired(
  javascript,
  /\} else if \(kind === 'android'\) \{\r?\n\s*const newLevel = Math\.max\(1, Math\.floor\(partnerLevel \* 0\.75\)\);[\s\S]*?\r?\n\s*\}/,
  `} else if (kind === 'android') {
                    // v6.3 templates never destroy partner development on failure.
                }`,
  "non-destructive absorption fallback"
);
javascript = replaceRequired(
  javascript,
  /\r?\n\s*\}\);\r?\n\s*\}\r?\n\s*state\.attempts\.unshift\(/,
  "\n                }\n                state.attempts.unshift(",
  "absorption fallback closure"
);
javascript = javascript
  .replaceAll("Perfect Android Absorption", "Bio-Android Adaptation Templates")
  .replaceAll("Majin Absorption", "Majin Absorption Cores")
  .replaceAll("Attempt to permanently copy 100% of an unlocked partner boost. Failure only starts a 7 day cooldown for that partner.", "Install one bounded partner trait in an Absorption Core. The partner remains owned and never loses levels.")
  .replaceAll("Attempt to permanently copy 10% of an unlocked partner boost. Failure costs that partner 25% of their levels and starts a 7 day cooldown.", "Install one bounded partner trait as an Adaptation Template. The partner remains owned and never loses levels.")
  .replaceAll("Roll + 0.257 ln(partner level / (7 x player level)) must be below 0.5.", "Quality comes from partner level, bond and tier. Preview and confirmation are required before installation.")
  .replaceAll("Roll + 0.257 ln(partner level / player level) must be below 0.5.", "Quality comes from partner level, bond and tier. Preview and confirmation are required before installation.")
  .replaceAll("They lost 25% of their levels.", "No partner levels were changed.");
javascript = replaceRequired(
  javascript,
  /function attemptRaceAbsorption\(partnerId\) \{[\s\S]*?\r?\n\s*window\.attemptRaceAbsorption = attemptRaceAbsorption;/,
  `function attemptRaceAbsorption(partnerId) {
                if (typeof window.installV6RaceCore === 'function') return window.installV6RaceCore(partnerId);
                return v6Alert('The bounded core manager is still loading. Please try again.');
            }
            window.attemptRaceAbsorption = attemptRaceAbsorption;`,
  "bounded absorption entry point"
);
javascript = replaceRequired(
  javascript,
  "const lockedText = absorbed ? `Absorbed ${absorbed.absorbPercent}% at Lv ${absorbed.level}` : cooldown.active ? `${Math.ceil(cooldown.remainingMs / 86400000)}d cooldown` : `${chance}% chance`;",
  `const routeEntries = kind === 'majin' ? (char.raceProgression?.absorptionCores || []) : (char.raceProgression?.adaptationTemplates || []);
                    const installedCore = routeEntries.find(entry => entry.sourcePartnerId === partner.id);
                    const lockedText = installedCore ? \`Installed · quality \${Math.round(installedCore.quality || 0)}\` : 'Preview bounded trait';`,
  "bounded absorption status"
);
javascript = replaceRequired(
  javascript,
  "<button class=\"btn-small v5t-action\" ${absorbed || cooldown.active ? 'disabled' : `onclick=\"attemptRaceAbsorption('${v5tEscape(partner.id)}')\"`}>${absorbed ? 'Absorbed' : 'Absorb'}</button>",
  "<button class=\"btn-small v5t-action\" onclick=\"attemptRaceAbsorption('${v5tEscape(partner.id)}')\">${absorbed ? 'Refresh' : 'Preview'}</button>",
  "bounded absorption action"
);
javascript = replaceRequired(
  javascript,
  "            { id: 'first_transform', name: 'A New Power Awakens', icon: '✨', desc: 'Unlock your first transformation', check: (char) => char.unlockedTransformations.length > 1 },",
  "            { id: 'first_transform', name: 'A New Power Awakens', icon: '✨', desc: 'Unlock your first usable transformation', check: (char) => getAvailableTransformations(char).length > 1 },",
  "usable transformation achievement"
);
javascript = javascript
  .replaceAll("check: (char) => char.unlockedTransformations.includes('super_saiyan')", "check: (char) => getAvailableTransformations(char).some(trans => trans.id === 'super_saiyan')")
  .replaceAll("check: (char) => char.unlockedTransformations.length >= 10", "check: (char) => getAvailableTransformations(char).length >= 10")
  .replaceAll("check: (char) => char.unlockedTransformations.length >= 20", "check: (char) => getAvailableTransformations(char).length >= 20")
  .replaceAll("check: (char) => char.unlockedTransformations.length >= 30", "check: (char) => getAvailableTransformations(char).length >= 30");
javascript = javascript
  .replaceAll("Team PL multiplier", "Training synergy index")
  .replaceAll("Team PL x", "Training synergy ×")
  .replaceAll("Active Team Scaling", "Active Team Synergy");

javascript = replaceRequired(
  javascript,
  "            function v5_patchAbilityData() {",
  `            function v6ScaleProgressionRequirements(requirements, sagaId, targetShare = 0.75) {
                const scaled = { ...(requirements || {}) };
                const statEntries = Object.entries(scaled).filter(([stat, value]) =>
                    STATS.includes(stat) && stat !== 'GKI' && Number(value) > 0
                );
                if (!statEntries.length) return scaled;
                const week = SAGA_TARGET_WEEKS[sagaId || scaled.sagaId] ?? 0;
                const targetScore = Math.max(40, window.DBZ_V6_CONFIG.basePowerTargetForWeek(week) * targetShare);
                const currentScore = statEntries.reduce((sum, [stat, value]) =>
                    sum + Number(value) * Number(window.DBZ_V6_CONFIG.statWeights[stat] || 1), 0
                );
                if (currentScore > targetScore) {
                    const scale = targetScore / currentScore;
                    statEntries.forEach(([stat, value]) => {
                        scaled[stat] = Math.max(1, Math.round(Number(value) * scale));
                    });
                }
                if (Number(scaled.level) > 0) {
                    scaled.level = Math.min(Number(scaled.level), Math.max(5, Math.round(8 + week * 0.72)));
                }
                return scaled;
            }

            function v5_patchAbilityData() {`,
  "progression requirement scaler"
);
javascript = replaceRequired(
  javascript,
  "                ABILITIES.forEach(ability => {\n                    const authored = ABILITY_EFFECT_LIBRARY[ability.id] || {};",
  "                ABILITIES.forEach(ability => {\n                    ability.reqs = v6ScaleProgressionRequirements(ability.reqs, ability.sagaId, 0.48);\n                    const authored = ABILITY_EFFECT_LIBRARY[ability.id] || {};",
  "ability requirement rebalance"
);
javascript = replaceRequired(
  javascript,
  "                TRANSFORMATIONS.forEach(trans => {\n                    const authored = TRANSFORMATION_EFFECT_LIBRARY[trans.id] || {};",
  "                TRANSFORMATIONS.forEach(trans => {\n                    trans.reqs = v6ScaleProgressionRequirements(trans.reqs, trans.reqs?.sagaId, 0.78);\n                    const authored = TRANSFORMATION_EFFECT_LIBRARY[trans.id] || {};",
  "transformation requirement rebalance"
);
javascript = replaceRequired(
  javascript,
  /const statsOK = \['STR','END','AGI','VIT','SPI'\]\.every\(s => !ability\.reqs\[s\] \|\| char\.stats\[s\] >= ability\.reqs\[s\]\);\r?\n\s*const isAvailable = sagaUnlocked && statsOK;/,
  `                    const missingStats = ['STR','END','AGI','VIT','SPI']
                        .filter(stat => ability.reqs[stat] && char.stats[stat] < ability.reqs[stat])
                        .map(stat => \`\${stat} \${Math.ceil(ability.reqs[stat] - char.stats[stat])} short\`);
                    const statsOK = missingStats.length === 0;
                    const missingRequirements = [
                        ...(!sagaUnlocked ? [\`Clear \${sagaName}\`] : []),
                        ...missingStats
                    ];
                    const isAvailable = sagaUnlocked && statsOK;`,
  "ability missing requirements"
);
javascript = replaceRequired(
  javascript,
  /let statusText = '🔒 Locked';\r?\n\s*let statusClass = 'status-locked';/,
  "let statusText = missingRequirements.length ? `Locked · ${missingRequirements.slice(0, 2).join(' · ')}` : 'Locked';\n                    let statusClass = 'status-locked';",
  "ability locked status"
);
javascript = replaceRequired(
  javascript,
  `        function v5aRequirementText(char, ability) {
            const blockers = v5aRequirementBlockers(char, ability);
            if (!blockers.length) return 'Requirements met';
            return blockers.slice(0, 3).join(' | ');
        }`,
  `        function v5aRequirementText(char, ability) {
            const check = typeof canPurchaseAbility === 'function'
                ? canPurchaseAbility(char, ability)
                : { blockers: v5aRequirementBlockers(char, ability) };
            const blockers = (check.blockers || []).map(blocker => {
                const text = String(blocker || '');
                if (!v5aGodKiVisible(char) && text.startsWith('GKI ')) return 'God Ki unlocked in Dragon Ball Super';
                return text;
            });
            return blockers.length ? blockers.slice(0, 3).join(' | ') : 'Ready to purchase';
        }`,
  "ability AP lock explanation"
);

javascript = replaceRequired(
  javascript,
  "            if (fromSchema < 25) {",
  `            if (fromSchema < 31 && !c.v6Migration) {
                const migratedBasePower = window.DBZ_V6_CONFIG.basePower(
                    c.stats,
                    getStartingStatsForRace(c.race || 'earthling'),
                    false
                );
                const migratedRoute = typeof window.getRaceRoutePowerMultiplier === 'function'
                    ? window.getRaceRoutePowerMultiplier(c)
                    : { multiplier: 1, label: 'Base Form' };
                c.v6Migration = {
                    sourceSchema: fromSchema,
                    targetSchema: SAVE_SCHEMA_VERSION,
                    migratedAt: new Date().toISOString(),
                    note: 'Base fitness power now grows linearly; equipped states and race mechanics provide saga-scale power.',
                    preview: {
                        previousModel: 'v5 exponential display model',
                        baseFitnessPL: Math.max(1, Math.round(migratedBasePower)),
                        stateLabel: migratedRoute.label,
                        stateMultiplier: migratedRoute.multiplier,
                        effectivePL: Math.max(1, Math.round(migratedBasePower * migratedRoute.multiplier))
                    }
                };
            }
            if (fromSchema < 25) {`,
  "v6 migration receipt"
);
javascript = replaceRequired(
  javascript,
  "            const notes = '';",
  "            const notes = String(state.v6WorkoutContext?.notes || '').slice(0, 500);",
  "workout context notes"
);
javascript = replaceRequired(
  javascript,
  /mainPartner: getMainPartnerId\(char\),\r?\n\s*notes/,
  `                mainPartner: getMainPartnerId(char),
                wellness: {
                    rpe: Number(state.v6WorkoutContext?.rpe) || null,
                    rir: Number(state.v6WorkoutContext?.rir) || null,
                    deload: !!state.v6WorkoutContext?.deload,
                    readiness: Number(state.v6Wellness?.readiness) || null,
                    illness: !!state.v6Wellness?.illness,
                    injury: String(state.v6Wellness?.injury || '').slice(0, 180)
                },
                notes`,
  "workout wellness record"
);
javascript = replaceRequired(
  javascript,
  /saveState\(\);\r?\n\s*currentWorkoutSession = \[\];/,
  "            state.v6WorkoutContext = {};\r\n            saveState();\r\n            currentWorkoutSession = [];",
  "workout context reset"
);

let html = source
  .replace('<meta name="viewport" content="width=880, viewport-fit=cover">', '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">')
  .replace("<title>Dragon Ball Fitness RPG Tracker</title>", "<title>Dragon Ball Fitness RPG v6</title>")
  .replace('content="A Dragon Ball inspired fitness RPG tracker."', 'content="A three-year, offline-first fitness RPG with race-specific progression, transformations, abilities, partners, and story sagas."')
  .replace('content="DB Fitness RPG"', 'content="DB Fitness RPG v6"')
  .replace('href="manifest.webmanifest"', 'href="manifest-v6.webmanifest"')
  .replace("<head>", `<head>\n    <meta name="dbz-build" content="${BUILD_ID}">`)
  .replace('<h1 class="game-title">Dragon Ball Fitness RPG</h1>', `<h1 class="game-title">Dragon Ball Fitness RPG <span class="v6-build-badge">v6.3 · ${BUILD_ID}</span></h1>`)
  .replace(styleMatch[0], `    <link rel="stylesheet" href="dbz-v6.css?v=${BUILD_ID}">\n    <link rel="stylesheet" href="dbz-v6-overrides.css?v=${BUILD_ID}">`)
  .replace(
    scriptMatch[0],
    `    <script src="dbz-v6-config.js?v=${BUILD_ID}"></script>\n` +
      `    <script src="dbz-v6-progression-config.js?v=${BUILD_ID}"></script>\n` +
      `    <script src="dbz-v6-progression-core.js?v=${BUILD_ID}"></script>\n` +
      `    <script src="v6-asset-manifest.js?v=${BUILD_ID}"></script>\n` +
      `    <script src="dbz-v6-storage.js?v=${BUILD_ID}"></script>\n` +
      `    <script src="dbz-v6.js?v=${BUILD_ID}"></script>\n` +
      `    <script src="dbz-v6-enhancements.js?v=${BUILD_ID}"></script>\n` +
      `    <script src="dbz-v6-race-ui.js?v=${BUILD_ID}"></script>`
  );

html = html.replaceAll("Dragon Ball Fitness RPG Tracker", "Dragon Ball Fitness RPG v6");

const finalizeText = value => value.replace(/[ \t]+$/gm, "").trimEnd() + "\n";
html = finalizeText(html);
css = finalizeText(css.trimStart());
javascript = finalizeText(javascript.trimStart());

fs.writeFileSync(path.join(DESTINATION, "DragonBall_Fitness_RPG_v6.0.html"), html);
if (fs.existsSync(path.join(DESTINATION, ".git"))) {
  fs.writeFileSync(path.join(DESTINATION, "index.html"), html);
}
fs.writeFileSync(path.join(DESTINATION, "dbz-v6.css"), css);
fs.writeFileSync(path.join(DESTINATION, "dbz-v6.js"), javascript);
const assetManifest = Object.fromEntries(
  imageFiles.map(fullPath => {
    const relative = path.relative(DESTINATION, fullPath).replaceAll("\\", "/");
    const hash = crypto.createHash("sha256").update(fs.readFileSync(fullPath)).digest("hex").slice(0, 12);
    return [relative, `./${relative}?h=${hash}`];
  })
);
fs.writeFileSync(
  path.join(DESTINATION, "v6-asset-manifest.js"),
  `'use strict';\n\nglobalThis.DBZ_V6_ASSETS = Object.freeze(${JSON.stringify(assetManifest, null, 2)});\n`
);

console.log(
  JSON.stringify(
    {
      htmlBytes: Buffer.byteLength(html),
      cssBytes: Buffer.byteLength(css),
      javascriptBytes: Buffer.byteLength(javascript),
      removedEmbeddedBytes: scriptMatch[1].length - javascript.length,
    },
    null,
    2
  )
);
