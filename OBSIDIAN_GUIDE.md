# Obsidian Plugin Development: Best Practices & Marketplace Standards

This guide serves as the definitive technical standard for the **brAIn** plugin refactor. All code changes must align with these principles to ensure stability, performance, and successful marketplace approval.

## 1. Lifecycle & Resource Management
- **`onload()`**: Initialize your services, register views, and add commands here. 
- **`onunload()`**: **CRITICAL.** Every event listener, interval, or observer must be cleaned up. Failure to do so leaks memory and impacts the entire Obsidian app.
- **Register Everything**: Use `this.registerEvent`, `this.registerInterval`, and `this.registerDomEvent`. Obsidian will automatically clean these up when your plugin is disabled.

## 2. API Usage Standards
- **Use `this.app`**: Never access `window.app`. Use the `app` instance provided by the `Plugin` class.
- **Vault API over Adapter**: Always prefer `this.app.vault` for file operations. It uses a caching layer and serializes operations to prevent race conditions.
- **Editor API**: Use `editor.replaceSelection()` or `editor.setLine()` for active note modifications. Avoid direct file writes to the active file if the user is currently editing it.
- **`requestUrl`**: Use Obsidian's `requestUrl` instead of `fetch`. It handles CORS issues and provides a more consistent experience across platforms.
- **MetadataCache**: Use `this.app.metadataCache` to retrieve information about files (tags, links, headings) without re-reading the entire file from disk.

## 3. UI/UX Principles
- **Native-First**: Use Obsidian's built-in components: `Setting`, `Modal`, `Notice`, `Menu`, and `ItemView`. 
- **CSS Variables**: Never use hardcoded colors. Use `--text-normal`, `--interactive-accent`, `--background-primary`, etc., to support all themes.
- **View Management**: Use `this.registerView` to register custom views. Never store static references to view instances; use `workspace.getLeavesOfType()` to find active views.
- **Asynchronous UI**: Never block the main thread. Perform heavy AI analysis or content extraction in the background and use `Notice` or status bar items to update the user.

## 4. Security & Compliance
- **No `eval()`**: The use of `eval()` or `new Function()` is strictly prohibited in the marketplace.
- **Remote Code**: Do not download or execute remote scripts. All logic must be contained within the plugin bundle.
- **Mobile Compatibility**: If using Node.js or Electron-specific modules (like `child_process`, `fs`, `crypto`), the `manifest.json` MUST have `"isDesktopOnly": true`.
- **Privacy**: Respect user data. Do not send vault content to external servers without explicit user intent and clear configuration.

## 5. Reliability & Performance
- **Atomic Operations**: Ensure file writes are atomic. Use `this.app.vault.process` for modifications.
- **Error Boundaries**: Wrap AI parsing and external process calls in robust try/catch blocks with user-facing error messages.
- **Minimal Dependencies**: Keep the bundle size small. Every added dependency increases the attack surface and potential for breakage.

## 6. GitHub & Deployment
- **Semantic Versioning**: Follow `x.y.z` format.
- **Manifest Sync**: Ensure `version` in `manifest.json` matches the GitHub release tag.
- **Binary Assets**: Releases must include `main.js`, `manifest.json`, and `styles.css`.
