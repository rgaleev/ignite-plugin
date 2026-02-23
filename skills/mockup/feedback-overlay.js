/**
 * Ignite Feedback Overlay
 * Annotation system for mockup pages - injected via <script> tag
 * Zero dependencies, pure browser JavaScript
 */
const FeedbackOverlay = (() => {
  let config = { mockup: '', serverPort: 3000 };
  let feedback = { mockup: '', version: 1, htmlHash: '', comments: [] };
  let mode = 'element'; // 'element' | 'area' | null
  let isDrawing = false;
  let drawStart = null;
  let drawRect = null;
  let selectedElement = null;
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
      <button class="fb-mode-element active" title="Click elements to annotate">Element</button>
      <button class="fb-mode-area" title="Draw rectangle to annotate area">Area</button>
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
  function showPopup(comment, anchor) {
    document.querySelectorAll('.fb-popup').forEach(p => p.remove());
    const popup = document.createElement('div');
    popup.className = 'fb-popup';

    const isNew = !comment.comment && comment.status === 'open';
    popup.innerHTML = `
      <textarea placeholder="What should change here?">${comment.comment || ''}</textarea>
      <div class="fb-actions">
        <button class="fb-save">${isNew ? 'Add' : 'Update'}</button>
        ${!isNew ? '<button class="fb-resolve">' + (comment.status === 'resolved' ? 'Reopen' : 'Resolve') + '</button>' : ''}
        ${!isNew ? '<button class="fb-delete">Delete</button>' : ''}
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

    const resolveBtn = popup.querySelector('.fb-resolve');
    if (resolveBtn) {
      resolveBtn.addEventListener('click', () => {
        comment.status = comment.status === 'resolved' ? 'open' : 'resolved';
        saveFeedback().then(renderPins);
        popup.remove();
      });
    }

    const deleteBtn = popup.querySelector('.fb-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        feedback.comments = feedback.comments.filter(c => c.id !== comment.id);
        saveFeedback().then(renderPins);
        popup.remove();
      });
    }

    popup.querySelector('.fb-cancel').addEventListener('click', () => popup.remove());

    document.body.appendChild(popup);
    popup.querySelector('textarea').focus();
  }

  // --- Event Handlers ---
  function handleElementClick(e) {
    if (mode !== 'element') return;
    const el = e.target;
    if (el.closest('.fb-toolbar') || el.closest('.fb-popup') || el.closest('.fb-sidebar') ||
        el.closest('.fb-pin') || el.closest('.fb-area-pin')) return;

    e.preventDefault();
    e.stopPropagation();

    const comment = {
      id: uuid(),
      type: 'element',
      selector: getSelector(el),
      elementText: getElementText(el),
      rect: null,
      comment: '',
      status: 'open',
      timestamp: new Date().toISOString(),
      version: feedback.version
    };

    feedback.comments.push(comment);
    renderPins();

    // Show popup for the new comment
    const pins = document.querySelectorAll('.fb-pin');
    const lastPin = pins[pins.length - 1];
    if (lastPin) showPopup(comment, lastPin);
  }

  function handleMouseDown(e) {
    if (mode !== 'area') return;
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

    const comment = {
      id: uuid(),
      type: 'area',
      selector: null,
      elementText: null,
      rect: { x, y, w, h },
      comment: '',
      status: 'open',
      timestamp: new Date().toISOString(),
      version: feedback.version
    };

    feedback.comments.push(comment);
    renderPins();

    // Show popup for area
    setTimeout(() => {
      const areas = document.querySelectorAll('.fb-area-pin');
      const lastArea = areas[areas.length - 1];
      if (lastArea) showPopup(comment, lastArea);
    }, 50);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.fb-popup').forEach(p => p.remove());
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
      if (!e.target.closest('.fb-popup') && !e.target.closest('.fb-pin') && !e.target.closest('.fb-area-pin')) {
        document.querySelectorAll('.fb-popup').forEach(p => p.remove());
      }
    });
  }

  return { init };
})();
