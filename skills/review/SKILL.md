---
name: review
description: Use when processing mockup or design annotations, triaging user feedback from HTML mockups, or syncing feedback changes back to PRD
---

# Review Feedback

## Overview

Process annotation feedback from mockups or design options. Presents comments in a batch triage UX, classifies impact, applies approved changes to HTML and syncs feature changes to PRD.md.

## Preconditions

| Check | If missing |
|-------|-----------|
| `*.feedback.json` files exist | "No feedback files found. Open mockups at localhost:3000, annotate, then re-run." |
| At least 1 comment with status `open` | "All comments are resolved. Run `/ignite:design` or `/ignite:bootstrap`." |

Look for feedback files in:
- `mockups/` directory (from `/ignite:mockup`)
- `docs/design/options/` directory (from `/ignite:design`)

## Process

### Step 1: Load & Summarize

Read all `.feedback.json` files. Build a summary table:

```
Found [N] open comments across [N] mockups:

| #  | Mockup          | Target                                       | Comment                        |
|----|-----------------|----------------------------------------------|-------------------------------|
| 1  | upload.html     | #upload-btn "Upload Photos"                  | Should support drag & drop    |
| 2  | upload.html     | Area: #upload-btn, #file-input, .drop-zone   | This area feels cramped       |
| 3  | analysis.html   | .keyword-chip "landscape"                    | Need bulk editing for keywords|

Orphaned (selector broken): [N] comments — listed below
```

For area comments: if the `elements` array is present and non-empty, display as "Area: selector1, selector2, ...".
If `elements` is missing or empty (older feedback), fall back to "Area (x,y w×h)".

For orphaned comments (status `orphaned` or selector can't be resolved), list separately with their original selector and element text.

### Step 2: Batch Triage

Present comments in groups of 3-5 using **AskUserQuestion with multiSelect**:

```
Which of these should be applied? (Select all to accept)
☐ #1: Upload button → drag & drop support
☐ #2: Upload area → more spacing
☐ #3: Keywords → bulk editing
```

For >10 comments, first ask: "Accept all, reject all, or review individually?" via AskUserQuestion.

The "Other" option (always available via AskUserQuestion) lets users modify specific items ("Accept #1 but change to...").

### Step 3: Impact Classification

For each accepted comment, classify automatically:

| Classification | Criteria | Action |
|---------------|----------|--------|
| **UI-only** | Spacing, wording, color, layout changes | Update HTML only |
| **New feature** | Adding functionality not in PRD (e.g., "add drag & drop") | Update HTML + add to PRD Features |
| **Feature change** | Modifying existing PRD feature behavior | Update HTML + modify PRD Feature |
| **Removal** | Removing a section or feature | Update HTML + add to PRD Out of Scope |

Present the classification to the user:
```
Impact classification:
- 2 UI-only changes (HTML only)
- 1 new feature (will add to PRD)
- 1 feature change (will modify PRD)

The PRD changes:
- ADD: UPLD-03 "Drag & drop upload support" (new feature from comment #1)
- MODIFY: EDIT-01 "Bulk keyword editing" (expanded from comment #3)

Approve PRD changes?
```

Wait for approval before modifying PRD.md.

### Step 4: Apply Changes

For each accepted comment:
1. **Read** the target mockup HTML
2. **Apply** the change (modify element, adjust spacing, add/remove sections)
3. **Update** the comment status in `.feedback.json` to `resolved`
4. **Increment** the `version` number in the feedback JSON
5. **Update** the `htmlHash` to match the new HTML

For PRD changes (if approved):
1. **Read** `PRD.md`
2. **Add** new features to the appropriate section with CAT-NN IDs
3. **Modify** existing feature descriptions
4. **Add** removals to Out of Scope

### Step 5: Report

```
Review complete!

Applied: [N] changes across [N] mockups
Rejected: [N] comments (marked as resolved-rejected)
PRD updated: [Y/N] ([N] features added, [N] modified)
Orphaned: [N] comments could not be placed

Next steps:
- Re-open mockups to verify changes: http://localhost:3000
- Run /ignite:design to create a design system
- Run /ignite:review again if more annotations needed
```

## Cross-Version Handling

Before applying changes, check if the mockup HTML has been modified since the feedback was written:
1. Compare `htmlHash` in feedback JSON to current HTML hash
2. If different, report: "⚠️ [mockup].html was modified since these annotations. Attempting to resolve selectors..."
3. Run selector recovery for all comments (selector → text fallback → orphan)
4. Present recovered vs orphaned counts before proceeding

## Important Rules

- **Never auto-apply** — all changes go through triage
- **Batch over one-at-a-time** — minimize user fatigue
- **PRD changes require explicit approval** — separate gate from HTML changes
- **Orphaned comments are reported, not silently dropped**
- **Comment status updates are atomic** — if HTML update fails, don't mark as resolved
