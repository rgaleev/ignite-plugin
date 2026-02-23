---
name: mockup
description: Use when generating interactive HTML mockups from a PRD, creating visual prototypes for user feedback, or setting up mockup annotation infrastructure
---

# Mockup Generation

## Overview

Generate mid-fi interactive HTML mockups from a PRD. Each screen becomes a self-contained HTML file with Tailwind CSS, working navigation, real sample data, and an injected feedback overlay for annotations.

## Preconditions

| Check | If missing |
|-------|-----------|
| `PRD.md` exists in project root | "No PRD.md found. Run `/ignite:prd` first." |

## Process

### Step 1: Analyze PRD

Read `PRD.md` and identify:
1. **Screens** — one per User Workflow (plus Settings if applicable)
2. **Navigation structure** — how screens connect
3. **Key elements per screen** — from Features table
4. **Sample data** — realistic examples for each screen

Present the planned screens to the user:
```
I'll generate [N] mockup screens:
1. upload.html — Photo upload with drag & drop, batch support
2. analysis.html — AI analysis results with keyword/description editing
3. export.html — Stock agency export with adapter selection
4. settings.html — API keys, model configuration

Approve or modify?
```

### Step 2: Set Up Infrastructure

1. Create `mockups/` directory in project root
2. Copy `feedback-server.js` from the plugin's `skills/mockup/` directory to `mockups/`
3. Copy `feedback-overlay.js` from the plugin's `skills/mockup/` directory to `mockups/`
4. Generate `.gitignore` in project root (append if exists):
```gitignore
# Ignite process artifacts
*.feedback.json
.feedback-server-port
.feedback-server-pid
feedback-server.js
feedback-overlay.js
node_modules/
```

### Step 3: Generate HTML Mockups

For each screen, generate a self-contained HTML file following this structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Screen Name] — [Project Name] Mockup</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root {
      --color-primary: #3b82f6;
      --color-primary-hover: #2563eb;
      --color-surface: #ffffff;
      --color-surface-alt: #f8fafc;
      --color-border: #e2e8f0;
      --color-text: #1e293b;
      --color-text-muted: #64748b;
      --font-heading: system-ui, -apple-system, sans-serif;
      --font-body: system-ui, -apple-system, sans-serif;
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.1);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
    }
    .btn-primary { background: var(--color-primary); color: white; border-radius: var(--radius-md); }
    .btn-primary:hover { background: var(--color-primary-hover); }
    .card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <nav class="bg-white border-b border-gray-200 px-6 py-3">
    <div class="flex items-center justify-between max-w-7xl mx-auto">
      <span class="font-bold text-lg">[Project Name]</span>
      <div class="flex gap-4">
        <a href="upload.html" class="text-gray-600 hover:text-blue-600">Upload</a>
        <a href="analysis.html" class="text-gray-600 hover:text-blue-600">Analysis</a>
        <a href="export.html" class="text-gray-600 hover:text-blue-600">Export</a>
        <a href="settings.html" class="text-gray-600 hover:text-blue-600">Settings</a>
      </div>
    </div>
  </nav>

  <main class="max-w-7xl mx-auto p-6">
    <!-- Screen-specific content with semantic IDs -->
    <!-- Real sample data, not lorem ipsum -->
    <!-- Tailwind for layout, CSS custom properties for design tokens -->
  </main>

  <script src="feedback-overlay.js"></script>
  <script>
    FeedbackOverlay.init({
      mockup: '[filename].html',
      serverPort: 3000
    });
  </script>
</body>
</html>
```

**Rules for mockup HTML:**
- **Navigation works** — real `<a href>` links between mockup pages
- **Hover/active states** — via Tailwind utilities
- **Forms are visual only** — no submission logic
- **No JavaScript** beyond the feedback overlay
- **Real sample data** — use realistic names, numbers, text
- **Semantic IDs** on key interactive elements (for feedback targeting)
- **CSS custom properties** for all design-sensitive values (colors, fonts, radii, shadows)
- **Tailwind only for layout** (flex, grid, padding, margin, responsive)
- **Active nav link** highlighted on each page

### Step 4: Start Feedback Server

Run the feedback server in background:
```
1. Check if port 3000 is in use (read .feedback-server-port, try connect)
2. If in use and PID file exists: kill process (taskkill /PID <pid> /F on Windows, kill <pid> on Unix)
3. Start server: node feedback-server.js mockups/ 3000 (run in background via Bash run_in_background)
4. Wait 2 seconds, verify http://localhost:3000 responds
5. Report to user:

   Mockups generated! [N] screens ready for review.

   Open in browser: http://localhost:3000

   Screens:
   - upload.html — Photo upload interface
   - analysis.html — AI analysis results
   - export.html — Stock export dashboard
   - settings.html — Configuration

   How to annotate:
   1. Click any element to add a comment (Element mode)
   2. Switch to Area mode to draw rectangles around regions
   3. Your annotations save automatically

   When done annotating, run /ignite:review to process feedback.
```

### Step 5: Generate index.html

Create a simple landing page at `mockups/index.html` that lists all mockup screens with links:
```html
<!DOCTYPE html>
<html>
<head>
  <title>[Project Name] — Mockups</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center">
  <div class="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
    <h1 class="text-2xl font-bold mb-6">[Project Name] Mockups</h1>
    <div class="space-y-3">
      <a href="upload.html" class="block p-3 rounded-lg bg-gray-50 hover:bg-blue-50 transition">
        Upload — Photo upload interface
      </a>
      <!-- ... more links -->
    </div>
  </div>
</body>
</html>
```

## Important Rules

- **One file per screen** — never combine screens
- **Fully self-contained** — each HTML works standalone (except Tailwind CDN and feedback overlay)
- **Mid-fidelity** — looks good enough to evaluate layout and flow, not pixel-perfect design
- **Real data** — every field, list, table uses realistic example data
- **Consistent navigation** — same nav bar on every page, active state on current page
- **CSS custom properties** for ALL visual tokens — this enables `/ignite:design --apply` to reskin without touching HTML
