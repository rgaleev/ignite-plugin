/**
 * Ignite Feedback Overlay
 * Annotation system for mockup pages - injected via <script> tag
 * Zero dependencies, pure browser JavaScript
 */
const FeedbackOverlay = (() => {
  let config = { mockup: '', serverPort: 3000 };
  let feedback = { mockup: '', version: 1, htmlHash: '', comments: [] };
  let mode = 'element'; // 'element' | 'area' | null
  let overlayMode = 'preview'; // 'preview' | 'feedback'
  let isDrawing = false;
  let drawStart = null;
  let drawRect = null;
  let selectedElement = null;
  let activeCleanup = null; // cleanup callback for uncommitted popup
  let suppressDismiss = false; // suppress outside-click dismiss for one tick
  let toolbar = null;
  let overlay = null;
  let sidebar = null;

  // --- Utilities ---
  function uuid() {
    return 'xxxx-xxxx-xxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16));
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).slice(0, 8);
  }

  function getSelector(el) {
    if (el.id) return '#' + el.id;
    const parts = [];
    while (el && el !== document.body) {
      let selector = el.tagName.toLowerCase();
      if (el.id) { parts.unshift('#' + el.id); break; }
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\s+/).filter(c => !c.startsWith('fb-')).slice(0, 2);
        if (classes.length) selector += '.' + classes.join('.');
      }
      const parent = el.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) selector += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
      }
      parts.unshift(selector);
      el = parent;
    }
    return parts.join(' > ');
  }

  function getElementText(el) {
    return (el.textContent || '').trim().slice(0, 80);
  }

  function findByText(text) {
    if (!text) return null;
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      if (el.closest('.fb-overlay') || el.closest('.fb-toolbar') || el.closest('.fb-sidebar')) continue;
      const elText = (el.textContent || '').trim();
      if (elText.includes(text) && el.children.length < 3) return el;
    }
    return null;
  }

  function resolveComment(comment) {
    // Try selector first
    if (comment.selector) {
      try {
        const el = document.querySelector(comment.selector);
        if (el && !el.closest('.fb-overlay')) return { el, method: 'selector' };
      } catch (e) { /* invalid selector */ }
    }
    // Fallback to text search
    if (comment.elementText) {
      const el = findByText(comment.elementText);
      if (el) return { el, method: 'text' };
    }
    return null;
  }

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

  // --- Server Communication ---
  const serverUrl = () => `http://localhost:${config.serverPort}`;

  async function loadFeedback() {
    try {
      const resp = await fetch(`${serverUrl()}/__feedback/${config.mockup}`);
      if (resp.ok) {
        const data = await resp.json();
        feedback = data;
        return true;
      }
    } catch (e) {
      // Try localStorage fallback
      const stored = localStorage.getItem(`fb-${config.mockup}`);
      if (stored) { feedback = JSON.parse(stored); return true; }
    }
    return false;
  }

  async function saveFeedback() {
    feedback.htmlHash = hashString(document.body.innerHTML);
    // Always save to localStorage as backup
    localStorage.setItem(`fb-${config.mockup}`, JSON.stringify(feedback));
    try {
      const resp = await fetch(`${serverUrl()}/__feedback/${config.mockup}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback)
      });
      if (!resp.ok) throw new Error('Server error');
      showToast('Saved');
    } catch (e) {
      showToast('Saved locally (server unreachable)', 'warn');
    }
  }

  function exportFeedback() {
    const blob = new Blob([JSON.stringify(feedback, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${config.mockup}.feedback.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // --- UI Components ---
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .fb-toolbar {
        position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
        background: #1a1a2e; color: #eee; padding: 6px 12px;
        display: flex; align-items: center; gap: 8px; font: 13px/1.4 system-ui;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      .fb-toolbar button {
        background: #2d2d44; color: #eee; border: 1px solid #444;
        padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;
      }
      .fb-toolbar button:hover { background: #3d3d55; }
      .fb-toolbar button.active { background: #4361ee; border-color: #4361ee; }
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
      .fb-toolbar .fb-spacer { flex: 1; }
      .fb-toolbar .fb-badge {
        background: #e74c3c; color: white; border-radius: 10px;
        padding: 1px 7px; font-size: 11px; font-weight: bold;
      }
      .fb-pin {
        position: absolute; z-index: 99990; width: 24px; height: 24px;
        background: #e74c3c; border-radius: 50%; border: 2px solid white;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        font: bold 11px system-ui; color: white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        transition: transform 0.15s;
      }
      .fb-pin:hover { transform: scale(1.2); }
      .fb-pin.resolved { background: #27ae60; }
      .fb-pin.orphaned { background: #f39c12; }
      .fb-area-pin {
        position: absolute; z-index: 99989;
        border: 2px dashed #e74c3c; background: rgba(231,76,60,0.08);
        cursor: pointer; border-radius: 4px;
      }
      .fb-area-pin.resolved { border-color: #27ae60; background: rgba(39,174,96,0.08); }
      .fb-popup {
        position: absolute; z-index: 99991; background: #1a1a2e; color: #eee;
        border-radius: 8px; padding: 12px; width: 280px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4); font: 13px/1.5 system-ui;
      }
      .fb-popup textarea {
        width: 100%; min-height: 60px; background: #2d2d44; color: #eee;
        border: 1px solid #444; border-radius: 4px; padding: 8px; resize: vertical;
        font: 13px/1.5 system-ui; box-sizing: border-box;
      }
      .fb-popup .fb-actions { display: flex; gap: 6px; margin-top: 8px; }
      .fb-popup .fb-actions button {
        padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; border: none;
      }
      .fb-popup .fb-save { background: #4361ee; color: white; }
      .fb-popup .fb-resolve { background: #27ae60; color: white; }
      .fb-popup .fb-delete { background: #e74c3c; color: white; }
      .fb-popup .fb-cancel { background: #555; color: white; }
      .fb-highlight { outline: 3px solid #4361ee !important; outline-offset: 2px; }
      .fb-draw-rect {
        position: fixed; z-index: 99998; border: 2px dashed #4361ee;
        background: rgba(67,97,238,0.1); pointer-events: none;
      }
      .fb-toast {
        position: fixed; bottom: 20px; right: 20px; z-index: 99999;
        background: #27ae60; color: white; padding: 8px 16px; border-radius: 6px;
        font: 13px system-ui; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        animation: fb-fade 2s forwards;
      }
      .fb-toast.warn { background: #f39c12; }
      @keyframes fb-fade { 0%,70% { opacity: 1; } 100% { opacity: 0; } }
      .fb-sidebar {
        position: fixed; top: 40px; right: 0; bottom: 0; width: 300px; z-index: 99995;
        background: #1a1a2e; color: #eee; overflow-y: auto; padding: 12px;
        box-shadow: -4px 0 12px rgba(0,0,0,0.3); font: 13px/1.5 system-ui;
        transform: translateX(100%); transition: transform 0.2s;
      }
      .fb-sidebar.open { transform: translateX(0); }
      .fb-sidebar h3 { margin: 0 0 8px; font-size: 14px; color: #f39c12; }
      .fb-sidebar .fb-orphan-item {
        background: #2d2d44; padding: 8px; margin: 6px 0; border-radius: 4px;
        border-left: 3px solid #f39c12;
      }
      .fb-sidebar .fb-orphan-item .fb-meta { font-size: 11px; color: #888; }
      .fb-version-banner {
        position: fixed; top: 40px; left: 0; right: 0; z-index: 99996;
        background: #f39c12; color: #1a1a2e; padding: 6px 12px; font: 12px system-ui;
        text-align: center;
      }
      body { padding-top: 40px !important; }
    `;
    document.head.appendChild(style);
  }

  function createToolbar() {
    toolbar = document.createElement('div');
    toolbar.className = 'fb-toolbar';
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
    document.body.appendChild(toolbar);

    toolbar.querySelector('.fb-mode-element').addEventListener('click', () => setMode('element'));
    toolbar.querySelector('.fb-mode-area').addEventListener('click', () => setMode('area'));
    toolbar.querySelector('.fb-btn-export').addEventListener('click', exportFeedback);
    toolbar.querySelector('.fb-btn-orphans').addEventListener('click', toggleSidebar);

    toolbar.querySelector('.fb-toggle-preview').addEventListener('click', () => setOverlayMode('preview'));
    toolbar.querySelector('.fb-toggle-feedback').addEventListener('click', () => setOverlayMode('feedback'));
  }

  function createSidebar() {
    sidebar = document.createElement('div');
    sidebar.className = 'fb-sidebar';
    document.body.appendChild(sidebar);
  }

  function toggleSidebar() {
    sidebar.classList.toggle('open');
  }

  function setMode(m) {
    mode = m;
    toolbar.querySelector('.fb-mode-element').classList.toggle('active', m === 'element');
    toolbar.querySelector('.fb-mode-area').classList.toggle('active', m === 'area');
    document.body.style.cursor = m === 'area' ? 'crosshair' : '';
  }

  function setOverlayMode(m) {
    overlayMode = m;
    // Cancel any in-progress area draw
    if (isDrawing) {
      isDrawing = false;
      if (drawRect) { drawRect.remove(); drawRect = null; }
    }
    // Remove any element highlight
    document.querySelectorAll('.fb-highlight').forEach(el => el.classList.remove('fb-highlight'));
    toolbar.querySelector('.fb-toggle-preview').classList.toggle('active', m === 'preview');
    toolbar.querySelector('.fb-toggle-feedback').classList.toggle('active', m === 'feedback');
    const controls = toolbar.querySelector('.fb-feedback-controls');
    controls.classList.toggle('hidden', m === 'preview');
    document.body.style.cursor = (m === 'feedback' && mode === 'area') ? 'crosshair' : '';
    renderPins();
  }

  function showToast(msg, type = 'ok') {
    const toast = document.createElement('div');
    toast.className = 'fb-toast' + (type === 'warn' ? ' warn' : '');
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
  }

  function updateCommentCount() {
    const open = feedback.comments.filter(c => c.status === 'open').length;
    const el = toolbar.querySelector('.fb-comment-count');
    el.innerHTML = open > 0 ? `<span class="fb-badge">${open}</span> open` : 'No comments';
  }

  // --- Pin Rendering ---
  function clearPins() {
    document.querySelectorAll('.fb-pin, .fb-area-pin, .fb-popup').forEach(el => el.remove());
  }

  function renderPins() {
    clearPins();
    if (overlayMode === 'preview') {
      updateCommentCount();
      return;
    }
    let orphanCount = 0;
    const orphans = [];

    feedback.comments.forEach((comment, idx) => {
      if (comment.type === 'area') {
        renderAreaPin(comment, idx);
      } else {
        const resolved = resolveComment(comment);
        if (resolved) {
          renderElementPin(comment, idx, resolved.el);
        } else {
          comment.status = comment.status === 'resolved' ? 'resolved' : 'orphaned';
          orphans.push(comment);
          orphanCount++;
        }
      }
    });

    // Update orphan button
    const orphanBtn = toolbar.querySelector('.fb-btn-orphans');
    if (orphanCount > 0) {
      orphanBtn.style.display = '';
      orphanBtn.textContent = `Orphaned (${orphanCount})`;
    } else {
      orphanBtn.style.display = 'none';
    }

    // Render sidebar
    renderOrphanSidebar(orphans);
    updateCommentCount();
  }

  function renderElementPin(comment, idx, targetEl) {
    const pin = document.createElement('div');
    pin.className = 'fb-pin' + (comment.status === 'resolved' ? ' resolved' : '') +
                    (comment.status === 'orphaned' ? ' orphaned' : '');
    pin.textContent = idx + 1;
    pin.title = comment.comment || 'Click to view';

    const rect = targetEl.getBoundingClientRect();
    pin.style.left = (rect.right + window.scrollX - 8) + 'px';
    pin.style.top = (rect.top + window.scrollY - 8) + 'px';

    pin.addEventListener('click', (e) => { e.stopPropagation(); showPopup(comment, pin); });
    document.body.appendChild(pin);
  }

  function renderAreaPin(comment, idx) {
    const r = comment.rect;
    if (!r) return;
    const area = document.createElement('div');
    area.className = 'fb-area-pin' + (comment.status === 'resolved' ? ' resolved' : '');
    area.style.left = r.x + 'px';
    area.style.top = r.y + 'px';
    area.style.width = r.w + 'px';
    area.style.height = r.h + 'px';

    const pin = document.createElement('div');
    pin.className = 'fb-pin' + (comment.status === 'resolved' ? ' resolved' : '');
    pin.textContent = idx + 1;
    const elemCount = (comment.elements || []).length;
    pin.title = comment.comment || (elemCount > 0 ? `${elemCount} elements` : 'Click to view');
    pin.style.position = 'absolute';
    pin.style.top = '-12px';
    pin.style.right = '-12px';
    area.appendChild(pin);

    area.addEventListener('click', (e) => { e.stopPropagation(); showPopup(comment, area); });
    document.body.appendChild(area);
  }

  function renderOrphanSidebar(orphans) {
    sidebar.innerHTML = `<h3>Orphaned Comments</h3>
      <p style="font-size:11px;color:#888;">These comments could not be matched to current elements.</p>`;
    if (orphans.length === 0) {
      sidebar.innerHTML += '<p style="color:#666;">None</p>';
      return;
    }
    orphans.forEach(c => {
      const item = document.createElement('div');
      item.className = 'fb-orphan-item';
      item.innerHTML = `
        <div>${c.comment || '(no text)'}</div>
        <div class="fb-meta">Was: ${c.selector || 'area'} | Text: "${c.elementText || ''}"</div>
      `;
      sidebar.appendChild(item);
    });
  }

  // --- Popup ---
  function findExistingComment(el) {
    const selector = getSelector(el);
    return feedback.comments.find(c =>
      c.type === 'element' && c.status === 'open' && c.selector === selector
    );
  }

  function showPopup(comment, anchor) {
    document.querySelectorAll('.fb-popup').forEach(p => p.remove());
    const popup = document.createElement('div');
    popup.className = 'fb-popup';

    let elementsInfo = '';
    if (comment.elements && comment.elements.length > 0) {
      const names = comment.elements.map(e => e.text || e.selector).join(', ');
      elementsInfo = `<div style="font-size:11px;color:#888;margin-bottom:6px;">Elements: ${names}</div>`;
    }

    popup.innerHTML = `
      ${elementsInfo}
      <textarea placeholder="What should change here?">${comment.comment || ''}</textarea>
      <div class="fb-actions">
        <button class="fb-save">Update</button>
        <button class="fb-resolve">${comment.status === 'resolved' ? 'Reopen' : 'Resolve'}</button>
        <button class="fb-delete">Delete</button>
        <button class="fb-cancel">Cancel</button>
      </div>
    `;

    const rect = anchor.getBoundingClientRect();
    popup.style.left = Math.min(rect.left + window.scrollX, window.innerWidth - 300) + 'px';
    popup.style.top = (rect.bottom + window.scrollY + 8) + 'px';

    popup.querySelector('.fb-save').addEventListener('click', () => {
      comment.comment = popup.querySelector('textarea').value;
      if (!comment.comment.trim()) { showToast('Please enter a comment', 'warn'); return; }
      saveFeedback().then(renderPins);
      popup.remove();
    });

    popup.querySelector('.fb-resolve').addEventListener('click', () => {
      comment.status = comment.status === 'resolved' ? 'open' : 'resolved';
      saveFeedback().then(renderPins);
      popup.remove();
    });

    popup.querySelector('.fb-delete').addEventListener('click', () => {
      feedback.comments = feedback.comments.filter(c => c.id !== comment.id);
      saveFeedback().then(renderPins);
      popup.remove();
    });

    popup.querySelector('.fb-cancel').addEventListener('click', () => popup.remove());

    document.body.appendChild(popup);
    popup.querySelector('textarea').focus();
  }

  function showNewPopup(metadata, anchor, onClose) {
    // Clean up any previous uncommitted popup
    if (activeCleanup) { activeCleanup(); activeCleanup = null; }
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
      activeCleanup = null;
      popup.remove();
      anchor.remove();
      if (onClose) onClose();
    };
    activeCleanup = cleanup;
    // Suppress outside-click dismiss for one tick so the mouseup→click
    // event sequence from area drawing doesn't immediately kill the popup
    suppressDismiss = true;
    setTimeout(() => { suppressDismiss = false; }, 0);

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

  // --- Event Handlers ---
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

  function handleMouseDown(e) {
    if (overlayMode !== 'feedback' || mode !== 'area') return;
    if (e.target.closest('.fb-toolbar') || e.target.closest('.fb-popup') ||
        e.target.closest('.fb-sidebar') || e.target.closest('.fb-pin') || e.target.closest('.fb-area-pin')) return;

    isDrawing = true;
    drawStart = { x: e.pageX, y: e.pageY };

    drawRect = document.createElement('div');
    drawRect.className = 'fb-draw-rect';
    drawRect.style.left = e.clientX + 'px';
    drawRect.style.top = e.clientY + 'px';
    document.body.appendChild(drawRect);
  }

  function handleMouseMove(e) {
    if (!isDrawing || !drawRect) return;
    const x = Math.min(e.clientX, drawStart.x - window.scrollX + window.scrollX);
    const y = Math.min(e.clientY, drawStart.y - window.scrollY + window.scrollY);
    const w = Math.abs(e.clientX - (drawStart.x - window.scrollX));
    const h = Math.abs(e.clientY - (drawStart.y - window.scrollY));

    drawRect.style.left = Math.min(e.clientX, drawStart.x - window.scrollX) + 'px';
    drawRect.style.top = Math.min(e.clientY, drawStart.y - window.scrollY) + 'px';
    drawRect.style.width = w + 'px';
    drawRect.style.height = h + 'px';
  }

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

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (activeCleanup) { activeCleanup(); activeCleanup = null; }
      else { document.querySelectorAll('.fb-popup').forEach(p => p.remove()); }
      if (sidebar.classList.contains('open')) sidebar.classList.remove('open');
    }
  }

  // --- Initialization ---
  async function init(cfg) {
    config = { ...config, ...cfg };
    feedback.mockup = config.mockup;

    injectStyles();
    createToolbar();
    createSidebar();

    // Load existing feedback
    await loadFeedback();

    // Check version
    const currentHash = hashString(document.body.innerHTML);
    if (feedback.htmlHash && feedback.htmlHash !== currentHash && feedback.comments.length > 0) {
      const banner = document.createElement('div');
      banner.className = 'fb-version-banner';
      banner.textContent = 'This mockup was updated since your last annotations. Some pins may have moved.';
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 8000);
    }

    renderPins();

    // Bind events
    document.addEventListener('click', handleElementClick, true);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    // Close popups on outside click
    document.addEventListener('click', (e) => {
      if (suppressDismiss) return;
      if (!e.target.closest('.fb-popup') && !e.target.closest('.fb-pin') && !e.target.closest('.fb-area-pin')) {
        if (activeCleanup) { activeCleanup(); activeCleanup = null; }
        else { document.querySelectorAll('.fb-popup').forEach(p => p.remove()); }
      }
    });
  }

  return { init };
})();
