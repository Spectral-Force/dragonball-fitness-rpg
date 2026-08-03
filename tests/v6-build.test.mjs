import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const html = read("DragonBall_Fitness_RPG_v6.0.html");
const game = read("dbz-v6.js");
const storage = read("dbz-v6-storage.js");
const serviceWorker = read("dbz-sw-v6.0.js");
const assetManifestSource = read("v6-asset-manifest.js");

test("v6 is a split canonical build without embedded base64 assets", () => {
    assert.ok(html.length < 100_000);
    assert.ok(game.length < 2_000_000);
    assert.doesNotMatch(html + game, /data:image\/[^;,]+;base64/i);
    assert.match(html, /dbz-v6-config\.js/);
    assert.match(html, /dbz-v6-progression-config\.js/);
    assert.match(html, /dbz-v6-progression-core\.js/);
    assert.match(html, /dbz-v6-story-db\.js/);
    assert.match(html, /dbz-v6-story-dbz\.js/);
    assert.match(html, /dbz-v6-story-super\.js/);
    assert.match(html, /dbz-v6-story-characters\.js/);
    assert.match(html, /dbz-v6-story-core\.js/);
    assert.match(html, /dbz-v6-story-ui\.js/);
    assert.match(html, /v6-asset-manifest\.js/);
    assert.match(html, /dbz-v6-storage\.js/);
    assert.match(html, /dbz-v6-enhancements\.js/);
    assert.match(html, /dbz-v6-race-ui\.js/);
});

test("mobile viewport, safe notifications and accessibility helpers are wired", () => {
    assert.match(html, /width=device-width/);
    assert.doesNotMatch(html + game, /\bmin-width:\s*880px/);
    assert.doesNotMatch(game, /\balert\(/);
    assert.match(read("dbz-v6-enhancements.js"), /role.*dialog|setAttribute\('role', 'dialog'\)/s);
    assert.match(read("dbz-v6-overrides.css"), /prefers-reduced-motion/);
    assert.match(game, /tabId === 'story'[\s\S]{0,80}window\.renderStoryCodex/);
    assert.match(read("dbz-v6-enhancements.js"), /\['story', 'Story Codex'\]/);
    assert.match(read("dbz-v6-overrides.css"), /\.modal\.active\s*\{[\s\S]*?z-index:\s*3000/);
});

test("persistence uses IndexedDB, snapshots and bounded import validation", () => {
    assert.match(storage, /indexedDB\.open/);
    assert.match(storage, /snapshot:/);
    assert.match(storage, /MAX_IMPORT_BYTES = 10 \* 1024 \* 1024/);
    assert.match(storage, /validateImportedSave/);
    assert.match(storage, /preservePreMigrationSnapshot/);
    assert.match(game, /await window\.DBZV6Storage\.preservePreMigrationSnapshot\(loaded, SAVE_SCHEMA_VERSION\)/);
});

test("PWA shell references real v6 files", () => {
    const expected = [
        "DragonBall_Fitness_RPG_v6.0.html",
        "manifest-v6.webmanifest",
        "dbz-v6.css",
        "dbz-v6.js",
        "dbz-v6-enhancements.js",
        "dbz-v6-progression-config.js",
        "dbz-v6-progression-core.js",
        "dbz-v6-race-ui.js",
        "dbz-v6-story.css",
        "dbz-v6-story-db.js",
        "dbz-v6-story-dbz.js",
        "dbz-v6-story-super.js",
        "dbz-v6-story-characters.js",
        "dbz-v6-story-core.js",
        "dbz-v6-story-ui.js",
        "v6-asset-manifest.js",
        "images/v6/v6_hero.webp",
        "images/v6/race_route_backdrop.webp"
    ];
    expected.forEach(relative => {
        assert.ok(fs.existsSync(path.join(root, relative)), `${relative} is missing`);
        assert.match(serviceWorker, new RegExp(relative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
    assert.doesNotMatch(serviceWorker, /DragonBall\.svg|index\.html/);
    assert.match(serviceWorker, /caches\.match\(request, \{ ignoreSearch: true \}\)/);
});

test("every versioned local stylesheet and script has an offline shell cache key", () => {
    const versionedAssets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))\?v=[^"]+"/g)]
        .map(match => match[1]);
    assert.ok(versionedAssets.length >= 10, "expected the generated shell to use versioned assets");
    versionedAssets.forEach(relative => {
        const escaped = relative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        assert.match(serviceWorker, new RegExp(`['"]\\./${escaped}['"]`), `${relative} is not in the offline shell`);
    });
    assert.match(serviceWorker, /caches\.match\(request, \{ ignoreSearch: true \}\)/);
});

test("release metadata stays synchronized across the generated shell and PWA", () => {
    const buildId = html.match(/name="dbz-build" content="([^"]+)"/)?.[1];
    const serviceWorkerBuild = serviceWorker.match(/const BUILD_ID = '([^']+)'/)?.[1];
    const releaseVersion = read("dbz-v6-config.js").match(/version:\s*'([^']+)'/)?.[1];
    const manifest = JSON.parse(read("manifest-v6.webmanifest"));
    const escapedBuildId = buildId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.ok(buildId);
    assert.equal(serviceWorkerBuild, buildId);
    assert.equal(manifest.name, `Dragon Ball Fitness RPG ${releaseVersion}`);
    assert.match(html, new RegExp(`serviceWorker\\.register\\('./dbz-sw-v6\\.0\\.js\\?v=${escapedBuildId}[^)]*updateViaCache`));
    assert.match(html, /controllerchange[\s\S]{0,120}location\.reload\(\)/);
    assert.match(game, new RegExp(`serviceWorker\\.register\\('./dbz-sw-v6\\.0\\.js\\?v=${escapedBuildId}[^)]*updateViaCache`));
    assert.ok(html.indexOf("serviceWorker.register('./dbz-sw-v6.0.js") < html.indexOf('dbz-v6-config.js'), "worker bootstrap must precede cached runtime assets");
});

