# brAIn Refactor: Mission to the Marketplace 🚀

This board tracks the transformation of **brAIn** from a personal Python-based script into a world-class, native Obsidian plugin.

## 🎯 Global Success Criteria
1. **The Karpathy Standard**: Code must be surgical, simple, and self-documenting.
2. **Native-First**: Zero hardcoded styles; use Obsidian's CSS variables and UI classes.
3. **Zero Configuration**: No Python, no venv, no external dependencies for the user.
4. **Data Agency**: Users own their prompts and their organizational strategy.
5. **Mobile-Ready**: Full compatibility with Obsidian Mobile.

---

## 🗺️ Roadmap & Checklist

### Milestone 0: The Great Decoupling (Python Removal)
*Goal: Move all extraction logic to native TypeScript.*
*Protocol: Keep Python scripts until Milestone 0 is fully verified in Obsidian.*

- [x] **Task 0.1**: Add `@mozilla/readability` and `turndown` to `package.json`.
    - **Outcome**: `npm run build` succeeds, and the new dependencies are bundled into `main.js`.
- [x] **Task 0.2**: Implement `YoutubeExtractor.ts` (Native TS parsing).
    - **Outcome**: A YouTube video URL is summarized successfully without the plugin spawning any Python processes.
- [x] **Task 0.3**: Implement `WebExtractor.ts` (Native TS using Readability).
    - **Outcome**: A complex article URL is summarized with high-quality Markdown extraction, confirmed via manual verification in Obsidian.
- [x] **Task 0.4**: Update `ContentExtractor.ts` and UI to point to new native engines.
    - **Outcome**: All extraction types (YT/Web) work perfectly in the local Obsidian instance. 
- [x] **Task 0.5**: **The Purge**: Delete all `.py` files, `requirements.txt`, and `venv` references.
    - **Outcome**: The repository is 100% TypeScript/CSS and the plugin still works perfectly on a fresh install without Python.

### Milestone 1: Compliance & Hardening
*Goal: Fix lifecycle leaks and align with Obsidian Developer Policies.*

- [ ] **Task 1.1**: Update `manifest.json` (Set `isDesktopOnly: false`, bump `minAppVersion`).
    - **Outcome**: Plugin loads and functions in Obsidian 1.4.0+ without errors.
- [ ] **Task 1.2**: Implement `onunload()` in `main.ts` and all managers.
    - **Outcome**: Disabling the plugin stops all AI tasks and cleans all listeners; no "Zombie" processes detected in DevTools.
- [ ] **Task 1.3**: CSS Migration: Move all styles to `styles.css`.
    - **Outcome**: The UI renders perfectly in both Light and Dark modes without any programmatic `<style>` injection.
- [ ] **Task 1.4**: Event Registration: Refactor to `this.registerDomEvent` and `this.registerEvent`.
    - **Outcome**: Plugin passes a 10-cycle "Enable/Disable" stress test without crashing Obsidian.

### Milestone 2: UI/UX Refinement (The "Agentic" Standard)
*Goal: Empower the user with customization and transparency.*

- [ ] **Task 2.1**: Vault-Native Prompts: Allow overrides via `.brAIn/prompts/*.md`.
    - **Outcome**: User-created prompts in the vault are correctly detected and utilized by the AI.
- [ ] **Task 2.2**: Organization Strategies: Implement "Folders" vs "Tags" vs "Hybrid".
    - **Outcome**: User can toggle between organization styles and see the notes created in the expected locations/format.
- [ ] **Task 2.3**: Pre-flight Token Check: Show cost/length before analysis.
    - **Outcome**: The UI displays a transcript length warning before the LLM call is triggered.

### Milestone 3: Marketplace Readiness
*Goal: Final polish and submission audit.*

- [ ] **Task 3.1**: README Overhaul: Clear installation, usage, and "Why brAIn?" narrative.
- [ ] **Task 3.2**: Asset Check: Create high-quality icons and screenshots.
- [ ] **Task 3.3**: Final Build Audit: Run `npm run build` and verify `main.js` size/performance.

---

## 🛠️ Execution Protocol
1. **Atomic Step**: Work on exactly one `[ ]` task at a time.
2. **Branch First**: All refactoring must happen on a feature branch (Active: `feature/native-extraction`).
3. **Commit Protocol**: Commit at the end of every task using Conventional Commits.
4. **Build Check**: Run `npm run build` after every modification.
5. **Manual Verification**: I will wait for you to verify the feature in your Obsidian instance.
6. **Sign-off**: Check off the item ONLY after successful manual verification.
7. **No Early Deletion**: Python scripts remain in the codebase until Milestone 0 is fully verified as an **outcome**.
