# v7 mobile deployment

- Release: `7.0.0-9ed6f21fa3b6`; schema 70.
- Installation shell: 5,238,694 bytes across 72 cache entries.
- Full workspace validation before publication: 303 tests passed.
- Browser integration: original v6 worker installed and cached; its existing registration upgraded to v7; the old launch URL opens v7 and maps the old training shortcut.
- Migration coverage: IndexedDB and local fallback, newest valid legacy selection, original-data preservation, retry after quota failure, corrupt-save protection, subsequent v7 progress and no repeated rewards.
- Update coverage: successful-save gating, pending edits, active dialogs, concurrent edits, hidden pages, first installation, later updates, offline operation and no reload loops.

Only runtime files, production WebP art, portable regression tests and two build/preview utilities are included in this release. Local saves, browser fixtures, QA screenshots and records, generation masters and source-art provenance remain outside this publication.
