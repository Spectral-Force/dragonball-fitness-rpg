import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../v7/engine.js';
import * as S from '../v7/storage.js';
import { CATALOG, STATS } from '../v7/catalog.js';
import { createRestoredUI } from '../v7/restored-ui.js';
import { renderDashboard, renderBuild, renderStatSheet, renderGrowthPlot, getPinnedPurchase } from '../v7/dashboard.js';
import { normalizeTemplate, workoutFromDay } from '../v7/planner.js';
import { STAT_LABELS } from '../v7/chronicle.js';
import { escapeHTML } from '../v7/ui-kit.js';
import { createLegacyCorrection } from '../v7/history-corrections.js';

const copy = value => JSON.parse(JSON.stringify(value));
const fmt = (value, digits = 1) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
const dayAgo = days => { const date = new Date(); date.setDate(date.getDate() - days); return E.localDate(date); };
function fixture(routeId = 'earthling', developed = false) {
    const state = E.createState(), c = E.createCharacter(state, { id: 'test_player', name: '<Player & One>', routeId }, `${dayAgo(35)}T12:00:00`);
    state.templates = [{ id: 'routine_for_projection', name: 'Bench & meditation', entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 40 }] }, { exerciseId: 'meditation', duration: 12, distance: 0, sets: [] }] }];
    if (developed) {
        c.baseline.tp = c.tp = 5000; c.baseline.ap = c.ap = 200;
        E.recruitPartner(c, 'kid_goku'); if (!c.activePartners.includes('kid_goku')) E.togglePartner(c, 'kid_goku'); E.setMainMentor(c, 'kid_goku');
        E.buyAbility(c, 'ki_blast'); if (!c.activeAbilities.includes('ki_blast')) E.toggleAbility(c, 'ki_blast');
        const upgrade = CATALOG.trainingBranches[0].upgrades.find(item => E.getEquipmentState(c, item.id).canBuy); if (upgrade) E.buyEquipment(c, upgrade.id);
        for (const days of [28, 24, 21, 18, 14, 11, 7, 4, 1]) E.logWorkout(c, { date: dayAgo(days), kind: 'training', name: `Training ${days}`, entries: [{ exerciseId: 'bench_press', sets: [{ reps: 10, weight: 40 }, { reps: 8, weight: 45 }] }, { exerciseId: 'meditation', duration: 20, distance: 0, sets: [] }] });
    }
    return { state, c };
}
function harness(f = fixture()) {
    const dialogs = [], notifications = [], navigations = [], commits = [], view = {}; let renders = 0;
    const host = { getState: () => f.state, getCharacter: () => f.c, getView: () => view, openDialog: (title, html, cls) => { dialogs.push({ title, html, cls }); return null; }, closeDialog: () => {}, notify: text => notifications.push(text), render: () => { renders++; }, searchRender: () => { renders++; }, navigate: (...args) => navigations.push(args),
        commit: async (action, message) => { try { action(); commits.push(message); return true; } catch (error) { notifications.push(error.message); return false; } },
        templates: () => f.state.templates, templateEntries: t => workoutFromDay({ entries: normalizeTemplate(t).entries }) };
    return { ...f, host, ui: createRestoredUI(host), dialogs, notifications, navigations, commits, view, get renders() { return renders; }, get last() { return dialogs.at(-1); } };
}
async function submit(ui, id, values) {
    const old = globalThis.FormData;
    globalThis.FormData = class { constructor(form) { this.values = form.values; } get(key) { return this.values[key] ?? null; } };
    try { return await ui.handleSubmit({ target: { id, values }, preventDefault() {} }); } finally { globalThis.FormData = old; }
}
const change = (dataset, value, checked) => ({ target: { dataset, value, checked, hasAttribute: key => key === 'data-r-benchmark' && dataset.benchmark } });

