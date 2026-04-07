# Pact Graph Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pannable/zoomable graph layout for OSRS League 6 demonic pacts, with ~120 nodes and ~130 edges extracted from the official Jagex site.

**Architecture:** New `graph` layout type alongside existing `columns`/`rows`. Data stored as flat node array (with x/y percentages) + edge array in JSON. Rendered via absolute-positioned nodes + SVG line overlay in a pan/zoom container. Existing picker interactivity (toggle, sidebar, URL state, export) extended to handle `.pact` elements.

**Tech Stack:** Astro components, TypeScript, CSS absolute positioning, SVG for edges, html2canvas for export.

---

### Task 1: Data Extraction Script

**Files:**

- Create: `scripts/extract-pacts.mjs`

This script parses the official Jagex HTML to produce node + edge data and download images.

- [ ] **Step 1: Create the extraction script**

```javascript
// scripts/extract-pacts.mjs
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import https from 'https';

const HTML_FILE = 'scripts/pact-source.html';
const OUTPUT_JSON = 'scripts/pact-graph-output.json';
const IMAGE_DIR = 'public/osrs/6/pacts';

// Ensure output directory exists
fs.mkdirSync(IMAGE_DIR, { recursive: true });

const html = fs.readFileSync(HTML_FILE, 'utf-8');
const dom = new JSDOM(html);
const doc = dom.window.document;

// Extract nodes
const nodeEls = doc.querySelectorAll('.pact-node');
const rawNodes = [];

for (const el of nodeEls) {
  const id = el.getAttribute('data-node-id');
  const style = el.getAttribute('style') || '';

  const leftMatch = style.match(/left:\s*([-\d.]+)px/);
  const topMatch = style.match(/top:\s*([-\d.]+)px/);
  const bgMatch = style.match(/background-image:\s*url\("?([^"]+)"?\)/);

  const left = leftMatch ? parseFloat(leftMatch[1]) : 0;
  const top = topMatch ? parseFloat(topMatch[1]) : 0;
  const imageUrl = bgMatch ? bgMatch[1] : '';

  // Determine size from class
  let size = 'md';
  if (el.classList.contains('size-sm')) size = 'sm';
  if (el.classList.contains('size-lg')) size = 'lg';

  rawNodes.push({ id, left, top, imageUrl, size });
}

// Calculate bounding box for normalization
const allLeft = rawNodes.map(n => n.left);
const allTop = rawNodes.map(n => n.top);
const minX = Math.min(...allLeft);
const maxX = Math.max(...allLeft);
const minY = Math.min(...allTop);
const maxY = Math.max(...allTop);
const rangeX = maxX - minX;
const rangeY = maxY - minY;

// Add padding (5% on each side)
const padFrac = 0.05;

const nodes = rawNodes.map(n => ({
  id: n.id,
  x: parseFloat((((n.left - minX) / rangeX) * (1 - 2 * padFrac) * 100 + padFrac * 100).toFixed(2)),
  y: parseFloat((((n.top - minY) / rangeY) * (1 - 2 * padFrac) * 100 + padFrac * 100).toFixed(2)),
  src: `/osrs/6/pacts/${n.id}.png`,
  pactLabel: n.id,
  toolTipItems: [],
  size: n.size,
}));

// Extract edges
const edgeEls = doc.querySelectorAll('.pact-edge');
const edges = [];

for (const el of edgeEls) {
  const edgeId = el.getAttribute('data-edge-id') || '';
  // Format: e-FROM-TO
  const match = edgeId.match(/^e-(\w+)-(\w+)$/);
  if (match) {
    edges.push({ from: match[1], to: match[2] });
  }
}

// Write JSON output
const graph = { nodes, edges };
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(graph, null, 2));
console.log(`Extracted ${nodes.length} nodes and ${edges.length} edges`);
console.log(`Output written to ${OUTPUT_JSON}`);

// Download images
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    if (!url || url.includes('xyzuvwrst')) {
      // Placeholder/unsolved node — skip or use a default
      console.log(`  Skipping placeholder: ${filepath}`);
      resolve();
      return;
    }
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }
    }).on('error', reject);
  });
}

console.log('\nDownloading node images...');
for (const node of rawNodes) {
  const filepath = path.join(IMAGE_DIR, `${node.id}.png`);
  if (fs.existsSync(filepath)) {
    console.log(`  Already exists: ${node.id}.png`);
    continue;
  }
  try {
    await downloadImage(node.imageUrl, filepath);
    console.log(`  Downloaded: ${node.id}.png`);
  } catch (err) {
    console.error(`  Failed to download ${node.id}: ${err.message}`);
  }
}

console.log('\nDone!');
```

