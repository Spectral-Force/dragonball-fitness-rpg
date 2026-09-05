import { CATALOG } from './catalog.js';
import { DAY_NAMES, clone, plannerId, defaultEntry, normalizeTemplate, templateLibrary, planForCharacter, presetLibrary, applyPreset, copyDay, copyWeek, calculateEntry, oneRepMax, repPercentage, workoutFromDay, scheduledReferences, validateTemplate, importTemplates, exportTemplates, importPlan } from './planner.js';

/** Scoped dialogs; all persistence and workout loading stay behind the app host. */
export function createPlannerUI(host) {
    const esc = host.escapeHTML || (value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])));
    const button = (text, action, data = '', cls = 'ghost') => `<button type="button" class="button ${cls}" data-action="${action}" ${data}>${text}</button>`;
    const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    let mode = '', previousMode = '', template = null, templateBaseline = '', plan = null, planBaseline = '', week = 0, day = 0, query = '', targetDay = false, busy = false, pending = null;
    const state = () => host.getState(), character = () => host.getCharacter();
    const library = () => templateLibrary(state());
    const currentDay = () => plan.weeks[week].days[day];
    const ownDialog = () => document.querySelector('dialog[data-planner-owned="true"]');
    const templateDirty = () => !!template && JSON.stringify(template) !== templateBaseline;
    const planDirty = () => !!plan && JSON.stringify(plan) !== planBaseline;
    const isDirty = () => templateDirty() || planDirty();
    const field = (label, value, attrs = '', type = 'text') => `<label>${label}<input type="${type}" value="${esc(value)}" ${attrs}></label>`;
    const numeric = (label, value, attrs = '', max = 100000) => field(label, value, `${attrs} min="0" max="${max}" step="any" inputmode="decimal"`, 'number');
    const options = (rows, value) => rows.map(([id, name]) => `<option value="${esc(id)}" ${String(value) === String(id) ? 'selected' : ''}>${esc(name)}</option>`).join('');
    const exerciseOptions = value => options(CATALOG.exercises.filter(e => e.type !== 'recovery_rest').map(e => [e.id, e.name]).sort((a, b) => a[1].localeCompare(b[1])), value);

    function show(title, body) {
        const dialog = host.openDialog(title, `<div class="planner-workspace">${body}</div>`, 'wide-dialog planner-dialog');
        if (!dialog) return;
        dialog.dataset.plannerOwned = 'true';
        const close = dialog.querySelector('[data-action="close-dialog"]');
        if (close) close.dataset.action = 'planner-close';
        dialog.addEventListener('cancel', event => { event.preventDefault(); requestClose(); }, { capture: true });
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const bounds = dialog.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) { event.preventDefault(); event.stopImmediatePropagation(); requestClose(); }
        }, { capture: true });
    }

    function toolbar() {
        return `<div class="planner-toolbar"><div class="button-row">${button('Template library', 'template-library')}${button('Four-week planner', 'planner-open')}</div><span class="planner-save-state" data-planner-dirty role="status">${isDirty() ? 'Unsaved changes' : 'Saved routines · no XP awarded here'}</span></div>`;
    }

    function updateDirty() {
        const status = ownDialog()?.querySelector('[data-planner-dirty]');
        if (status) status.textContent = isDirty() ? 'Unsaved changes' : 'Saved routines · no XP awarded here';
    }

    function askDiscard(next, text = 'Your unsaved template or plan changes will be discarded.') {
        previousMode = mode; mode = 'confirm'; pending = next;
        show('Keep your changes?', `<p>${esc(text)}</p><div class="button-row">${button('Continue editing', 'planner-cancel-discard', '', 'primary')}${button('Discard changes', 'planner-confirm-discard', '', 'danger')}</div>`);
    }

    function rerender() {
        if (mode === 'template') renderEditor();
        else if (mode === 'plan') renderPlan();
        else if (mode === 'settings') renderSettings();
        else if (mode === 'library') renderLibrary();
        else if (mode === 'import') renderImport();
        else if (mode === 'copy') renderCopy();
    }

    function requestClose() {
        if (!ownDialog()) return false;
        if (busy) return true;
        if (mode === 'confirm') { mode = previousMode; pending = null; rerender(); return true; }
        if (isDirty()) askDiscard(() => { template = null; plan = null; mode = ''; host.closeDialog(); });
        else { template = null; plan = null; mode = ''; host.closeDialog(); }
        return true;
    }

    function openTemplates() {
        if (templateDirty()) return askDiscard(() => { template = null; mode = 'library'; renderLibrary(); });
        template = null; query = ''; mode = 'library'; renderLibrary();
    }

    function libraryRows() {
        const rows = library().filter(t => `${t.name} ${t.entries.map(e => e.name).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
        return rows.length ? rows.map(t => `<article class="planner-routine"><div><h3>${esc(t.name.replaceAll('_', ' '))}</h3><p class="muted">${t.entries.length} exercises · ${t.builtIn ? 'Built-in · original stays available' : 'Your editable routine'} · ${t.restSeconds} sec default rest</p><p class="planner-preview">${esc(t.entries.map(e => e.name).join(' · '))}</p></div><div class="button-row">${button(targetDay ? 'Add to planned day' : 'Use routine', 'template-use', `data-id="${esc(t.id)}"`, 'primary')}${button(t.builtIn ? 'Customize a copy' : 'Edit', 'template-edit', `data-id="${esc(t.id)}"`)}${button('Duplicate', 'template-duplicate', `data-id="${esc(t.id)}"`)}${!t.builtIn ? `${button('Rename', 'template-rename', `data-id="${esc(t.id)}"`)}${button('Delete', 'template-delete', `data-id="${esc(t.id)}"`, 'text-button')}` : ''}${button('Export', 'template-export', `data-id="${esc(t.id)}"`, 'text-button')}</div></article>`).join('') : '<p class="empty-inline">No routines match this search.</p>';
    }

    function renderLibrary() {
        mode = 'library';
        show('Workout templates', `${toolbar()}<p class="muted">Edit routines independently of your session. Built-in workouts remain recoverable; customize them as your own copy.</p>${targetDay ? `<p class="planner-notice">Adding exercises to week ${week + 1}, ${esc(currentDay().title)}. ${button('Back to plan', 'planner-open', '', 'small')}</p>` : ''}<div class="button-row">${button('Create template', 'template-create', '', 'primary')}${button('Import templates', 'template-import')}${button('Export my templates', 'template-export-all')}</div><label class="search-field">Search by routine or exercise<input type="search" data-planner-search value="${esc(query)}" placeholder="Chest, running, core…"></label><div class="planner-library" data-planner-results>${libraryRows()}</div>`);
    }

    function startTemplate(source, asNew = false) {
        const next = () => {
            const original = source ? normalizeTemplate(source) : { id: plannerId(), name: 'New routine', notes: '', restSeconds: 90, entries: [] };
            template = clone(original);
            if (source?.builtIn || asNew) { template.sourceTemplateId = source?.id; template.id = plannerId(); template.name = `${original.name.replaceAll('_', ' ')} copy`; }
            template.builtIn = false;
            templateBaseline = JSON.stringify(template); mode = 'template'; renderEditor();
        };
        if (templateDirty()) askDiscard(next); else next();
    }

    function saveDraftAsTemplate(entries, name) {
        startTemplate({ id: plannerId(), name: name || 'My routine', entries: clone(entries) });
        templateBaseline = ''; updateDirty();
    }

    function entryFields(entry, index, context) {
        const setBased = ['weighted', 'bodyweight', 'timed_hold'].includes(entry.type);
        const attr = `data-context="${context}" data-entry="${index}"`;
        const weighted = entry.type === 'weighted', hold = entry.type === 'timed_hold';
        const suggestion = context === 'plan' ? calculateEntry(entry, plan) : entry;
        return `<article class="planner-exercise ${entry.unresolved ? 'planner-unresolved' : ''}"><div class="planner-exercise-heading"><h3>${index + 1}. ${esc(entry.name)}</h3><div class="button-row">${context === 'plan' ? `<label class="planner-check"><input type="checkbox" ${attr} data-efield="selected" ${entry.selected ? 'checked' : ''}>Select</label><label class="planner-check"><input type="checkbox" ${attr} data-efield="completed" ${entry.completed ? 'checked' : ''}>Completed</label>` : ''}${button('↑', 'planner-entry-up', `${attr} aria-label="Move ${esc(entry.name)} up" ${index === 0 ? 'disabled' : ''}`, 'small')}${button('↓', 'planner-entry-down', `${attr} aria-label="Move ${esc(entry.name)} down"`, 'small')}${button('Duplicate', 'planner-entry-duplicate', attr, 'small')}${button('Remove', 'planner-entry-remove', attr, 'small text-button')}</div></div>${entry.unresolved ? `<p class="planner-notice">Original exercise “${esc(entry.name)}” was retained. Match it to the library before loading a workout.</p>` : ''}<div class="planner-form-grid"><label>Exercise<select ${attr} data-efield="exerciseId"><option value="">Choose exercise…</option>${exerciseOptions(entry.exerciseId)}</select></label>${numeric('Rest after a set (seconds)', entry.restSeconds, `${attr} data-efield="restSeconds"`, 3600)}${context === 'plan' && weighted ? `${numeric('Your estimated 1RM (kg)', oneRepMax(plan, entry.name), `${attr} data-efield="oneRepMax"`, 10000)}<label>Equipment rounding<select ${attr} data-efield="equipmentId">${options(Object.entries(plan.equipmentProfiles).map(([id, value]) => [id, value.name || id]), entry.equipmentId)}</select>` : ''}</div>${setBased ? `<div class="planner-sets"><div class="planner-set-labels"><span>Set</span><span>${hold ? 'Hold (sec)' : 'Reps'}</span>${weighted ? '<span>Load (kg)</span>' : ''}<span>Actions</span></div>${entry.sets.map((set, si) => `<div class="planner-set-row ${weighted ? 'weighted' : ''}"><span class="planner-set-number">${si + 1}</span>${numeric(`${hold ? 'Seconds' : 'Reps'} · set ${si + 1}`, hold ? set.seconds : set.reps, `${attr} data-set="${si}" data-sfield="${hold ? 'seconds' : 'reps'}"`, hold ? 86400 : 10000)}${weighted ? `<div>${numeric(`Kg · set ${si + 1}`, set.weight, `${attr} data-set="${si}" data-sfield="weight"`, 10000)}${context === 'plan' ? `<small class="planner-target" data-target="${index}-${si}">${suggestion.sets[si]?.targetWeight > 0 ? `Suggested ${suggestion.sets[si].targetWeight} kg · ${Math.round(repPercentage(plan, set.reps) * 100)}%${set.manualWeight ? ' · manual load' : ''}` : 'Enter your 1RM to calculate a suggestion'}</small>` : ''}</div>` : ''}${button('−', 'planner-set-remove', `${attr} data-set="${si}" aria-label="Remove set ${si + 1}"`, 'small')}</div>`).join('')}</div><div class="button-row">${button('Add set', 'planner-set-add', attr, 'small')}${context === 'plan' && weighted ? button('Apply suggested loads', 'planner-calculate-entry', attr, 'small') : ''}</div>` : entry.type === 'recovery_rest' ? '<p class="muted">Recovery marker. Record this with Log recovery day rather than as an exercise.</p>' : `<div class="planner-form-grid">${numeric('Duration (minutes)', entry.duration, `${attr} data-efield="duration"`, 1440)}${entry.type === 'cardio_distance' ? numeric('Distance (km)', entry.distance, `${attr} data-efield="distance"`, 1000) : ''}</div>`}<label>Exercise notes<textarea rows="2" maxlength="4000" ${attr} data-efield="notes">${esc(entry.notes)}</textarea></label></article>`;
    }

    function addControls(context) {
        return `<div class="planner-add"><label>Add an exercise<select id="${context}-add-exercise">${exerciseOptions('')}</select></label>${button('Add exercise', 'planner-entry-add', `data-context="${context}"`, 'primary')}</div>`;
    }

    function renderEditor() {
        mode = 'template';
        show('Edit workout template', `${toolbar()}<form id="template-editor-form"><div class="planner-form-grid">${field('Template name', template.name, 'data-tfield="name" name="name" required maxlength="160"')}${numeric('Default rest (seconds)', template.restSeconds, 'data-tfield="restSeconds"', 3600)}</div><label>Routine notes<textarea rows="2" maxlength="4000" data-tfield="notes">${esc(template.notes)}</textarea></label><p class="fine-print">Set loads are suggestions. Dumbbell weights are per hand unless you state otherwise in the notes. New exercises inherit the routine’s rest default.</p><div class="planner-exercises">${template.entries.map((entry, i) => entryFields(entry, i, 'template')).join('') || '<p class="empty-inline">Build your routine by adding an exercise below.</p>'}</div>${addControls('template')}<div class="planner-sticky-actions"><button type="submit" class="button primary">Save changes</button>${button('Save as new template', 'template-save-new')}${button('Back to library', 'template-library')}</div></form>`);
    }

    async function persistTemplates(next, message) {
        const before = clone(state().templates || []);
        state().templates = next;
        if (await host.save() === false) { state().templates = before; return false; }
        host.notify(message); host.render?.(); return true;
    }

    async function saveTemplate(asNew = false) {
        validateTemplate(template);
        const updated = { ...clone(template), updatedAt: new Date().toISOString() };
        if (asNew) updated.id = plannerId();
        const rows = clone(state().templates || []), index = rows.findIndex(t => t.id === updated.id);
        if (index >= 0) rows[index] = updated; else { if (rows.length >= 500) throw Error('The library supports 500 custom templates.'); rows.push(updated); }
        if (!await persistTemplates(rows, asNew ? 'A separate template was saved.' : 'Template saved. Your workout draft is unchanged.')) return;
        template = clone(updated); templateBaseline = JSON.stringify(template); renderEditor();
    }

    function openPlan() {
        const next = () => { template = null; if (!plan) { plan = planForCharacter(character(), state()); planBaseline = JSON.stringify(plan); } targetDay = false; mode = 'plan'; renderPlan(); };
        if (templateDirty()) askDiscard(next); else next();
    }

    function renderPlan() {
        mode = 'plan'; const selected = currentDay(), count = selected.entries.filter(e => e.completed).length;
        show('Your four-week training plan', `${toolbar()}<p class="muted">A flexible plan, separate from your training log. Checkboxes track preparation and completion; XP is earned only when you finish a workout.</p><div class="planner-form-grid">${field('Plan name', plan.name, 'data-pfield="name" maxlength="160"')}<label>Recoverable presets<select id="planner-preset"><option value="blank">Blank plan</option>${options(presetLibrary(plan).map(p => [p.id, p.name]), plan.presetId)}</select></label></div><div class="button-row">${button('Load preset', 'planner-preset')}${button('Save as reusable preset', 'planner-save-preset')}${button('Loading / 1RM settings', 'planner-settings')}${button('Copy day or week', 'planner-copy')}${button('Export plan', 'planner-export')}${button('Import plan', 'planner-import')}</div><div class="planner-weeks" role="group" aria-label="Choose week">${plan.weeks.map((w, wi) => button(esc(w.title), 'planner-week', `data-index="${wi}" aria-pressed="${week === wi}"`, week === wi ? 'primary' : 'ghost')).join('')}</div><div class="planner-days" role="group" aria-label="Choose day">${plan.weeks[week].days.map((d, di) => button(`<strong>${esc(d.title)}</strong><small>${d.entries.length} exercises · ${d.entries.filter(e => e.completed).length} done</small>`, 'planner-day', `data-index="${di}" aria-pressed="${day === di}"`, day === di ? 'primary' : 'ghost')).join('')}</div><form id="planner-editor-form"><div class="planner-day-heading"><h3>Week ${week + 1} · ${esc(selected.title)}</h3><span>${count}/${selected.entries.length} completed</span></div><div class="planner-form-grid">${field('Day title', selected.title, 'data-dfield="title" maxlength="160"')}<label>Day intention<select data-dfield="status">${options([['planned', 'Training'], ['rest', 'Recovery / optional light activity'], ['completed', 'Completed']], selected.status)}</select></label></div><label>Day notes<textarea rows="2" maxlength="4000" data-dfield="notes">${esc(selected.notes)}</textarea></label><div class="button-row">${button('Add a template', 'planner-day-template')}${button('Save day as template', 'planner-day-save-template')}${button('Mark all completed', 'planner-complete-all')}${button('Clear completion', 'planner-clear-completed')}</div><div class="planner-exercises">${selected.entries.map((entry, i) => entryFields(entry, i, 'plan')).join('') || '<p class="empty-inline">No exercises scheduled. Add exercises, import a routine or enjoy an open day.</p>'}</div>${addControls('plan')}<div class="planner-sticky-actions"><button type="submit" class="button primary">Save plan</button>${button('Load day into workout', 'planner-load', 'data-load="all"')}${button('Load selected', 'planner-load', 'data-load="selected"')}${button('Load completed', 'planner-load', 'data-load="completed"')}</div></form>${plan.sourceArchive?.length ? `<details class="planner-archive"><summary>${plan.sourceArchive.length} original plan / schedule records preserved</summary><p>Your imported fields and prior schedules remain available in the plan export. Converted exercises above are editable; historical source records remain intact.</p><ul>${plan.sourceArchive.map(record => `<li>${esc(record.kind.replaceAll('-', ' '))}</li>`).join('')}</ul>${button('Export originals', 'planner-export-originals')}</details>` : ''}`);
    }

    async function savePlan() {
        const before = character().fitnessPlan ? clone(character().fitnessPlan) : undefined;
        plan.updatedAt = new Date().toISOString(); character().fitnessPlan = clone(plan);
        if (await host.save() === false) { if (before === undefined) delete character().fitnessPlan; else character().fitnessPlan = before; return false; }
        planBaseline = JSON.stringify(plan); host.notify('Four-week plan saved. No workout rewards were issued.'); host.render?.(); updateDirty(); return true;
    }

    function renderSettings() {
        mode = 'settings';
        const profile = plan.intensityProfiles[plan.activeProfileId] || Object.values(plan.intensityProfiles)[0];
        show('Planned loads and equipment', `${toolbar()}<p class="planner-notice">These are editable load suggestions. Enter your own 1RM values; do not test a maximum simply to fill this planner. Dumbbell loads and 1RM values use one dumbbell / one hand. Cable stack values must use the convention you actually record.</p><label>Rep-percentage profile<select data-profile-select>${options(Object.entries(plan.intensityProfiles).map(([id, value]) => [id, value.name]), plan.activeProfileId)}</select></label><div class="button-row">${button('Create custom profile', 'planner-custom-profile')}</div><div class="planner-profile-grid">${[...new Set([1, 2, 4, 6, 8, 10, 12, ...Object.keys(profile.percentages || {}).map(Number)])].sort((a, b) => a - b).map(reps => numeric(`${reps} reps · % 1RM`, Math.round((profile.percentages?.[reps] || repPercentage(plan, reps)) * 10000) / 100, `data-profile-reps="${reps}"`, 150)).join('')}</div><p class="fine-print">Other rep counts use 1 ÷ (1 + reps/30), bounded to 45–100%. Editing a built-in profile automatically makes a custom copy; its default stays recoverable.</p><h3>Equipment increments and stack values</h3>${Object.entries(plan.equipmentProfiles).map(([id, equipment]) => `<section class="planner-equipment"><h4>${esc(equipment.name || id)}</h4><div class="planner-form-grid">${numeric('Increment (kg)', equipment.step, `data-equipment="${esc(id)}" data-equipment-field="step"`, 1000)}${field('Available stack loads, comma-separated kg', Array.isArray(equipment.values) ? equipment.values.join(', ') : equipment.values || '', `data-equipment="${esc(id)}" data-equipment-field="values" maxlength="4000"`)}</div></section>`).join('')}<p class="fine-print">A stack list overrides the increment. Suggestions use the closest available weight; equal-distance stack values choose the lighter load. Manual set weights remain unchanged until you choose Apply suggested loads.</p><h3>Your 1RM library</h3><p class="muted">Values entered on planned exercises appear here. Missing values remain zero and never inherit Tim or Hannah’s lifting numbers.</p><div class="planner-form-grid">${Object.entries(plan.oneRepMaxes).map(([name, value]) => numeric(esc(name), value, `data-one-rm="${esc(name)}"`, 10000)).join('') || '<p>No 1RM values entered yet.</p>'}</div><div class="planner-sticky-actions">${button('Back to plan', 'planner-open', '', 'primary')}${button('Save plan settings', 'planner-save')}</div>`);
    }

    function customProfile() {
        if (!plan.activeProfileId.startsWith('custom_')) {
            const original = plan.intensityProfiles[plan.activeProfileId];
            const id = plannerId('custom'); plan.intensityProfiles[id] = { ...clone(original), id, name: `${original.name} · custom` }; plan.activeProfileId = id;
            const select = ownDialog()?.querySelector('[data-profile-select]');
            if (select) { const option = document.createElement('option'); option.value = id; option.textContent = plan.intensityProfiles[id].name; select.append(option); select.value = id; }
        }
    }

    function renderCopy() {
        mode = 'copy';
        show('Copy a planned day or week', `<p>Copy week ${week + 1}, ${esc(currentDay().title)}, or the whole week. Destination exercises are replaced; copied completion checkboxes reset.</p><div class="planner-form-grid"><label>Destination week<select id="planner-copy-week">${options(plan.weeks.map((w, wi) => [wi, w.title]), (week + 1) % 4)}</select></label><label>Destination day<select id="planner-copy-day">${options(DAY_NAMES.map((d, di) => [di, d]), day)}</select></label></div><div class="button-row">${button('Copy day', 'planner-copy-day', '', 'primary')}${button('Copy whole week', 'planner-copy-week')}${button('Back to plan', 'planner-open')}</div>`);
    }

    function renderImport(kind = 'templates') {
        mode = 'import';
        show(kind === 'plan' ? 'Import a four-week plan' : 'Import workout templates', `<form id="planner-import-form" data-kind="${kind}"><p>${kind === 'plan' ? 'Accepts an exported v7 plan or original v6 fitnessPlan. Your current plan is archived before replacement.' : 'Accepts v7 template exports and v6 workoutTemplates. Imported routines receive new IDs, so existing routines remain intact.'}</p><label>Choose a JSON file<input type="file" accept="application/json,.json" data-planner-import-file></label><label>Or paste JSON<textarea name="json" rows="9" maxlength="8388608" required placeholder="Paste your exported JSON here…"></textarea></label><div class="button-row"><button class="button primary" type="submit">Import ${kind === 'plan' ? 'plan' : 'templates'}</button>${button('Back', kind === 'plan' ? 'planner-open' : 'template-library')}</div></form>`);
    }

    function download(name, text) {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; document.body.append(anchor); anchor.click(); anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function editEntries(context) { return context === 'template' ? template.entries : currentDay().entries; }

    async function handleAction(action, element) {
        if (!action?.startsWith('planner-') && !action?.startsWith('template-')) return false;
        if (busy) return true;
        if (action === 'planner-close') { requestClose(); return true; }
        busy = true;
        try {
            const id = element?.dataset.id, context = element?.dataset.context, index = Number(element?.dataset.entry), setIndex = Number(element?.dataset.set);
            const entries = context ? editEntries(context) : null;
            switch (action) {
            case 'planner-close': requestClose(); break;
            case 'planner-cancel-discard': mode = previousMode; pending = null; rerender(); break;
            case 'planner-confirm-discard': { const next = pending; pending = null; next?.(); break; }
            case 'template-library': targetDay = false; openTemplates(); break;
            case 'template-create': startTemplate(); break;
            case 'template-edit': startTemplate(library().find(t => t.id === id)); break;
            case 'template-duplicate': startTemplate(library().find(t => t.id === id), true); break;
            case 'template-rename': startTemplate(library().find(t => t.id === id)); ownDialog()?.querySelector('[data-tfield="name"]')?.select(); break;
            case 'template-save-new': await saveTemplate(true); break;
            case 'template-use': {
                const routine = library().find(t => t.id === id); if (!routine) throw Error('Template not found.');
                if (targetDay) { currentDay().entries.push(...clone(routine.entries).map(e => ({ ...e, id: plannerId('entry'), completed: false }))); currentDay().templateId = routine.id; targetDay = false; mode = 'plan'; renderPlan(); }
                else { if (planDirty() && !await savePlan()) break; const loaded = await host.loadWorkout(workoutFromDay({ entries: routine.entries }), routine.name.replaceAll('_', ' ')); if (loaded === true) { mode = ''; template = null; plan = null; } }
                break;
            }
            case 'template-delete': {
                const routine = library().find(t => t.id === id); if (!routine || routine.builtIn) throw Error('Built-in routines stay available.');
                const refs = scheduledReferences(state(), id); mode = 'delete';
                show('Delete this template?', `<p>Delete “${esc(routine.name)}” from your custom library?</p>${refs.length ? `<p class="planner-notice">Used by ${refs.length} scheduled days. Four-week day copies remain usable; old weekly links will be cleared.</p><ul>${refs.map(ref => `<li>${esc(ref)}</li>`).join('')}</ul>` : '<p>Completed workouts and existing drafts remain unchanged.</p>'}<div class="button-row">${button('Keep template', 'template-library', '', 'primary')}${button('Delete template', 'template-confirm-delete', `data-id="${esc(id)}"`, 'danger')}</div>`); break;
            }
            case 'template-confirm-delete': {
                const before = clone(state());
                Object.values(state().characters || {}).forEach(c => { Object.entries(c.plan || {}).forEach(([d, value]) => { if (value === id) c.plan[d] = ''; }); });
                if (await persistTemplates((state().templates || []).filter(t => t.id !== id), 'Template removed. Planned exercise copies are retained.')) renderLibrary();
                else Object.values(state().characters || {}).forEach(c => { if (before.characters[c.id]) c.plan = before.characters[c.id].plan; });
                break;
            }
            case 'template-export': { const t = library().find(t => t.id === id); download('dbz-workout-template.json', exportTemplates([t])); break; }
            case 'template-export-all': download('dbz-workout-templates.json', exportTemplates(state().templates || [])); break;
            case 'template-import': renderImport(); break;
            case 'planner-open': openPlan(); break;
            case 'planner-week': week = Number(element.dataset.index); renderPlan(); break;
            case 'planner-day': day = Number(element.dataset.index); renderPlan(); break;
            case 'planner-settings': renderSettings(); break;
            case 'planner-save': await savePlan(); break;
            case 'planner-save-preset': {
                if ((plan.customPresets || []).length >= 100) throw Error('The planner supports 100 reusable custom presets. Export a plan to keep an additional copy.');
                mode = 'preset-name';
                show('Save a reusable plan preset', `<form id="planner-preset-form">${field('Preset name', `${plan.name} preset`, 'name="presetName" required maxlength="160"')}<p>This saves a separate four-week schedule. Completion checkboxes reset when you load a preset; personal 1RM values are kept in your active plan.</p><div class="button-row"><button type="submit" class="button primary">Save reusable preset</button>${button('Back to plan', 'planner-open')}</div></form>`); break;
            }
            case 'planner-preset': {
                const presetId = ownDialog().querySelector('#planner-preset').value;
                previousMode = mode; mode = 'confirm-preset'; pending = () => { plan = applyPreset(plan, presetId); mode = 'plan'; renderPlan(); };
                show('Replace the four-week schedule?', `<p>This replaces the editable weeks with the selected preset. Your current plan is retained in the originals archive. Personal 1RM and equipment settings stay in place.</p><div class="button-row">${button('Keep current plan', 'planner-open', '', 'primary')}${button('Load preset', 'planner-confirm-discard')}</div>`); break;
            }
            case 'planner-day-template': targetDay = true; query = ''; template = null; renderLibrary(); break;
            case 'planner-day-save-template': startTemplate({ id: plannerId(), name: `${plan.name} · ${currentDay().title}`, entries: clone(currentDay().entries), notes: currentDay().notes }); templateBaseline = ''; updateDirty(); break;
            case 'planner-complete-all': currentDay().entries.forEach(e => { e.completed = true; }); renderPlan(); break;
            case 'planner-clear-completed': currentDay().entries.forEach(e => { e.completed = false; }); renderPlan(); break;
            case 'planner-load': { const entriesToLoad = workoutFromDay(currentDay(), element.dataset.load); if (await savePlan() && await host.loadWorkout(entriesToLoad, `${plan.name} · week ${week + 1} · ${currentDay().title}`) === true) { mode = ''; plan = null; template = null; } break; }
            case 'planner-copy': renderCopy(); break;
            case 'planner-copy-day': case 'planner-copy-week': {
                const wi = Number(ownDialog().querySelector('#planner-copy-week').value), di = Number(ownDialog().querySelector('#planner-copy-day').value);
                if (wi === week && (action === 'planner-copy-week' || di === day)) throw Error('Choose a different destination.');
                const apply = () => { plan = action === 'planner-copy-week' ? copyWeek(plan, week, wi) : copyDay(plan, week, day, wi, di); week = wi; if (action === 'planner-copy-day') day = di; mode = 'plan'; renderPlan(); };
                mode = 'confirm-copy'; pending = apply;
                show('Replace the destination?', `<p>Replace ${action === 'planner-copy-week' ? `week ${wi + 1}` : `week ${wi + 1}, ${DAY_NAMES[di]}`} with a separate copy? Completed checkboxes reset in the copy.</p><div class="button-row">${button('Keep destination', 'planner-copy', '', 'primary')}${button('Replace with copy', 'planner-confirm-discard')}</div>`); break;
            }
            case 'planner-custom-profile': { const p = plan.intensityProfiles[plan.activeProfileId], id = plannerId('custom'); plan.intensityProfiles[id] = { ...clone(p), id, name: `${p.name} copy` }; plan.activeProfileId = id; renderSettings(); break; }
            case 'planner-export': download('dbz-four-week-plan.json', JSON.stringify({ format: 'dbz-fitness-plan', version: 7, fitnessPlan: plan }, null, 2)); break;
            case 'planner-export-originals': download('dbz-original-plans.json', JSON.stringify(plan.sourceArchive, null, 2)); break;
            case 'planner-import': renderImport('plan'); break;
            case 'planner-entry-add': { if (entries.length >= 100) throw Error('A routine supports at most 100 exercises.'); const exerciseId = ownDialog().querySelector(`#${context}-add-exercise`).value; const entry = defaultEntry(exerciseId); if (context === 'template') entry.restSeconds = template.restSeconds; entries.push(entry); rerender(); break; }
            case 'planner-entry-remove': entries.splice(index, 1); rerender(); break;
            case 'planner-entry-duplicate': if (entries.length >= 100) throw Error('A routine supports at most 100 exercises.'); entries.splice(index + 1, 0, { ...clone(entries[index]), id: plannerId('entry'), completed: false }); rerender(); break;
            case 'planner-entry-up': if (index > 0) [entries[index - 1], entries[index]] = [entries[index], entries[index - 1]]; rerender(); break;
            case 'planner-entry-down': if (index < entries.length - 1) [entries[index + 1], entries[index]] = [entries[index], entries[index + 1]]; rerender(); break;
            case 'planner-set-add': if (entries[index].sets.length >= 100) throw Error('An exercise supports at most 100 sets.'); entries[index].sets.push(clone(entries[index].sets.at(-1) || { reps: 10, seconds: 60, weight: 0, manualWeight: true })); rerender(); break;
            case 'planner-set-remove': entries[index].sets.splice(setIndex, 1); rerender(); break;
            case 'planner-calculate-entry': currentDay().entries[index] = calculateEntry(entries[index], plan, true); renderPlan(); break;
            default: return false;
            }
            return true;
        } finally { busy = false; }
    }

    function handleInput(event) {
        const el = event.target; if (!el.closest?.('.planner-workspace')) return false;
        if (el.matches('[data-planner-search]')) { query = el.value; ownDialog().querySelector('[data-planner-results]').innerHTML = libraryRows(); return true; }
        if (el.dataset.tfield) { template[el.dataset.tfield] = el.type === 'number' ? number(el.value) : el.value; updateDirty(); return true; }
        if (el.dataset.pfield) { plan[el.dataset.pfield] = el.value; updateDirty(); return true; }
        if (el.dataset.dfield) { currentDay()[el.dataset.dfield] = el.value; updateDirty(); return true; }
        if (el.dataset.sfield) {
            const entry = editEntries(el.dataset.context)[Number(el.dataset.entry)], set = entry.sets[Number(el.dataset.set)];
            set[el.dataset.sfield] = number(el.value); if (el.dataset.sfield === 'weight') set.manualWeight = true;
            updateTargets(entry, Number(el.dataset.entry), el.dataset.context); updateDirty(); return true;
        }
        if (el.dataset.efield) {
            const entries = editEntries(el.dataset.context), index = Number(el.dataset.entry), entry = entries[index], key = el.dataset.efield;
            if (key === 'exerciseId') {
                if (event.type !== 'change') return true;
                const ex = CATALOG.exercises.find(e => e.id === el.value); if (!ex) return true;
                const replacement = entry.type === ex.type ? { ...entry, exerciseId: ex.id, name: ex.name, unresolved: false } : { ...defaultEntry(ex), notes: entry.notes, restSeconds: entry.restSeconds, selected: entry.selected, completed: entry.completed };
                replacement.originalExerciseName = entry.originalExerciseName || entry.name; entries[index] = replacement; rerender(); return true;
            }
            if (key === 'oneRepMax') plan.oneRepMaxes[entry.name] = number(el.value);
            else entry[key] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? number(el.value) : el.value;
            if (key === 'equipmentId') plan.exerciseEquipment[entry.name] = el.value;
            updateTargets(entry, index, el.dataset.context); updateDirty(); return true;
        }
        if (el.hasAttribute('data-profile-select')) { if (event.type === 'change') { plan.activeProfileId = el.value; renderSettings(); } return true; }
        if (el.dataset.profileReps) { customProfile(); plan.intensityProfiles[plan.activeProfileId].percentages[el.dataset.profileReps] = Math.max(.01, Math.min(1.5, number(el.value) / 100)); updateDirty(); return true; }
        if (el.dataset.equipment) { plan.equipmentProfiles[el.dataset.equipment][el.dataset.equipmentField] = el.type === 'number' ? number(el.value) : el.value; updateDirty(); return true; }
        if (el.dataset.oneRm) { plan.oneRepMaxes[el.dataset.oneRm] = number(el.value); updateDirty(); return true; }
        return false;
    }

    function updateTargets(entry, index, context) {
        if (context !== 'plan') return;
        const calculated = calculateEntry(entry, plan);
        calculated.sets.forEach((set, si) => { const el = ownDialog()?.querySelector(`[data-target="${index}-${si}"]`); if (el) el.textContent = set.targetWeight > 0 ? `Suggested ${set.targetWeight} kg · ${Math.round(repPercentage(plan, set.reps) * 100)}%${entry.sets[si].manualWeight ? ' · manual load' : ''}` : 'Enter your 1RM to calculate a suggestion'; });
    }

    async function handleChange(event) {
        const el = event.target;
        if (el.matches?.('[data-planner-import-file]')) {
            const file = el.files?.[0]; if (file) { if (file.size > 8 * 1024 * 1024) throw Error('Choose a JSON file smaller than 8 MB.'); el.closest('form').querySelector('textarea[name="json"]').value = await file.text(); } return true;
        }
        return handleInput(event);
    }

    async function handleSubmit(event) {
        const form = event.target;
        if (!['template-editor-form', 'planner-editor-form', 'planner-import-form', 'planner-preset-form'].includes(form.id)) return false;
        event.preventDefault(); if (busy) return true; busy = true;
        try {
            if (form.id === 'template-editor-form') await saveTemplate();
            if (form.id === 'planner-editor-form') await savePlan();
            if (form.id === 'planner-preset-form') {
                const name = String(new FormData(form).get('presetName') || '').trim().slice(0, 160);
                if (!name) throw Error('Give the preset a name.');
                const weeks = clone(plan.weeks); weeks.forEach(w => w.days.forEach(d => { d.status = d.status === 'completed' ? 'planned' : d.status; d.entries.forEach(e => { e.completed = false; }); }));
                plan.customPresets ||= []; plan.customPresets.push({ id: plannerId('preset'), name, activeProfileId: plan.activeProfileId, intensityProfiles: clone(plan.intensityProfiles), weeks, builtIn: false });
                if (await savePlan()) renderPlan();
            }
            if (form.id === 'planner-import-form') {
                const text = new FormData(form).get('json');
                if (form.dataset.kind === 'plan') {
                    plan = importPlan(text, plan, { templates: library(), schedule: character().plan }); renderPlan(); host.notify('Plan imported into the editor. Review it, then Save plan.');
                } else { const rows = importTemplates(text, state().templates || []); if (await persistTemplates([...(state().templates || []), ...rows], `${rows.length} templates imported as separate copies.`)) renderLibrary(); }
            }
            return true;
        } finally { busy = false; }
    }

    return { openTemplates, openPlan, saveDraftAsTemplate, handleAction, handleInput, handleChange, handleSubmit, requestClose, canClose: () => !ownDialog() || !isDirty(), isActive: () => !!ownDialog() };
}
