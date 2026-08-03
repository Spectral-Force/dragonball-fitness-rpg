(function installV6Experience(root) {
    'use strict';

    const config = root.DBZ_V6_CONFIG;
    const collectionTabs = ['character', 'abilities', 'transformations', 'achievements'];
    const originalInputValues = new WeakMap();
    let lastFocusedBeforeModal = null;

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function safeText(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        })[character]);
    }

    function activeCharacter() {
        try {
            return typeof getActiveCharacter === 'function' ? getActiveCharacter() : state?.characters?.[state?.activeCharacter];
        } catch {
            return null;
        }
    }

    function statusAtLeast(status, target) {
        const order = { locked: 0, unlocked: 1, cleared: 2, mastered: 3 };
        return (order[status] || 0) >= (order[target] || 0);
    }

    function sagaStatus(character, saga) {
        if (!character || !saga) return 'locked';
        if (typeof getSagaStatus === 'function') return getSagaStatus(character, saga.id);
        if (character.completedSagas?.includes(saga.id)) return 'cleared';
        return character.sagaProgress?.[saga.id]?.status || 'locked';
    }

    function nextStorySaga(character) {
        return SAGAS.find(saga => !statusAtLeast(sagaStatus(character, saga), 'cleared')) || SAGAS[SAGAS.length - 1];
    }

    function dateKey(value) {
        const date = value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : new Date();
        return Number.isNaN(date.getTime()) ? null : date;
    }

    function startOfWeek(date = new Date()) {
        const start = new Date(date);
        const day = start.getDay() || 7;
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() + 1 - day);
        return start;
    }

    function weeklySessionDays(character) {
        const weekStart = startOfWeek();
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const days = new Set();
        (character?.workoutLog || []).forEach(workout => {
            const date = dateKey(workout.date);
            if (date && date >= weekStart && date < weekEnd) days.add(String(workout.date).slice(0, 10));
        });
        return days.size;
    }

    function readiness(character) {
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = (character?.workoutLog || []).filter(workout => {
            const date = dateKey(workout.date);
            return date && date >= sevenDaysAgo && date <= now;
        });
        const load = recent.reduce((total, workout) => total + Math.max(1, workout.exercises?.length || 0), 0);
        const restDays = recent.filter(workout => (workout.exercises || []).some(exercise => /rest|stretch|meditation|mobility|yoga/i.test(exercise.name || ''))).length;
        const checkIn = state?.v6Wellness || {};
        const selfRating = clamp(Number(checkIn.readiness || 4), 1, 5);
        const illnessPenalty = checkIn.illness ? 24 : 0;
        const injuryPenalty = String(checkIn.injury || '').trim() ? 16 : 0;
        const deloadBonus = checkIn.deload ? 8 : 0;
        const score = clamp(Math.round(52 + selfRating * 10 - Math.max(0, load - 16) * 1.5 + restDays * 4 - illnessPenalty - injuryPenalty + deloadBonus), config.recovery.readinessFloor, 100);
        const label = score >= 82 ? 'Ready to push' : score >= 64 ? 'Train normally' : score >= 48 ? 'Keep it light' : 'Recovery first';
        return { score, label, load, restDays };
    }

    function currentPlanDay() {
        const plan = state?.fitnessPlan;
        if (!plan?.weeks?.length) return null;
        const character = activeCharacter();
        const started = dateKey(character?.startedAt || character?.workoutLog?.[0]?.date || new Date().toISOString());
        const elapsedDays = Math.max(0, Math.floor((Date.now() - started.getTime()) / 86400000));
        const week = Math.floor(elapsedDays / 7) % plan.weeks.length;
        const day = (new Date().getDay() + 6) % 7;
        return plan.weeks[week]?.days?.[day] || null;
    }

    function plannedWorkoutSummary() {
        const day = currentPlanDay();
        if (!day) return { title: 'Choose a training plan', meta: 'The built-in Tim plan is available in Plan.' };
        const exercises = day.exercises || [];
        if (day.status === 'rest' || exercises.some(exercise => /rest day/i.test(exercise.name || ''))) {
            return { title: `${day.title || 'Today'} · recovery`, meta: 'Rest, mobility and meditation protect long-term consistency.' };
        }
        const preview = exercises.slice(0, 3).map(exercise => exercise.name).filter(Boolean).join(', ');
        return {
            title: day.title || 'Today’s plan',
            meta: exercises.length ? `${exercises.length} items${preview ? ` · ${preview}` : ''}` : 'No exercises are scheduled; choose a template or log recovery.'
        };
    }

    function equippedPowerState(character) {
        const ids = new Set(['base', ...(character?.unlockedTransformations || []), ...(character?.equippedTransformations || [])]);
        const transformations = [...ids]
            .map(id => typeof getTransformationById === 'function' ? getTransformationById(id) : null)
            .filter(Boolean);
        const sanitized = root.DBZ_V6_PROGRESSION?.sanitizePrimaryState(character, transformations);
        const primary = transformations.find(state => state.id === (sanitized?.primaryId || 'base'));
        const equippedMultiplier = Math.max(1, Number(primary?.powerMultiplier || primary?.mult || 1));
        const route = typeof root.getRaceRoutePowerMultiplier === 'function'
            ? root.getRaceRoutePowerMultiplier(character)
            : { multiplier: equippedMultiplier, label: primary?.name || 'Base', source: 'primary transformation' };
        return {
            name: route.label || primary?.name || 'Base',
            multiplier: Math.max(equippedMultiplier, Number(route.multiplier) || 1),
            equippedName: primary?.name || 'Base',
            equippedMultiplier,
            source: route.source || 'primary transformation'
        };
    }

    function recentBaseGainPerWeek(character) {
        const snapshots = (character?.history || [])
            .filter(snapshot => snapshot?.date && snapshot?.stats)
            .map(snapshot => ({ ...snapshot, parsedDate: dateKey(snapshot.date) }))
            .filter(snapshot => snapshot.parsedDate)
            .sort((a, b) => a.parsedDate - b.parsedDate)
            .slice(-8);
        if (snapshots.length < 2) return 0;
        const first = snapshots[0];
        const last = snapshots[snapshots.length - 1];
        const weeks = Math.max(1, (last.parsedDate - first.parsedDate) / (7 * 86400000));
        const starting = typeof getStartingStatsForRace === 'function' ? getStartingStatsForRace(character?.race || 'earthling') : {};
        const firstPL = config.basePower(first.stats, starting, false);
        const lastPL = config.basePower(last.stats, starting, false);
        return Math.max(0, (lastPL - firstPL) / weeks);
    }

    function storyProjection(character, saga, currentEffective, targetEffective, stateMultiplier) {
        if (currentEffective >= targetEffective) return 'Power requirement ready';
        const gain = recentBaseGainPerWeek(character);
        if (gain <= 0) return 'Log at least two weeks for an estimate';
        const requiredBase = targetEffective / Math.max(1, stateMultiplier);
        const currentBase = typeof getBasePowerLevel === 'function' ? getBasePowerLevel(character) : 1;
        const weeks = Math.ceil(Math.max(0, requiredBase - currentBase) / gain);
        return weeks > 260 ? 'Long-term target — upgrade your loadout' : `About ${weeks} week${weeks === 1 ? '' : 's'} at recent base growth`;
    }

    function todayMarkup(character) {
        const currentSaga = nextStorySaga(character);
        const currentSagaStatus = sagaStatus(character, currentSaga);
        const powerState = equippedPowerState(character);
        const currentEffective = typeof getSagaUnlockPowerLevel === 'function'
            ? getSagaUnlockPowerLevel(character)
            : (typeof getPowerLevel === 'function' ? getPowerLevel(character) : 1);
        const targetRequirements = statusAtLeast(currentSagaStatus, 'unlocked') ? currentSaga?.clearReqs : currentSaga?.unlockReqs;
        const targetEffective = Number(targetRequirements?.effectivePL || currentSaga?.plReq || 1);
        const sagaPercent = targetEffective <= 1 ? 100 : clamp(Math.log10(Math.max(1, currentEffective)) / Math.log10(Math.max(10, targetEffective)) * 100, 0, 100);
        const consistency = weeklySessionDays(character);
        const ready = readiness(character);
        const plan = plannedWorkoutSummary();
        const racePath = config.racePowerPaths[character?.race || 'earthling'] || config.racePowerPaths.earthling;
        const projection = storyProjection(character, currentSaga, currentEffective, targetEffective, powerState.multiplier);
        const basePower = typeof getBasePowerLevel === 'function' ? getBasePowerLevel(character) : 1;
        const migrationPreview = character?.v6Migration?.preview;

        return `
            <div class="v6-today-head">
                <div>
                    <div class="v6-eyebrow">Today · sustainable progress</div>
                    <h2>${safeText(character?.name || 'Warrior')}, choose today’s useful action</h2>
                </div>
                <span class="v6-route-pill">${safeText(racePath.label)} route</span>
            </div>
            <div class="v6-today-grid">
                <article class="v6-today-card">
                    <span class="v6-today-label">Next workout</span>
                    <strong class="v6-today-value">${safeText(plan.title)}</strong>
                    <span class="v6-today-meta">${safeText(plan.meta)}</span>
                </article>
                <article class="v6-today-card">
                    <span class="v6-today-label">Readiness</span>
                    <strong class="v6-today-value">${ready.score}% · ${safeText(ready.label)}</strong>
                    <span class="v6-today-meta">${ready.load} exercise entries and ${ready.restDays} recovery sessions in the last seven days.</span>
                    <div class="v6-meter" style="--v6-meter:${ready.score}%"><span></span></div>
                </article>
                <article class="v6-today-card">
                    <span class="v6-today-label">Weekly consistency</span>
                    <strong class="v6-today-value">${consistency}/${config.recovery.weeklyConsistencyTarget} training days</strong>
                    <span class="v6-today-meta">Rest days do not erase stats or break the campaign.</span>
                    <div class="v6-meter" style="--v6-meter:${clamp(consistency / config.recovery.weeklyConsistencyTarget * 100, 0, 100)}%"><span></span></div>
                </article>
                <article class="v6-today-card">
                    <span class="v6-today-label">${statusAtLeast(currentSagaStatus, 'unlocked') ? 'Current saga clear' : 'Next saga threshold'}</span>
                    <strong class="v6-today-value">${safeText(currentSaga?.name || 'Story complete')}</strong>
                    <span class="v6-today-meta">Effective PL ${typeof formatPL === 'function' ? formatPL(currentEffective) : Math.round(currentEffective)} / ${typeof formatPL === 'function' ? formatPL(targetEffective) : Math.round(targetEffective)} · ${safeText(projection)}</span>
                    <div class="v6-meter" style="--v6-meter:${sagaPercent}%"><span></span></div>
                </article>
            </div>
            <div class="v6-power-explainer">
                <div class="v6-formula"><strong>Effective PL = Base fitness PL × equipped transformation or race-equivalent state.</strong> Current preview: ${typeof formatPL === 'function' ? formatPL(basePower) : Math.round(basePower)} × ${safeText(powerState.name)} (${typeof formatSignificantNumber === 'function' ? formatSignificantNumber(powerState.multiplier, 4) : powerState.multiplier}×). Equipped form: ${safeText(powerState.equippedName)} (${typeof formatSignificantNumber === 'function' ? formatSignificantNumber(powerState.equippedMultiplier, 4) : powerState.equippedMultiplier}×). Partners, abilities, wishes and training branches accelerate earned stats and route mastery; they are bounded and shown through this state.</div>
                <div class="v6-route"><strong>${safeText(racePath.stateLabel)}:</strong> ${safeText(racePath.route)}. ${safeText(racePath.identity)}.</div>
                ${migrationPreview ? `<details class="v6-migration-preview"><summary>v5 → v6 recalculation receipt</summary><div>Legacy model: ${safeText(migrationPreview.previousModel)}. New result: base ${safeText(migrationPreview.baseFitnessPL)} × ${safeText(migrationPreview.stateLabel)} ${safeText(migrationPreview.stateMultiplier)}× = ${safeText(migrationPreview.effectivePL)} Effective PL. Logged workouts and raw stats were preserved.</div></details>` : ''}
            </div>
            <div class="v6-today-actions">
                <button class="btn-success" type="button" data-v6-tab="training">Train now</button>
                <button class="btn-secondary" type="button" data-v6-tab="fitness-plan">Open today’s plan</button>
                <button class="btn-secondary" type="button" data-v6-tab="sagas">Review saga</button>
                <button class="btn-secondary" type="button" data-v6-checkin>Readiness check-in</button>
            </div>
            <div class="v6-checkin-host" hidden></div>`;
    }

    function renderToday() {
        const dashboard = document.getElementById('dashboard');
        const character = activeCharacter();
        if (!dashboard || !character) return;
        let panel = document.getElementById('v6Today');
        if (!panel) {
            panel = document.createElement('section');
            panel.id = 'v6Today';
            panel.className = 'v6-today';
            dashboard.prepend(panel);
        }
        panel.innerHTML = todayMarkup(character);
        panel.querySelectorAll('[data-v6-tab]').forEach(button => {
            button.addEventListener('click', () => goToTab(button.dataset.v6Tab));
        });
        panel.querySelector('[data-v6-checkin]')?.addEventListener('click', openCheckIn);
    }

    function openCheckIn() {
        const host = document.querySelector('.v6-checkin-host');
        if (!host) return;
        const checkIn = state.v6Wellness || {};
        host.hidden = !host.hidden;
        if (host.hidden) return;
        host.innerHTML = `
            <form class="v6-formula" style="margin:0 1rem 1rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.65rem;" aria-label="Readiness check-in">
                <label>Readiness (1–5)<input name="readiness" type="range" min="1" max="5" value="${clamp(Number(checkIn.readiness || 4), 1, 5)}"></label>
                <label><input name="illness" type="checkbox" ${checkIn.illness ? 'checked' : ''}> Illness / unwell</label>
                <label><input name="deload" type="checkbox" ${checkIn.deload ? 'checked' : ''}> Planned deload</label>
                <label>Injury or limitation<input name="injury" maxlength="180" value="${safeText(checkIn.injury || '')}" placeholder="Optional note"></label>
            </form>`;
        host.querySelector('form').addEventListener('change', event => {
            const form = event.currentTarget;
            state.v6Wellness = {
                readiness: Number(form.elements.readiness.value),
                illness: form.elements.illness.checked,
                deload: form.elements.deload.checked,
                injury: form.elements.injury.value.slice(0, 180),
                updatedAt: new Date().toISOString()
            };
            saveState();
        });
    }

    function installWorkoutContext() {
        const training = document.getElementById('training');
        if (!training || document.getElementById('v6WorkoutContext')) return;
        const context = state.v6WorkoutContext || {};
        const panel = document.createElement('details');
        panel.id = 'v6WorkoutContext';
        panel.className = 'dbz-panel';
        panel.innerHTML = `
            <summary><strong>Optional session context</strong> · RPE, RIR, deload and notes</summary>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:.7rem;margin-top:.8rem;">
                <label>Session RPE (1–10)<input name="rpe" type="number" min="1" max="10" step="0.5" value="${safeText(context.rpe || '')}" placeholder="Optional"></label>
                <label>Average RIR (0–10)<input name="rir" type="number" min="0" max="10" step="0.5" value="${safeText(context.rir || '')}" placeholder="Optional"></label>
                <label><input name="deload" type="checkbox" ${context.deload ? 'checked' : ''}> Deload session</label>
                <label>Session notes<input name="notes" maxlength="500" value="${safeText(context.notes || '')}" placeholder="Optional"></label>
            </div>`;
        training.prepend(panel);
        panel.addEventListener('change', () => {
            state.v6WorkoutContext = {
                rpe: panel.querySelector('[name="rpe"]').value ? Number(panel.querySelector('[name="rpe"]').value) : null,
                rir: panel.querySelector('[name="rir"]').value ? Number(panel.querySelector('[name="rir"]').value) : null,
                deload: panel.querySelector('[name="deload"]').checked,
                notes: panel.querySelector('[name="notes"]').value.slice(0, 500)
            };
            saveState();
        });
    }

    function goToTab(tabId) {
        const button = document.querySelector(`.tab-btn[data-tab="${CSS.escape(tabId)}"]`);
        if (button) button.click();
        document.querySelectorAll('.v6-mobile-nav button').forEach(item => item.classList.toggle('active', item.dataset.v6Tab === tabId));
        window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    root.v6GoToTab = goToTab;

    function installMobileNavigation() {
        if (document.querySelector('.v6-mobile-nav')) return;
        const nav = document.createElement('nav');
        nav.className = 'v6-mobile-nav';
        nav.setAttribute('aria-label', 'Primary game navigation');
        nav.innerHTML = `
            <button type="button" class="active" data-v6-tab="dashboard"><span aria-hidden="true">⌂</span>Today</button>
            <button type="button" data-v6-tab="training"><span aria-hidden="true">＋</span>Train</button>
            <button type="button" data-v6-tab="fitness-plan"><span aria-hidden="true">▦</span>Plan</button>
            <button type="button" data-v6-tab="sagas"><span aria-hidden="true">◇</span>Story</button>
            <button type="button" data-v6-more><span aria-hidden="true">•••</span>More</button>`;
        document.body.appendChild(nav);
        nav.querySelectorAll('[data-v6-tab]').forEach(button => button.addEventListener('click', () => goToTab(button.dataset.v6Tab)));
        nav.querySelector('[data-v6-more]').addEventListener('click', openMoreMenu);
    }

    function openMoreMenu() {
        let sheet = document.getElementById('v6MoreSheet');
        if (!sheet) {
            sheet = document.createElement('div');
            sheet.id = 'v6MoreSheet';
            sheet.className = 'v6-more-sheet';
            sheet.hidden = true;
            sheet.innerHTML = `
                <div class="v6-more-panel" role="dialog" aria-modal="true" aria-labelledby="v6MoreTitle" tabindex="-1">
                    <div class="v6-more-head"><h2 id="v6MoreTitle">More</h2><button type="button" data-v6-close aria-label="Close more menu">Close</button></div>
                    <div class="v6-more-grid">
                        ${[
                            ['story', 'Story Codex'],
                            ['character', 'Partners'],
                            ['abilities', 'Abilities'],
                            ['transformations', 'Transformations'],
                            ['dragonballs', 'Dragon Balls'],
                            ['achievements', 'Achievements'],
                            ['history', 'History']
                        ].map(([id, label]) => `<button type="button" class="btn-secondary" data-v6-tab="${id}">${label}</button>`).join('')}
                        <button type="button" class="btn-secondary" data-v6-export>Export backup</button>
                        <button type="button" class="btn-secondary" data-v6-import>Import backup</button>
                    </div>
                </div>`;
            document.body.appendChild(sheet);
            sheet.querySelector('[data-v6-close]').addEventListener('click', closeMoreMenu);
            sheet.addEventListener('click', event => { if (event.target === sheet) closeMoreMenu(); });
            sheet.querySelectorAll('[data-v6-tab]').forEach(button => button.addEventListener('click', () => {
                closeMoreMenu();
                goToTab(button.dataset.v6Tab);
            }));
            sheet.querySelector('[data-v6-export]').addEventListener('click', () => {
                closeMoreMenu();
                document.getElementById('exportBtn')?.click();
            });
            sheet.querySelector('[data-v6-import]').addEventListener('click', () => {
                closeMoreMenu();
                document.getElementById('importBtn')?.click();
            });
        }
        lastFocusedBeforeModal = document.activeElement;
        sheet.hidden = false;
        sheet.querySelector('[role="dialog"]').focus();
    }

    function closeMoreMenu() {
        const sheet = document.getElementById('v6MoreSheet');
        if (sheet) sheet.hidden = true;
        lastFocusedBeforeModal?.focus?.();
    }

    function installToasts() {
        if (document.querySelector('.v6-toast-region')) return;
        const region = document.createElement('div');
        region.className = 'v6-toast-region';
        region.setAttribute('aria-live', 'polite');
        region.setAttribute('aria-label', 'Game notifications');
        document.body.appendChild(region);
        document.addEventListener('dbz-toast', event => {
            const detail = event.detail || {};
            const toast = document.createElement('div');
            toast.className = `v6-toast ${detail.type || 'info'}`;
            const effectText = String(detail.message || '').toLowerCase();
            toast.dataset.v6Effect = /dragon ball|wish/.test(effectText)
                ? 'dragon'
                : /transform|mastery|rank|form/.test(effectText)
                    ? 'aura'
                    : /unlock|reward|capsule|earned|level/.test(effectText)
                        ? 'capsule'
                        : /saga|power|target|limited/.test(effectText)
                            ? 'scouter'
                            : 'spark';
            const message = document.createElement('span');
            message.textContent = String(detail.message || '');
            toast.appendChild(message);
            if (typeof detail.action === 'function') {
                const action = document.createElement('button');
                action.type = 'button';
                action.textContent = detail.actionLabel || 'Undo';
                action.addEventListener('click', () => {
                    detail.action();
                    toast.remove();
                });
                toast.appendChild(action);
            }
            region.prepend(toast);
            while (region.children.length > 4) region.lastElementChild.remove();
            setTimeout(() => toast.remove(), detail.type === 'error' ? 9000 : 5200);
        });
    }

    const abilityFamilies = [
        { id: 'beam', label: 'Beam', symbol: '◇', match: /beam|wave|ray|cannon|galick|kamehameha|masenko|flash/ },
        { id: 'spirit', label: 'Spirit', symbol: '✦', match: /spirit|ki|energy|aura|meditat|focus|potential/ },
        { id: 'movement', label: 'Movement', symbol: '»', match: /instant|speed|dash|flight|teleport|afterimage|movement/ },
        { id: 'control', label: 'Control', symbol: '◎', match: /control|barrier|shield|sense|heal|regen|support/ },
        { id: 'destruction', label: 'Destruction', symbol: '◆', match: /destroy|hakai|explosion|bomb|blast|death|erasure/ },
        { id: 'god', label: 'God Ki', symbol: '✧', match: /god|divine|ultra|angel|destruction energy/ },
        { id: 'martial', label: 'Martial', symbol: '⬡', match: /strike|kick|punch|martial|combo|rush|counter|technique/ }
    ];

    function abilityFamily(text) {
        const normalized = String(text || '').toLowerCase();
        return abilityFamilies.find(family => family.match.test(normalized))
            || { id: 'utility', label: 'Utility', symbol: '•' };
    }

    function auraFamily(text) {
        const normalized = String(text || '').toLowerCase();
        if (/blue|evolution|god|divine|ultra instinct|angel/.test(normalized)) return 'divine';
        if (/rose|pink|majin/.test(normalized)) return 'rose';
        if (/orange|giant|namek|potential/.test(normalized)) return 'verdant';
        if (/gold|frieza|released/.test(normalized)) return 'gold';
        if (/beast|rage|super saiyan|legendary/.test(normalized)) return 'storm';
        if (/android|bio|perfect|absorp/.test(normalized)) return 'synthetic';
        return 'base';
    }

    function sagaVisualFamily(text) {
        const normalized = String(text || '').toLowerCase();
        if (/daima/.test(normalized)) return 'daima';
        if (/beerus|resurrection|universe|future|goku black|tournament|moro|granolah|super/.test(normalized)) return 'super';
        if (/raditz|saiyan|namek|frieza|android|cell|buu|z\b/.test(normalized)) return 'z';
        return 'adventure';
    }

    function decorateVisualLanguage(rootNode = document) {
        const matchesWithin = selector => [
            ...(rootNode.matches?.(selector) ? [rootNode] : []),
            ...(rootNode.querySelectorAll?.(selector) || [])
        ];
        matchesWithin('.v5a-roster-row, .v5-ability-card').forEach(card => {
            const family = abilityFamily(card.textContent);
            card.dataset.v6Family = family.id;
            if (card.querySelector('.v6-family-badge')) return;
            const badge = document.createElement('span');
            badge.className = 'v6-family-badge';
            badge.title = `${family.label} ability family`;
            badge.setAttribute('aria-label', `${family.label} ability family`);
            badge.innerHTML = `<span aria-hidden="true">${family.symbol}</span>${family.label}`;
            (card.querySelector('.v5a-roster-title, h3') || card).prepend(badge);
        });

        matchesWithin('.v5t-roster-row, .transformation-card, .v5t-slot, .v5t-portrait-wrap').forEach(card => {
            card.dataset.v6Aura = auraFamily(card.textContent);
            if (card.querySelector(':scope > .v6-state-fx')) return;
            const effect = document.createElement('span');
            effect.className = 'v6-state-fx';
            effect.setAttribute('aria-hidden', 'true');
            card.prepend(effect);
        });

        matchesWithin('.v5-saga-banner-wrap').forEach(banner => {
            banner.dataset.v6SagaVisual = sagaVisualFamily(banner.closest('.v5-saga-panel, .v5-saga-detail, .v5-saga-current')?.textContent || banner.textContent);
        });
    }

    function installSaveStatus() {
        if (document.querySelector('.v6-save-status')) return;
        const status = document.createElement('div');
        status.className = 'v6-save-status';
        status.textContent = 'Save ready';
        document.body.appendChild(status);
        document.addEventListener('dbz-save-status', event => {
            status.textContent = event.detail?.detail || 'Save updated';
            status.classList.toggle('error', event.detail?.status === 'error');
            const pill = document.querySelector('.v6-save-pill');
            if (pill) pill.textContent = status.textContent;
        });
    }

    function inputLimit(input) {
        const identity = `${input.id} ${input.name} ${input.placeholder} ${input.getAttribute('aria-label') || ''}`.toLowerCase();
        if (/rep/.test(identity)) return config.inputLimits.reps;
        if (/weight|kg|1rm|body.?weight/.test(identity)) return config.inputLimits.weightKg;
        if (/second|hold/.test(identity)) return config.inputLimits.seconds;
        if (/duration|minute/.test(identity)) return config.inputLimits.durationMinutes;
        if (/distance|kilomet|\\bkm\\b/.test(identity)) return config.inputLimits.distanceKm;
        if (/speed|kph|km\/h/.test(identity)) return config.inputLimits.speedKph;
        return null;
    }

    function guardNumericInput(input) {
        if (!(input instanceof HTMLInputElement) || input.type !== 'number' || input.dataset.v6Guarded) return;
        const limit = inputLimit(input);
        if (!limit) return;
        input.dataset.v6Guarded = '1';
        if (!input.max || Number(input.max) > limit) input.max = String(limit);
        input.addEventListener('focus', () => originalInputValues.set(input, input.value));
        input.addEventListener('input', () => {
            const value = Number(input.value);
            if (!Number.isFinite(value) || value <= limit) return;
            const original = input.value;
            input.value = String(limit);
            input.classList.add('v6-input-warning');
            document.dispatchEvent(new CustomEvent('dbz-toast', {
                detail: {
                    type: 'error',
                    message: `${original} is outside the plausible range here, so it was limited to ${limit}.`,
                    actionLabel: 'Undo',
                    action: () => {
                        input.value = originalInputValues.get(input) ?? original;
                        input.classList.remove('v6-input-warning');
                        input.focus();
                    }
                }
            }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            setTimeout(() => input.classList.remove('v6-input-warning'), 4000);
        });
    }

    function installInputSafety() {
        document.querySelectorAll('input[type="number"]').forEach(guardNumericInput);
        const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
            if (!(node instanceof Element)) return;
            if (node.matches('input[type="number"]')) guardNumericInput(node);
            node.querySelectorAll?.('input[type="number"]').forEach(guardNumericInput);
        })));
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function filterCollection(tab, query) {
        const normalized = query.trim().toLowerCase();
        const cards = tab.querySelectorAll(
            '.v5p-card, .v5p-roster-row, .v5p-partner-row, ' +
            '.v5a-card, .v5a-roster-row, ' +
            '.v5t-card, .v5t-roster-row, ' +
            '.achievement-card, .achievement-grid-card'
        );
        cards.forEach(card => {
            card.hidden = !!normalized && !card.textContent.toLowerCase().includes(normalized);
        });
    }

    function installCollectionSearch() {
        collectionTabs.forEach(tabId => {
            const tab = document.getElementById(tabId);
            if (!tab || tab.querySelector(':scope > .v6-collection-search')) return;
            const wrapper = document.createElement('label');
            wrapper.className = 'v6-collection-search';
            wrapper.innerHTML = `<span class="v6-visually-hidden">Search ${safeText(tabId)}</span><input type="search" placeholder="Search ${safeText(tabId)}…" autocomplete="off">`;
            tab.prepend(wrapper);
            wrapper.querySelector('input').addEventListener('input', event => filterCollection(tab, event.target.value));
        });
    }

    function syncGoalSearch() {
        const select = document.getElementById('coreGoalSelect');
        if (!select) return;
        let input = document.getElementById('v6GoalSearch');
        let list = document.getElementById('v6GoalOptions');
        if (!input) {
            input = document.createElement('input');
            input.id = 'v6GoalSearch';
            input.className = 'v6-goal-search';
            input.type = 'search';
            input.placeholder = 'Find goal…';
            input.autocomplete = 'off';
            input.setAttribute('aria-label', 'Find a power-level goal');
            input.setAttribute('list', 'v6GoalOptions');
            list = document.createElement('datalist');
            list.id = 'v6GoalOptions';
            select.before(input, list);
            const commitGoalSearch = () => {
                const query = input.value.trim().toLowerCase();
                if (!query) return;
                const options = [...select.options];
                const exact = options.find(option => option.textContent.trim().toLowerCase() === query);
                const partial = options.filter(option => option.textContent.toLowerCase().includes(query));
                const match = exact || (partial.length === 1 ? partial[0] : null);
                if (!match) return;
                select.value = match.value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
                input.value = '';
            };
            input.addEventListener('change', commitGoalSearch);
            input.addEventListener('keydown', event => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                commitGoalSearch();
            });
        }
        if (!list) return;
        list.replaceChildren(...[...select.options].map(option => {
            const item = document.createElement('option');
            item.value = option.textContent.trim();
            return item;
        }));
    }

    function dedupeGoalDatabase() {
        if (typeof CHARACTER_POWER_DATABASE === 'undefined' || !Array.isArray(CHARACTER_POWER_DATABASE)) return;
        const selected = new Map();
        CHARACTER_POWER_DATABASE.forEach(entry => {
            const key = String(entry?.name || entry?.id || '').trim().toLowerCase();
            if (!key) return;
            const existing = selected.get(key);
            const candidateIsBenchmark = /benchmark/i.test(entry.id || '');
            const existingIsBenchmark = /benchmark/i.test(existing?.id || '');
            if (!existing || (existingIsBenchmark && !candidateIsBenchmark)) selected.set(key, entry);
        });
        CHARACTER_POWER_DATABASE.splice(0, CHARACTER_POWER_DATABASE.length, ...selected.values());
    }

    function labelImagesAndDialogs(rootNode = document) {
        decorateVisualLanguage(rootNode);
        rootNode.querySelectorAll?.('img').forEach(image => {
            image.loading = image.closest('#dashboard') ? 'eager' : 'lazy';
            image.decoding = 'async';
            if (!image.alt) {
                const nearby = image.closest('.card, article, section')?.querySelector('h2,h3,strong')?.textContent?.trim();
                image.alt = nearby ? `${nearby} artwork` : '';
            }
        });
        rootNode.querySelectorAll?.('.modal').forEach(modal => {
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('tabindex', '-1');
            const heading = modal.querySelector('h1,h2,h3');
            if (heading && !heading.id) heading.id = `v6Dialog${Math.random().toString(36).slice(2)}`;
            if (heading) modal.setAttribute('aria-labelledby', heading.id);
        });
        rootNode.querySelectorAll?.('button').forEach(button => {
            if (!button.getAttribute('aria-label') && !button.textContent.trim()) {
                button.setAttribute('aria-label', button.title || 'Game action');
            }
        });
    }

    function installAccessibilityObserver() {
        labelImagesAndDialogs();
        const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
            if (node instanceof Element) labelImagesAndDialogs(node);
        })));
        observer.observe(document.body, { childList: true, subtree: true });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                closeMoreMenu();
                const visibleModal = [...document.querySelectorAll('.modal')].find(modal => getComputedStyle(modal).display !== 'none');
                visibleModal?.querySelector('.close, [data-close]')?.click();
            }
            if (event.key !== 'Tab') return;
            const dialog = [...document.querySelectorAll('[role="dialog"]')].find(item => !item.closest('[hidden]') && getComputedStyle(item).display !== 'none');
            if (!dialog) return;
            const focusable = [...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])')];
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        });
    }

    function humanizeSagaIds() {
        if (typeof SAGAS === 'undefined') return;
        const names = new Map(SAGAS.map(saga => [saga.id, saga.name]));
        document.querySelectorAll('.tab-content.active, .v6-more-sheet').forEach(container => {
            const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) nodes.push(walker.currentNode);
            nodes.forEach(node => {
                if (!/\b(?:db|dbz|dbs|daima)_[a-z0-9_]+\b/i.test(node.nodeValue)) return;
                let next = node.nodeValue;
                names.forEach((name, id) => { next = next.replaceAll(id, name); });
                node.nodeValue = next;
            });
        });
    }

    function validateGameDataV6() {
        const errors = [];
        const warnings = [];
        const weeks = Object.entries(config.sagaTargetWeeks);
        weeks.forEach(([id, week], index) => {
            if (!Number.isFinite(week) || week < 0) errors.push(`Invalid target week for ${id}`);
            if (index && week <= weeks[index - 1][1]) errors.push(`Saga target weeks are not increasing at ${id}`);
        });
        if (weeks.at(-1)?.[1] !== config.campaignWeeks) errors.push('The final saga does not target week 156.');
        if (typeof SAGAS !== 'undefined') {
            weeks.forEach(([id]) => { if (!SAGAS.some(saga => saga.id === id)) errors.push(`Missing saga ${id}`); });
        }
        if (typeof TRANSFORMATIONS !== 'undefined') {
            const supportedRaces = new Set(TRANSFORMATIONS.flatMap(transformation => {
                if (Array.isArray(transformation.races)) return transformation.races;
                return transformation.race ? [transformation.race] : [];
            }));
            Object.keys(config.racePowerPaths).forEach(race => {
                if (!supportedRaces.has(race) && !['earthling', 'android', 'majin'].includes(race)) warnings.push(`${race} relies on a race mechanic rather than a conventional form.`);
            });
        }
        return { ok: errors.length === 0, errors, warnings, checkedAt: new Date().toISOString() };
    }
    root.validateGameDataV6 = validateGameDataV6;

    function installDashboardWrapper() {
        if (typeof renderDashboard !== 'function' || renderDashboard.__v6Wrapped) return;
        const original = renderDashboard;
        renderDashboard = function renderDashboardV6(...args) {
            const result = original.apply(this, args);
            renderToday();
            installWorkoutContext();
            syncGoalSearch();
            queueMicrotask(humanizeSagaIds);
            return result;
        };
        renderDashboard.__v6Wrapped = true;
    }

    dedupeGoalDatabase();
    installDashboardWrapper();

    document.addEventListener('DOMContentLoaded', () => {
        installToasts();
        installSaveStatus();
        installMobileNavigation();
        installInputSafety();
        installCollectionSearch();
        syncGoalSearch();
        installAccessibilityObserver();
        installWorkoutContext();
        document.querySelectorAll('.overview-recovery-label').forEach(label => {
            if (label.textContent.includes('No-log Decay')) label.textContent = 'Readiness:';
            if (label.textContent.includes('Weekly Risk')) label.textContent = 'Weekly Goal:';
        });
        setTimeout(() => {
            renderToday();
            humanizeSagaIds();
            const character = activeCharacter();
            if (character?.v6Migration && !sessionStorage.getItem('dbz_v6_migration_notice')) {
                sessionStorage.setItem('dbz_v6_migration_notice', '1');
                v6Alert('Save migrated to v6: base fitness power is linear, and saga-scale power now comes from equipped progression systems.', 'success');
            }
        }, 0);
    });
})(globalThis);
