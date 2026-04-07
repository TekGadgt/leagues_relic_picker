# Pact Tree Layout Design

## Overview

OSRS League 6 (Demonic Pacts) uses a graph-based pact tree instead of the grid/row layout used by relics and masteries. The graph has ~120 nodes and ~130 edges, with a central node branching into 6 main paths (3 red/combat-style paths, 3 white paths). Nodes can have multiple parents (it's a DAG, not a strict tree). The layout ranges from organic/freeform in the upper branches to structured grid-like lattice in the lower section.

The official Jagex site (runescape.com) renders this as an HTML/SVG canvas with explicit pixel positions for each node and SVG paths for edges. We extract this data directly for our picker rather than manually positioning nodes.

This design adds graph layout support to the picker without affecting existing grid-based pages.

## Data Source

Node positions and edge connections are extracted from the official Jagex pact page HTML:
- **Nodes**: `div.pact-node` elements with `data-node-id`, `left`/`top` inline styles, `background-image` URLs, and size classes (`size-sm`, `size-md`, `size-lg`)
- **Edges**: `path.pact-edge` elements with `data-edge-id` in format `e-FROM-TO`

A one-time extraction script converts this into our JSON format. Node pixel coordinates are normalized to percentages of the overall canvas bounding box. Node images are downloaded and hosted locally in `public/osrs/6/pacts/`.

## Data Structure

### Schema Changes (`src/content/config.ts`)

New schemas for graph nodes and edges:

```typescript
const graphNodeSchema = z.object({
  id: z.string(),
  x: z.number(),          // percentage position (0-100)
  y: z.number(),          // percentage position (0-100)
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
```

League schema changes:
- `layout` enum gains `'graph'` value: `z.enum(['columns', 'rows', 'graph'])`
- New optional `graph` field: `graph: pactGraphSchema.optional()`
- Existing `items` field remains for grid layouts; `graph` field used for graph layouts

### JSON Structure (`osrs-6-pacts.json`)

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
  "meta": { ... },
  "theme": { ... },
  "items": {},
  "graph": {
    "nodes": [
      { "id": "AA", "x": 50.0, "y": 45.2, "src": "/osrs/6/pacts/AA.png", "pactLabel": "Center Pact", "toolTipItems": ["Effect description"], "size": "md" },
      { "id": "B1", "x": 40.3, "y": 38.1, "src": "/osrs/6/pacts/B1.png", "pactLabel": "Pact B1", "toolTipItems": ["Effect description"], "size": "md" },
      ...
    ],
    "edges": [
      { "from": "AA", "to": "B1" },
      { "from": "AA", "to": "B2" },
      { "from": "AA", "to": "B3" },
      ...
    ]
  }
}
```

Node IDs follow the official naming convention (AA, B1-B3, BA-BC, C1-C4, etc.).

## Components

### New: `PactGraph.astro`

Replaces `ItemGrid` for graph layouts. Responsible for:
- Receiving the `graph` data (nodes + edges) as a prop
- Rendering a pannable/zoomable container with `position: relative`
- Positioning `PactNode` components using `position: absolute` with percentage-based `left`/`top` from the node data
- Rendering an SVG overlay (`pointer-events: none`) with `<line>` elements for each edge
- Each SVG line has `data-from` and `data-to` attributes matching node IDs for client-side reactivity
- Pan/zoom controls (zoom in, zoom out, reset/center) similar to the official site

### New: `PactNode.astro`

Individual pact node component, similar to `RelicItem`/`MasteryItem`. Renders:
- Pact image (`src`)
- Pact label (`pactLabel`) — hidden by default, shown on hover or when selected
- Data attributes for picker.ts: `data-label`, `data-image-src`, `data-items` (JSON stringified toolTipItems)
- Size variant class based on `size` field (`.pact-sm`, `.pact-md`, `.pact-lg`)
- Uses `.pact` CSS class

Reused in both desktop graph view and mobile flat view.

### Modified: `[...slug].astro`

Conditionally renders `PactGraph` when `layout === 'graph'`, otherwise `ItemGrid` as before:

```astro
{data.layout === 'graph' ? (
  <PactGraph graph={data.graph} />
) : (
  <ItemGrid items={data.items} layout={data.layout} pageType={data.pageType} isRs3={data.isRs3} />
)}
```

## Client-Side Interactivity (`picker.ts`)

### Item Detection

Add `.pact` as a third item class option. The init logic becomes:

```typescript
const itemClass = document.querySelector('.relic') ? 'relic'
  : document.querySelector('.pact') ? 'pact'
  : 'mastery';
