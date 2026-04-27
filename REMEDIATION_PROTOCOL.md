# 🛡️ Axiom: Obsidian Submission Remediation Protocol

This document tracks the surgical fixes required to clear the [Obsidian Review Bot findings](file:///Users/surendran/Projects/second-brAIn/obsidian_review.md) and ensure production stability.

## 🚦 The Verification Standard
Before any phase is marked as complete, it must pass:
1. **Linter Check**: `npx eslint` confirms the specific rule violation count is ZERO.
2. **Build Check**: `npm run build` completes with no TypeScript errors.
3. **Functional Check**: The Axiom sidebar still renders and accepts inputs.

---

## 🟢 Phase 1: Security & UI Hardening (Bot Blockers)
**Status: COMPLETE**

- [x] **Sanitize DOM**: Replaced all `innerHTML` / `outerHTML` with `setText()` or `createEl()`.
- [x] **Theme Compliance**: Replaced all `element.style` direct assignments with CSS classes in `styles.css`.
- [x] **UI Polish**: Converted all Title Case strings to **Sentence case** for native Obsidian look.
- [x] **Settings API**: Replaced manual HTML headings in settings with `new Setting().setHeading()`.

**Verification**: Linter confirms 0 UI/Security errors.
**User Sign-off**: ✅ Surendran (Phase 1 verified)

---

## 🟢 Phase 2: Async & Architectural Hardening
**Status: COMPLETE** (2024-04-26)

- [x] **Promise Trace**: All floating promises in `main.ts`, `settings.ts`, and `TraceManager.ts` are resolved.
- [x] **Node.js Removal**: Purged `fs` and `path` from `YoutubeExtractor`; migrated to `vault.adapter`.
- [x] **Bug Fix**: Resolved `pathParts` runtime crash in `HierarchyChoiceModal.ts`.
- [x] **Type Hardening**: Replaced 100+ `any` instances with strict interfaces (`FullAnalysisResult`, `HierarchyAnalysisResult`).
- [x] **Branding**: Synchronized internal data paths to the `axiom` identifier.

**Verification**: `npm run build` succeeds; Linter confirms zero critical async leaks.
**User Sign-off**: ✅ Surendran (Phase 2 Hardening verified)

---

## 🟢 Phase 3: The "Axiom" Acceptance Test (COMPLETE)
*The ultimate verification of plugin integrity.*

1. **Clean Slate**: Clear the Activity Log.
2. **E2E Processing**: Paste a fresh YouTube or Article URL.
3. **Hierarchy Validation**: 
   - [x] Verify the note is generated in the correct folder.
   - [x] Verify the MOC (Map of Content) document is correctly updated with the new link.
   - [x] Verify no errors appear in the Obsidian Developer Console (Cmd+Opt+I).

**User Sign-off**: ✅ Surendran (Axiom functional verification)

---

## 🛠 Phase 4: Final Bot Compliance & Zero-Warning Audit
**Status: IN PROGRESS**

### 4.1 Async/Await & Promise Safety
- [ ] Audit all `async` methods; ensure every one contains an `await` or remove `async`.
- [ ] Fix any remaining floating promises in `main.ts` (e.g., `onunload`).
- [ ] Ensure `onunload` does NOT detach leaves (Review bot recommendation).

### 4.2 Strict UI String Normalization (Sentence Case)
- [ ] Sweep all UI strings; only the FIRST word should be capitalized (e.g., "AI Provider" -> "AI provider").
- [ ] Verify proper nouns (Gemini, OpenRouter, YouTube) remain capitalized.

### 4.3 Environment & Path Hardening
- [ ] Replace hardcoded `.obsidian` with `this.app.vault.configDir`.
- [ ] Replace `as TFile` with `instanceof TFile` type guards.

### 4.4 Cleanliness & Linter Perfection
- [ ] Purge `any` from `NoteProcessor.ts` and `HierarchyService.ts`.
- [ ] Remove redundant type assertions.
- [ ] Resolve all "unused" variable/import warnings.
- [ ] Fill or remove empty block statements.
