# Regions picker — Equilibrium League

Status: approved, not yet implemented
Branch: `regions-picker`
Date: 2026-08-07

## What we're building

A regions page for RS3 Leagues 2 at `/rs3/2/regions/`, with the same three
affordances the relic and blessing pages have: export to PNG, a Copy Image Link
share card, and a randomizer.

Data is final — the last reveal landed 2026-08-07, so nothing here is
provisional.

## The ruleset

Six regions are unlocked over a run. Three are not choices:

| Region | Status |
|---|---|
| Misthalin | Unlocked from the start |
| Havenhythe | Unlocked from the start |
| Karamja | Forced, at 50 tasks |

The remaining three are free choices from a pool of eight, taken in order at
task milestones:

| Tasks | Slot | Chosen from |
|---|---|---|
| 175 | 4 | Anachronia, Asgarnia, Fremennik, Kandarin, Kharidian Desert, Morytania, Tirannwn, Wilderness |
| 300 | 5 | ” |
| 450 | 6 | ” |

No region can be taken twice. **There is no adjacency constraint** — the game is
dense with teleports, so any three of the eight is a legal build. This is the
single biggest simplification versus the pact graph, which does have to walk
edges.

## Why slots are an ordering, not a grouping

The obvious move is to model the three slots as `groups` and reuse
`tier-selection.ts`. That's wrong here. Tier groups work because each tier holds
a distinct set of items — a relic exists in exactly one tier, so "the group
containing this element" identifies the tier. On a map there is exactly one
badge per region, and any of the eight can land in any of the three slots. There
is no containment relationship to read a slot out of.

So the state is an **ordered list of at most three region ids**, and the slot is
just the index. Concretely:

- Clicking an unpicked region appends it, if there's room.
- Clicking a picked region removes it, and later picks shift up — slot 5 becomes
  slot 4. The thresholds mean "your Nth unlock," so shifting is the correct
  reading, not a compromise.
- Clicking a mandatory region does nothing.

This is a new, small module (`src/scripts/region-selection.ts`) rather than an
extension of `tier-selection.ts`. It is materially simpler than the tier rules:
no bonus granter, no arming, no reconciliation guesswork.

### URL state comes free

`?selected=` is already a comma-separated id list and the URL preserves its
order, so `?selected=morytania,wilderness,tirannwn` encodes both the picks and
the slot assignment with no new parameter. Restoring is a left-to-right replay
of the list, dropping anything unknown, not in the pool, duplicated, or past the
third pick.

Contrast `tier-selection.ts`, which needed a separate `bonus` param because a
bonus pick was genuinely unrecoverable from an id list. Nothing here is
ambiguous.

## Visual approach

**Superseded.** The section below records an earlier plan to use the in-game
screenshot as a background plate. See "Vector map — what we built" for what
shipped and why the plate was dropped.

<details>
<summary>Earlier plate-based plan (not built)</summary>


The wiki's `Equilibrium_League_regions.png` is a 904×667 in-game screenshot: tab
chrome baked in, every locked region flat-shaded the same muted green, region
shapes not separable from the plate.

**Chosen approach — illustrated plate plus badge nodes.** Crop the chrome off and
use the map as a static background, with absolutely-placed nodes on top. This is
the `PactGraph` pattern minus edges and minus zoom.

The plate turned out to already have the badges drawn on it, **desaturated for
locked regions and bright for the two starting ones**. That is precisely the
locked state we want, so rather than fighting it:

- The plate supplies the unpicked appearance for all eleven regions.
- The interactive layer supplies a transparent hit target per region, carrying
  the `data-label` / `data-image-src` / `data-items` attributes the sidebar and
  export already read.
- Picking overlays the bright 50×50 wiki badge, slightly larger than the baked
  one, plus the gold glow used on blessings. Overlaying larger is deliberate: it
  fully conceals the dull badge underneath, and any residual rim is absorbed by
  the glow.