```

### Pan/Zoom

The graph container supports:
- **Mouse wheel** to zoom in/out
- **Click and drag** on the background to pan
- **Zoom controls** (buttons for +, -, and reset/center)
- Transform applied via CSS `transform: translate(x, y) scale(z)` on the inner canvas element

### SVG Line Reactivity

After each selection toggle, iterate all SVG lines and update appearance:
- If both `data-from` and `data-to` nodes are selected: full opacity, brighter/thicker line
- Otherwise: semi-transparent, default thickness

### Selection Behavior

Pure toggle — any node can be selected/deselected independently. No path-based restrictions (this is a planning tool, not enforcing game rules).

Opacity dims unselected nodes, same as current relics/masteries.

### URL State

No changes to serialization logic. Selected pact IDs serialize the same way: `?selected=AA,B1,F1&title=My%20Build`

### Export

The graph container is reset to a known zoom/pan state during export so html2canvas captures the full graph consistently. Uses `main.exporting` CSS overrides.

## Showcase Support

### Graph Node Lookup

The showcase resolves selected IDs from URL params against the item data. For graph layouts, it builds a lookup map from the flat nodes array:

```typescript
// For graph layouts, nodes are already flat — just index by ID
const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
```

Showcase uses this map to look up image/label for each selected ID. The `LeagueData` type in `showcase.ts` gains an optional `graph` field, and the showcase page passes it through from the league data.

The `LeagueEntry` type in `showcase.astro` also needs the `graph` field added, and the showcase page needs to pass `league.data.graph` when building `leagueData`.

## CSS & Responsive Behavior

### Desktop (>1024px) — Graph Layout

- Graph viewport: fills available space, `overflow: hidden`, acts as the pan/zoom container
- Inner canvas: large fixed-size element (matching the aspect ratio of the node bounding box), positioned via CSS transform
- Nodes: `position: absolute`, placed via percentage-based `left`/`top`
- SVG overlay: same dimensions as inner canvas, `pointer-events: none`
- Line default: semi-transparent white
- Line selected state (both endpoints selected): full opacity, slightly thicker or glowing
- Node sizes: `.pact-sm` ~30px, `.pact-md` ~50px, `.pact-lg` ~70px (scaled by zoom)
- Labels hidden by default, shown on hover and when node is selected

### Tablet (769px-1024px) — Same Graph, Smaller Default Zoom

- Same pan/zoom graph, starts at a lower default zoom level
- Slightly smaller node sizes

### Mobile (<768px) — Touch Pan/Zoom

- Same graph layout as desktop, with touch gesture support
- Pinch-to-zoom and drag-to-pan via touch events
- Starts at a lower default zoom to show more of the graph
- Zoom controls still visible for single-hand use
- Node tap targets remain large enough for comfortable interaction

### Export Overrides (`main.exporting`)

- Reset pan/zoom to show the full graph at a fixed scale
- Ensures consistent export from any device

## Data Extraction Script

A one-time Node.js script (`scripts/extract-pacts.js`) that:
1. Fetches the official Jagex pact page HTML (or reads from a saved copy)
2. Parses all `pact-node` divs to extract IDs, positions, image URLs, and sizes
3. Parses all `pact-edge` paths to extract edge connections from `data-edge-id`
4. Normalizes pixel positions to percentages based on the bounding box of all nodes
5. Downloads all node images to `public/osrs/6/pacts/`
6. Outputs the `graph` JSON (nodes + edges) ready to paste into `osrs-6-pacts.json`

This script is run once (or re-run if the official tree is updated) and is not part of the build pipeline.