test('calendar opens the corrected physical date without changing imported rewards', async () => {
    const h = harness();
    h.c.workouts = [{ id:'legacy-record', legacy:true, date:dayAgo(5), name:'Archived bench', kind:'training', entries:[{exerciseId:'bench_press',sets:[{reps:10,weight:50}]}], notes:'' }];
    const before = { stats:copy(h.c.stats), xp:h.c.xp, tp:h.c.tp, ap:h.c.ap };
    const correctedDate = dayAgo(4);
    h.c.workouts[0] = createLegacyCorrection(h.c,'legacy-record',{date:correctedDate,entries:[{exerciseId:'bench_press',sets:[{reps:5,weight:60}]}]},'Corrected from paper log').workout;
    await h.ui.handleAction('r-calendar-day',{dataset:{id:correctedDate}});
    assert.match(h.last.html,/Archived bench/);
    assert.match(h.last.html,/data-id="legacy-record"/);
    assert.deepEqual({stats:h.c.stats,xp:h.c.xp,tp:h.c.tp,ap:h.c.ap},before);
});

test('selected Kid Goku partner form is displayed from the persisted activeForm field', async () => {
    const h = harness(fixture('saiyan',true));
    const available=E.getPartnerForms(h.c,'kid_goku').find(f=>f.unlocked);
    assert.ok(available);
    await h.ui.handleAction('r-partner-form',{dataset:{id:'kid_goku',form:available.id}});
    assert.equal(h.c.partners.kid_goku.activeForm,available.id);
    assert.match(h.last.html,new RegExp(`data-form="${available.id}"[^>]*>Selected</button>`));
});

test('every race has a complete fresh dashboard with currencies, seven stats, story, build and radar', () => {
    for (const route of Object.keys(CATALOG.routes)) {
        const { state, c } = fixture(route), before = copy(state), html = renderDashboard(c, state);
        for (const label of ['Training Points', 'Ability Points', 'Your seven stats', 'Your growth over time', 'Prepared abilities', 'Active training upgrades', 'Dragon Radar', 'LATEST STORY']) assert.ok(html.includes(label), `${route}: ${label}`);
        for (const stat of STATS) assert.ok(html.includes(`data-id="${stat}"`), stat);
        assert.ok(html.includes('&lt;Player &amp; One&gt;')); assert.ok(!html.includes('<Player & One>'));
        assert.doesNotMatch(html, /\b(?:undefined|NaN|Infinity)\b/); assert.deepEqual(state, before, `${route} rendering must not change game state`);
    }
});

test('developed dashboard and all chart modes show recorded values without changing saved history', () => {
    const { state, c } = fixture('saiyan', true), before = copy(state);
    const html = renderDashboard(c, state); assert.match(html, /Replay reward receipt/); assert.ok(html.includes(fmt(c.tp, 2))); assert.ok(html.includes('Kid Goku'));
    for (const range of ['7', '30', 'all', 'custom']) for (const metric of ['stats', 'power']) for (const mode of ['absolute', 'percent', ...(metric === 'power' ? ['log'] : [])]) {
        const plot = renderGrowthPlot(c, state, { range, metric, mode, start: dayAgo(30), end: E.localDate(), series: STATS, group: 'week' });
        assert.match(plot, /<table>/); assert.doesNotMatch(plot, /(?:NaN|Infinity|undefined)/, `${range}/${metric}/${mode}`);
    }
    const sheet = renderStatSheet(c, state); for (const stat of STATS) assert.ok(sheet.includes(STAT_LABELS[stat]));
    assert.deepEqual(state, before);
});

test('all restored views render against the actual production engine for fresh and developed players', () => {
    for (const developed of [false, true]) {
        const h = harness(fixture('earthling', developed));
        for (const key of ['raceExtras', 'balls', 'rewards', 'story', 'analysis', 'records', 'comparisonView']) {
            const html = h.ui[key](); assert.ok(typeof html === 'string' && html.length > 100, `${key}, developed=${developed}`); assert.doesNotMatch(html, /\b(?:undefined|NaN|Infinity)\b/, key);
        }
        for (const kind of ['partners', 'abilities', 'forms']) assert.ok(h.ui.slotPanel(kind).length > 100);
        h.ui.showPartner('bulma'); assert.match(h.last.html, /Partner Level/);
        h.ui.showAbility('ki_blast'); assert.match(h.last.html, /Ability Level/);
        h.ui.showForm('base'); assert.match(h.last.html, /Mastery Level/);
        assert.deepEqual(h.notifications, []);
    }
});