- Mandatory regions render in that lit state permanently. Karamja is baked dull
  despite being forced, so it needs the overlay from the start; Misthalin and
  Havenhythe are baked bright and would look right either way, but get the same
  treatment for consistency.

This also removes the coordinate guesswork — positions come from the baked art.

Plate is 828×372, palette-reduced to 256 colours (299K → 95K, RMSE 1.1%). Baked
badge diameter is ~36px, so the lit overlay should render a little above that.

**Rejected — traced region polygons.** thersguide does this and it looks sharp,
but it costs eleven hand-traced landmasses and lands on an austere vector
aesthetic that isn't ours. The plate keeps the illustrated map, costs no tracing,
and is more in keeping with the rest of the site.

The plate has Misthalin and Havenhythe already tinted as unlocked, which is
permanently correct since they always are. Karamja reads as locked in the source
image; we do **not** try to repaint the landmass. Unlock state is communicated by
the badge, uniformly for all six, so the one inconsistent landmass is scenery.

### The slot rail

Borrowed in concept from thersguide, built in our own idiom: a rail listing the
three mandatory regions and the three choice slots. Each choice slot shows its
task threshold, its region once picked, and is where the per-slot randomizer
button lives.

We keep the game's real slot numbers (3/4/5/6) and thresholds rather than
renumbering 01–05 as thersguide does, because those numbers are the actual
information a shared build carries — what you rush first, and at what cost.

Mandatory entries render lit but non-interactive with a marker, so a shared
build doesn't read as though the player chose all six.

### Badge coordinates

Starting estimates, as percentages of the cropped plate. The crop box is
`(33,205)`–`(872,650)` of the original 904×667. **These are eyeballed and need
visual verification against the rendered page.**

| Region | x% | y% |
|---|---|---|
| Fremennik | 30.5 | 27.0 |
| Wilderness | 53.0 | 27.6 |
| Anachronia | 80.1 | 27.0 |
| Asgarnia | 45.1 | 49.2 |
| Misthalin | 53.2 | 55.1 |
| Morytania | 66.0 | 52.1 |
| Tirannwn | 22.2 | 58.7 |
| Kandarin | 32.2 | 57.3 |
| Karamja | 42.3 | 74.6 |
| Kharidian Desert | 57.6 | 81.1 |
| Havenhythe | 91.1 | 64.5 |

Badge files are `{Region}_League_Region_Badge.png` on the wiki, except the desert
which is `Desert_League_Region_Badge.png`. All are 50×50. Low-res, but uniformly
so, which matches the rest of the RS3/2 assets.

</details>

## Vector map — what we built

The plate was dropped. On a 1200×630 share card it would be upscaling an 828px
screenshot; it bakes in unlock state we don't control; hit areas would be
invisible rectangles rather than the landmass a player is aiming at; and it's a
lifted UI capture that can't be themed.

Deriving the shapes from the screenshot by flood fill was tried and abandoned.
The internal boundaries are one anti-aliased pixel wide, so fills leak between
regions through the gaps, and a threshold wide enough to seal them starts eating
coastline instead.

**The chunk grid is the real source.** The game assigns every chunk of the world
map to a League region, published as a 128×96 grid, so region shapes are a fact
about the game and recoverable exactly.
`scripts/build-region-shapes.mjs` walks the boundary between in-region and
out-of-region chunks and chains the edges into closed loops.

Provenance: the grid was extracted from region map data published by
thersguide.com, normalised into `scripts/data/rs3-2-region-chunks.json`, and
verified against the wiki's in-game map — including the unlabelled south-western
landmass, which both sources agree is Misthalin. Only the chunk assignments are
taken; shapes, smoothing, styling and rendering are ours. **Credit them in the
page footer.**

### Coast is rounded, borders are not

Smoothing everything made the map look like melted wax and, worse, would let two
neighbours' shared frontier drift apart into slivers. Each boundary edge already
knows what's on the other side, so it's tagged coast (sea beyond) or border
(another region beyond). Chaikin corner-cutting and curve fitting apply only
where coast meets coast; frontiers stay ruler-straight on the chunk grid. That
reads like a real map and keeps neighbours tiling exactly.

