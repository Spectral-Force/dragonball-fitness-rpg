import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function entry(id, order, phase, focusRatio) {
    return {
        id, order, phase, ...(focusRatio === undefined ? {} : { focusRatio }),
        title: `${id} title`, canonText: `${id} canon.`, characterText: `${id} character.`,
        playerReflection: `${id} reflection?`, characters: ['hero'], tags: ['test']
    };
}

function runtime() {
    const context = vm.createContext({
        console,
        Date,
        Object,
        Array,
        Set,
        Map,
        Number,
        String,
        Math,
        JSON,
        RegExp,
        document: { getElementById: () => null }
    });
    context.globalThis = context;
    context.DBZ_V6_PROGRESSION_CONFIG = {
        sagas: [
            { id: 'db_pilaf', focusClearXP: 100 },
            { id: 'other_saga', focusClearXP: 100 }
        ]
    };
    context.DBZ_V6_STORY_DATA = {
        version: '6.4.0',
        sagas: {
            db_pilaf: {
                id: 'db_pilaf', title: 'Pilaf', series: 'DB', continuity: 'canon_core', sourceNote: 'Test',
                entries: [
                    entry('db_pilaf_story_01', 1, 'entry', 0),
                    entry('db_pilaf_story_02', 2, 'development', 0.5),
                    entry('db_pilaf_story_03', 3, 'resolution'),
                    entry('db_pilaf_story_04', 4, 'mastery')
                ]
            },
            other_saga: {
                id: 'other_saga', title: 'Other', series: 'DB', continuity: 'canon_core', sourceNote: 'Test',
                entries: [entry('other_story_01', 1, 'entry', 0), entry('other_story_02', 2, 'resolution'), entry('other_story_03', 3, 'mastery')]
            }
        },
        characters: {
            hero: {
                id: 'hero', partnerId: 'hero', name: 'Hero', title: 'Hero Arc',
                beats: [{
                    id: 'hero_arc_01', order: 1, phase: 'introduction', title: 'A Hero',
                    canonText: 'Canon.', characterText: 'Character.', playerReflection: 'Reflect.',
                    unlock: { partner: { id: 'hero', owned: true, level: 10 }, saga: { id: 'db_pilaf', status: 'cleared' } },
                    tags: ['hero']
                }]
            }
        },
        relationships: {
            hero_mentor: {
                id: 'hero_mentor', title: 'Hero and Mentor', partnerIds: ['hero', 'mentor'],
                beats: [{
                    id: 'hero_mentor_01', order: 1, phase: 'training_interlude', title: 'Shared Drill',
                    trainingText: 'They train.', characterText: 'They listen.', playerReflection: 'Who helps?',
                    unlock: {
                        partners: [{ id: 'hero', owned: true, level: 10 }, { id: 'mentor', owned: true, level: 10 }],
                        saga: { id: 'db_pilaf', status: 'cleared' }
                    }, tags: ['hero', 'mentor']
                }]
            }
        }
    };
    vm.runInContext(fs.readFileSync(path.join(root, 'dbz-v6-story-core.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(root, 'dbz-v6-story-ui.js'), 'utf8'), context);
    return context;
}

function character(status = 'locked', focusXP = 0) {
    return {
        sagaProgress: {
            db_pilaf: { status, focusXP },
            other_saga: { status: 'locked', focusXP: 0 }
        },
        completedSagas: status === 'cleared' || status === 'mastered' ? ['db_pilaf'] : [],
        ownedPartners: [],
        partnerLevels: {}
    };
}

test('sync never reveals locked, uncleared resolution, or unmastered mastery beats', () => {
    const context = runtime();
    const char = character('locked', 100);
    context.DBZ_V6_STORY_UI.syncStoryUnlocks(char);
    assert.equal(Object.keys(char.storyLog.entries).length, 0);

    char.sagaProgress.db_pilaf.status = 'unlocked';
    char.sagaProgress.db_pilaf.focusXP = 50;
    context.DBZ_V6_STORY_UI.syncStoryUnlocks(char);
    assert.deepEqual(Object.keys(char.storyLog.entries).sort(), ['db_pilaf_story_01', 'db_pilaf_story_02']);

    char.sagaProgress.db_pilaf.focusXP = 100;
    context.DBZ_V6_STORY_UI.syncStoryUnlocks(char);
    assert.equal(char.storyLog.entries.db_pilaf_story_03, undefined);
    assert.equal(char.storyLog.entries.db_pilaf_story_04, undefined);

    char.sagaProgress.db_pilaf.status = 'cleared';
    context.DBZ_V6_STORY_UI.syncStoryUnlocks(char);
    assert.equal(char.storyLog.entries.db_pilaf_story_03.unlocked, true);
    assert.equal(char.storyLog.entries.db_pilaf_story_04, undefined);
});

test('latest dashboard story is exact-saga and never borrows another saga', () => {
    const context = runtime();
    const char = character('locked', 0);
    char.sagaProgress.other_saga.status = 'unlocked';
    context.DBZ_V6_STORY_UI.syncStoryUnlocks(char);
    const text = context.DBZ_V6_STORY_UI.latestSagaText(char, { id: 'db_pilaf', name: 'Pilaf' });
    assert.match(text, /has not revealed a chapter yet/);
    assert.doesNotMatch(text, /other_story/);
});

test('legacy prose is compacted and partner milestones move to Training Journal', () => {
    const context = runtime();
    const char = character('cleared', 100);
    char.ownedPartners = ['hero'];
    char.partnerLevels = { hero: { level: 10 } };
    char.storyLog = {
        unlockedEntries: {
            db_pilaf_ep001: { id: 'db_pilaf_ep001', title: 'Old', text: ['duplicated prose'], unlockedAt: '2026-01-01T00:00:00.000Z' },
            hero_milestone_story_20: { id: 'hero_milestone_story_20', text: ['generated prose'], unlockedAt: '2026-01-02T00:00:00.000Z' },
            hero_story_unlock_0: { id: 'hero_story_unlock_0', text: ['old character prose'], unlockedAt: '2026-01-03T00:00:00.000Z' },
            pl_1_million_story: { id: 'pl_1_million_story', text: ['old global prose'], unlockedAt: '2026-01-04T00:00:00.000Z' }
        },
        readEntries: { db_pilaf_ep001: true, hero_story_unlock_0: true, pl_1_million_story: true },
        lastUnlockedEntryIds: ['pl_1_million_story', 'hero_story_unlock_0', 'hero_milestone_story_20', 'db_pilaf_ep001']
    };
    context.DBZ_V6_STORY_UI.syncStoryUnlocks(char);
    assert.equal(char.storyLog.unlockedEntries, undefined);
    assert.equal(char.storyLog.readEntries, undefined);
    assert.equal(char.storyLog.entries.hero_milestone_story_20, undefined);
    assert.equal(char.partnerJournal.entries.hero_milestone_story_20.level, 20);
    assert.equal(char.storyLog.entries.db_pilaf_story_01.read, true);
    assert.equal(char.storyLog.entries.hero_story_unlock_0, undefined);
    assert.equal(char.storyLog.entries.hero_arc_01.read, true);
    assert.equal(context.DBZ_V6_STORY_UI.legacyCodexEntries(char)[0].id, 'pl_1_million_story');
    assert.equal(context.DBZ_V6_STORY_UI.legacyCodexEntries(char)[0].read, true);
    assert.equal(JSON.stringify(char.storyLog).includes('duplicated prose'), false);
});

test('character and relationship beats require owned, levelled partners and exact saga status', () => {
    const context = runtime();
    const char = character('cleared', 100);
    char.ownedPartners = ['hero', 'mentor'];
    char.partnerLevels = { hero: { level: 10 }, mentor: { level: 9 } };
    context.DBZ_V6_STORY_UI.syncStoryUnlocks(char);
    assert.equal(char.storyLog.entries.hero_arc_01.unlocked, true);
    assert.equal(char.storyLog.entries.hero_mentor_01, undefined);

    char.partnerLevels.mentor.level = 10;
    context.DBZ_V6_STORY_UI.syncStoryUnlocks(char);
    assert.equal(char.storyLog.entries.hero_mentor_01.unlocked, true);
});

test('read receipts and compact Training Journal recording are idempotent', () => {
    const context = runtime();
    const char = character('unlocked', 0);
    context.DBZ_V6_STORY_UI.syncStoryUnlocks(char);
    assert.equal(context.DBZ_V6_STORY_UI.markStoryEntryRead(char, 'db_pilaf_story_01'), true);
    const readAt = char.storyLog.entries.db_pilaf_story_01.readAt;
    context.DBZ_V6_STORY_UI.markStoryEntryRead(char, 'db_pilaf_story_01');
    assert.equal(char.storyLog.entries.db_pilaf_story_01.readAt, readAt);
    assert.equal(context.DBZ_V6_STORY_UI.recordPartnerMilestone(char, 'hero', { level: 20 }), true);
    assert.equal(context.DBZ_V6_STORY_UI.recordPartnerMilestone(char, 'hero', { level: 20 }), false);
    assert.equal(Object.keys(char.partnerJournal.entries).length, 1);
});