- [ ] **Step 2: Save the official HTML source**

Save the HTML from the Jagex pact page to `scripts/pact-source.html`. This is the div with class `osrs-pact-root` and its full contents (the HTML already provided by the user in conversation).

- [ ] **Step 3: Install jsdom and run the script**

```bash
npm install --save-dev jsdom
node scripts/extract-pacts.mjs
```

Expected: outputs `scripts/pact-graph-output.json` with ~120 nodes and ~130 edges, downloads images to `public/osrs/6/pacts/`.

- [ ] **Step 4: Verify output**

Check that the JSON has reasonable percentage values (all between 0-100) and that images downloaded:

```bash
node -e "const g = require('./scripts/pact-graph-output.json'); console.log('Nodes:', g.nodes.length, 'Edges:', g.edges.length); console.log('X range:', Math.min(...g.nodes.map(n=>n.x)).toFixed(1), '-', Math.max(...g.nodes.map(n=>n.x)).toFixed(1)); console.log('Y range:', Math.min(...g.nodes.map(n=>n.y)).toFixed(1), '-', Math.max(...g.nodes.map(n=>n.y)).toFixed(1));"
ls public/osrs/6/pacts/ | wc -l
```

- [ ] **Step 5: Commit**

```bash
git add scripts/extract-pacts.mjs scripts/pact-source.html scripts/pact-graph-output.json public/osrs/6/pacts/
git commit -m "feat: add pact data extraction script and extracted graph data"
```

---

### Task 2: Schema and JSON Data

**Files:**

- Modify: `src/content/config.ts`
- Modify: `src/content/leagues/osrs-6-pacts.json`

- [ ] **Step 1: Update the content schema**

In `src/content/config.ts`, add the graph schemas before the `leagueCollection` definition and update the league schema:

```typescript
import { defineCollection, z } from 'astro:content';

const itemSchema = z.object({
  id: z.string(),
  src: z.string(),
  relicLabel: z.string().optional(),
  title: z.string().optional(),
  toolTipItems: z.array(z.string()).default([]),
});

const graphNodeSchema = z.object({
  id: z.string(),
  x: z.number(),
  y: z.number(),
  src: z.string(),
  pactLabel: z.string(),
  toolTipItems: z.array(z.string()).default([]),
  size: z.enum(['sm', 'md', 'lg']).default('md'),
});

const graphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

const pactGraphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

const leagueCollection = defineCollection({
  type: 'data',
  schema: z.object({
    game: z.enum(['osrs', 'rs3']),
    leagueNumber: z.number(),
    name: z.string(),
    pageType: z.enum(['relics', 'masteries', 'pacts']),
    layout: z.enum(['columns', 'rows', 'graph']),
    isRs3: z.boolean().default(false),
    backgroundColor: z.string(),
    exportFilename: z.string(),
    meta: z.object({
      title: z.string(),
      description: z.string(),
      ogImage: z.string(),
      ogImageAlt: z.string(),
      url: z.string(),
    }),
    theme: z.object({
      titleColor: z.string(),
      navItemColor: z.string(),
      headerBackgroundColor: z.string(),
      backgroundColor: z.string(),
    }),
    items: z.record(z.string(), z.array(itemSchema)),
    graph: pactGraphSchema.optional(),
  }),
});

export const collections = {
  leagues: leagueCollection,
};
```

- [ ] **Step 2: Update osrs-6-pacts.json**

Replace the contents of `src/content/leagues/osrs-6-pacts.json` with the extracted graph data. Keep the existing metadata fields, change `layout` to `"graph"`, set `items` to `{}`, and add the `graph` field from `scripts/pact-graph-output.json`:

