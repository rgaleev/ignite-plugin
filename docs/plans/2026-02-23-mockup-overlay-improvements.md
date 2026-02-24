# Mockup Overlay Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three UX issues in the feedback overlay: add preview/feedback mode toggle, prevent accidental annotation creation with popup-first flow, and enrich area annotations with element references.

**Architecture:** All changes are in one file (`feedback-overlay.js`) plus two documentation files. The overlay is a pure-browser IIFE with zero dependencies. State is managed via module-scoped variables. The feedback server is a pass-through JSON store that requires no changes.

**Tech Stack:** Vanilla JavaScript (browser), no build step, no dependencies.

**Design Doc:** `docs/plans/2026-02-23-mockup-overlay-improvements-design.md`

---

### Task 1: Add Preview/Feedback Mode State and Toggle UI

**Files:**
- Modify: `skills/mockup/feedback-overlay.js:6-16` (state variables)
- Modify: `skills/mockup/feedback-overlay.js:131-218` (styles)
- Modify: `skills/mockup/feedback-overlay.js:221-239` (toolbar creation)

**Context:** The overlay currently has `mode` for element/area. We need a higher-level `overlayMode` for preview/feedback. Preview is the default — users explore the mockup first, then switch to Feedback to annotate.

**Step 1: Add overlayMode state variable**

In `feedback-overlay.js`, after line 9 (`let mode = 'element';`), add:

```javascript
let overlayMode = 'preview'; // 'preview' | 'feedback'
```

**Step 2: Add CSS for the mode toggle**

In `injectStyles()`, add these styles inside the template literal (after the `.fb-toolbar button.active` rule, around line 145):

```css
.fb-mode-toggle {
  display: flex; border: 1px solid #444; border-radius: 4px; overflow: hidden;
}
.fb-mode-toggle button {
  border: none; border-radius: 0; margin: 0;
  padding: 4px 12px; font-size: 12px;
  background: #2d2d44; color: #aaa;
}
.fb-mode-toggle button.active {
  background: #4361ee; color: white; border-color: #4361ee;
}
.fb-mode-toggle button:first-child { border-right: 1px solid #444; }
.fb-feedback-controls { display: flex; gap: 8px; }
.fb-feedback-controls.hidden { display: none; }
```

**Step 3: Update toolbar HTML**

Replace the `createToolbar()` function's `toolbar.innerHTML` (lines 224-232) with:

```javascript
toolbar.innerHTML = `
  <strong>Ignite Feedback</strong>
  <div class="fb-mode-toggle">
    <button class="fb-toggle-preview active" title="Explore the mockup interactively">Preview</button>
    <button class="fb-toggle-feedback" title="Switch to annotation mode">Feedback</button>
  </div>
  <div class="fb-feedback-controls hidden">
    <button class="fb-mode-element active" title="Click elements to annotate">Element</button>
    <button class="fb-mode-area" title="Draw rectangle to annotate area">Area</button>
  </div>
  <span class="fb-spacer"></span>
  <span class="fb-comment-count"></span>
  <button class="fb-btn-orphans" title="Show orphaned comments" style="display:none">Orphaned</button>
  <button class="fb-btn-export" title="Export feedback JSON">Export</button>
`;
```

**Step 4: Add toggle event listeners**

After the existing event listeners in `createToolbar()` (lines 235-238), add:

```javascript
toolbar.querySelector('.fb-toggle-preview').addEventListener('click', () => setOverlayMode('preview'));
toolbar.querySelector('.fb-toggle-feedback').addEventListener('click', () => setOverlayMode('feedback'));
```

**Step 5: Create setOverlayMode function**

Add this function after the existing `setMode()` function (after line 256):

```javascript
function setOverlayMode(m) {
  overlayMode = m;
  toolbar.querySelector('.fb-toggle-preview').classList.toggle('active', m === 'preview');
  toolbar.querySelector('.fb-toggle-feedback').classList.toggle('active', m === 'feedback');
  const controls = toolbar.querySelector('.fb-feedback-controls');
  controls.classList.toggle('hidden', m === 'preview');
  document.body.style.cursor = (m === 'feedback' && mode === 'area') ? 'crosshair' : '';
  renderPins();
}
```

**Step 6: Guard renderPins() with overlayMode check**

At the top of `renderPins()` (line 278), add:

