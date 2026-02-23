---
name: prd
description: Use when starting a new project, generating product requirements, or turning an idea into a structured PRD document through interactive Q&A
---

# PRD Generation

## Overview

Generate a complete Product Requirements Document from a project idea through structured, interactive Q&A. Each section is drafted, reviewed, and approved before moving on.

## Preconditions

None — this is the pipeline entry point.

## Process

### Step 1: Understand the Idea

Ask the user to describe their project idea in 1-3 sentences. If they provided it as an argument to the command, use that.

Then ask clarifying questions **one at a time** using AskUserQuestion:

1. **Who is this for?** Target users, their context, pain points
2. **What's the core workflow?** The primary thing users DO with this product
3. **What technology?** Stack preferences, external services, deployment targets
4. **What's out of scope?** Explicit boundaries for v1
5. **Any inspirations?** Existing tools, competitors, reference points

Skip questions the user already answered in their initial description. Adapt follow-ups based on answers.

### Step 2: Draft PRD Sections

Using the prd-template.md as structure, draft the PRD section by section. For each section:

1. Present the drafted content to the user
2. Ask: "Does this capture it correctly? Any changes?" via AskUserQuestion
3. Apply modifications if requested
4. Move to next section

**Section order:**
1. Vision + Problem Statement (together — they're tightly coupled)
2. Target Users
3. User Workflows (this is the most critical section — spend extra time here)
4. Features table (Core MVP, Future, Out of Scope)
5. Technical Constraints
6. Non-Functional Requirements
7. Success Criteria
8. Open Questions

### Step 3: Feature ID Assignment

Assign feature IDs using the CAT-NN format:
- Group features by the User Workflow they serve
- Create a 2-5 letter uppercase mnemonic from each workflow name (most distinctive word)
- Number features sequentially within each category (01, 02, 03...)
- Ensure mnemonics are unique across categories

Example:
```
Upload Photos     → UPLD-01, UPLD-02
AI Analysis       → ANLS-01, ANLS-02
Review & Edit     → EDIT-01, EDIT-02
Export            → EXPO-01, EXPO-02
```

### Step 4: Save PRD

Write the completed PRD to `PRD.md` in the project root.

Present a final summary:
```
PRD saved to PRD.md

Sections: 8
Features: [N] core, [N] future, [N] out of scope
Workflows: [N]

Next step: Run /ignite:mockup to generate interactive mockups
```

## Important Rules

- **Real content only** — no lorem ipsum, no "[TBD]" placeholders
- **User-perspective descriptions** — features describe what users DO, not implementation details
- **Testable success criteria** — each criterion must be observable and verifiable
- **One question at a time** — never dump a list of questions. Ask, wait, adapt.
- **Respect the user's expertise** — if they give detailed technical answers, match that level