Two bugs worth remembering:

- **Corner touches.** Where chunks meet at only a corner, a vertex has two
  outgoing edges. Keying edges by start point drops one and closes the loop
  across the diagonal — large triangular bites out of Wilderness, Anachronia and
  Havenhythe. Fixed by keeping all outgoing edges and taking the most clockwise
  turn, which also keeps the rings separate rather than splicing them into a
  figure-eight.
- **Speckle.** Some chunks inside a region are unassigned and some regions have
  one- or two-chunk offshore slivers, neither visible in game. Holes up to 6
  chunks are filled, islands under 3 dropped. Most regions fall to one or two
  loops; Fremennik stays at 8, which is correct — it really is scattered.

Badge anchors are the chunk furthest from any edge **within the largest
landmass**; plain maximum clearance stranded Fremennik's badge on an islet.

`SMOOTH_PASSES` defaults to 2. Output is 56KB of path data, 12.5KB brotli.
Coordinates are rounded to a tenth of a chunk, well under a pixel at any size
this renders at.

Regenerate with `npm run build:regions`. Geometry is generated, so it lives in
`src/data/rs3-2-region-shapes.json`, apart from the hand-authored league content
file — fix a wrong shape in the chunk data, never in the output.

## Randomizer

A new strategy registered in `STRATEGIES`, named `regions`. The existing plan
contract fits unchanged — strategies return picks and never touch the DOM, and
the caller applies them through normal click handling, so illegal builds stay
inexpressible.

- `rollAll` — shuffle the eight, take three, `clearFirst: true`.
- `rollNext` — one random unpicked region into the next free slot. This is the
  progression beat: "roll my next unlock." It maps onto the region page more
  naturally than it does onto tiers, since the game genuinely reveals these one
  at a time as you cross thresholds.

`RollPlan.bonusPick` is unused here and stays undefined.

### Animation

`roll-animation.ts` spins reels in place within a group. That doesn't transfer:
badges sit at fixed map positions, so cycling them in place would flash glows
across the whole map.

Instead the reel runs **in the slot rail row** — cycling region names and badges
in the slot being filled — and the map badge lights up on land. Same easing
constants and skip-on-click behaviour, different mount point. Treat this as the
one genuinely new piece of animation work, not a reuse.

## Wiring

Mechanical, small, and mostly additive:

- `src/content/config.ts` — `pageType` gains `'regions'`; `randomizer` enum gains
  `'regions'`; a `map` layout variant carrying the plate and badge nodes
- `src/pages/[...slug].astro` — branch to the new component
- `src/components/RegionMap.astro` — plate plus nodes
- `src/components/RegionRail.astro` — the slot rail
- `src/layouts/PickerLayout.astro` — `pageType` union, and `onePickPerTier` must
  stay false for regions
- `src/components/Navbar.astro` — `itemType`
- `src/scripts/showcase.ts` — render region rows using the badges
- `netlify/functions/share-image.mjs` — add `regions` to `PAGE_PATTERN` (line 18)
- `src/content/leagues/rs3-2-regions.json` — content, with `randomizer` and
  `shareImage: true`
- `src/pages/index.astro` — homepage link and label

## Share image cache

A new route is purely additive: existing relic and blessing share URLs keep
working and keep their cached renders.

The risk is staleness, not breakage. Cached cards are pinned for a year via
`Netlify-Cache-ID`, so if this work touches shared styling or `PickerLayout` in a
way that changes how the existing pages render, previously-shared cards keep
serving the old look. Mitigation: keep region work in new files wherever
possible, and if shared CSS does change, bump `share-image-v1` to `v2` in the
same deploy.

Region pages should render faster than blessings — one plate plus eleven small
badges is far less than a full blessing grid.

## Out of scope

- Backfilling regions to any other league
- Region-specific content beyond the badge and the wiki blurb
- Any adjacency or reachability logic