```javascript
clearPins();
if (overlayMode === 'preview') {
  updateCommentCount();
  return;
}
```

Remove the existing `clearPins()` call on line 278 since it's now inside the guard.

**Step 7: Guard event handlers with overlayMode check**

At the top of `handleElementClick()` (line 420), change the first line from:
```javascript
if (mode !== 'element') return;
```
to:
```javascript
if (overlayMode !== 'feedback' || mode !== 'element') return;
```

At the top of `handleMouseDown()` (line 450), change:
```javascript
if (mode !== 'area') return;
```
to:
```javascript
if (overlayMode !== 'feedback' || mode !== 'area') return;
```

**Step 8: Verify manually**

Open any mockup HTML in a browser. Confirm:
- Toolbar shows Preview/Feedback toggle
- Preview mode (default): clicks pass through to the page, no pins visible, Element/Area buttons hidden
- Feedback mode: pins appear, Element/Area buttons show, clicks create annotations

**Step 9: Commit**

```bash
git add skills/mockup/feedback-overlay.js
git commit -m "feat: add preview/feedback mode toggle to overlay

Preview mode (default) lets users explore mockups interactively.
Feedback mode enables annotation. Toggle in toolbar switches between."
```

---

### Task 2: Popup-First Annotation Creation for Elements

**Files:**
- Modify: `skills/mockup/feedback-overlay.js:367-416` (showPopup)
- Modify: `skills/mockup/feedback-overlay.js:419-447` (handleElementClick)

**Context:** Currently, clicking an element immediately creates a comment in the data array, then opens a popup. Cancel doesn't clean up. We need to: (a) show popup first, only create on Save, (b) clicking an element with existing annotation opens that annotation, (c) Delete is always available.

**Step 1: Add findExistingComment utility**

Add this function before `showPopup()` (before line 367):

```javascript
function findExistingComment(el) {
  const selector = getSelector(el);
  return feedback.comments.find(c =>
    c.type === 'element' && c.status === 'open' && c.selector === selector
  );
}
```

**Step 2: Rewrite handleElementClick to not create comments**

Replace the entire `handleElementClick` function (lines 419-447) with:

```javascript
function handleElementClick(e) {
  if (overlayMode !== 'feedback' || mode !== 'element') return;
  const el = e.target;
  if (el.closest('.fb-toolbar') || el.closest('.fb-popup') || el.closest('.fb-sidebar') ||
      el.closest('.fb-pin') || el.closest('.fb-area-pin')) return;

  e.preventDefault();
  e.stopPropagation();

  // Check if this element already has an open comment
  const existing = findExistingComment(el);
  if (existing) {
    // Find the pin for this comment and open its popup
    const idx = feedback.comments.indexOf(existing);
    const pins = document.querySelectorAll('.fb-pin');
    if (pins[idx]) showPopup(existing, pins[idx]);
    return;
  }

  // No existing comment — show popup for a NEW (uncommitted) annotation
  // Create a temporary anchor at the element's position
  const rect = el.getBoundingClientRect();
  const anchor = document.createElement('div');
  anchor.style.position = 'absolute';
  anchor.style.left = (rect.right + window.scrollX - 8) + 'px';
  anchor.style.top = (rect.top + window.scrollY - 8) + 'px';
  anchor.style.width = '1px';
  anchor.style.height = '1px';
  document.body.appendChild(anchor);

  // Highlight the target element
  el.classList.add('fb-highlight');

  showNewPopup({
    type: 'element',
    selector: getSelector(el),
    elementText: getElementText(el),
    rect: null,
    elements: null
  }, anchor, () => el.classList.remove('fb-highlight'));
}
```

**Step 3: Create showNewPopup function for uncommitted annotations**

Add this function after `showPopup()` (after line 416):

