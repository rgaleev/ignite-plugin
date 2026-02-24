# Mockup Overlay Improvements Design

**Date:** 2026-02-23
**Status:** Approved

## Problem

The mockup feedback overlay has three UX issues:

1. **No preview mode** - The overlay always intercepts clicks for annotations. Users can't explore the mockup's navigation, hover states, or flow without accidentally creating feedback nodes.
2. **Accidental annotation creation** - Clicking an element immediately creates a comment object (even before typing). Cancel doesn't remove it. No delete button on new comments. Multiple annotations can pile up on the same element.
3. **Area annotations lack element context** - Area feedback only stores pixel coordinates `{x, y, w, h}`. During `/ignite:review`, this shows as "Area (120,340 400x200)" which is hard to act on.

## Design

### 1. Preview / Feedback Mode Toggle

Add a two-state toggle to the toolbar: **Preview** | **Feedback**.

**Preview mode (default on load):**
- All clicks, hovers, navigation links work normally
- The overlay toolbar is visible but doesn't intercept any events
- Existing annotation pins are hidden
- Element/Area sub-mode buttons are hidden
- User can explore the mockup as if it were a real app

**Feedback mode:**
- Current annotation behavior (with fixes from sections 2 and 3)
- Pins become visible
- Element/Area sub-modes appear
- Clicks are intercepted for annotation

Toolbar layout:
```
[Preview | Feedback]  |  Element  Area  |  3 open  |  Orphaned  Export
                         ^^^hidden in Preview^^^
```

**Implementation:**
- Add `overlayMode` state: `'preview' | 'feedback'` (default: `'preview'`)
- Toggle button in toolbar switches between modes
- In Preview mode: unbind `handleElementClick`, `handleMouseDown/Move/Up` event handlers
- In Feedback mode: rebind all annotation event handlers
- `renderPins()` checks `overlayMode` and skips pin rendering in Preview mode
- The toggle has visual affordance (active state styling like Element/Area buttons)

### 2. Popup First, Create on Save

**Current flow:** Click -> create comment -> push to array -> render pin -> open popup -> Cancel leaves orphan

**New flow:** Click -> open popup (no comment created yet) -> User types + clicks Save -> comment created and pushed to array -> render pins

**Key changes:**

a) `handleElementClick` no longer creates a comment object. Instead:
   - Check if the clicked element already has an open comment (match by selector)
   - If yes: open the existing comment's popup
   - If no: open a "new comment" popup anchored to the element, passing element metadata (selector, text) but NOT yet creating a comment

b) `showPopup` gains a new code path for "uncommitted" comments:
   - Save button: creates the comment object, pushes to `feedback.comments`, saves, re-renders pins
   - Cancel/Escape: simply removes the popup, nothing is persisted

c) Delete button is always available on existing comments (remove the `isNew` guard)

d) Same logic applies to area annotations: the rectangle is drawn, elements are detected, popup opens, but the comment is only created on Save.

### 3. Area Annotations with Element References

After drawing a rectangle, the system enriches the area annotation with references to the DOM elements inside it.

**Detection algorithm:**
1. Get the bounding rect of the drawn area
2. Query all elements in the document body
3. For each element, check if its bounding rect overlaps with the drawn area (using intersection logic)
4. Filter to "meaningful" elements:
   - Has an `id` attribute
   - Is a semantic tag: `button`, `input`, `select`, `textarea`, `a`, `h1`-`h6`, `img`, `table`, `form`, `nav`, `label`
   - Has role attribute
5. For each matching element, store: `{selector: getSelector(el), text: getElementText(el)}`

**Data structure change:**
```json
{
  "id": "xxxx-xxxx-xxxx",
  "type": "area",
  "selector": null,
  "elementText": null,
  "rect": {"x": 120, "y": 340, "w": 400, "h": 200},
  "elements": [
    {"selector": "#upload-btn", "text": "Upload Photos"},
    {"selector": "#file-input", "text": "Choose files..."},
    {"selector": ".drop-zone", "text": "Drag & drop files here"}
  ],
  "comment": "This area feels cramped",
  "status": "open",
  "timestamp": "2026-02-23T10:00:00Z",
  "version": 1
}
```

**UI in popup:** Show detected elements as a summary line above the textarea:
```
Elements: Upload Photos, Choose files..., Drag & drop files here
[textarea for comment]
[Save] [Cancel]
```

**Impact on /ignite:review:** The review skill's summary table can now show:
```
| # | Mockup      | Target                                           | Comment              |
|---|-------------|--------------------------------------------------|----------------------|
| 2 | upload.html | Area: #upload-btn, #file-input, .drop-zone       | This area feels cramped |
```

Instead of just "Area (120,340 400x200)".

## Files Changed

| File | Change |
|------|--------|
| `skills/mockup/feedback-overlay.js` | Add preview/feedback mode toggle, popup-first creation, element detection for areas |
| `skills/mockup/SKILL.md` | Update user instructions to document Preview/Feedback modes |
| `skills/review/SKILL.md` | Update target column format to leverage area element references |

## Backward Compatibility

- Existing `.feedback.json` files without `elements` field on area comments still work (treated as empty array)
- The overlay gracefully handles missing `elements` field
- No changes to feedback-server.js (data structure is pass-through)
