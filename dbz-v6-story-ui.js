(function installDragonBallFitnessStoryUI(root) {
    'use strict';

    const STORY_UI_VERSION = '6.4.0';
    const STORY_LOG_SCHEMA_VERSION = 1;
    const JOURNAL_SCHEMA_VERSION = 1;
    const PHASE_LABELS = Object.freeze({
        entry: 'Arrival',
        development: 'Rising Action',
        preclimax: 'Turning Point',
        resolution: 'Resolution',
        mastery: 'Mastery Epilogue'
    });

    function isRecord(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[character]));
    }

    function timestamp(value) {
        return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
    }

    function nowISO() {
        return new Date().toISOString();
    }

    function storyRuntime() {
        const core = root.DBZ_V6_STORY_CORE;
        const data = root.DBZ_V6_STORY_DATA;
        if (!core || !data) return null;
        return { core, data };
    }

    function progressionOptions() {
        return { progressionConfig: root.DBZ_V6_PROGRESSION_CONFIG };
    }

    function emptyStoryLog(migratedAt = null) {
        return {
            schemaVersion: STORY_LOG_SCHEMA_VERSION,
            contentVersion: STORY_UI_VERSION,
            migratedAt,
            entries: {},
            lastUnlockedEntryIds: []
        };
    }

    function ensureTrainingJournal(char) {
        const previous = isRecord(char?.partnerJournal) ? char.partnerJournal : {};
        const journal = {
            schemaVersion: JOURNAL_SCHEMA_VERSION,
            entries: isRecord(previous.entries) ? previous.entries : {},
            lastUnlockedEntryIds: Array.isArray(previous.lastUnlockedEntryIds)
                ? previous.lastUnlockedEntryIds.filter(id => typeof id === 'string').slice(0, 24)
                : []
        };
        if (char) char.partnerJournal = journal;
        return journal;
    }

    function moveLegacyMilestonesToJournal(char, log) {
        const journal = ensureTrainingJournal(char);
        let changed = false;
        for (const [id, record] of Object.entries(log.entries || {})) {
            const match = id.match(/^(.*)_milestone_story_(\d+)$/);
            if (!match) continue;
            const unlockedAt = timestamp(record?.unlockedAt);
            journal.entries[id] = {
                partnerId: match[1],
                level: Number(match[2]),
                unlockedAt
            };
            if (!journal.lastUnlockedEntryIds.includes(id)) journal.lastUnlockedEntryIds.unshift(id);
            delete log.entries[id];
            changed = true;
        }
        journal.lastUnlockedEntryIds = journal.lastUnlockedEntryIds.slice(0, 24);
        return changed;
    }

    function legacyAliasTarget(data, legacyId, char) {
        const bespoke = legacyId.match(/^(db_pilaf|dbz_vegeta|dbz_frieza)_ep00([123])$/);
        const fallback = legacyId.match(/^(.+)_fallback_(start|focus|clear)$/);
        const sagaId = bespoke?.[1] || fallback?.[1];
        const pack = sagaId ? data.sagas?.[sagaId] : null;
        if (pack?.entries?.length) {
            const kind = bespoke ? Number(bespoke[2]) : ({ start: 1, focus: 2, clear: 3 }[fallback[2]]);
            let entry;
            if (kind === 1) entry = pack.entries.find(candidate => candidate.phase === 'entry') || pack.entries[0];
            else if (kind === 3) entry = pack.entries.find(candidate => candidate.phase === 'resolution') || null;
            else {
                entry = pack.entries
                    .filter(candidate => ['development', 'preclimax'].includes(candidate.phase))
                    .sort((left, right) => Math.abs(Number(left.focusRatio) - 0.5) - Math.abs(Number(right.focusRatio) - 0.5))[0] || null;
            }
            return entry ? { entry, type: 'saga', sagaId } : null;
        }

        const characterPacks = Object.values(data.characters || {})
            .filter(characterPack => characterPack?.partnerId && Array.isArray(characterPack.beats))
            .sort((left, right) => String(right.partnerId).length - String(left.partnerId).length);
        for (const characterPack of characterPacks) {
            const prefix = `${characterPack.partnerId}_story_`;
            if (!legacyId.startsWith(prefix)) continue;
            const legacyTrigger = legacyId.slice(prefix.length);
            if (!/^(?:unlock|level)_\d+$/.test(legacyTrigger)) return null;
            const eligible = characterPack.beats.filter(beat => characterBeatUnlocked(char, beat));
            if (!eligible.length) return null;
            const entry = legacyTrigger.startsWith('unlock_') ? eligible[0] : eligible[eligible.length - 1];
            return { entry, type: 'character', partnerId: characterPack.partnerId };
        }
        return null;
    }

    function migrateLegacyAliases(char, log, runtime) {
        let changed = false;
        for (const [legacyId, legacyRecord] of Object.entries({ ...log.entries })) {
            const target = legacyAliasTarget(runtime.data, legacyId, char);
            if (!target || target.entry.id === legacyId) continue;
            const authorized = target.type === 'saga'
                ? runtime.core.shouldUnlockEntry(target.entry, target.sagaId, char, progressionOptions())
                : characterBeatUnlocked(char, target.entry);
            if (!authorized) continue;
            const current = isRecord(log.entries[target.entry.id]) ? log.entries[target.entry.id] : {};
            log.entries[target.entry.id] = {
                unlocked: true,
                unlockedAt: timestamp(current.unlockedAt) || timestamp(legacyRecord?.unlockedAt),
                read: current.read === true || legacyRecord?.read === true,
                readAt: timestamp(current.readAt) || timestamp(legacyRecord?.readAt)
            };
            delete log.entries[legacyId];
            log.lastUnlockedEntryIds = log.lastUnlockedEntryIds.map(id => id === legacyId ? target.entry.id : id);
            changed = true;
        }
        log.lastUnlockedEntryIds = [...new Set(log.lastUnlockedEntryIds)].filter(id => log.entries[id]?.unlocked).slice(0, 24);
        return changed;
    }

    function partnerLevel(char, partnerId) {
        return Math.max(1, Math.floor(Number(char?.partnerLevels?.[partnerId]?.level) || 1));
    }

    function sagaMeetsStatus(char, requirement) {
        if (!requirement?.id) return true;
        const core = root.DBZ_V6_STORY_CORE;
        const actual = char?.sagaProgress?.[requirement.id]?.status
            || ((char?.completedSagas || []).includes(requirement.id) ? 'cleared' : 'locked');
        return core?.sagaStatusRank(actual) >= core?.sagaStatusRank(requirement.status || 'unlocked');
    }

    function partnerMeetsRequirement(char, requirement) {
        if (!requirement?.id) return false;
        if (requirement.owned !== false && !(char?.ownedPartners || []).includes(requirement.id)) return false;
        return partnerLevel(char, requirement.id) >= Math.max(1, Number(requirement.level) || 1);
    }

    function characterBeatUnlocked(char, beat) {
        return partnerMeetsRequirement(char, beat?.unlock?.partner)
            && sagaMeetsStatus(char, beat?.unlock?.saga);
    }

    function relationshipBeatUnlocked(char, beat) {
        const partners = Array.isArray(beat?.unlock?.partners) ? beat.unlock.partners : [];
        return partners.length >= 2
            && partners.every(requirement => partnerMeetsRequirement(char, requirement))
            && sagaMeetsStatus(char, beat?.unlock?.saga);
    }

    function resolveCharacterEntries(char) {
        const log = char?.storyLog?.entries || {};
        return Object.values(root.DBZ_V6_STORY_DATA?.characters || {}).flatMap(pack =>
            (pack.beats || []).map(beat => ({
                ...beat,
                pack,
                type: 'character',
                source: pack.name || pack.title || pack.partnerId,
                unlocked: characterBeatUnlocked(char, beat),
                read: log[beat.id]?.read === true,
                readAt: timestamp(log[beat.id]?.readAt),
                unlockedAt: timestamp(log[beat.id]?.unlockedAt)
            }))
        );
    }

    function resolveRelationshipEntries(char) {
        const log = char?.storyLog?.entries || {};
        return Object.values(root.DBZ_V6_STORY_DATA?.relationships || {}).flatMap(pack =>
            (pack.beats || []).map(beat => ({
                ...beat,
                pack,
                type: 'relationship',
                source: pack.title || pack.id,
                unlocked: relationshipBeatUnlocked(char, beat),
                read: log[beat.id]?.read === true,
                readAt: timestamp(log[beat.id]?.readAt),
                unlockedAt: timestamp(log[beat.id]?.unlockedAt)
            }))
        );
    }

    function syncResolvedEntries(log, resolvedEntries, newlyUnlocked) {
        let changed = false;
        for (const entry of resolvedEntries) {
            if (!entry.unlocked) continue;
            const existing = isRecord(log.entries[entry.id]) ? log.entries[entry.id] : null;
            if (existing?.unlocked) continue;
            log.entries[entry.id] = {
                unlocked: true,
                unlockedAt: nowISO(),
                read: existing?.read === true,
                readAt: timestamp(existing?.readAt)
            };
            log.lastUnlockedEntryIds.unshift(entry.id);
            newlyUnlocked.push(entry.id);
            changed = true;
        }
        return changed;
    }

    function ensureStoryLog(char) {
        const runtime = storyRuntime();
        if (!char || !runtime) return { log: emptyStoryLog(), changed: false };
        const previous = isRecord(char.storyLog) ? char.storyLog : {};
        const alreadyCompact = previous.schemaVersion === STORY_LOG_SCHEMA_VERSION
            && isRecord(previous.entries)
            && !isRecord(previous.unlockedEntries)
            && !isRecord(previous.readEntries);
        const log = alreadyCompact
            ? previous
            : runtime.core.migrateLegacyStoryLog(previous, runtime.data, { migratedAt: nowISO() });
        log.schemaVersion = STORY_LOG_SCHEMA_VERSION;
        log.contentVersion = runtime.data.version || STORY_UI_VERSION;
        if (!isRecord(log.entries)) log.entries = {};
        if (!Array.isArray(log.lastUnlockedEntryIds)) log.lastUnlockedEntryIds = [];
        let changed = !alreadyCompact;
        changed = moveLegacyMilestonesToJournal(char, log) || changed;
        changed = migrateLegacyAliases(char, log, runtime) || changed;
        char.storyLog = log;
        return { log, changed };
    }

    function syncStoryUnlocks(char) {
        const runtime = storyRuntime();
        if (!char || !runtime) return { changed: false, newlyUnlocked: [] };
        const ensured = ensureStoryLog(char);
        const log = ensured.log;
        const newlyUnlocked = [];
        let changed = ensured.changed;
        for (const sagaId of Object.keys(runtime.data.sagas || {})) {
            for (const entry of runtime.core.resolveSagaEntries(runtime.data, sagaId, char, progressionOptions())) {
                if (!entry.unlocked) continue;
                const existing = isRecord(log.entries[entry.id]) ? log.entries[entry.id] : null;
                if (existing?.unlocked) continue;
                log.entries[entry.id] = {
                    unlocked: true,
                    unlockedAt: nowISO(),
                    read: existing?.read === true,
                    readAt: timestamp(existing?.readAt)
                };
                log.lastUnlockedEntryIds.unshift(entry.id);
                newlyUnlocked.push(entry.id);
                changed = true;
            }
        }
        changed = syncResolvedEntries(log, resolveCharacterEntries(char), newlyUnlocked) || changed;
        changed = syncResolvedEntries(log, resolveRelationshipEntries(char), newlyUnlocked) || changed;
        log.lastUnlockedEntryIds = [...new Set(log.lastUnlockedEntryIds)].slice(0, 24);
        return { changed, newlyUnlocked };
    }

    function sagaEntries(char, sagaId, shouldSync = true) {
        const runtime = storyRuntime();
        if (!runtime) return [];
        if (shouldSync) syncStoryUnlocks(char);
        return runtime.core.resolveSagaEntries(runtime.data, sagaId, char, progressionOptions());
    }

    function unlockLabel(entry, saga) {
        if (entry.phase === 'entry') return 'Unlock this saga';
        if (entry.phase === 'resolution') return 'Clear this saga';
        if (entry.phase === 'mastery') return 'Master this saga';
        const target = Number(saga?.clearReqs?.focusXP)
            || Number(root.DBZ_V6_PROGRESSION_CONFIG?.sagas?.find(row => row.id === saga?.id)?.focusClearXP)
            || 0;
        const amount = target > 0 ? Math.ceil(target * Number(entry.focusRatio || 0)) : 0;
        return amount > 0
            ? `Reach ${amount} Focus XP (${Math.round(Number(entry.focusRatio || 0) * 100)}%)`
            : `Reach ${Math.round(Number(entry.focusRatio || 0) * 100)}% saga focus`;
    }

    function narrativeBody(entry) {
        return `<div class="v64-story-copy">
            <p><strong>Story</strong>${escapeHtml(entry.canonText)}</p>
            <p><strong>Character lens</strong>${escapeHtml(entry.characterText)}</p>
            <p class="v64-story-reflection"><strong>Your chapter</strong>${escapeHtml(entry.playerReflection)}</p>
        </div>`;
    }

    function sagaEntryCard(entry, saga, compact = false) {
        const open = entry.unlocked === true;
        const phase = PHASE_LABELS[entry.phase] || entry.phase || 'Story';
        if (!open) {
            return `<article class="v5-saga-story-entry v64-story-entry locked" aria-label="Locked ${escapeHtml(phase)} story beat">
                <div class="v5-kicker">${escapeHtml(phase)} · Locked</div>
                <h4>Story beat concealed</h4>
                <p>${escapeHtml(unlockLabel(entry, saga))} to reveal this chapter.</p>
            </article>`;
        }
        return `<article class="v5-saga-story-entry v64-story-entry open ${entry.read ? 'read' : 'unread'}">
            <div class="v5-kicker">${escapeHtml(phase)} · ${entry.read ? 'Read' : 'New'}</div>
            <h4>${escapeHtml(entry.title)}</h4>
            ${compact ? `<p>${escapeHtml(entry.canonText)}</p>` : narrativeBody(entry)}
            ${entry.read ? '' : `<button type="button" class="btn-small v64-story-read" onclick="markStoryEntryRead('${escapeHtml(entry.id)}')">Mark read</button>`}
        </article>`;
    }

    function renderSagaStoryLog(char, saga) {
        const entries = sagaEntries(char, saga?.id);
        if (!entries.length) return '<div class="v5-mini-note">Story content is unavailable for this saga.</div>';
        return entries.map(entry => sagaEntryCard(entry, saga)).join('');
    }

    function sagaStatus(char, saga) {
        if (typeof root.getSagaStatus === 'function') return root.getSagaStatus(char, saga.id);
        return char?.sagaProgress?.[saga.id]?.status || 'locked';
    }

    function renderCompleteSagaStoryArchive(char, sagas = []) {
        syncStoryUnlocks(char);
        return sagas.map(saga => {
            const entries = sagaEntries(char, saga.id, false);
            const openEntries = entries.filter(entry => entry.unlocked);
            const status = sagaStatus(char, saga);
            const shouldOpen = char?.activeSagaFocus === saga.id || status === 'unlocked';
            return `<details class="v5-saga-archive-item ${escapeHtml(status)}" ${shouldOpen ? 'open' : ''}>
                <summary><strong>${escapeHtml(saga.name)}</strong><span>${escapeHtml(status)} · ${openEntries.length}/${entries.length} beats</span></summary>
                <div class="v5-saga-archive-body">
                    <div class="v64-continuity">${escapeHtml(root.DBZ_V6_STORY_DATA?.sagas?.[saga.id]?.continuity || saga.series || 'Story continuity')}</div>
                    <div class="v5-saga-story-grid">${entries.map(entry => sagaEntryCard(entry, saga, true)).join('')}</div>
                </div>
            </details>`;
        }).join('');
    }

    function findSagaEntry(id) {
        const data = root.DBZ_V6_STORY_DATA;
        for (const [sagaId, pack] of Object.entries(data?.sagas || {})) {
            const entry = pack?.entries?.find(candidate => candidate.id === id);
            if (entry) return { ...entry, sagaId, pack };
        }
        return null;
    }

    function recordPartnerMilestone(char, partnerId, milestone) {
        if (!char || !partnerId || !milestone?.level) return false;
        const journal = ensureTrainingJournal(char);
        const id = `${partnerId}_milestone_story_${milestone.level}`;
        if (journal.entries[id]) return false;
        journal.entries[id] = { partnerId, level: Number(milestone.level), unlockedAt: nowISO() };
        journal.lastUnlockedEntryIds.unshift(id);
        journal.lastUnlockedEntryIds = [...new Set(journal.lastUnlockedEntryIds)].slice(0, 24);
        return true;
    }

    function partnerName(partnerId) {
        if (typeof root.getPartnerById === 'function') return root.getPartnerById(partnerId)?.name || partnerId;
        return partnerId;
    }

    function journalEntries(char) {
        const journal = ensureTrainingJournal(char);
        return Object.entries(journal.entries).map(([id, record]) => {
            const milestones = root.PARTNER_MILESTONES?.[record.partnerId] || [];
            const milestone = milestones.find(item => Number(item.level) === Number(record.level));
            return {
                id,
                unlockedAt: timestamp(record.unlockedAt),
                title: milestone?.name || `Level ${record.level} milestone`,
                text: Array.isArray(milestone?.story) ? milestone.story.join(' ') : String(milestone?.story || 'A partner training milestone was reached.'),
                source: partnerName(record.partnerId),
                type: 'training'
            };
        });
    }

    function sagaCodexEntries(char, sagas) {
        const sagaById = Object.fromEntries((sagas || []).map(saga => [saga.id, saga]));
        const records = [];
        for (const sagaId of Object.keys(root.DBZ_V6_STORY_DATA?.sagas || {})) {
            for (const entry of sagaEntries(char, sagaId, false).filter(item => item.unlocked)) {
                records.push({
                    ...entry,
                    source: sagaById[sagaId]?.name || root.DBZ_V6_STORY_DATA.sagas[sagaId].title,
                    type: 'saga',
                    text: entry.canonText
                });
            }
        }
        return records;
    }

    function characterCodexEntries(char) {
        return resolveCharacterEntries(char).filter(entry => entry.unlocked).map(entry => ({
            ...entry,
            canonText: entry.canonText,
            text: entry.canonText
        }));
    }

    function relationshipCodexEntries(char) {
        return resolveRelationshipEntries(char).filter(entry => entry.unlocked).map(entry => ({
            ...entry,
            canonText: entry.trainingText,
            text: entry.trainingText
        }));
    }

    function productionStoryIds() {
        const data = root.DBZ_V6_STORY_DATA || {};
        return new Set([
            ...Object.values(data.sagas || {}).flatMap(pack => (pack.entries || []).map(entry => entry.id)),
            ...Object.values(data.characters || {}).flatMap(pack => (pack.beats || []).map(entry => entry.id)),
            ...Object.values(data.relationships || {}).flatMap(pack => (pack.beats || []).map(entry => entry.id))
        ]);
    }

    function legacyCodexEntries(char) {
        const currentIds = productionStoryIds();
        const known = {
            pl_1_million_story: ['Scouter Static', 'Legacy Power Milestone'],
            pl_1_billion_story: ['The Scouter Gives Up', 'Legacy Power Milestone']
        };
        return Object.entries(char?.storyLog?.entries || {})
            .filter(([id, record]) => record?.unlocked && !currentIds.has(id))
            .map(([id, record]) => {
                const friendly = known[id] || [id.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()), 'Legacy Story'];
                return {
                    id,
                    title: friendly[0],
                    source: friendly[1],
                    type: 'legacy',
                    text: 'Preserved from your pre-v6.4 Story Codex. Current authored chapters unlock from your live saga and partner progress.',
                    unlocked: true,
                    unlockedAt: timestamp(record.unlockedAt),
                    read: record.read === true,
                    readAt: timestamp(record.readAt)
                };
            });
    }

    function codexCard(entry) {
        if (entry.type === 'training') {
            return `<article class="v5s-story-card read">
                <div class="v5-kicker">Training Journal · ${escapeHtml(entry.source)}</div>
                <h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.text)}</p>
            </article>`;
        }
        return `<article class="v5s-story-card ${entry.read ? 'read' : 'unread'}">
            <div class="v5-kicker">${escapeHtml(entry.type || 'story')} · ${escapeHtml(entry.source || '')}</div>
            <h3>${escapeHtml(entry.title)}</h3>
            ${entry.canonText ? narrativeBody(entry) : `<p>${escapeHtml(entry.text || '')}</p>`}
            ${entry.read ? '' : `<button type="button" class="btn-small v64-story-read" onclick="markStoryEntryRead('${escapeHtml(entry.id)}')">Mark read</button>`}
        </article>`;
    }

    function renderCodex(char, filter = 'current', sagas = []) {
        if (!char) return '';
        syncStoryUnlocks(char);
        const display = document.getElementById('storyCodexDisplay');
        if (!display) return '';
        const currentSaga = typeof root.getActiveSagaFocus === 'function' ? root.getActiveSagaFocus(char) : null;
        const sagaRows = sagaCodexEntries(char, sagas);
        const characterRows = characterCodexEntries(char);
        const relationshipRows = relationshipCodexEntries(char);
        const trainingRows = journalEntries(char);
        const legacyRows = legacyCodexEntries(char);
        const allRows = [...sagaRows, ...characterRows, ...relationshipRows, ...trainingRows, ...legacyRows].sort((left, right) => {
            const dateOrder = String(right.unlockedAt || '').localeCompare(String(left.unlockedAt || ''));
            return dateOrder || String(left.id).localeCompare(String(right.id));
        });
        const filtered = allRows.filter(entry => {
            if (filter === 'current') return entry.type === 'saga' && entry.sagaId === currentSaga?.id;
            if (filter === 'unread') return entry.type !== 'training' && !entry.read;
            if (filter === 'training') return entry.type === 'training';
            if (filter === 'sagas') return entry.type === 'saga';
            if (filter === 'characters') return entry.type === 'character';
            if (filter === 'relationships') return entry.type === 'relationship';
            if (filter === 'legacy') return entry.type === 'legacy';
            return true;
        });
        const filters = [
            ['current', 'Current Saga'], ['unread', 'Unread'], ['sagas', 'Saga Archive'],
            ['characters', 'Characters'], ['relationships', 'Relationships'], ['training', 'Training Journal'],
            ['legacy', 'Legacy History'], ['all', 'All']
        ];
        display.innerHTML = `<div class="v5-section-intro"><strong>Story Codex</strong><span>${sagaRows.length} saga chapters · ${characterRows.length} character moments · ${relationshipRows.length} relationship scenes · ${trainingRows.length} training notes · ${legacyRows.length} legacy receipts</span></div>
            <div class="v5s-filter-row" role="navigation" aria-label="Story filters">
                ${filters.map(([id, label]) => `<button type="button" class="btn-small ${filter === id ? 'btn-success' : ''}" onclick="renderStoryCodex('${id}')">${escapeHtml(label)}</button>`).join('')}
            </div>
            <div class="v64-codex-context">${filter === 'current' ? `Showing ${escapeHtml(currentSaga?.name || 'the active saga')} only. The dashboard never substitutes an unrelated chapter.` : escapeHtml(filters.find(item => item[0] === filter)?.[1] || 'All stories')}</div>
            <div class="v5s-story-grid">${filtered.map(codexCard).join('') || '<div class="v5-mini-note">No entries have unlocked in this section yet.</div>'}</div>`;
        return display.innerHTML;
    }

    function markStoryEntryRead(char, id) {
        const ensured = ensureStoryLog(char);
        const record = ensured.log.entries?.[id];
        if (!record?.unlocked) return false;
        record.read = true;
        record.readAt = record.readAt || nowISO();
        return true;
    }

    function latestSagaText(char, saga) {
        const runtime = storyRuntime();
        if (!runtime || !saga?.id) return `${saga?.name || 'This saga'} has not revealed a chapter yet.`;
        syncStoryUnlocks(char);
        const entry = runtime.core.getLatestSagaEntry(runtime.data, saga.id, char, progressionOptions());
        if (!entry) return `${saga.name || 'This saga'} has not revealed a chapter yet.`;
        return `${entry.title}: ${entry.canonText}`;
    }

    function validateInstalledContent() {
        const runtime = storyRuntime();
        if (!runtime) return { valid: false, errors: ['Story runtime did not load.'], sagaCount: 0, entryCount: 0 };
        return runtime.core.validateStoryData(runtime.data, root.DBZ_V6_CONFIG);
    }

    root.DBZ_V6_STORY_UI = Object.freeze({
        version: STORY_UI_VERSION,
        ensureStoryLog,
        syncStoryUnlocks,
        renderSagaStoryLog,
        renderCompleteSagaStoryArchive,
        renderCodex,
        markStoryEntryRead,
        latestSagaText,
        recordPartnerMilestone,
        journalEntries,
        legacyCodexEntries,
        resolveCharacterEntries,
        resolveRelationshipEntries,
        findSagaEntry,
        validateInstalledContent
    });

    if (root.document?.addEventListener) {
        root.document.addEventListener('DOMContentLoaded', () => {
            const validation = validateInstalledContent();
            if (root.document.documentElement) {
                root.document.documentElement.dataset.dbzStoryStatus = validation.valid ? 'ready' : 'invalid';
                root.document.documentElement.dataset.dbzStoryBeats = String(validation.entryCount || 0);
            }
            if (!validation.valid) console.error('v6.4 story content validation failed:', validation.errors);
        });
    }
})(globalThis);
