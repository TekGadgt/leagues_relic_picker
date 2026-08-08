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

The wiki's `Equilibrium_League_regions.png` is a 904×667 in-game screenshot: tab
chrome baked in, every locked region flat-shaded the same muted green, region
shapes not separable from the plate.

**Chosen approach — illustrated plate plus badge nodes.** Crop the chrome off,
use the map as a static background, and position the eleven 50×50 region badges
on top as absolutely-placed nodes. Selection state rides entirely on the badge:
picked is full opacity plus the gold glow already used on blessings, unpicked is
dimmed and desaturated. This is the `PactGraph` pattern minus edges and minus
zoom.

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