```json
{
  "game": "osrs",
  "leagueNumber": 6,
  "name": "Demonic Pacts League",
  "pageType": "pacts",
  "layout": "graph",
  "isRs3": false,
  "backgroundColor": "#0C0000",
  "exportFilename": "pacts.png",
  "meta": {
    "title": "Demonic Pacts Pact Picker",
    "description": "Set a title, pick your pacts, screenshot, and share",
    "ogImage": "https://relics.runetools.lol/osrs/6/poster_pacts.png",
    "ogImageAlt": "A Selection of Pacts for OSRS Demonic Pacts League.",
    "url": "https://relics.runetools.lol/osrs/6/pacts/"
  },
  "theme": {
    "titleColor": "#c33232",
    "navItemColor": "#7a0c0c",
    "headerBackgroundColor": "#140202",
    "backgroundColor": "#0C0000"
  },
  "items": {},
  "graph": <paste contents of scripts/pact-graph-output.json here>
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: builds successfully with the new schema and data.

- [ ] **Step 4: Commit**

```bash
git add src/content/config.ts src/content/leagues/osrs-6-pacts.json
git commit -m "feat: add graph schema and pact graph data to osrs-6-pacts.json"
```

---

### Task 3: PactNode Component

**Files:**

- Create: `src/components/PactNode.astro`

- [ ] **Step 1: Create the PactNode component**

```astro
---
interface Props {
  id: string;
  src: string;
  label: string;
  toolTipItems: string[];
  size: 'sm' | 'md' | 'lg';
}

const { id, src, label, toolTipItems, size } = Astro.props;
---

<div
  class={`pact pact-${size}`}
  id={id}
  data-label={label}
  data-image-src={src}
  data-items={JSON.stringify(toolTipItems)}
>
  <img class="pactImg" src={src} alt={`${label} pact icon`} />
  <span class="pactLabel">{label}</span>