test("v6 art uses hashed runtime assets and a coherent race portrait set", () => {
    const races = ["earthling", "saiyan", "half_saiyan", "namekian", "android", "frieza_race", "majin"];
    races.forEach(race => {
        const relative = `images/v6/races/${race}.webp`;
        assert.ok(fs.existsSync(path.join(root, relative)), `${relative} is missing`);
        assert.match(assetManifestSource, new RegExp(`${race}\\.webp\\?h=[a-f0-9]{12}`));
        assert.match(game, new RegExp(`images/v6/races/${race}\\.webp`));
    });
    assert.match(assetManifestSource, /race_route_backdrop\.webp\?h=[a-f0-9]{12}/);
    assert.match(read("dbz-v6-overrides.css"), /race_route_backdrop\.webp/);
    assert.match(game, /DBZ_V6_ASSETS/);
    assert.doesNotMatch(assetManifestSource, /optional_review|partners_review|client_email_files|_source\.png|contact_sheet/i);
    assert.match(read("dbz-v6-enhancements.js"), /abilityFamilies|v6-state-fx|v6SagaVisual|v6GoalSearch/);
    assert.match(read("dbz-v6-overrides.css"), /v6-scouter-scan|v6-dragon-orbit|prefers-reduced-motion|\.v5a-roster-row/);
});

test("three-year balance and race-equivalent routes are in runtime code", () => {
    assert.match(game, /basePowerTargetForWeek/);
    assert.match(game, /getRaceRoutePowerMultiplier/);
    assert.match(game, /DBZ_V6_PROGRESSION\.getRacePowerState/);
    assert.match(read("dbz-v6-progression-config.js"), /android_infinite|android_bio|Majin Body Evolution/);
    assert.doesNotMatch(game, /targetState \* Math\.min/);
    assert.match(game, /authoritativeV6State/);
});