```javascript
function showNewPopup(metadata, anchor, onClose) {
  document.querySelectorAll('.fb-popup').forEach(p => p.remove());
  const popup = document.createElement('div');
  popup.className = 'fb-popup';

  let elementsHtml = '';
  if (metadata.elements && metadata.elements.length > 0) {
    const names = metadata.elements.map(e => e.text || e.selector).join(', ');
    elementsHtml = `<div style="font-size:11px;color:#888;margin-bottom:6px;">Elements: ${names}</div>`;
  }

  popup.innerHTML = `
    ${elementsHtml}
    <textarea placeholder="What should change here?"></textarea>
    <div class="fb-actions">
      <button class="fb-save">Add</button>
      <button class="fb-cancel">Cancel</button>
    </div>
  `;

  const rect = anchor.getBoundingClientRect();
  popup.style.left = Math.min(rect.left + window.scrollX, window.innerWidth - 300) + 'px';
  popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';

  const cleanup = () => {
    popup.remove();
    anchor.remove();
    if (onClose) onClose();
  };

  popup.querySelector('.fb-save').addEventListener('click', () => {
    const text = popup.querySelector('textarea').value;
    if (!text.trim()) { showToast('Please enter a comment', 'warn'); return; }

    const comment = {
      id: uuid(),
      type: metadata.type,
      selector: metadata.selector,
      elementText: metadata.elementText,
      rect: metadata.rect,
      elements: metadata.elements || null,
      comment: text,
      status: 'open',
      timestamp: new Date().toISOString(),
      version: feedback.version
    };

    feedback.comments.push(comment);
    saveFeedback().then(renderPins);
    cleanup();
  });

  popup.querySelector('.fb-cancel').addEventListener('click', cleanup);

  document.body.appendChild(popup);
  popup.querySelector('textarea').focus();
}
```

**Step 4: Update showPopup to always show Delete**

In the existing `showPopup()` function, replace the popup innerHTML (lines 373-381) with:

```javascript
popup.innerHTML = `
  <textarea placeholder="What should change here?">${comment.comment || ''}</textarea>
  <div class="fb-actions">
    <button class="fb-save">Update</button>
    <button class="fb-resolve">${comment.status === 'resolved' ? 'Reopen' : 'Resolve'}</button>
    <button class="fb-delete">Delete</button>
    <button class="fb-cancel">Cancel</button>
  </div>
`;
```

Remove the `isNew` variable (line 372) — it's no longer needed. Since all comments in the array now have text, every popup for an existing comment shows all buttons.

Also remove the conditional checks around resolveBtn and deleteBtn (the `if (resolveBtn)` and `if (deleteBtn)` guards on lines 394 and 403) — they're always present now.

**Step 5: Verify manually**

Open a mockup, switch to Feedback mode:
- Click an element: popup appears, no pin yet. Type text, Save: pin appears. Cancel: nothing created.
- Click the same element again: opens the existing annotation's popup.
- Existing annotations have Update/Resolve/Delete/Cancel buttons.

**Step 6: Commit**

```bash
git add skills/mockup/feedback-overlay.js
git commit -m "feat: popup-first annotation creation, prevent accidental comments

Click shows popup first. Comment only created on Save. Cancel = nothing persisted.
Clicking an element with existing annotation opens that annotation.
Delete always available on existing comments."
```

---

### Task 3: Popup-First Annotation Creation for Areas

**Files:**
- Modify: `skills/mockup/feedback-overlay.js:477-510` (handleMouseUp)

**Context:** Same pattern as Task 2 but for area-draw mode. After drawing a rectangle, show the popup first. Only create the comment on Save.

**Step 1: Rewrite handleMouseUp to use showNewPopup**

Replace the `handleMouseUp` function (lines 477-510) with:

```javascript
function handleMouseUp(e) {
  if (!isDrawing) return;
  isDrawing = false;
  if (drawRect) drawRect.remove();

  const x = Math.min(drawStart.x, e.pageX);
  const y = Math.min(drawStart.y, e.pageY);
  const w = Math.abs(e.pageX - drawStart.x);
  const h = Math.abs(e.pageY - drawStart.y);

  if (w < 20 || h < 20) return; // Too small, ignore

  const rect = { x, y, w, h };

  // Detect elements inside the drawn area
  const elements = detectElementsInArea(rect);

  // Create a temporary visual area indicator
  const areaIndicator = document.createElement('div');
  areaIndicator.className = 'fb-area-pin';
  areaIndicator.style.left = rect.x + 'px';
  areaIndicator.style.top = rect.y + 'px';
  areaIndicator.style.width = rect.w + 'px';
  areaIndicator.style.height = rect.h + 'px';
  document.body.appendChild(areaIndicator);

  showNewPopup({
    type: 'area',
    selector: null,
    elementText: null,
    rect: rect,
    elements: elements
  }, areaIndicator, () => areaIndicator.remove());
}
```

