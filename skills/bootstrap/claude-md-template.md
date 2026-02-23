# CLAUDE.md Template

## Structure

```
# [Project Name]

[1-2 sentence project description from PRD Vision]

## Quick Start
- Setup: [installation/setup commands]
- Dev: [development server command]
- Test: [test command]
- Build: [build command]

## Architecture
- **Stack**: [from PRD Technical Constraints]
- **Entry point**: [main file]
- **Key directories**:
  - `src/` — Application source
  - `docs/` — Documentation and design artifacts

## Code Style
- [Language-appropriate style rules]
- [Naming conventions]
- [Import ordering]

## Key Patterns
- [Architecture patterns from PRD]
- [Error handling approach from PRD NFRs]
- [Extensibility patterns from PRD NFRs]

{{IF_DESIGN_TOKENS}}
## Design System
- Design tokens: `docs/design/tokens.css`
- Reference page: `docs/design/reference.html`
- Import tokens.css in all stylesheets for consistent theming
- All colors, fonts, radii, shadows use CSS custom properties from tokens
{{END_IF_DESIGN_TOKENS}}

## Planning
- PRD: `PRD.md`
- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`
- Mockups: `.planning/mockups/` (visual reference, no overlay scripts)

## Constraints
[From PRD Technical Constraints and Non-Functional Requirements]
```

## Notes for the skill
- Replace {{IF_DESIGN_TOKENS}}...{{END_IF_DESIGN_TOKENS}} blocks conditionally based on whether docs/design/tokens.css exists
- All [bracketed] values are filled from PRD.md content
- This is a GUIDE for the skill, not a literal template engine
