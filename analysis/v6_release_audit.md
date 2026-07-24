# v6 Release Audit

Build: 6.0.0-20260724.10
Roadmap source: `v5_improvement_roadmap.md`

## Implemented

- Canonical split v6 source, build ID, README, changelog and preserved v5 release.
- Mobile viewport and responsive override layer from a 360 px baseline.
- Compact mobile navigation, Today-first core flow and no page-level completion dialogs.
- Correct v6 PWA shell, real assets, offline navigation fallback and versioned cache replacement.
- IndexedDB primary saves, transactional queue, three rolling snapshots, fallback, save status and deterministic startup.
- Bounded schema/import validation, escaped player/imported text and five-year-friendly history limits.
- Duplicate goal cleanup, display-name repair, race-adjusted Dragon Ball text, terminology/formatting repair and input Undo.
- Linear base PL, 156-week saga schedule, Daima order, transformation mastery, era caps and route-equivalent states.
- Seven competitive race routes, including Android/Majin absorption.
- Migration receipt and before/after v6 recalculation preview.
- No permanent inactivity decay; readiness, deload, illness/injury, RPE/RIR and weekly consistency.
- Search plus `content-visibility` card virtualization for the major collections, with a type-to-find benchmark-goal control.
- Accessible modal semantics, focus management, keyboard handling, touch targets and reduced motion.
- External disk assets, lazy loading, WebP hero art and removal of roughly 47.6 MB of embedded duplicates.
- Coherent original seven-race avatar set with v6-only paths, leaving v5 art untouched.
- Reviewed live partner set, normalized card crops, family-coded ability badges and reusable transformation effects.
- Original saga environmental overlays and reduced-motion-aware reward, scouter, capsule, Dragon Ball and rank effects.
- Generated SHA-256 image manifest; review sheets, source PNGs and email-page artifacts are excluded from runtime lookup.
- Automated configuration, balance, build, persistence and PWA static gates.

## Verified release gates

- Build regeneration and JavaScript syntax checks.
- Character creation and save restoration.
- Workout selection, preview and completion with non-blocking reward toast.
- Outlier constraints and Undo hook.
- Saga chronology and monotonic three-year target data.
- Seven-race route definitions and exploit ceiling.
- 360, 390, 768, 1280 and 1920 px overflow checks.
- Keyboard/dialog semantics and reduced-motion CSS.
- Manifest, shell resources and service-worker cache list.
- Live browser console free of errors during core flows.

## Deliberate implementation choices

- The live partner library uses the manually reviewed replacement set documented in `images/partners_review/partner_image_review_notes.md`. v6 keeps those reviewed images and normalizes their presentation rather than regenerating recognizable legacy cast portraits.
- Browser-level `content-visibility` is used instead of a custom virtual-list framework so search, keyboard focus and the inherited renderers remain reliable.
- Automated PWA checks validate shell contents and update logic. A device-specific install banner, storage eviction policy and OS background behavior still depend on the target browser.
- The balance model is deterministic and transparent. Real-player telemetry should be used for small v6.0.x tuning; it should not restore exponential raw-stat PL.
