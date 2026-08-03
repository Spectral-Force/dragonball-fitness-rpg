import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    analyzeStoryContent,
    buildStoryContentReport
} from '../analysis/v6_story_content_report.mjs';

const report = await buildStoryContentReport();

test('production story content passes the complete audit', () => {
    assert.equal(report.valid, true, report.errors.join('\n'));
    assert.deepEqual(report.errors, []);
});

test('all 38 configured sagas contribute exactly 278 beats', () => {
    assert.equal(report.counts.sagas, 38);
    assert.equal(report.counts.sagaBeats, 278);
    assert.deepEqual(report.counts.seriesBeats, {
        DB: 63,
        DBZ: 126,
        DAIMA: 23,
        DBS: 66
    });
});

test('character and relationship story libraries meet their minimum depth', () => {
    assert.ok(report.counts.characterArcs >= 20);
    assert.ok(report.counts.completeCharacterArcs >= 20);
    assert.ok(report.counts.coreCharacterArcs >= 20);
    assert.equal(report.counts.characterBeats, report.counts.characterArcs * 5);
    assert.ok(report.counts.relationshipPacks >= 20);
    assert.ok(report.counts.completeRelationshipPacks >= 20);
    assert.equal(report.counts.relationshipBeats, report.counts.relationshipPacks * 2);
});

test('runtime roster extraction and character-pack resolution are active', () => {
    assert.ok(report.counts.runtimeRosterIds >= 20);
    assert.ok(report.counts.sagaCharacterReferences >= 20);
    assert.ok(report.counts.resolvableSagaCharacterReferences >= 20);
});

test('continuity and narrative word-count distributions are reported', () => {
    assert.ok(Object.keys(report.continuity.sagas).length >= 1);
    assert.ok(Object.keys(report.continuity.characters).length >= 1);
    assert.ok(Object.keys(report.continuity.relationships).length >= 1);
    for (const field of ['canonText', 'characterText', 'playerReflection', 'trainingText']) {
        assert.ok(report.wordCounts[field]?.count > 0, field);
        assert.ok(report.wordCounts[field].min > 0, field);
        assert.ok(report.wordCounts[field].max >= report.wordCounts[field].min, field);
    }
});

test('the audit detects duplicate IDs, ratio-bearing resolutions, placeholder prose, and HTML', async () => {
    const corrupted = structuredClone(globalThis.DBZ_V6_STORY_DATA);
    const firstSaga = corrupted.sagas[Object.keys(corrupted.sagas)[0]];
    firstSaga.entries[1].id = firstSaga.entries[0].id;
    firstSaga.entries.at(-2).focusRatio = 0.95;
    firstSaga.entries[0].canonText = '<b>Placeholder text</b>';
    const runtimeSource = await readFile(new URL('../dbz-v6.js', import.meta.url), 'utf8');
    const corruptedReport = analyzeStoryContent({
        data: corrupted,
        config: globalThis.DBZ_V6_CONFIG,
        core: globalThis.DBZ_V6_STORY_CORE,
        runtimeSource
    });
    assert.equal(corruptedReport.valid, false);
    assert.ok(corruptedReport.errors.some(error => error.includes('Duplicate production ID')));
    assert.ok(corruptedReport.errors.some(error => error.includes('must be ratio-free')));
    assert.ok(corruptedReport.errors.some(error => error.includes('fallback/placeholder')));
    assert.ok(corruptedReport.errors.some(error => error.includes('contains HTML')));
});

test('report CLI emits one compact JSON line and exits nonzero on load errors', () => {
    const reportPath = fileURLToPath(new URL('../analysis/v6_story_content_report.mjs', import.meta.url));
    const missingRoot = fileURLToPath(new URL('../analysis/not-a-story-root', import.meta.url));
    const result = spawnSync(process.execPath, [reportPath, missingRoot], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stderr, '');
    assert.equal(result.stdout.trim().split(/\r?\n/u).length, 1);
    const failedReport = JSON.parse(result.stdout);
    assert.equal(failedReport.valid, false);
    assert.ok(failedReport.errors.length > 0);
});
