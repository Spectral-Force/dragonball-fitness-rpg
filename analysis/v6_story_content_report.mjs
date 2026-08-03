import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const EXPECTED_SERIES_BEATS = Object.freeze({ DB: 63, DBZ: 126, DAIMA: 23, DBS: 66 });
const EXPECTED_SAGA_BEATS = 278;
const EXPECTED_SAGAS = 38;
const SAGA_PHASES = Object.freeze(['entry', 'development', 'preclimax', 'resolution', 'mastery']);
const CHARACTER_PHASES = Object.freeze(['introduction', 'bond', 'conflict', 'breakthrough', 'legacy']);
const CHARACTER_SAGA_STATUSES = Object.freeze(['unlocked', 'unlocked', 'cleared', 'cleared', 'mastered']);
const RELATIONSHIP_SAGA_STATUSES = Object.freeze(['cleared', 'mastered']);
const PLACEHOLDER_PATTERN = /\b(?:fallback|placeholder|lorem ipsum|todo|tbd|coming soon|replace me|dummy text|sample text)\b/i;
const HTML_PATTERN = /<\/?[a-z][^>]*>/i;
const DIRECT_QUOTE_PATTERN = /[\u0022\u00ab\u00bb\u201c\u201d]|\u2018[^\u2019\n]{2,}\u2019|â€œ|â€/u;
const REPORT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(REPORT_DIRECTORY, '..');
let loadSequence = 0;

function isRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

function wordCount(value) {
    return isNonEmptyString(value) ? value.trim().split(/\s+/u).length : 0;
}

