# Pact Tree Layout Design

## Overview

OSRS League 6 (Demonic Pacts) uses a radial tree layout for pacts instead of the grid/row layout used by relics and masteries. The tree has a central node with 6 branches radiating outward — 3 for pure combat styles (melee, range, magic) and 3 for hybrid combinations between them. Each branch can have arbitrary depth, and every node is a full pact with its own effects.

This design adds tree layout support to the picker without affecting existing grid-based pages.

## Data Structure

### Schema Changes (`src/content/config.ts`)

New `treeNodeSchema` for pact tree nodes:

```typescript
const treeNodeSchema = z.object({
  id: z.string(),
  src: z.string(),
  pactLabel: z.string(),
  toolTipItems: z.array(z.string()).default([]),
  children: z.lazy(() => z.array(treeNodeSchema)).optional(),
});
```

League schema changes:
- `layout` enum gains `'tree'` value: `z.enum(['columns', 'rows', 'tree'])`
- New optional `tree` field: `tree: treeNodeSchema.optional()`
- Existing `items` field remains for grid layouts; `tree` field used for tree layouts

### JSON Structure (`osrs-6-pacts.json`)

```json
{
  "game": "osrs",
  "leagueNumber": 6,
  "name": "Demonic Pacts League",
  "pageType": "pacts",
  "layout": "tree",
  "isRs3": false,
  "backgroundColor": "#0C0000",
  "exportFilename": "pacts.png",
  "meta": { ... },
  "theme": { ... },
  "items": {},
  "tree": {
    "id": "center",
    "src": "/osrs/6/pacts/center.png",
    "pactLabel": "Center Pact",
    "toolTipItems": ["Effect description"],
    "children": [
      {
        "id": "melee-1",
        "src": "/osrs/6/pacts/melee-1.png",
        "pactLabel": "Melee Pact I",
        "toolTipItems": ["Effect description"],
        "children": [
          {
            "id": "melee-2",
            "src": "/osrs/6/pacts/melee-2.png",
            "pactLabel": "Melee Pact II",
            "toolTipItems": ["Effect description"]
          }
        ]
      }
    ]
  }
}
```

## Components

### New: `PactTree.astro`

Replaces `ItemGrid` for tree layouts. Responsible for:
- Receiving the `tree` root node as a prop
- Rendering a fixed-aspect-ratio container with `position: relative`
- Positioning `PactNode` components using absolute positioning, calculated from branch angle (60-degree intervals) and depth along the branch
- Rendering an SVG overlay (same dimensions, `pointer-events: none`) with `<line>` elements connecting parent/child nodes
- Each SVG line has `data-from` and `data-to` attributes matching node IDs for client-side reactivity

### New: `PactNode.astro`

Individual pact node component, similar to `RelicItem`/`MasteryItem`. Renders:
- Pact image (`src`)
- Pact label (`pactLabel`)
- Data attributes for picker.ts: `data-label`, `data-image-src`, `data-items` (JSON stringified toolTipItems)
- Uses `.pact` CSS class

Reused in both desktop radial view and mobile flat view.

### Modified: `[...slug].astro`

Conditionally renders `PactTree` when `layout === 'tree'`, otherwise `ItemGrid` as before:

```astro
{data.layout === 'tree' ? (
  <PactTree tree={data.tree} />
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

### SVG Line Reactivity

After each selection toggle, iterate all SVG lines and update appearance:
- If both `data-from` and `data-to` nodes are selected: full opacity, brighter/thicker line
- Otherwise: semi-transparent, default thickness

### Selection Behavior

Pure toggle — any node can be selected/deselected independently. No path-based restrictions (this is a planning tool, not enforcing game rules).

Opacity dims unselected nodes, same as current relics/masteries.

### URL State

No changes to serialization logic. Selected pact IDs serialize the same way: `?selected=center,melee-1,melee-2&title=My%20Build`

### Export

The radial tree container uses fixed dimensions during export (`main.exporting` overrides) so html2canvas captures the full tree consistently regardless of viewport.

## Showcase Support

### Tree Flattening Utility

The showcase resolves selected IDs from URL params against the item data. For tree layouts, a utility flattens the tree into a lookup map:

```typescript
function flattenTree(node: TreeNode): Map<string, TreeNode> {
  const map = new Map();
  map.set(node.id, node);
  for (const child of node.children ?? []) {
    for (const [id, n] of flattenTree(child)) {
      map.set(id, n);
    }
  }
  return map;
}
```

Showcase uses this map to look up image/label for each selected ID, same as it does today with the flat `items` structure.

## CSS & Responsive Behavior

### Desktop (>1024px) — Radial Layout

- Tree container: fixed-aspect-ratio box, centered in `main`
- Nodes: `position: absolute`, placed via inline styles calculated from branch angle + depth
- SVG overlay: same dimensions as container, `pointer-events: none`
- Line default: semi-transparent white
- Line selected state (both endpoints selected): full opacity, slightly thicker or glowing
- Node images and labels use `.pact` / `.pactImg` / `.pactLabel` classes

### Tablet (769px-1024px) — Scaled Radial

- Same radial layout, scaled down (smaller images/labels, tighter spacing)

### Mobile (<768px) — Flat Vertical Layout

- Switches from radial to vertical list
- Each branch becomes a labeled section
- Children indented with a small parent thumbnail + label as breadcrumb reference
- Standard vertical scroll
- Same `PactNode` component, different layout wrapper

### Export Overrides (`main.exporting`)

- Force radial desktop layout at fixed dimensions
- Ensures consistent export from any device
