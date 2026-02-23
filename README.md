# ignite

**Project creation pipeline for Claude Code**: idea → PRD → interactive mockups → design system → CLAUDE.md → GSD handoff.

## What is ignite?

ignite is a Claude Code plugin that provides a complete workflow for going from a project idea to a fully planned, design-system-equipped codebase ready for implementation with [GSD](https://github.com/joshuarileydev/gsd).

## The Pipeline

```
/ignite:prd → /ignite:mockup → [annotate] → /ignite:review
  → /ignite:design → [annotate] → /ignite:design --refine
  → /ignite:design --apply → [annotate] → /ignite:review
  → /ignite:bootstrap → /gsd:plan-phase 1
```

## Commands

| Command | What it does |
|---------|-------------|
| `/ignite:prd` | Generate PRD from idea via interactive Q&A |
| `/ignite:mockup` | Generate mid-fi HTML mockups from PRD with annotation overlay |
| `/ignite:review` | Process annotation feedback, update mockups/design + sync PRD |
| `/ignite:design` | Create design system with style direction selection |
| `/ignite:design --refine` | Refine selected direction into tokens.css |
| `/ignite:design --apply` | Apply design tokens to mockups |
| `/ignite:bootstrap` | Generate CLAUDE.md + GSD planning files |

## How It Works

### 1. PRD Generation (`/ignite:prd`)
Answer questions about your project idea. ignite generates a structured PRD with features, workflows, technical constraints, and success criteria.

### 2. Mockup Generation (`/ignite:mockup`)
Generates self-contained HTML mockups (one per screen) with:
- Tailwind CSS for layout
- CSS custom properties for design tokens (enables later reskinning)
- Working navigation between screens
- Real sample data
- Annotation overlay for feedback

### 3. Feedback Loop (`/ignite:review`)
Open mockups in your browser, click elements or draw rectangles to annotate. Then `/ignite:review` processes your feedback in batches — triaging, classifying impact, and syncing changes to both HTML and PRD.

### 4. Design System (`/ignite:design`)
Generates 3 distinct style directions. Annotate your preferences, then `--refine` merges them into `tokens.css`. `--apply` reskins all mockups using the design tokens without touching HTML structure.

### 5. GSD Bootstrap (`/ignite:bootstrap`)
Maps PRD sections to GSD-compatible planning files:
- `CLAUDE.md` — project context for Claude
- `.planning/PROJECT.md` — project overview
- `.planning/REQUIREMENTS.md` — categorized requirements with CAT-NN IDs
- `.planning/ROADMAP.md` — phased implementation plan
- `.planning/config.json` — GSD configuration

## Installation

Add to your Claude Code `installed_plugins.json`:

```json
"ignite@local": [{
  "scope": "user",
  "installPath": "/path/to/ignite-plugin",
  "version": "0.1.0",
  "installedAt": "2026-02-22T00:00:00.000Z",
  "lastUpdated": "2026-02-22T00:00:00.000Z",
  "gitCommitSha": "0000000000000000000000000000000000000000"
}]
```

Enable in `settings.json`:
```json
"enabledPlugins": {
  "ignite@local": true
}
```

## Requirements

- Claude Code
- Node.js (for feedback server — zero npm dependencies)
- A browser (for viewing and annotating mockups)

## License

MIT