</div>
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: builds successfully (component not used yet, but no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add src/components/PactNode.astro
git commit -m "feat: add PactNode component"
```

---

### Task 4: PactGraph Component

**Files:**

- Create: `src/components/PactGraph.astro`

- [ ] **Step 1: Create the PactGraph component**

```astro
---
import PactNode from './PactNode.astro';

interface GraphNode {
  id: string;
  x: number;
  y: number;
  src: string;
  pactLabel: string;
  toolTipItems: string[];
  size: 'sm' | 'md' | 'lg';
}

interface GraphEdge {
  from: string;
  to: string;
}

interface Props {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

const { graph } = Astro.props;

// Build a lookup for node positions (for SVG line endpoints)
const nodePositions = new Map(graph.nodes.map(n => [n.id, { x: n.x, y: n.y }]));
---

<div class="pact-viewport" id="pactViewport">
  <div class="pact-controls">
    <button id="pactZoomOut" title="Zoom out">-</button>
    <button id="pactZoomIn" title="Zoom in">+</button>
    <button id="pactZoomReset" title="Center">&#x1f441;</button>
  </div>

  <div class="pact-canvas" id="pactCanvas">
    <svg
      class="pact-edges"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {graph.edges.map(edge => {
        const fromPos = nodePositions.get(edge.from);
        const toPos = nodePositions.get(edge.to);
        if (!fromPos || !toPos) return null;
        return (
          <line
            x1={fromPos.x}
            y1={fromPos.y}
            x2={toPos.x}
            y2={toPos.y}
            data-from={edge.from}
            data-to={edge.to}
            class="pact-edge"
          />
        );
      })}
    </svg>

    <div class="pact-nodes">
      {graph.nodes.map(node => (
        <div class="pact-node-wrapper" style={`left: ${node.x}%; top: ${node.y}%;`}>
          <PactNode
            id={node.id}
            src={node.src}
            label={node.pactLabel}
            toolTipItems={node.toolTipItems}
            size={node.size}
          />
        </div>
      ))}
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/components/PactGraph.astro
git commit -m "feat: add PactGraph component with SVG edges and positioned nodes"
```

---

### Task 5: Wire Up the Page Route

**Files:**

- Modify: `src/pages/[...slug].astro`
- Modify: `src/layouts/PickerLayout.astro`

- [ ] **Step 1: Update [...slug].astro to conditionally render PactGraph**

```astro
---
import { getCollection } from 'astro:content';
import PickerLayout from '../layouts/PickerLayout.astro';
import ItemGrid from '../components/ItemGrid.astro';
import PactGraph from '../components/PactGraph.astro';

export async function getStaticPaths() {
  const leagues = await getCollection('leagues');

  return leagues.map((league) => {
    let slug: string;
    if (league.data.pageType === 'relics') {
      slug = `${league.data.game}/${league.data.leagueNumber}`;
    } else {
      slug = `${league.data.game}/${league.data.leagueNumber}/${league.data.pageType}`;
    }

    return {
      params: { slug },
      props: { league },
    };
  });
}

const { league } = Astro.props;
const { data } = league;
---

<PickerLayout
  meta={data.meta}
  theme={data.theme}
  backgroundColor={data.backgroundColor}
  exportFilename={data.exportFilename}
  pageType={data.pageType}
>
  {data.layout === 'graph' && data.graph ? (
    <PactGraph graph={data.graph} />
  ) : (
    <ItemGrid
      items={data.items}
      layout={data.layout}
      pageType={data.pageType}
      isRs3={data.isRs3}
    />
  )}
</PickerLayout>
```

- [ ] **Step 2: Verify build and dev server**

```bash
npm run build
npm run dev
```

Navigate to `http://localhost:4321/osrs/6/pacts/` — should see the graph nodes positioned (unstyled).

- [ ] **Step 3: Commit**

```bash
git add src/pages/[...slug].astro
git commit -m "feat: wire up PactGraph component on pacts page route"
```

---

### Task 6: Graph CSS Styles

**Files:**

- Modify: `src/styles/global.css`

- [ ] **Step 1: Add pact graph styles**

Add the following CSS at the end of `global.css` (before the responsive media queries):

```css
/* Pact graph layout */
.pact-viewport {
  position: relative;
  width: 100%;
  height: 80vh;
  overflow: hidden;
  cursor: grab;
}

.pact-viewport:active {
  cursor: grabbing;
}

.pact-controls {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  display: flex;
  gap: 5px;
}

.pact-controls button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background-color: rgba(0, 0, 0, 0.6);
  color: var(--title-color);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.pact-controls button:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.pact-canvas {
  position: absolute;
  width: 5000px;
  height: 5000px;
  transform-origin: 0 0;
}

.pact-edges {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.pact-edge {
  stroke: rgba(255, 255, 255, 0.3);
  stroke-width: 0.15;
  transition: stroke 0.2s, stroke-width 0.2s, opacity 0.2s;
}

.pact-edge.active {
  stroke: rgba(255, 200, 100, 0.9);
  stroke-width: 0.25;
}

.pact-nodes {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.pact-node-wrapper {
  position: absolute;
  transform: translate(-50%, -50%);
}

.pact {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

.pactImg {
  transition: opacity 0.2s;
}

.pact-sm .pactImg {
  width: 30px;
  height: 30px;
}

.pact-md .pactImg {
  width: 50px;
  height: 50px;
}

.pact-lg .pactImg {
  width: 70px;
  height: 70px;
}

.pactLabel {
  font-size: 0.7em;
  color: var(--title-color);
  text-align: center;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.2s;
  pointer-events: none;
  margin-top: 2px;
}

.pact:hover .pactLabel,
.pact.selected .pactLabel {
  opacity: 1;
}
```

- [ ] **Step 2: Add responsive overrides in the tablet media query (1024px)**

Inside the existing `@media screen and (max-width: 1024px) and (min-width: 769px)` block, add:

```css
  .pact-sm .pactImg {
    width: 24px;
    height: 24px;
  }

  .pact-md .pactImg {
    width: 40px;
    height: 40px;
  }

  .pact-lg .pactImg {
    width: 56px;
    height: 56px;
  }
```

- [ ] **Step 3: Add responsive overrides in the mobile media query (768px)**

Inside the existing `@media screen and (max-width: 768px)` block, add:

```css
  .pact-viewport {
    height: 70vh;
    touch-action: none;
  }

  .pact-sm .pactImg {
    width: 22px;
    height: 22px;
  }

  .pact-md .pactImg {
    width: 36px;
    height: 36px;
  }

  .pact-lg .pactImg {
    width: 50px;
    height: 50px;
  }
```

- [ ] **Step 4: Add export overrides**

After the existing `main.exporting` rules, add:

```css
main.exporting .pact-viewport {
  width: 1200px;
  height: 1200px;
  overflow: visible;
}

main.exporting .pact-canvas {
  transform: none !important;
  width: 1200px;
  height: 1200px;
}
```

- [ ] **Step 5: Verify dev server**

```bash
npm run dev
```

Navigate to `http://localhost:4321/osrs/6/pacts/` — nodes should now be visually styled and positioned with connecting lines visible.

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css
git commit -m "feat: add pact graph CSS styles with responsive and export overrides"
```

---

### Task 7: Pan/Zoom Interactivity

**Files:**

- Create: `src/scripts/pact-graph.ts`
- Modify: `src/layouts/PickerLayout.astro`

- [ ] **Step 1: Create the pan/zoom script**

```typescript
// src/scripts/pact-graph.ts
// Pan and zoom functionality for the pact graph

interface PanZoomState {
  scale: number;
  translateX: number;
  translateY: number;
  isPanning: boolean;
  startX: number;
  startY: number;
  lastTouchDist: number;
}

function initPactGraph(): void {
  const viewport = document.getElementById('pactViewport');
  const canvas = document.getElementById('pactCanvas');
  if (!viewport || !canvas) return;

  const state: PanZoomState = {
    scale: 0.15,
    translateX: 0,
    translateY: 0,
    isPanning: false,
    startX: 0,
    startY: 0,
    lastTouchDist: 0,
  };

  function applyTransform(): void {
    canvas!.style.transform = `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`;
  }

  function centerGraph(): void {
    const vw = viewport!.clientWidth;
    const vh = viewport!.clientHeight;
    const cw = 5000 * state.scale;
    const ch = 5000 * state.scale;
    state.translateX = (vw - cw) / 2;
    state.translateY = (vh - ch) / 2;
    applyTransform();
  }

  // Initialize centered
  centerGraph();

  // Mouse wheel zoom
  viewport.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const rect = viewport.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Zoom toward mouse position
    const newScale = Math.max(0.05, Math.min(1, state.scale * zoomFactor));
    const scaleRatio = newScale / state.scale;
    state.translateX = mouseX - (mouseX - state.translateX) * scaleRatio;
    state.translateY = mouseY - (mouseY - state.translateY) * scaleRatio;
    state.scale = newScale;
    applyTransform();
  }, { passive: false });

  // Mouse pan
  viewport.addEventListener('mousedown', (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('.pact, .pact-controls')) return;
    state.isPanning = true;
    state.startX = e.clientX - state.translateX;
    state.startY = e.clientY - state.translateY;
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!state.isPanning) return;
    state.translateX = e.clientX - state.startX;
    state.translateY = e.clientY - state.startY;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    state.isPanning = false;
  });

  // Touch pan and pinch zoom
  viewport.addEventListener('touchstart', (e: TouchEvent) => {
    if ((e.target as HTMLElement).closest('.pact-controls')) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if ((e.target as HTMLElement).closest('.pact')) return;
      state.isPanning = true;
      state.startX = touch.clientX - state.translateX;
      state.startY = touch.clientY - state.translateY;
    } else if (e.touches.length === 2) {
      state.isPanning = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      state.lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    }
  }, { passive: false });

  viewport.addEventListener('touchmove', (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && state.isPanning) {
      const touch = e.touches[0];
      state.translateX = touch.clientX - state.startX;
      state.translateY = touch.clientY - state.startY;
      applyTransform();
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (state.lastTouchDist > 0) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = viewport.getBoundingClientRect();
        const centerX = midX - rect.left;
        const centerY = midY - rect.top;

        const zoomFactor = dist / state.lastTouchDist;
        const newScale = Math.max(0.05, Math.min(1, state.scale * zoomFactor));
        const scaleRatio = newScale / state.scale;
        state.translateX = centerX - (centerX - state.translateX) * scaleRatio;
        state.translateY = centerY - (centerY - state.translateY) * scaleRatio;
        state.scale = newScale;
        applyTransform();
      }
      state.lastTouchDist = dist;
    }
  }, { passive: false });

  viewport.addEventListener('touchend', () => {
    state.isPanning = false;
    state.lastTouchDist = 0;
  });

  // Zoom controls
  document.getElementById('pactZoomIn')?.addEventListener('click', () => {
    state.scale = Math.min(1, state.scale * 1.2);
    applyTransform();
  });

  document.getElementById('pactZoomOut')?.addEventListener('click', () => {
    state.scale = Math.max(0.05, state.scale * 0.8);
    applyTransform();
  });

  document.getElementById('pactZoomReset')?.addEventListener('click', () => {
    state.scale = 0.15;
    centerGraph();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPactGraph);
} else {
  initPactGraph();
}

