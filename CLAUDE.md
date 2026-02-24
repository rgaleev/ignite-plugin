# Ignite Plugin

Claude Code plugin for project creation: idea → PRD → mockups → design system → GSD handoff.

## Project Structure

- `skills/` — skill definitions (SKILL.md) and supporting files per command
  - `prd/` — PRD generation from idea via Q&A
  - `mockup/` — HTML mockup generation with feedback overlay (`feedback-overlay.js`, `feedback-server.js`)
  - `review/` — annotation feedback processing and PRD sync
  - `design/` — design system creation (options → tokens → apply)
  - `bootstrap/` — CLAUDE.md and GSD planning file generation
- `commands/` — command entry points (thin wrappers that invoke skills)
- `.claude-plugin/` — plugin metadata (`plugin.json`, `marketplace.json`)

## Key Files

- `skills/mockup/feedback-overlay.js` — browser-side IIFE injected into mockup HTML. Handles Preview/Feedback mode toggle, element/area annotation, popup-first creation flow, element detection in areas. Zero dependencies.
- `skills/mockup/feedback-server.js` — Node.js static file server with feedback JSON API. Zero npm dependencies.
- `skills/design/design-reference-template.html` — template for design option pages with placeholder tokens.

## Development Rules

### Version Bumping
**ALWAYS bump the version when making changes that affect plugin behavior.** Version must be updated in ALL 3 places:
1. `.claude-plugin/plugin.json` → `version`
2. `.claude-plugin/marketplace.json` → `metadata.version`
3. `.claude-plugin/marketplace.json` → `plugins[0].version`

Use semver: patch (0.x.Y) for fixes, minor (0.Y.0) for new features, major (Y.0.0) for breaking changes.

### Code Style
- `feedback-overlay.js` is a pure-browser IIFE — no build step, no dependencies, no ES modules
- CSS is injected via JavaScript template literals (no external stylesheets)
- All overlay DOM elements use `fb-` prefix for class names
- State is managed via module-scoped `let` variables inside the IIFE
- Feedback data is stored as `.feedback.json` files via the server API with localStorage fallback

### Testing
No automated test suite — this is a browser-based tool. Manual testing by opening mockup HTML files in browser and verifying overlay behavior.