function normalizedText(value) {
    return String(value || '').normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function stats(values) {
    if (!values.length) return { count: 0, min: 0, max: 0, average: 0, total: 0 };
    const total = values.reduce((sum, value) => sum + value, 0);
    return {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        average: Math.round((total / values.length) * 100) / 100,
        total
    };
}

function addDistribution(target, key, beats) {
    const label = isNonEmptyString(key) ? key : '(missing)';
    target[label] ||= { packs: 0, beats: 0 };
    target[label].packs += 1;
    target[label].beats += beats;
}

function pushError(errors, message) {
    if (!errors.includes(message)) errors.push(message);
}

function validateStringArray(value, label, errors) {
    if (!Array.isArray(value) || value.length === 0) {
        pushError(errors, `${label} must be a non-empty array.`);
        return;
    }
    if (value.some(item => !isNonEmptyString(item)) || new Set(value).size !== value.length) {
        pushError(errors, `${label} must contain unique non-empty strings.`);
    }
}

function registerId(registry, id, location, errors) {
    if (!isNonEmptyString(id)) {
        pushError(errors, `${location} requires a non-empty id.`);
        return;
    }
    if (registry.has(id)) pushError(errors, `Duplicate production ID ${id}: ${registry.get(id)} and ${location}.`);
    else registry.set(id, location);
}

function scanStrings(value, location, errors, options = {}) {
    if (typeof value === 'string') {
        if (PLACEHOLDER_PATTERN.test(value)) pushError(errors, `${location} contains fallback/placeholder language.`);
        if (HTML_PATTERN.test(value)) pushError(errors, `${location} contains HTML.`);
        if (options.narrative && DIRECT_QUOTE_PATTERN.test(value)) {
            pushError(errors, `${location} contains direct-quote-shaped punctuation.`);
        }
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((item, index) => scanStrings(item, `${location}[${index}]`, errors, options));
        return;
    }
    if (isRecord(value)) {
        for (const [key, item] of Object.entries(value)) {
            scanStrings(item, `${location}.${key}`, errors, {
                narrative: options.narrative || ['canonText', 'characterText', 'playerReflection', 'trainingText'].includes(key)
            });
        }
    }
}

function auditTextField(beat, field, band, location, errors, wordValues, textRegistry) {
    const value = beat[field];
    if (!isNonEmptyString(value)) {
        pushError(errors, `${location}.${field} is required.`);
        return;
    }
    const words = wordCount(value);
    wordValues[field] ||= [];
    wordValues[field].push(words);
    if (words < band[0] || words > band[1]) {
        pushError(errors, `${location}.${field} has ${words} words; expected ${band[0]}-${band[1]}.`);
    }
    const normalized = normalizedText(value);
    if (textRegistry.has(normalized)) {
        pushError(errors, `${location}.${field} duplicates ${textRegistry.get(normalized)}.`);
    } else {
        textRegistry.set(normalized, `${location}.${field}`);
    }
}

function contentBeats(pack, collectionName, packId, errors) {
    if (Array.isArray(pack?.beats)) return pack.beats;
    if (Array.isArray(pack?.entries)) {
        pushError(errors, `${collectionName} pack ${packId} uses diagnostic fallback key entries; expected beats.`);
        return pack.entries;
    }
    pushError(errors, `${collectionName} pack ${packId} requires a beats array.`);
    return [];
}

function extractRuntimeRoster(runtimeSource, errors) {
    if (!isNonEmptyString(runtimeSource)) {
        pushError(errors, 'Runtime roster source was unavailable.');
        return [];
    }
    const start = runtimeSource.indexOf('const PARTNER_ROSTER = [');
    const end = start >= 0 ? runtimeSource.indexOf('\n        ];', start) : -1;
    if (start < 0 || end < 0) {
        pushError(errors, 'Could not extract PARTNER_ROSTER from dbz-v6.js.');
        return [];
    }
    const segment = runtimeSource.slice(start, end);
    const ids = [...segment.matchAll(/["']id["']\s*:\s*["']([^"']+)["']/gu)].map(match => match[1]);
    const unique = [...new Set(ids)];
    if (unique.length < 20) pushError(errors, `Runtime roster extraction found only ${unique.length} IDs.`);
    return unique;
}

function auditSagaStatusCoverage(core, pack, errors) {
    if (!core || typeof core.resolveSagaEntries !== 'function') {
        pushError(errors, 'Story core resolveSagaEntries is unavailable for status coverage checks.');
        return;
    }
    const data = { version: '6.4.0', sagas: { [pack.id]: pack }, characters: {}, relationships: {} };
    const states = {
        locked: { sagaProgress: { [pack.id]: { status: 'locked', focusXP: 100 } } },
        entry: { sagaProgress: { [pack.id]: { status: 'unlocked', focusXP: 0 } } },
        focus: { sagaProgress: { [pack.id]: { status: 'unlocked', focusXP: 100 } } },
        resolution: { sagaProgress: { [pack.id]: { status: 'cleared', focusXP: 100 } } },
        mastery: { sagaProgress: { [pack.id]: { status: 'mastered', focusXP: 100 } } }
    };
    const resolve = state => core.resolveSagaEntries(data, pack.id, state, { focusTarget: 100 });
    const locked = resolve(states.locked);
    const atEntry = resolve(states.entry);
    const atFocus = resolve(states.focus);
    const atResolution = resolve(states.resolution);
    const atMastery = resolve(states.mastery);
    if (locked.some(beat => beat.unlocked)) pushError(errors, `${pack.id} exposes a beat while locked.`);
    if (atEntry.some(beat => beat.unlocked !== (beat.phase === 'entry'))) {
        pushError(errors, `${pack.id} has incorrect 0% entry-phase status coverage.`);
    }
    if (atFocus.some(beat => beat.unlocked !== ['entry', 'development', 'preclimax'].includes(beat.phase))) {
        pushError(errors, `${pack.id} has incorrect full-Focus status coverage.`);
    }
    if (atResolution.some(beat => beat.unlocked !== (beat.phase !== 'mastery'))) {
        pushError(errors, `${pack.id} has incorrect cleared status coverage.`);
    }
    if (atMastery.some(beat => !beat.unlocked)) pushError(errors, `${pack.id} does not expose all beats at mastery.`);
}

function auditSagas(data, config, core, errors, registry, textRegistry, wordValues, continuity) {
    const sagas = isRecord(data?.sagas) ? data.sagas : {};
    const configuredIds = isRecord(config?.sagaTargetWeeks) ? Object.keys(config.sagaTargetWeeks) : [];
    const seriesBeats = { DB: 0, DBZ: 0, DAIMA: 0, DBS: 0 };
    let sagaBeats = 0;

    if (configuredIds.length !== EXPECTED_SAGAS) {
        pushError(errors, `Configuration exposes ${configuredIds.length} sagas; expected ${EXPECTED_SAGAS}.`);
    }
    const sagaKeys = Object.keys(sagas);
    if (sagaKeys.length !== EXPECTED_SAGAS) pushError(errors, `Story data contains ${sagaKeys.length} saga packs; expected ${EXPECTED_SAGAS}.`);
    for (const id of configuredIds) {
        const exactMatches = Object.entries(sagas).filter(([key, pack]) => key === id && pack?.id === id);
        if (exactMatches.length !== 1) pushError(errors, `Configured saga ${id} resolves exactly ${exactMatches.length} times; expected once.`);
    }
    for (const key of sagaKeys) {
        if (!configuredIds.includes(key)) pushError(errors, `Story data contains unconfigured saga ${key}.`);
    }

    if (core && typeof core.validateStoryData === 'function') {
        const coreReport = core.validateStoryData(data, config);
        coreReport.errors.forEach(error => pushError(errors, `Core schema: ${error}`));
    } else {
        pushError(errors, 'DBZ_V6_STORY_CORE validator is unavailable.');
    }

    for (const [sagaId, pack] of Object.entries(sagas)) {
        const location = `sagas.${sagaId}`;
        if (!isRecord(pack)) {
            pushError(errors, `${location} must be an object.`);
            continue;
        }
        registerId(registry, pack.id, location, errors);
        const beats = Array.isArray(pack.entries) ? pack.entries : [];
        sagaBeats += beats.length;
        if (Object.prototype.hasOwnProperty.call(seriesBeats, pack.series)) seriesBeats[pack.series] += beats.length;
        else pushError(errors, `${location} has unsupported series ${String(pack.series)}.`);
        addDistribution(continuity.sagas, pack.continuity, beats.length);
        if (!isNonEmptyString(pack.continuity)) pushError(errors, `${location}.continuity is required.`);
        if (!isNonEmptyString(pack.sourceNote)) pushError(errors, `${location}.sourceNote is required.`);

        const phaseCounts = Object.fromEntries(SAGA_PHASES.map(phase => [phase, 0]));
        let previousFocus = -Infinity;
        for (const [index, beat] of beats.entries()) {
            const beatLocation = `${location}.entries[${index}]`;
            registerId(registry, beat?.id, beatLocation, errors);
            if (!isRecord(beat)) continue;
            if (Object.prototype.hasOwnProperty.call(phaseCounts, beat.phase)) phaseCounts[beat.phase] += 1;
            else pushError(errors, `${beatLocation} has unsupported phase ${String(beat.phase)}.`);
            if (beat.order !== index + 1) pushError(errors, `${beatLocation}.order must equal ${index + 1}.`);
            if (['resolution', 'mastery'].includes(beat.phase)) {
                if (Object.prototype.hasOwnProperty.call(beat, 'focusRatio')) {
                    pushError(errors, `${beatLocation} ${beat.phase} must be ratio-free.`);
                }
            } else if (Object.prototype.hasOwnProperty.call(beat, 'focusRatio')) {
                if (!Number.isFinite(beat.focusRatio) || beat.focusRatio < 0 || beat.focusRatio > 1) {
                    pushError(errors, `${beatLocation}.focusRatio must be between 0 and 1.`);
                } else {
                    if (beat.focusRatio <= previousFocus) pushError(errors, `${beatLocation}.focusRatio must increase monotonically.`);
                    previousFocus = beat.focusRatio;
                }
            }
            if (['development', 'preclimax'].includes(beat.phase)
                && (!Number.isFinite(beat.focusRatio) || beat.focusRatio <= 0)) {
                pushError(errors, `${beatLocation} requires a positive Focus threshold.`);
            }
            auditTextField(beat, 'canonText', [40, 80], beatLocation, errors, wordValues, textRegistry);
            auditTextField(beat, 'characterText', [20, 45], beatLocation, errors, wordValues, textRegistry);
            auditTextField(beat, 'playerReflection', [10, 35], beatLocation, errors, wordValues, textRegistry);
            validateStringArray(beat.characters, `${beatLocation}.characters`, errors);
            validateStringArray(beat.tags, `${beatLocation}.tags`, errors);
        }
        for (const phase of SAGA_PHASES) {
            if (phaseCounts[phase] < 1) pushError(errors, `${location} requires ${phase} phase coverage.`);
        }
        if (phaseCounts.entry !== 1 || phaseCounts.resolution !== 1 || phaseCounts.mastery !== 1) {
            pushError(errors, `${location} requires exactly one entry, resolution, and mastery beat.`);
        }
        if (beats.at(-2)?.phase !== 'resolution' || beats.at(-1)?.phase !== 'mastery') {
            pushError(errors, `${location} must end with resolution then mastery.`);
        }
        auditSagaStatusCoverage(core, pack, errors);
    }

    if (sagaBeats !== EXPECTED_SAGA_BEATS) pushError(errors, `Saga beat total is ${sagaBeats}; expected ${EXPECTED_SAGA_BEATS}.`);
    for (const [series, expected] of Object.entries(EXPECTED_SERIES_BEATS)) {
        if (seriesBeats[series] !== expected) pushError(errors, `${series} beat total is ${seriesBeats[series]}; expected ${expected}.`);
    }
    return { sagas: sagaKeys.length, sagaBeats, seriesBeats };
}

function auditCharacters(data, rosterIds, configuredSagaIds, errors, registry, textRegistry, wordValues, continuity) {
    const characters = isRecord(data?.characters) ? data.characters : {};
    const roster = new Set(rosterIds);
    let characterBeats = 0;
    let completeArcs = 0;
    let coreCharacterArcs = 0;
    for (const [characterId, pack] of Object.entries(characters)) {
        const location = `characters.${characterId}`;
        if (!isRecord(pack)) {
            pushError(errors, `${location} must be an object.`);
            continue;
        }
        registerId(registry, pack.id, location, errors);
        if (pack.id !== characterId) pushError(errors, `${location}.id must exactly match its object key.`);
        if (pack.id !== pack.partnerId) pushError(errors, `${location}.id must exactly match partnerId.`);
        if (!isNonEmptyString(pack.partnerId) || !roster.has(pack.partnerId)) {
            pushError(errors, `${location}.partnerId ${String(pack.partnerId)} does not resolve in PARTNER_ROSTER.`);
        }
        if (!isNonEmptyString(pack.continuity)) pushError(errors, `${location}.continuity is required.`);
        if (!isNonEmptyString(pack.sourceNote)) pushError(errors, `${location}.sourceNote is required.`);
        const beats = contentBeats(pack, 'Character', characterId, errors);
        characterBeats += beats.length;
        if (beats.length === 5) completeArcs += 1;
        else pushError(errors, `${location} has ${beats.length} beats; expected 5.`);
        if (beats.length === 5 && pack.continuity === 'canon_core') coreCharacterArcs += 1;
        addDistribution(continuity.characters, pack.continuity, beats.length);
        for (const [index, beat] of beats.entries()) {
            const beatLocation = `${location}.beats[${index}]`;
            registerId(registry, beat?.id, beatLocation, errors);
            if (!isRecord(beat)) continue;
            if (beat.order !== index + 1) pushError(errors, `${beatLocation}.order must equal ${index + 1}.`);
            if (beat.phase !== CHARACTER_PHASES[index]) {
                pushError(errors, `${beatLocation}.phase must be ${CHARACTER_PHASES[index]}.`);
            }
            auditTextField(beat, 'canonText', [12, 100], beatLocation, errors, wordValues, textRegistry);
            auditTextField(beat, 'characterText', [12, 80], beatLocation, errors, wordValues, textRegistry);
            auditTextField(beat, 'playerReflection', [8, 50], beatLocation, errors, wordValues, textRegistry);
            validateStringArray(beat.tags, `${beatLocation}.tags`, errors);
            if (!isRecord(beat.unlock)) pushError(errors, `${beatLocation}.unlock is required.`);
            if (isRecord(beat.unlock?.partner) && beat.unlock.partner.id !== pack.partnerId) {
                pushError(errors, `${beatLocation}.unlock.partner.id must match ${pack.partnerId}.`);
            }
            if (!configuredSagaIds.has(beat.unlock?.saga?.id)) {
                pushError(errors, `${beatLocation}.unlock.saga.id does not resolve to a configured saga.`);
            }
            if (beat.unlock?.saga?.status !== CHARACTER_SAGA_STATUSES[index]) {
                pushError(errors, `${beatLocation}.unlock.saga.status must be ${CHARACTER_SAGA_STATUSES[index]}.`);
            }
        }
    }
    if (completeArcs < 20) pushError(errors, `Only ${completeArcs} character arcs contain exactly 5 beats; expected at least 20.`);
    if (coreCharacterArcs < 20) pushError(errors, `Only ${coreCharacterArcs} canon-core character arcs contain exactly 5 beats; expected at least 20.`);
    return {
        characterArcs: Object.keys(characters).length,
        completeCharacterArcs: completeArcs,
        coreCharacterArcs,
        characterBeats
    };
}

function auditRelationships(data, rosterIds, configuredSagaIds, errors, registry, textRegistry, wordValues, continuity) {
    const relationships = isRecord(data?.relationships) ? data.relationships : {};
    const roster = new Set(rosterIds);
    let relationshipBeats = 0;
    let completePacks = 0;
    for (const [relationshipId, pack] of Object.entries(relationships)) {
        const location = `relationships.${relationshipId}`;
        if (!isRecord(pack)) {
            pushError(errors, `${location} must be an object.`);
            continue;
        }
        registerId(registry, pack.id, location, errors);
        if (pack.id !== relationshipId) pushError(errors, `${location}.id must exactly match its object key.`);
        if (!isNonEmptyString(pack.continuity)) pushError(errors, `${location}.continuity is required.`);
        if (!isNonEmptyString(pack.sourceNote)) pushError(errors, `${location}.sourceNote is required.`);
        validateStringArray(pack.partnerIds, `${location}.partnerIds`, errors);
        if (Array.isArray(pack.partnerIds) && pack.partnerIds.length !== 2) {
            pushError(errors, `${location}.partnerIds must identify exactly two partners.`);
        }
        for (const partnerId of Array.isArray(pack.partnerIds) ? pack.partnerIds : []) {
            if (!roster.has(partnerId)) pushError(errors, `${location}.partnerIds contains unresolved runtime ID ${partnerId}.`);
        }
        const beats = contentBeats(pack, 'Relationship', relationshipId, errors);
        relationshipBeats += beats.length;
        if (beats.length === 2) completePacks += 1;
        else pushError(errors, `${location} has ${beats.length} beats; expected 2.`);
        addDistribution(continuity.relationships, pack.continuity, beats.length);
        for (const [index, beat] of beats.entries()) {
            const beatLocation = `${location}.beats[${index}]`;
            registerId(registry, beat?.id, beatLocation, errors);
            if (!isRecord(beat)) continue;
            if (beat.order !== index + 1) pushError(errors, `${beatLocation}.order must equal ${index + 1}.`);
            if (beat.phase !== 'training_interlude') pushError(errors, `${beatLocation}.phase must be training_interlude.`);
            auditTextField(beat, 'trainingText', [12, 100], beatLocation, errors, wordValues, textRegistry);
            auditTextField(beat, 'characterText', [12, 80], beatLocation, errors, wordValues, textRegistry);
            auditTextField(beat, 'playerReflection', [8, 50], beatLocation, errors, wordValues, textRegistry);
            validateStringArray(beat.tags, `${beatLocation}.tags`, errors);
            if (!isRecord(beat.unlock)) pushError(errors, `${beatLocation}.unlock is required.`);
            const unlockedPartnerIds = Array.isArray(beat.unlock?.partners)
                ? beat.unlock.partners.map(partner => partner?.id)
                : [];
            if (unlockedPartnerIds.length !== 2 || pack.partnerIds.some(id => !unlockedPartnerIds.includes(id))) {
                pushError(errors, `${beatLocation}.unlock.partners must resolve both relationship partners.`);
            }
            if (!configuredSagaIds.has(beat.unlock?.saga?.id)) {
                pushError(errors, `${beatLocation}.unlock.saga.id does not resolve to a configured saga.`);
            }
            if (beat.unlock?.saga?.status !== RELATIONSHIP_SAGA_STATUSES[index]) {
                pushError(errors, `${beatLocation}.unlock.saga.status must be ${RELATIONSHIP_SAGA_STATUSES[index]}.`);
            }
        }
    }
    if (completePacks < 20) pushError(errors, `Only ${completePacks} relationship packs contain exactly 2 beats; expected at least 20.`);
    return { relationshipPacks: Object.keys(relationships).length, completeRelationshipPacks: completePacks, relationshipBeats };
}

export async function loadStoryModules(rootDirectory = DEFAULT_ROOT) {
    loadSequence += 1;
    delete globalThis.DBZ_V6_CONFIG;
    delete globalThis.DBZ_V6_STORY_DATA;
    delete globalThis.DBZ_V6_STORY_CORE;
    const moduleNames = [
        'dbz-v6-config.js',
        'dbz-v6-story-db.js',
        'dbz-v6-story-dbz.js',
        'dbz-v6-story-super.js',
        'dbz-v6-story-characters.js',
        'dbz-v6-story-core.js'
    ];
    const loadErrors = [];
    for (const [index, moduleName] of moduleNames.entries()) {
        const moduleUrl = pathToFileURL(path.join(rootDirectory, moduleName));
        moduleUrl.searchParams.set('story-audit', `${loadSequence}-${index}`);
        try {
            await import(moduleUrl.href);
        } catch (error) {
            loadErrors.push(`Failed to load ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return {
        data: globalThis.DBZ_V6_STORY_DATA,
        config: globalThis.DBZ_V6_CONFIG,
        core: globalThis.DBZ_V6_STORY_CORE,
        loadErrors
    };
}

export function analyzeStoryContent({ data, config, core, runtimeSource = '', loadErrors = [] }) {
    const errors = [...loadErrors];
    const registry = new Map();
    const textRegistry = new Map();
    const wordValues = {};
    const continuity = { sagas: {}, characters: {}, relationships: {} };
    if (!isRecord(data)) pushError(errors, 'DBZ_V6_STORY_DATA was not initialized.');
    if (data?.version !== '6.4.0') pushError(errors, `Story content version is ${String(data?.version)}; expected 6.4.0.`);
    scanStrings(data, 'storyData', errors);
    const rosterIds = extractRuntimeRoster(runtimeSource, errors);
    const configuredSagaIds = new Set(isRecord(config?.sagaTargetWeeks) ? Object.keys(config.sagaTargetWeeks) : []);
    const sagaCounts = auditSagas(data, config, core, errors, registry, textRegistry, wordValues, continuity);
    const characterCounts = auditCharacters(data, rosterIds, configuredSagaIds, errors, registry, textRegistry, wordValues, continuity);
    const relationshipCounts = auditRelationships(data, rosterIds, configuredSagaIds, errors, registry, textRegistry, wordValues, continuity);

    const sagaCharacterIds = new Set(Object.values(isRecord(data?.sagas) ? data.sagas : {})
        .flatMap(pack => (Array.isArray(pack?.entries) ? pack.entries : []))
        .flatMap(beat => Array.isArray(beat?.characters) ? beat.characters : []));
    const storyCharacterIds = new Set(Object.keys(isRecord(data?.characters) ? data.characters : {}));
    const roster = new Set(rosterIds);
    const resolvableSagaCharacterIds = [...sagaCharacterIds]
        .filter(id => storyCharacterIds.has(id) || roster.has(id));

    const wordCounts = Object.fromEntries(Object.entries(wordValues).map(([field, values]) => [field, stats(values)]));
    errors.sort((left, right) => left.localeCompare(right));
    return {
        version: data?.version || null,
        valid: errors.length === 0,
        counts: {
            ...sagaCounts,
            ...characterCounts,
            ...relationshipCounts,
            productionIds: registry.size,
            runtimeRosterIds: rosterIds.length,
            sagaCharacterReferences: sagaCharacterIds.size,
            resolvableSagaCharacterReferences: resolvableSagaCharacterIds.length
        },
        continuity,
        wordCounts,
        errors
    };
}

export async function buildStoryContentReport(rootDirectory = DEFAULT_ROOT) {
    const loaded = await loadStoryModules(rootDirectory);
    let runtimeSource = '';
    try {
        runtimeSource = await readFile(path.join(rootDirectory, 'dbz-v6.js'), 'utf8');
    } catch (error) {
        loaded.loadErrors.push(`Failed to read dbz-v6.js: ${error instanceof Error ? error.message : String(error)}`);
    }
    return analyzeStoryContent({ ...loaded, runtimeSource });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
    const requestedRoot = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_ROOT;
    const report = await buildStoryContentReport(requestedRoot);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!report.valid) process.exitCode = 1;
}