export {};
```

- [ ] **Step 2: Load the script on pact graph pages**

In `src/layouts/PickerLayout.astro`, conditionally include the pact-graph script when `pageType === 'pacts'`. After the existing `<script src="../scripts/picker.ts"></script>` line, add:

```astro
{pageType === 'pacts' && (
  <script src="../scripts/pact-graph.ts"></script>
)}
```

- [ ] **Step 3: Verify dev server**

```bash
npm run dev
```

Navigate to `http://localhost:4321/osrs/6/pacts/` — should be able to pan and zoom the graph with mouse and touch.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/pact-graph.ts src/layouts/PickerLayout.astro
git commit -m "feat: add pan/zoom interactivity for pact graph"
```

---

### Task 8: Picker Integration (Selection, Sidebar, Edge Reactivity)

**Files:**

- Modify: `src/scripts/picker.ts`

- [ ] **Step 1: Update item class detection**

In `picker.ts`, in the `initPicker` function, change the item class detection (around line 143):

```typescript
const itemClass = document.querySelector('.relic') ? 'relic'
  : document.querySelector('.pact') ? 'pact'
  : 'mastery';
```

- [ ] **Step 2: Update opacity function for pact elements**

In `updateElementOpacity`, add `.pactImg` and `.pactLabel` to the selector queries:

```typescript
function updateElementOpacity(element: HTMLElement, isSelected: boolean): void {
  const img = element.querySelector('.relicImg, .masteryImg, .pactImg') as HTMLElement | null;
  const label = element.querySelector('.relicLabel, .masteryLabel, .pactLabel') as HTMLElement | null;

  if (img) img.style.opacity = isSelected ? '1' : '0.25';
  if (label) label.style.opacity = isSelected ? '1' : '0.25';
}
```

- [ ] **Step 3: Add edge reactivity function**

Add this function after `updateElementOpacity`:

```typescript
function updateEdgeStyles(): void {
  const edges = document.querySelectorAll('.pact-edge');
  edges.forEach(edge => {
    const fromId = edge.getAttribute('data-from');
    const toId = edge.getAttribute('data-to');
    if (!fromId || !toId) return;

    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);
    const bothSelected = fromEl?.classList.contains('selected') && toEl?.classList.contains('selected');

    if (bothSelected) {
      edge.classList.add('active');
    } else {
      edge.classList.remove('active');
    }
  });
}
```

- [ ] **Step 4: Call edge update on toggle**

In the `toggleElement` function, add a call to `updateEdgeStyles()` after `updateURLParams`:

```typescript
function toggleElement(element: HTMLElement, elements: HTMLCollectionOf<Element>, titleSelector: string): void {
  const isSelected = element.classList.toggle('selected');
  updateElementOpacity(element, isSelected);
  updateURLParams(elements, titleSelector);
  updateEdgeStyles();
}
```

- [ ] **Step 5: Call edge update on initial selections**

At the end of `setInitialSelections`, after the opacity loop, add:

```typescript
  updateEdgeStyles();
