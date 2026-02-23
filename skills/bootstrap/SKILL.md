---
name: bootstrap
description: Use when generating CLAUDE.md and GSD planning files from a PRD, bootstrapping project planning infrastructure, or preparing for GSD handoff
---

# Bootstrap to GSD

## Overview

Generate CLAUDE.md and the full `.planning/` directory structure from a PRD, mapping PRD sections to GSD format for seamless handoff to `/gsd:plan-phase`.

## Preconditions

| Check | If missing | Severity |
|-------|-----------|----------|
| `PRD.md` exists | "No PRD.md found. Run `/ignite:prd` first." | Error — stop |
| `mockups/` directory exists | Warning: "No mockups found. Proceeding without visual reference. Consider running `/ignite:mockup` first." | Warning — continue |
| `docs/design/tokens.css` exists | Warning: "No design system found. CLAUDE.md will skip design section." | Warning — continue |

## Process

### Step 1: Read Inputs

1. Read `PRD.md` completely
2. Check for `mockups/*.html` — if present, list screen names
3. Check for `docs/design/tokens.css` — note existence for conditional CLAUDE.md sections
4. Check for `docs/design/design-system.md` — if present, read for reference

### Step 2: Generate .planning/PROJECT.md

Map PRD sections to PROJECT.md:

```markdown
# [Project Name]

## What This Is
[From PRD Vision — 2-3 sentences]

## Core Value
[Single sentence extracted from Vision — the ONE thing this product enables]

## Context
[Combined from PRD Problem Statement + Target Users — 1-2 paragraphs]

## Requirements

### Active
[From PRD Features → Core MVP — each as a checkbox]
- [ ] [Feature description with CAT-NN ID]

### Out of Scope
[From PRD Features → Out of Scope]
- [Feature] — [reason]

## Constraints
[From PRD Technical Constraints — each as bold label + explanation]
- **[Type]**: [What] — [Why this constraint exists]

## Key Decisions
[From PRD Open Questions that have been resolved during the process]
| Decision | Choice | Rationale |
|----------|--------|-----------|
| [Question] | [Answer] | [Why] |
```

Present to user: "Here's PROJECT.md. Approve?"

### Step 3: Generate .planning/REQUIREMENTS.md

Map PRD features to requirement IDs using the CAT-NN format:

```markdown
# Requirements

## v1 Requirements

### [Workflow Category Name]
- [ ] **CAT-01**: [Feature description from PRD]
- [ ] **CAT-02**: [Feature description from PRD]

### [Next Workflow Category]
- [ ] **CAT2-01**: [Feature description]

## v2+ Requirements
### [Category]
- **CAT-10**: [Future feature description]

## Out of Scope
| Feature | Reason |
|---------|--------|
| [Feature] | [From PRD] |

## Traceability
| Requirement | Phase | Status |
|------------|-------|--------|
| CAT-01 | — | Pending |
| CAT-02 | — | Pending |
```

The Traceability table starts with all requirements as "Pending" — GSD fills in Phase assignments during roadmap planning.

Present to user: "Here's REQUIREMENTS.md. Approve?"

### Step 4: Generate .planning/ROADMAP.md

Phase generation strategy:
1. **Phase 1: Foundation** — project setup, core data models, basic infrastructure (from Technical Constraints)
2. **Phase 2-N: Workflows** — each User Workflow from PRD maps to 1-2 phases. Primary workflow first.
3. **Phase N+1: Integration** — external services, APIs, adapters
4. **Phase N+2: Polish** — error handling, edge cases, non-functional requirements from PRD

```markdown
# Roadmap

## Phase 1: Foundation
**Goal**: Set up project structure and core data models
**Requirements**: [list CAT-NN IDs covered]
**Success Criteria**:
- [ ] Project builds and runs
- [ ] Core data models defined
- [ ] Development environment documented

## Phase 2: [Primary Workflow Name]
**Goal**: [What users can DO after this phase]
**Requirements**: CAT-01, CAT-02, CAT-03
**Success Criteria**:
- [ ] [Observable, testable criterion]
- [ ] [Observable, testable criterion]

## Phase 3: [Next Workflow Name]
...

## Phase N: Integration
**Goal**: Connect to external services
**Requirements**: [IDs]
**Success Criteria**:
- [ ] [Criterion]

## Phase N+1: Polish
**Goal**: Production readiness
**Requirements**: [NFR-related IDs if any]
**Success Criteria**:
- [ ] Error handling covers all documented cases
- [ ] All success criteria from PRD met
```

Present to user: "Here's ROADMAP.md with [N] phases. Approve?"

### Step 5: Generate .planning/config.json

```json
{
  "mode": "interactive",
  "depth": "standard",
  "workflow": { "research": true, "plan_check": true, "verifier": true },
  "parallelization": { "enabled": true, "max_concurrent_agents": 3 }
}
```

### Step 6: Copy Clean Mockups

If `mockups/*.html` exists:
1. Create `.planning/mockups/` directory
2. For each mockup HTML file:
   - Read the file
   - Strip the feedback overlay `<script>` tags (the `<script src="feedback-overlay.js">` and the `FeedbackOverlay.init(...)` block)
   - Write the clean version to `.planning/mockups/`

### Step 7: Generate CLAUDE.md

Use `claude-md-template.md` as a structural guide. Generate CLAUDE.md in the project root:

1. Fill in all sections from PRD content
2. **Conditionally include** the Design System section only if `docs/design/tokens.css` exists
3. Include Quick Start with reasonable defaults for the stack (e.g., if TypeScript + Node → `npm install`, `npm run dev`, `npm test`)
4. Include Architecture section based on PRD Technical Constraints
5. Include Code Style section with language-appropriate defaults

Present to user: "Here's CLAUDE.md. Approve?"

### Step 8: Final Report

```
Bootstrap complete!

Generated files:
  ✓ .planning/PROJECT.md
  ✓ .planning/REQUIREMENTS.md  ([N] v1 requirements, [N] v2+)
  ✓ .planning/ROADMAP.md       ([N] phases)
  ✓ .planning/config.json
  ✓ .planning/mockups/          ([N] clean mockup copies)
  ✓ CLAUDE.md

Next step: Run /gsd:plan-phase 1 to begin implementation planning.

The roadmap has [N] phases:
1. Foundation — project setup
2. [Workflow] — [goal]
...
```

## Important Rules

- **Every generated file gets user approval** before saving
- **CAT-NN IDs must be consistent** between REQUIREMENTS.md and ROADMAP.md
- **Clean mockups** — no feedback overlay scripts in .planning/mockups/
- **CLAUDE.md is practical** — Quick Start section should have runnable commands for the chosen stack
- **Roadmap phases are actionable** — each phase has clear success criteria a developer can verify
- **GSD compatibility** — .planning/ structure must match what /gsd:progress and /gsd:plan-phase expect