test('partner and ability details display exact production contribution/XP fields', () => {
    const h = harness(fixture('earthling', true)), exercise = { ...CATALOG.exercises.find(e => e.id === 'bench_press'), _stat: 'STR' };
    h.ui.showPartner('kid_goku'); const partner = E.getPartnerDevelopment(h.c, 'kid_goku', exercise);
    assert.ok(h.last.html.includes(`Partner Level ${E.getPartnerState(h.c, 'kid_goku').level}`));
    assert.ok(h.last.html.includes(`${fmt(partner.xpInto)} / ${fmt(partner.xpNeeded)} XP`));
    assert.ok(h.last.html.includes(`+${fmt(partner.contribution * 100, 2)}%`));
    h.ui.showAbility('ki_blast'); const ability = E.getAbilityDevelopment(h.c, 'ki_blast', exercise);
    assert.ok(h.last.html.includes(`Ability Level ${ability.level} / 100`));
    assert.ok(h.last.html.includes(`+${fmt(ability.contribution * 100, 2)}%`));
});

test('build summary uses practice levels and equipped echoForms rather than purchase ranks', () => {
    const { c } = fixture('earthling', true);
    c.forms.kaioken_x1 = { level: 6, xp: 1250 }; c.echoForms = ['kaioken_x1'];
    const practice = E.getAbilityDevelopment(c, 'ki_blast'); assert.ok(practice.level > c.abilities.ki_blast, 'Fixture must distinguish practice from purchase rank');
    const html = renderBuild(c);
    assert.ok(html.includes(`<small>Level ${practice.level}</small>`), 'Prepared technique must display its practice level');
    assert.match(html, /Training echoes:/); assert.ok(html.includes(CATALOG.transformations.find(f => f.id === 'kaioken_x1').name));
});

test('stat details list matching exercises and calculate the selected stat channel', async () => {
    const h = harness(fixture('earthling', true));
    await h.ui.handleAction('r-stat', { dataset: { id: 'AGI' } });
    assert.ok(h.last.html.includes('Training options:'), 'Catalog stat/weights must drive exercise suggestions');
    assert.match(h.last.html, /Bench Press → Agility:/);
});

test('reward and story tabs expose their complete groups and use honest daily/weekly labels', async () => {
    const h = harness(fixture());
    const html = h.ui.rewards(); assert.doesNotMatch(html, /<span class="tag[^"]*">Race-specific<\/span>/, 'Daily/weekly objectives are not race-specific');
    for (const id of ['achievements', 'partnerCollections', 'abilityCollections', 'transformationCollections', 'arcs']) { assert.equal(await h.ui.handleAction('r-reward-group', { dataset: { id } }), true); assert.ok(h.ui.rewards().length > 500); }
    for (const id of ['saga', 'character', 'relationship', 'journal']) { await h.ui.handleAction('r-story-group', { dataset: { id } }); assert.ok(h.ui.story().length > 500); }
});

test('story archive classifies the production kind field without hiding character or relationship entries', async () => {
    const h = harness(), all = E.getAllStoryEntries(h.c);
    for (const kind of ['saga', 'character', 'relationship']) {
        await h.ui.handleAction('r-story-group', { dataset: { id: kind } }); const html = h.ui.story();
        for (const entry of all.filter(e => e.kind === kind)) assert.ok(html.includes(`data-id="${entry.id}"`), `${kind} must include ${entry.id}`);
        const wrongKind = all.find(e => e.kind !== kind); assert.ok(!html.includes(`data-id="${wrongKind.id}"`), `${kind} must not mix ${wrongKind.kind} entries`);
    }
});