```

- [ ] **Step 6: Verify dev server**

```bash
npm run dev
```

Navigate to `http://localhost:4321/osrs/6/pacts/`, select nodes, verify:
- Nodes toggle selected state
- Edges between two selected nodes highlight
- Detail sidebar works on right-click / double-tap
- URL updates with selected IDs

- [ ] **Step 7: Commit**

```bash
git add src/scripts/picker.ts
git commit -m "feat: integrate pact graph with picker selection and edge reactivity"
```

---

### Task 9: Showcase Support

**Files:**

- Modify: `src/pages/showcase.astro`
- Modify: `src/scripts/showcase.ts`

- [ ] **Step 1: Update LeagueEntry type and data passing in showcase.astro**

In `src/pages/showcase.astro`, update the `LeagueEntry` type to include the graph field, and pass it through:

```typescript
type LeagueEntry = {
  game: string;
  leagueNumber: number;
  name: string;
  pageType: string;
  theme: {
    titleColor: string;
    navItemColor: string;
    headerBackgroundColor: string;
    backgroundColor: string;
  };
  items: Record<string, unknown>;
  graph?: {
    nodes: Array<{
      id: string;
      src: string;
      pactLabel: string;
      toolTipItems: string[];
    }>;
    edges: Array<{ from: string; to: string }>;
  };
};
```