**Step 2: Verify manually**

Open a mockup, switch to Feedback > Area mode:
- Draw a rectangle: dashed outline appears, popup opens. Type text, Save: area pin with number badge appears. Cancel: rectangle disappears, nothing saved.

**Step 3: Commit**

```bash
git add skills/mockup/feedback-overlay.js
git commit -m "feat: popup-first for area annotations, same pattern as elements"
```

---

### Task 4: Add Element Detection for Area Annotations

**Files:**
- Modify: `skills/mockup/feedback-overlay.js` (add detectElementsInArea utility, before handleMouseUp)
- Modify: `skills/mockup/feedback-overlay.js:326-346` (renderAreaPin to show element count)

**Context:** When drawing an area, detect which meaningful DOM elements are inside it and store `elements: [{selector, text}]`. This data is used by `/ignite:review` and shown in the popup.

**Step 1: Add detectElementsInArea utility**

Add this function in the Utilities section (after `resolveComment`, around line 83):

```javascript
const SEMANTIC_TAGS = new Set([
  'button', 'input', 'select', 'textarea', 'a',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'img', 'table', 'form', 'nav', 'label'
]);

function detectElementsInArea(areaRect) {
  const elements = [];
  const seen = new Set();
  const all = document.querySelectorAll('body *');

  for (const el of all) {
    if (el.closest('.fb-toolbar') || el.closest('.fb-popup') || el.closest('.fb-sidebar') ||
        el.closest('.fb-pin') || el.closest('.fb-area-pin')) continue;

    // Filter to meaningful elements
    const tag = el.tagName.toLowerCase();
    const hasId = !!el.id;
    const isSemantic = SEMANTIC_TAGS.has(tag);
    const hasRole = el.hasAttribute('role');
    if (!hasId && !isSemantic && !hasRole) continue;

    // Check bounding box overlap
    const elRect = el.getBoundingClientRect();
    const elAbsRect = {
      x: elRect.left + window.scrollX,
      y: elRect.top + window.scrollY,
      w: elRect.width,
      h: elRect.height
    };

    // Intersection check
    const overlapX = elAbsRect.x < areaRect.x + areaRect.w && elAbsRect.x + elAbsRect.w > areaRect.x;
    const overlapY = elAbsRect.y < areaRect.y + areaRect.h && elAbsRect.y + elAbsRect.h > areaRect.y;

    if (overlapX && overlapY && elAbsRect.w > 0 && elAbsRect.h > 0) {
      const selector = getSelector(el);
      if (!seen.has(selector)) {
        seen.add(selector);
        elements.push({ selector, text: getElementText(el) });
      }
    }
  }

  return elements;
}
```

**Step 2: Add elements display in area popup via showNewPopup**

This is already handled by `showNewPopup()` from Task 2 — it renders the `elementsHtml` line when `metadata.elements` is present. No additional code needed.

**Step 3: Update renderAreaPin to show element count in title**

In `renderAreaPin()` (around line 326), update the pin title. After creating the pin element (line 337), add:

```javascript
const elemCount = (comment.elements || []).length;
pin.title = comment.comment || (elemCount > 0 ? `${elemCount} elements` : 'Click to view');
```

**Step 4: Show elements in existing comment popups too**

In the existing `showPopup()` function, add an elements summary line above the textarea. Before the `popup.innerHTML` assignment, add:

```javascript
let elementsInfo = '';
if (comment.elements && comment.elements.length > 0) {
  const names = comment.elements.map(e => e.text || e.selector).join(', ');
  elementsInfo = `<div style="font-size:11px;color:#888;margin-bottom:6px;">Elements: ${names}</div>`;
}
```

Then prepend `${elementsInfo}` before the `<textarea>` in the popup innerHTML.

**Step 5: Verify manually**

Draw an area around a section with buttons/links:
- Popup shows "Elements: Upload Photos, Choose files..."
- After saving, the area pin tooltip shows element count
- Re-opening the saved annotation still shows the elements line

**Step 6: Commit**

```bash
git add skills/mockup/feedback-overlay.js
git commit -m "feat: detect and display elements inside area annotations

Area annotations now store elements: [{selector, text}] for all semantic
elements inside the drawn rectangle. Shown in popup and pin tooltip."
```