test('receipt replay displays saved partner and ability XP channels and never awards again', () => {
    const h = harness(fixture('earthling', true)), workout = h.c.workouts.at(-1), r = workout.receipt, before = copy(h.state);
    assert.ok(r.partnerXPById.kid_goku > 0); assert.ok(r.abilityXP > 0); assert.ok(r.activeAbilities.includes('ki_blast'));
    h.ui.showReceipt(workout.id);
    assert.ok(h.last.html.includes(`Kid Goku: +${fmt(r.partnerXPById.kid_goku, 2)} XP`), 'Receipt needs the recorded partnerXPById allocation');
    assert.ok(h.last.html.includes(`Ki Blast: +${fmt(r.abilityXP, 2)} XP`), 'Receipt needs scalar abilityXP applied to recorded activeAbilities');
    assert.deepEqual(h.state, before); assert.equal(h.commits.length, 0);
});

test('UI navigation, chart controls and purchase goal actions keep their intended domains', async () => {
    const h = harness();
    await h.ui.handleAction('r-open-develop', { dataset: { id: 'abilities' } }); assert.deepEqual(h.navigations.at(-1), ['develop', 'abilities']);
    await h.ui.handleAction('r-dragon-balls', { dataset: {} }); assert.deepEqual(h.navigations.at(-1), ['adventure', 'expedition']);
    h.ui.handleChange(change({ rChart: 'metric' }, 'power')); h.ui.handleChange(change({ rChart: 'mode' }, 'log')); h.ui.handleChange(change({ rChart: 'metric' }, 'stats')); assert.equal(h.view.chart.mode, 'absolute');
    h.ui.handleChange(change({ rSeries: 'GKI' }, '', true)); assert.ok(h.view.chart.series.includes('GKI'));
    await h.ui.handleAction('r-pin-purchase', { dataset: { id: 'ki_blast', kind: 'abilities' } }); assert.equal(getPinnedPurchase(h.c).item.id, 'ki_blast'); assert.equal(h.commits.length, 1);
    assert.equal(await h.ui.handleAction('ordinary-app-action', { dataset: {} }), false);
});

test('Player 2 comparison accepts production exports and compatible payload envelopes without saving them', async () => {
    const h = harness(fixture('saiyan', true)), other = fixture('namekian', true), original = copy(h.state);
    other.c.name = 'Player Two <script>'; const exports = [S.exportGame(other.state), JSON.stringify(other.state), JSON.stringify({ payload: { state: other.state } })];
    for (const backup of exports) {
        assert.equal(await submit(h.ui, 'r-comparison-form', { backup }), true);
        assert.deepEqual(h.notifications, []); assert.ok(h.ui.comparisonView().includes('Player Two &lt;script&gt;')); assert.deepEqual(h.state, original);
    }
    assert.equal(h.commits.length, 0);
});

test('Player 2 comparison rejects invalid save values rather than displaying an unchecked character', async () => {
    const h = harness(), other = fixture(); other.c.stats.STR = -500;
    await submit(h.ui, 'r-comparison-form', { backup: JSON.stringify(other.state) });
    assert.equal(h.notifications.length, 1, 'Imported comparison must use the production save validator'); assert.equal(h.commits.length, 0);
});

test('saved-routine projection runs the production engine on an isolated copy', async () => {
    const h = harness(fixture('earthling', true)), before = copy(h.state), t = h.state.templates[0];
    await h.ui.handleAction('r-projection', { dataset: {} }); assert.ok(h.last.html.includes(escapeHTML(t.name)));
    await submit(h.ui, 'r-projection-form', { weeks: '2', sessions: '2', template: t.id });
    assert.deepEqual(h.notifications, []); assert.equal(h.last.title, 'Your projected season');
    assert.ok(h.last.html.includes('2 weeks · 2 sessions per week'));
    const projected = copy(h.c), start = new Date(`${E.localDate()}T12:00:00`);
    for (let w = 0; w < 2; w++) for (let j = 0; j < 2; j++) { const date = new Date(start); date.setDate(date.getDate() + 1 + w * 7 + Math.floor(j * 7 / 2)); E.logWorkout(projected, { date: E.localDate(date), name: t.name, kind: 'training', entries: h.host.templateEntries(t) }, date); }
    for (const stat of STATS) assert.ok(h.last.html.includes(`<td>${fmt(projected.stats[stat], 3)}</td>`), stat);
    assert.deepEqual(h.state, before); assert.equal(h.commits.length, 0);
});