In the loop building `leagueData`, add the graph field:

```typescript
  leagueData[key] = {
    game: league.data.game,
    leagueNumber: league.data.leagueNumber,
    name: league.data.name,
    pageType: league.data.pageType,
    theme: league.data.theme,
    items: league.data.items,
    graph: league.data.graph,
  };
```

- [ ] **Step 2: Update LeagueData type in showcase.ts**

Add the graph field to the `LeagueData` interface:

```typescript
interface LeagueData {
  game: string;
  leagueNumber: number;
  name: string;
  pageType: 'relics' | 'masteries' | 'pacts';
  theme: {
    titleColor: string;
    navItemColor: string;
    headerBackgroundColor: string;
    backgroundColor: string;
  };
  items: Record<string, LeagueItem[]>;
  graph?: {
    nodes: Array<{
      id: string;
      src: string;
      pactLabel: string;
      toolTipItems: string[];
    }>;
    edges: Array<{ from: string; to: string }>;
  };
}
```

- [ ] **Step 3: Add graph node lookup to processURLs**

In the `processURLs` function, after the existing item lookup logic, add a branch for graph data:

```typescript
    // Get items based on page type
    let items: LeagueItem[];
    if (league.graph && league.graph.nodes.length > 0) {
      // Graph layout: look up nodes by ID directly
      const nodeMap = new Map(league.graph.nodes.map(n => [n.id, n]));
      items = parsed.selectedIds
        .map(id => {
          const node = nodeMap.get(id);
          if (!node) return null;
          return {
            id: node.id,
            src: node.src,
            title: node.pactLabel,
            toolTipItems: node.toolTipItems,
          };
        })
        .filter((item): item is LeagueItem => item !== null);
    } else if (league.pageType === 'relics') {
      items = getAllSelectedItems(parsed.selectedIds, league.items);
    } else {
      items = getHighestPerGroup(parsed.selectedIds, league.items);
    }
```

This replaces the existing ternary that assigns `items`.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/showcase.astro src/scripts/showcase.ts
git commit -m "feat: add graph node support to showcase page"
```

---

### Task 10: Export Handling

**Files:**

- Modify: `src/scripts/picker.ts`

- [ ] **Step 1: Update export logic for graph layout**

In `picker.ts`, in the export button click handler, add logic to reset graph pan/zoom before capture and restore after. Before the `requestAnimationFrame` call that does the capture, add:

```typescript
      // Reset graph pan/zoom for consistent export
      const pactCanvas = document.getElementById('pactCanvas');
      const savedTransform = pactCanvas?.style.transform || '';
      if (pactCanvas) {
        pactCanvas.style.transform = 'none';
      }
```

And in the `restoreLayout` function, add:

```typescript
      const restoreLayout = () => {
        mainElement.classList.remove('exporting');
        mainElement.style.paddingTop = '';
        mainElement.style.paddingBottom = '';
        mainElement.style.backgroundColor = '';
        if (pactCanvas) {
          pactCanvas.style.transform = savedTransform;
        }
      };
```

- [ ] **Step 2: Verify export works**

```bash
npm run dev
```

Navigate to pacts page, select some nodes, click export. Verify the exported image shows the full graph.

- [ ] **Step 3: Commit**

```bash
git add src/scripts/picker.ts
git commit -m "feat: handle graph pan/zoom reset during export"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Full build check**

```bash
npm run build
```

- [ ] **Step 2: Test all pages still work**

```bash
npm run preview
```

Verify:

- `http://localhost:4321/` — homepage loads
- `http://localhost:4321/osrs/1/` — relics page works as before
- `http://localhost:4321/osrs/5/masteries/` — masteries page works as before
- `http://localhost:4321/osrs/6/pacts/` — graph renders with pan/zoom, selection works, edges react, export works
- `http://localhost:4321/osrs/6/pacts/?selected=AA,B1,B2&title=Test` — URL state restores correctly

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: final adjustments for pact graph layout"
```