---

### Task 5: Update Mockup SKILL.md Documentation

**Files:**
- Modify: `skills/mockup/SKILL.md:139-156` (user instructions for annotating)

**Context:** The "How to annotate" section needs to document Preview/Feedback modes.

**Step 1: Update the instruction text in Step 4**

Replace the user-facing instructions block (lines 140-156) with:

```
   Mockups generated! [N] screens ready for review.

   Open in browser: http://localhost:3000

   Screens:
   - upload.html — Photo upload interface
   - analysis.html — AI analysis results
   - export.html — Stock export dashboard
   - settings.html — Configuration

   The mockups open in Preview mode — click links, explore the UI, try the flow.

   To give feedback, click "Feedback" in the toolbar:
   1. Element mode — click any element, type your comment, hit Save
   2. Area mode — draw a rectangle around a region, type your comment, hit Save
   3. Click an existing pin to edit, resolve, or delete a comment

   When done annotating, run /ignite:review to process feedback.
```

**Step 2: Commit**

```bash
git add skills/mockup/SKILL.md
git commit -m "docs: update mockup SKILL.md for preview/feedback modes"
```

---

### Task 6: Update Review SKILL.md for Area Element References

**Files:**
- Modify: `skills/review/SKILL.md:27-39` (summary table format)

**Context:** The review skill's summary table needs to use area element references when available.

**Step 1: Update the summary table example**

Replace lines 29-38 with:

```
Found [N] open comments across [N] mockups:

| #  | Mockup          | Target                                       | Comment                        |
|----|-----------------|----------------------------------------------|-------------------------------|
| 1  | upload.html     | #upload-btn "Upload Photos"                  | Should support drag & drop    |
| 2  | upload.html     | Area: #upload-btn, #file-input, .drop-zone   | This area feels cramped       |
| 3  | analysis.html   | .keyword-chip "landscape"                    | Need bulk editing for keywords|

Orphaned (selector broken): [N] comments — listed below
```

Add a note after the table:

```
For area comments: if the `elements` array is present and non-empty, display as "Area: selector1, selector2, ...".
If `elements` is missing or empty (older feedback), fall back to "Area (x,y w×h)".
```

**Step 2: Commit**

```bash
git add skills/review/SKILL.md
git commit -m "docs: update review SKILL.md to leverage area element references"
```

---

### Task 7: Final Integration Verification

**Files:** None (manual testing only)

**Step 1: Create a test mockup**

Create a minimal test HTML file with the feedback overlay to verify all features work together:

```bash
mkdir -p /tmp/ignite-test
```

Create `/tmp/ignite-test/test.html`:
```html
<!DOCTYPE html>
<html><head><title>Test</title>
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="p-8">
  <h1 id="title" class="text-2xl font-bold mb-4">Test Mockup</h1>
  <button id="btn-upload" class="bg-blue-500 text-white px-4 py-2 rounded">Upload</button>
  <a href="#" id="link-settings" class="ml-4 text-blue-600">Settings</a>
  <div class="mt-8 p-4 border rounded">
    <input id="search" type="text" placeholder="Search..." class="border p-2 rounded">
    <label for="search">Search files</label>
  </div>
  <script src="../../skills/mockup/feedback-overlay.js"></script>
  <script>FeedbackOverlay.init({ mockup: 'test.html', serverPort: 3000 });</script>
</body></html>
```

**Step 2: Verify all features**

Test checklist:
- [ ] Page loads in Preview mode (default)
- [ ] Clicks on links/buttons work normally in Preview
- [ ] Toggle to Feedback: pins appear (if any), Element/Area buttons show
- [ ] Element click: popup appears, no comment created yet
- [ ] Save: comment created, pin appears
- [ ] Cancel: nothing created
- [ ] Click same element again: opens existing annotation
- [ ] Area draw: rectangle shown, popup shows detected elements
- [ ] Area Save: area pin with element references stored
- [ ] Area Cancel: rectangle disappears, nothing saved
- [ ] Toggle back to Preview: pins hidden, clicks work
- [ ] Export: JSON includes `elements` field on area comments

**Step 3: Clean up test files**

```bash
rm -rf /tmp/ignite-test
```

**Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: integration fixups from manual testing"
```
