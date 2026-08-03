(function installDragonBallFitnessStoryCore(root) {
    'use strict';

    const STORY_VERSION = '6.4.0';
    const STORY_LOG_SCHEMA_VERSION = 1;
    const PHASES = Object.freeze(['entry', 'development', 'preclimax', 'resolution', 'mastery']);
    const FOCUS_PHASES = new Set(['development', 'preclimax']);
    const PHASE_RANK = Object.freeze(Object.fromEntries(PHASES.map((phase, index) => [phase, index])));
    const STATUS_RANK = Object.freeze({ locked: 0, unlocked: 1, cleared: 2, mastered: 3 });

    function isRecord(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function isNonEmptyString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    }

    function isTimestamp(value) {
        return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
    }

    function uniqueStrings(values) {
        const seen = new Set();
        const result = [];
        for (const value of Array.isArray(values) ? values : []) {
            if (!isNonEmptyString(value) || seen.has(value)) continue;
            seen.add(value);
            result.push(value);
        }
        return result;
    }

    function configuredSagaIds(config) {
        if (!isRecord(config)) return [];
        if (isRecord(config.sagaTargetWeeks)) return Object.keys(config.sagaTargetWeeks);
        if (Array.isArray(config.sagas)) {
            return uniqueStrings(config.sagas.map(saga => isRecord(saga) ? saga.id : null));
        }
        return [];
    }

    /**
     * Validate assembled story content without mutating it.
     * The installed DBZ_V6_CONFIG is used only when the caller omits config.
     */
    function validateStoryData(data, config) {
        const errors = [];
        const storyData = isRecord(data) ? data : {};
        const sagas = isRecord(storyData.sagas) ? storyData.sagas : {};
        const expectedIds = configuredSagaIds(arguments.length >= 2 ? config : root.DBZ_V6_CONFIG);
        const sagaKeys = Object.keys(sagas);
        const entryIds = new Set();
        const packIds = new Set();
        let entryCount = 0;

        if (!isRecord(data)) errors.push('Story data must be an object.');
        if (storyData.version !== STORY_VERSION) {
            errors.push(`Story data version must be ${STORY_VERSION}.`);
        }
        if (!isRecord(storyData.sagas)) errors.push('Story data sagas must be an object.');
        if (!isRecord(storyData.characters)) errors.push('Story data characters must be an object.');
        if (!isRecord(storyData.relationships)) errors.push('Story data relationships must be an object.');

        if (expectedIds.length) {
            if (expectedIds.length !== 38) {
                errors.push(`Loaded configuration must expose exactly 38 saga IDs; found ${expectedIds.length}.`);
            }
            const expected = new Set(expectedIds);
            for (const id of expectedIds) {
                if (!Object.prototype.hasOwnProperty.call(sagas, id)) {
                    errors.push(`Missing configured saga: ${id}.`);
                }
            }
            for (const id of sagaKeys) {
                if (!expected.has(id)) errors.push(`Unknown saga not present in configuration: ${id}.`);
            }
        }

        for (const [sagaKey, packValue] of Object.entries(sagas)) {
            if (!isRecord(packValue)) {
                errors.push(`Saga ${sagaKey} must be an object.`);
                continue;
            }
            const pack = packValue;
            if (!isNonEmptyString(pack.id)) errors.push(`Saga ${sagaKey} requires an id.`);
            if (pack.id !== sagaKey) errors.push(`Saga key ${sagaKey} must exactly match pack id ${String(pack.id)}.`);
            if (packIds.has(pack.id)) errors.push(`Duplicate saga id: ${String(pack.id)}.`);
            else if (isNonEmptyString(pack.id)) packIds.add(pack.id);
            for (const field of ['title', 'series', 'continuity', 'sourceNote']) {
                if (!isNonEmptyString(pack[field])) errors.push(`Saga ${sagaKey} requires ${field}.`);
            }
            if (!Array.isArray(pack.entries) || pack.entries.length === 0) {
                errors.push(`Saga ${sagaKey} requires a non-empty entries array.`);
                continue;
            }

            let previousOrder = -Infinity;
            let previousPhaseRank = -Infinity;
            const orderValues = new Set();
            const coverage = new Set();
            for (let index = 0; index < pack.entries.length; index += 1) {
                const entry = pack.entries[index];
                const label = `Saga ${sagaKey} entry ${index + 1}`;
                entryCount += 1;
                if (!isRecord(entry)) {
                    errors.push(`${label} must be an object.`);
                    continue;
                }
                if (!isNonEmptyString(entry.id)) errors.push(`${label} requires an id.`);
                else if (entryIds.has(entry.id)) errors.push(`Duplicate story entry id: ${entry.id}.`);
                else entryIds.add(entry.id);

                if (!Number.isInteger(entry.order) || entry.order < 0) {
                    errors.push(`${label} order must be a non-negative integer.`);
                } else {
                    if (orderValues.has(entry.order)) errors.push(`Saga ${sagaKey} has duplicate entry order ${entry.order}.`);
                    if (entry.order <= previousOrder) errors.push(`Saga ${sagaKey} entries must be in strictly increasing order.`);
                    orderValues.add(entry.order);
                    previousOrder = entry.order;
                }

                if (!PHASES.includes(entry.phase)) {
                    errors.push(`${label} has unsupported phase ${String(entry.phase)}.`);
                } else {
                    coverage.add(entry.phase);
                    const rank = PHASE_RANK[entry.phase];
                    if (rank < previousPhaseRank) errors.push(`Saga ${sagaKey} phases must not move backwards.`);
                    previousPhaseRank = Math.max(previousPhaseRank, rank);
                }

                for (const field of ['title', 'canonText', 'characterText', 'playerReflection']) {
                    if (!isNonEmptyString(entry[field])) errors.push(`${label} requires original ${field}.`);
                }
                const textFields = ['canonText', 'characterText', 'playerReflection']
                    .map(field => isNonEmptyString(entry[field]) ? entry[field].trim() : null)
                    .filter(Boolean);
                if (new Set(textFields).size !== textFields.length) {
                    errors.push(`${label} text fields must be distinct.`);
                }

                for (const field of ['characters', 'tags']) {
                    if (!Array.isArray(entry[field]) || entry[field].length === 0) {
                        errors.push(`${label} requires a non-empty ${field} array.`);
                    } else if (entry[field].some(value => !isNonEmptyString(value))
                        || new Set(entry[field]).size !== entry[field].length) {
                        errors.push(`${label} ${field} must contain unique, non-empty strings.`);
                    }
                }

                if (entry.focusRatio !== undefined
                    && (!Number.isFinite(entry.focusRatio) || entry.focusRatio < 0 || entry.focusRatio > 1)) {
                    errors.push(`${label} focusRatio must be between 0 and 1.`);
                }
                if (FOCUS_PHASES.has(entry.phase)
                    && (!Number.isFinite(entry.focusRatio) || entry.focusRatio <= 0 || entry.focusRatio > 1)) {
                    errors.push(`${label} phase ${entry.phase} requires a focusRatio above 0 and at most 1.`);
                }
            }

            for (const requiredPhase of ['entry', 'resolution', 'mastery']) {
                if (!coverage.has(requiredPhase)) errors.push(`Saga ${sagaKey} requires a ${requiredPhase} entry.`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            sagaCount: sagaKeys.length,
            entryCount
        };
    }

    function sagaStatusRank(status) {
        const key = isRecord(status) ? status.status : status;
        return typeof key === 'string' ? (STATUS_RANK[key.trim().toLowerCase()] ?? 0) : 0;
    }

    /**
     * Convert a Focus amount to a bounded 0..1 ratio. An object may supply an
     * explicit focusRatio or a focusXP amount; the target is always explicit.
     */
    function normalizeFocusRatio(focus, target = 1) {
        const explicitRatio = isRecord(focus) ? Number(focus.focusRatio) : NaN;
        if (Number.isFinite(explicitRatio)) return Math.max(0, Math.min(1, explicitRatio));
        const amount = Number(isRecord(focus) ? focus.focusXP : focus);
        const denominator = Number(target);
        if (!Number.isFinite(amount) || !Number.isFinite(denominator) || denominator <= 0) return 0;
        return Math.max(0, Math.min(1, amount / denominator));
    }

    function getSagaProgress(state, sagaId) {
        return isRecord(state?.sagaProgress) && isRecord(state.sagaProgress[sagaId])
            ? state.sagaProgress[sagaId]
            : {};
    }

    function exactIdIn(values, sagaId) {
        return Array.isArray(values) && values.includes(sagaId);
    }

    function hasUnlockedSaga(state, sagaId, progress) {
        return sagaStatusRank(progress) >= STATUS_RANK.unlocked
            || isTimestamp(progress.unlockedAt)
            || isTimestamp(progress.clearedAt)
            || isTimestamp(progress.masteredAt)
            || exactIdIn(state?.unlockedSagas, sagaId)
            || exactIdIn(state?.completedSagas, sagaId);
    }

    function hasClearedSaga(state, sagaId, progress) {
        return sagaStatusRank(progress) >= STATUS_RANK.cleared
            || isTimestamp(progress.clearedAt)
            || isTimestamp(progress.masteredAt)
            || exactIdIn(state?.completedSagas, sagaId);
    }

    function hasMasteredSaga(progress) {
        return sagaStatusRank(progress) >= STATUS_RANK.mastered || isTimestamp(progress.masteredAt);
    }

    function focusTargetForSaga(sagaId, progress, options) {
        const opts = isRecord(options) ? options : {};
        const direct = Number(opts.focusTarget);
        if (Number.isFinite(direct) && direct > 0) return direct;
        const mapped = Number(isRecord(opts.focusTargets) ? opts.focusTargets[sagaId] : NaN);
        if (Number.isFinite(mapped) && mapped > 0) return mapped;
        const local = Number(progress.focusTarget ?? progress.focusClearXP);
        if (Number.isFinite(local) && local > 0) return local;
        const configured = Array.isArray(opts.progressionConfig?.sagas)
            ? opts.progressionConfig.sagas.find(saga => saga?.id === sagaId)
            : null;
        const configuredTarget = Number(configured?.focusClearXP);
        return Number.isFinite(configuredTarget) && configuredTarget > 0 ? configuredTarget : 0;
    }

    /**
     * Decide eligibility using only the exact saga's state. Saved story-log
     * records are intentionally not authorization for clear or mastery beats.
     */
    function shouldUnlockEntry(entry, sagaId, state = {}, options = {}) {
        if (!isRecord(entry) || !isNonEmptyString(sagaId) || !PHASES.includes(entry.phase)) return false;
        if (isNonEmptyString(entry.sagaId) && entry.sagaId !== sagaId) return false;
        const progress = getSagaProgress(state, sagaId);
        if (!hasUnlockedSaga(state, sagaId, progress)) return false;

        if (entry.phase === 'entry') return true;
        if (FOCUS_PHASES.has(entry.phase)) {
            if (!Number.isFinite(entry.focusRatio) || entry.focusRatio <= 0 || entry.focusRatio > 1) return false;
            const target = focusTargetForSaga(sagaId, progress, options);
            return normalizeFocusRatio(progress, target) >= entry.focusRatio;
        }
        if (entry.phase === 'resolution') return hasClearedSaga(state, sagaId, progress);
        if (entry.phase === 'mastery') return hasMasteredSaga(progress);
        return false;
    }

    function storyLogForState(state) {
        return isRecord(state?.storyLog) ? state.storyLog : {};
    }

    function historyForEntry(storyLog, entryId) {
        if (isRecord(storyLog.entries) && isRecord(storyLog.entries[entryId])) return storyLog.entries[entryId];
        const legacyUnlocked = isRecord(storyLog.unlockedEntries) ? storyLog.unlockedEntries[entryId] : null;
        const legacyRead = isRecord(storyLog.readEntries) ? storyLog.readEntries[entryId] : null;
        return {
            unlocked: !!legacyUnlocked,
            unlockedAt: isRecord(legacyUnlocked) && isTimestamp(legacyUnlocked.unlockedAt)
                ? legacyUnlocked.unlockedAt
                : null,
            read: legacyRead === true || isTimestamp(legacyRead),
            readAt: isTimestamp(legacyRead) ? legacyRead : null
        };
    }

    function resolveSagaEntries(storyData, sagaId, state = {}, options = {}) {
        if (!isRecord(storyData?.sagas) || !isNonEmptyString(sagaId)) return [];
        const pack = storyData.sagas[sagaId];
        if (!isRecord(pack) || pack.id !== sagaId || !Array.isArray(pack.entries)) return [];
        const storyLog = storyLogForState(state);
        return pack.entries.map(entry => {
            const history = historyForEntry(storyLog, entry.id);
            return {
                ...entry,
                sagaId,
                unlocked: shouldUnlockEntry(entry, sagaId, state, options),
                historicallyUnlocked: history.unlocked === true,
                unlockedAt: isTimestamp(history.unlockedAt) ? history.unlockedAt : null,
                read: history.read === true,
                readAt: isTimestamp(history.readAt) ? history.readAt : null
            };
        });
    }

    function getLatestSagaEntry(storyData, sagaId, state = {}, options = {}) {
        return resolveSagaEntries(storyData, sagaId, state, options)
            .filter(entry => entry.unlocked)
            .reduce((latest, entry) => !latest || entry.order > latest.order ? entry : latest, null);
    }

    function timestampOrNull(value) {
        return isTimestamp(value) ? value : null;
    }

    function collectLegacyIds(log) {
        const ids = [];
        const add = id => {
            if (isNonEmptyString(id) && !ids.includes(id)) ids.push(id);
        };
        Object.keys(isRecord(log.entries) ? log.entries : {}).forEach(add);
        Object.keys(isRecord(log.unlockedEntries) ? log.unlockedEntries : {}).forEach(add);
        Object.keys(isRecord(log.readEntries) ? log.readEntries : {}).forEach(add);
        (Array.isArray(log.unlockedEntries) ? log.unlockedEntries : []).forEach(value => add(isRecord(value) ? value.id : value));
        (Array.isArray(log.readEntries) ? log.readEntries : []).forEach(value => add(isRecord(value) ? value.id : value));
        uniqueStrings(log.unlockedEntryIds).forEach(add);
        uniqueStrings(log.readEntryIds).forEach(add);
        uniqueStrings(log.lastUnlockedEntryIds).forEach(add);
        return ids;
    }

    /**
     * Convert any known legacy story log to compact ID/timestamp/read records.
     * Prose is discarded because current content is resolved from STORY_DATA.
     */
    function migrateLegacyStoryLog(legacyStoryLog, storyData, options = {}) {
        const log = isRecord(legacyStoryLog) ? legacyStoryLog : {};
        const migrated = {};
        const arrayUnlocked = new Map((Array.isArray(log.unlockedEntries) ? log.unlockedEntries : [])
            .map(value => [isRecord(value) ? value.id : value, value]));
        const arrayRead = new Map((Array.isArray(log.readEntries) ? log.readEntries : [])
            .map(value => [isRecord(value) ? value.id : value, value]));

        for (const id of collectLegacyIds(log)) {
            const current = isRecord(log.entries?.[id]) ? log.entries[id] : {};
            const legacyUnlocked = isRecord(log.unlockedEntries) ? log.unlockedEntries[id] : arrayUnlocked.get(id);
            const legacyRead = isRecord(log.readEntries) ? log.readEntries[id] : arrayRead.get(id);
            const unlockedByList = exactIdIn(log.unlockedEntryIds, id) || exactIdIn(log.lastUnlockedEntryIds, id);
            const readByList = exactIdIn(log.readEntryIds, id);
            const unlocked = current.unlocked === true || !!legacyUnlocked || unlockedByList;
            const read = current.read === true || legacyRead === true || !!legacyRead || readByList;
            const unlockedAt = timestampOrNull(current.unlockedAt)
                || timestampOrNull(isRecord(legacyUnlocked) ? legacyUnlocked.unlockedAt : legacyUnlocked);
            const readAt = timestampOrNull(current.readAt)
                || timestampOrNull(isRecord(legacyRead) ? legacyRead.readAt : legacyRead);
            migrated[id] = { unlocked, unlockedAt, read, readAt };
        }

        const lastUnlockedEntryIds = uniqueStrings(log.lastUnlockedEntryIds)
            .filter(id => migrated[id]?.unlocked);
        const requestedMigrationTime = timestampOrNull(options.migratedAt);
        return {
            schemaVersion: STORY_LOG_SCHEMA_VERSION,
            contentVersion: isNonEmptyString(storyData?.version)
                ? storyData.version
                : (isNonEmptyString(log.contentVersion) ? log.contentVersion : STORY_VERSION),
            migratedAt: timestampOrNull(log.migratedAt) || requestedMigrationTime,
            entries: migrated,
            lastUnlockedEntryIds
        };
    }

    root.DBZ_V6_STORY_CORE = Object.freeze({
        version: STORY_VERSION,
        storyLogSchemaVersion: STORY_LOG_SCHEMA_VERSION,
        phases: PHASES,
        validateStoryData,
        sagaStatusRank,
        normalizeFocusRatio,
        shouldUnlockEntry,
        resolveSagaEntries,
        getLatestSagaEntry,
        migrateLegacyStoryLog
    });
})(globalThis);
