# v7 mobile deployment

## iPhone layout and character-management update · 5 September 2026

- Current build: `7.0.0-7a9ad60094f1`.
- Adds device-provided safe-area spacing around the app, dialogs, navigation and notifications, with 48 px character controls. Portrait and landscape are supported without a hardcoded phone model size.
- Adds individual character deletion and Start fresh from the avatar and Settings. Typed confirmation and a required recovery snapshot precede removal. Fresh start optionally keeps templates and the current character’s training plan.
- Saves detached replacements only after draft flushing; preserves revision checks and valid empty v7 storage, so ordinary reopening does not reimport deleted legacy characters.
- Verified 291 automated tests. Browser tests used an isolated origin with a simulated 74 px portrait system area and 62/20 px landscape side insets. Avatar and close controls remained accessible, layouts did not overflow, deletion/reset survived reload, retained templates survived reset, and snapshot restoration worked from the empty-character screen.
- Layout design follows [WebKit’s safe-area guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/). Physical iPhone hardware was not available for these checks.

## Original v7 publication

- Release: `7.0.0-9ed6f21fa3b6`; schema 70.
- Installation shell: 5,238,694 bytes across 72 cache entries.
- Full workspace validation before publication: 303 tests passed.
- Browser integration: original v6 worker installed and cached; its existing registration upgraded to v7; the old launch URL opens v7 and maps the old training shortcut.
- Migration coverage: IndexedDB and local fallback, newest valid legacy selection, original-data preservation, retry after quota failure, corrupt-save protection, subsequent v7 progress and no repeated rewards.
- Update coverage: successful-save gating, pending edits, active dialogs, concurrent edits, hidden pages, first installation, later updates, offline operation and no reload loops.

Only runtime files, production WebP art, portable regression tests and two build/preview utilities are included in this release. Local saves, browser fixtures, QA screenshots and records, generation masters and source-art provenance remain outside this publication.
