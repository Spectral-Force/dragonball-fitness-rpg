(function installDragonBallFitnessRaceUI(root) {
    'use strict';

    const progression = root.DBZ_V6_PROGRESSION;
    const config = root.DBZ_V6_PROGRESSION_CONFIG;
    if (!progression || !config || typeof document === 'undefined') return;

    const safeText = value => String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
    const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

    function getCharacter() {
        return typeof root.getActiveCharacter === 'function' ? root.getActiveCharacter() : null;
    }

    function transformationCatalog(char) {
        const ids = new Set(['base', ...(char?.unlockedTransformations || []), ...(char?.equippedTransformations || [])]);
        Object.values(config.routes).forEach(route => route.tiers.forEach(tier => tier.formIds.forEach(id => ids.add(id))));
        return [...ids].map(id => typeof root.getTransformationById === 'function' ? root.getTransformationById(id) : null).filter(Boolean);
    }

    function runtimeContext(char) {
        const abilities = (char?.equippedAbilities || [])
            .map(id => typeof root.getAbilityById === 'function' ? root.getAbilityById(id) : null)
            .filter(Boolean);
        return {
            transformations: transformationCatalog(char),
            abilities,
            getBasePower: candidate => typeof root.getBasePowerLevel === 'function' ? root.getBasePowerLevel(candidate) : 1,
            getMasteryRank: (candidate, id) => typeof root.getTransformationMasteryRank === 'function'
                ? root.getTransformationMasteryRank(candidate, id)
                : 'G',
            getActivePartnerIds: candidate => typeof root.getActivePartners === 'function'
                ? root.getActivePartners(candidate)
                : (candidate?.activePartners || [])
        };
    }

    function formatPower(value) {
        if (typeof root.formatPL === 'function') return root.formatPL(value);
        return Math.round(number(value, 1)).toLocaleString();
    }

    function projectedFinaleWeek(char) {
        const started = new Date(char?.startedAt || char?.workoutLog?.[0]?.date || '');
        const now = new Date();
        const elapsed = Number.isNaN(started.getTime()) ? 0 : Math.max(1, (now - started) / 604800000);
        const storyRate = number(char?.storyXP) / elapsed;
        if (elapsed < 4 || number(char?.storyXP) < 200 || storyRate < 1) return null;
        const projectedWeek = Math.round(config.campaignWeeks * 50 / storyRate);
        return projectedWeek <= 520 ? projectedWeek : null;
    }

    function choiceControls(char, milestone) {
        const route = milestone.route;
        const earnedPastBase = (char.raceProgression?.earnedTiers || []).some(id => id !== 'base');
        const controls = [];
        if (progression.normalizeRaceKey(char.race) === 'android') {
            controls.push(`<fieldset class="v6-race-choice"><legend>Android architecture</legend>
                ${config.androidPaths.map(path => `<button type="button" class="${char.raceProgression.androidPath === path ? 'selected' : ''}" data-v6-race-choice="androidPath" data-value="${path}" ${earnedPastBase ? 'disabled' : ''}>${path === 'bio' ? 'Bio-Android' : 'Infinite Energy'}</button>`).join('')}
                <small>${earnedPastBase ? 'Architecture locked after the first breakthrough.' : 'Choose before the first breakthrough. Bio-Android uses templates; Infinite Energy uses reactor mastery.'}</small>
            </fieldset>`);
        }
        if (route.id === 'namekian') {
            controls.push(`<fieldset class="v6-race-choice"><legend>Namekian discipline</legend>
                ${config.namekianBranches.map(branch => `<button type="button" class="${char.raceProgression.namekianBranch === branch ? 'selected' : ''}" data-v6-race-choice="namekianBranch" data-value="${branch}" ${char.raceProgression.namekianBranch ? 'disabled' : ''}>${branch[0].toUpperCase() + branch.slice(1)}</button>`).join('')}
                <small>Warrior favours physical control, Dragon favours Spirit and Technique, Balanced spreads both.</small>
            </fieldset>`);
        }
        if (milestone.current.multiplier >= 800 || milestone.next?.multiplier >= 1000) {
            const divineLocked = milestone.current.multiplier >= 1000;
            controls.push(`<fieldset class="v6-race-choice"><legend>Divine discipline</legend>
                ${config.divineDisciplines.map(discipline => `<button type="button" class="${char.raceProgression.divineDiscipline === discipline ? 'selected' : ''}" data-v6-race-choice="divineDiscipline" data-value="${discipline}" ${divineLocked ? 'disabled' : ''}>${discipline[0].toUpperCase() + discipline.slice(1)}</button>`).join('')}
                <small>${divineLocked ? 'Discipline locked at the Divine breakthrough.' : 'Native protects the race identity; Instinct and Destruction unlock shared side-grade techniques.'}</small>
            </fieldset>`);
        }
        return controls.join('');
    }

    function coreSummary(char) {
        const routeId = progression.routeIdForCharacter(char);
        const entries = routeId === 'majin'
            ? (char.raceProgression?.absorptionCores || [])
            : routeId === 'android_bio'
                ? (char.raceProgression?.adaptationTemplates || [])
                : [];
        if (!entries.length && !['majin', 'android_bio'].includes(routeId)) return '';
        const label = routeId === 'majin' ? 'Absorption Cores' : 'Adaptation Templates';
        const items = entries.length ? entries.map(entry => `<li>
            <strong>${safeText(entry.sourcePartnerName || entry.sourcePartnerId)}</strong>
            <span>${safeText(entry.trait?.key || 'trait')} ${(number(entry.trait?.value) * 100).toFixed(1)}% · quality ${number(entry.quality).toFixed(0)}</span>
        </li>`).join('') : '<li><span>No core installed yet. Develop a partner before copying a trait.</span></li>';
        return `<div class="v6-race-cores"><h3>${label} <span>${entries.length}/3</span></h3><ul>${items}</ul><p>The source partner stays owned but is removed from the active team while its copied trait is equipped, preventing double-dipping.</p></div>`;
    }

    function buildRacePathPanel(char, panelId = 'dashboard') {
        const context = runtimeContext(char);
        progression.syncCharacterProgression(char, context);
        const milestone = progression.getNextRaceMilestone(char, context);
        const state = progression.getRacePowerState(char, context);
        const basePower = context.getBasePower(char);
        const effective = progression.calculateEffectivePower(basePower, state);
        const earned = new Set(char.raceProgression?.earnedTiers || ['base']);
        const targetWeek = milestone.next ? config.sagas.find(saga => saga.id === milestone.next.sagaId)?.targetWeek : 156;
        const campaignWeek = Math.min(156, Math.floor(number(char.storyXP) / 50));
        const finale = projectedFinaleWeek(char);
        const raceKey = progression.normalizeRaceKey(char.race);
        const imageRace = raceKey === 'hybrid' ? 'half_saiyan' : raceKey;
        const nextBlockers = milestone.nextStatus?.blockers || [];
        const support = milestone.support;
        const rail = milestone.route.tiers.map(tier => {
            const complete = earned.has(tier.bandId) || earned.has(tier.id);
            const active = tier.bandId === milestone.current.bandId;
            return `<li class="${complete ? 'complete' : active ? 'active' : 'locked'}" aria-label="${safeText(tier.name)}, ${tier.multiplier.toLocaleString()} times, ${complete ? 'complete' : active ? 'current' : 'locked'}">
                <span class="v6-tier-badge">${tier.multiplier >= 1000 ? `${tier.multiplier / 1000}k` : tier.multiplier}×</span>
                <strong>${safeText(tier.name)}</strong>
            </li>`;
        }).join('');
        const titleId = `v6-race-path-title-${panelId}`;
        return `<section class="v6-race-path" aria-labelledby="${titleId}" style="--route-color:${milestone.route.color}">
            <header>
                <img src="./images/v6/races/${imageRace}.webp" alt="" aria-hidden="true">
                <div><span class="v6-race-kicker">Race Path · campaign week ${campaignWeek}/156</span><h2 id="${titleId}">${safeText(milestone.route.label)}</h2><p>${safeText(milestone.route.resourceLabel)} creates fixed breakthroughs. It never scales itself to the next opponent.</p></div>
            </header>
            <div class="v6-race-power-grid">
                <div><span>Base Fitness PL</span><strong>${formatPower(basePower)}</strong></div>
                <div><span>Current state</span><strong>${safeText(state.label)} · ${state.multiplier.toLocaleString()}×</strong></div>
                <div><span>Effective PL</span><strong>${formatPower(effective)}</strong></div>
                <div><span>Finale projection</span><strong>${finale ? `week ${finale}` : 'building baseline'}</strong></div>
            </div>
            <ol class="v6-race-rail">${rail}</ol>
            <div class="v6-race-detail-grid">
                <div class="v6-next-breakthrough"><h3>${milestone.next ? `Next: ${safeText(milestone.next.name)} · ${milestone.next.multiplier.toLocaleString()}×` : 'Finale tier mastered'}</h3>
                    ${milestone.next ? `<p>Target saga: ${safeText(milestone.next.sagaId.replace(/_/g, ' '))} · target week ${targetWeek}</p>
                    ${nextBlockers.length ? `<ul>${nextBlockers.map(blocker => `<li>${safeText(blocker)}</li>`).join('')}</ul>` : '<p class="ready">Breakthrough ready. It will be recorded automatically.</p>'}` : '<p>Your route has a native answer to every campaign band.</p>'}
                </div>
                <div class="v6-support-quality"><h3>Support quality <span>${support.total}/100</span></h3>
                    ${Object.entries(support.components).map(([key, value]) => `<div><span>${safeText(key)}</span><meter min="0" max="${config.supportWeights[key]}" value="${value}">${value}</meter><strong>${value}/${config.supportWeights[key]}</strong></div>`).join('')}
                    <p>Mastery credit uses only the primary state (${safeText(support.primaryId)} · ${safeText(support.masteryRank)}). Base never counts.</p>
                </div>
            </div>
            ${choiceControls(char, milestone)}
            ${coreSummary(char)}
        </section>`;
    }

    function renderRacePath() {
        const char = getCharacter();
        if (!char) return;
        progression.ensureCharacterProgression(char, runtimeContext(char));
        const dashboard = document.getElementById('dashboard');
        const transformations = document.getElementById('transformations');
        [dashboard, transformations].filter(Boolean).forEach((container, index) => {
            const html = buildRacePathPanel(char, index === 0 ? 'dashboard' : 'transformations');
            let panel = container.querySelector(':scope > .v6-race-path');
            if (!panel) {
                panel = document.createElement('div');
                panel.className = 'v6-race-path';
                if (index === 0) {
                    const today = container.querySelector('.v6-today-panel');
                    today ? today.insertAdjacentElement('afterend', panel) : container.prepend(panel);
                } else container.prepend(panel);
            }
            panel.outerHTML = html;
        });
    }

    function saveAndRender() {
        if (typeof root.saveState === 'function') root.saveState();
        renderRacePath();
        if (typeof root.renderDashboard === 'function') root.renderDashboard();
        if (typeof root.renderTransformations === 'function') root.renderTransformations();
        document.dispatchEvent(new CustomEvent('dbz-race-progression-updated'));
    }

    function setRaceChoice(field, value) {
        const char = getCharacter();
        if (!char) return;
        const state = progression.ensureCharacterProgression(char, runtimeContext(char));
        const allowed = field === 'androidPath' ? config.androidPaths
            : field === 'divineDiscipline' ? config.divineDisciplines
                : field === 'namekianBranch' ? config.namekianBranches : [];
        if (!allowed.includes(value) || state[field] === value) return;
        const earnedPastBase = state.earnedTiers.some(id => id !== 'base');
        if ((field === 'androidPath' && earnedPastBase) || (field === 'divineDiscipline' && progression.highestEarnedTier(char).multiplier >= 1000) || (field === 'namekianBranch' && state.namekianBranch)) {
            return root.v6Alert?.('That route choice is already locked for this character.');
        }
        const label = value.replace(/_/g, ' ');
        if (!root.confirm(`Choose ${label}? This route choice becomes permanent when its associated breakthrough is earned.`)) return;
        state[field] = value;
        state.routeId = progression.routeIdForCharacter(char);
        saveAndRender();
    }

    function installBoundedAbsorption(partnerId) {
        const char = getCharacter();
        if (!char) return;
        const state = progression.ensureCharacterProgression(char, runtimeContext(char));
        const routeId = progression.routeIdForCharacter(char);
        const kind = routeId === 'majin' ? 'majin' : routeId === 'android_bio' ? 'bio' : null;
        if (!kind) return root.v6Alert?.('Choose the Bio-Android route to use Adaptation Templates. Infinite Energy Androids progress through reactor mastery.');
        const partner = typeof root.getPartnerById === 'function' ? root.getPartnerById(partnerId) : null;
        if (!partner || !(char.ownedPartners || []).includes(partnerId)) return root.v6Alert?.('Unlock that partner first.');
        const progress = char.partnerLevels?.[partnerId] || { level: 1, totalXp: 0 };
        const core = progression.buildAbsorptionCore(partner, progress, kind);
        const collection = kind === 'bio' ? state.adaptationTemplates : state.absorptionCores;
        const replacing = collection.length >= 3 && !collection.some(entry => entry.sourcePartnerId === partnerId)
            ? collection[collection.length - 1]
            : null;
        const copied = `${core.trait.key} ${(core.trait.value * 100).toFixed(1)}%`;
        const message = `${kind === 'bio' ? 'Install adaptation template' : 'Install absorption core'} from ${partner.name}?\n\nCopied trait: ${copied}\nQuality: ${core.quality}/100\n${replacing ? `Replaces: ${replacing.sourcePartnerName}\n` : ''}The partner remains owned but leaves the active team while this copied trait is active. No levels are lost.`;
        if (!root.confirm(message)) return;
        progression.installAbsorptionCore(char, core, kind, replacing ? collection.length - 1 : null);
        char.activePartners = (char.activePartners || []).filter(id => id !== partnerId);
        if (char.mainPartner === partnerId) char.mainPartner = null;
        const legacyKind = kind === 'bio' ? 'android' : 'majin';
        char.raceAbsorptions = char.raceAbsorptions || {};
        char.raceAbsorptions[legacyKind] = char.raceAbsorptions[legacyKind] || { absorbed: {}, cooldowns: {}, attempts: [] };
        char.raceAbsorptions[legacyKind].absorbed[partnerId] = {
            partnerId,
            partnerName: partner.name,
            level: number(progress.level, 1),
            absorbedAt: core.createdAt,
            absorbPercent: Math.round(core.trait.value * 10000) / 100,
            boundedCore: true,
            effects: core.effects
        };
        delete char.raceAbsorptions[legacyKind].cooldowns?.[partnerId];
        saveAndRender();
        root.v6Alert?.(`${partner.name}'s ${copied} trait was copied. No partner levels were changed.`, 'success');
    }

    root.attemptRaceAbsorption = installBoundedAbsorption;
    root.installV6RaceCore = installBoundedAbsorption;
    root.setV6RaceProgressionChoice = setRaceChoice;
    root.renderV6RacePath = renderRacePath;

    document.addEventListener('click', event => {
        const button = event.target.closest('[data-v6-race-choice]');
        if (!button || button.disabled) return;
        setRaceChoice(button.dataset.v6RaceChoice, button.dataset.value);
    });

    document.addEventListener('DOMContentLoaded', () => {
        renderRacePath();
        const observer = new MutationObserver(mutations => {
            if (mutations.some(mutation => [...mutation.addedNodes].some(node => node.nodeType === 1 && !node.closest?.('.v6-race-path')))) {
                window.requestAnimationFrame(renderRacePath);
            }
        });
        ['dashboard', 'transformations'].map(id => document.getElementById(id)).filter(Boolean)
            .forEach(container => observer.observe(container, { childList: true }));
    });
    document.addEventListener('dbz-save-status', event => {
        if (event.detail?.status === 'loaded') renderRacePath();
    });
})(globalThis);
