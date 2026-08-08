/**
 * Turn the Equilibrium region chunk grid into SVG outlines.
 *
 * The game assigns each chunk of the world map to a League region, so region
 * shapes are a fact about the game rather than something to draw by hand. This
 * walks the boundary between in-region and out-of-region chunks and chains the
 * resulting edges into closed loops — exact, rectilinear, and blocky in a way
 * that suits the map's look.
 *
 * Geometry is generated rather than hand-authored, so it lives apart from the
 * league content file: regenerate with `npm run build:regions`, and edit the
 * chunk data if a shape is wrong, never the output.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const INPUT = join(here, 'data', 'rs3-2-region-chunks.json');
const OUTPUT = join(here, '..', 'src', 'data', 'rs3-2-region-shapes.json');

const { legend, rows, _grid: grid } = JSON.parse(readFileSync(INPUT, 'utf8'));

const width = grid.width;
const height = grid.height;

/** Boolean chunk mask for one region code. */
function maskFor(code) {
  const mask = Array.from({ length: height }, () => new Array(width).fill(false));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rows[y][x] === code) mask[y][x] = true;
    }
  }
  return mask;
}

const inside = (mask, x, y) =>
  x >= 0 && y >= 0 && x < width && y < height && mask[y][x];

// A handful of chunks inside a region are unassigned — instanced areas and the
// like — and a few regions have one- or two-chunk slivers off their coast. Both
// are invisible on the in-game map and just add speckle here, so small holes get
// filled and small islands dropped. Anything genuinely separate, like Karamja's
// outlying islands, is comfortably above these thresholds.
const MAX_HOLE_CHUNKS = 6;
const MIN_ISLAND_CHUNKS = 3;

// Corner-cutting passes applied before curves are fitted. Raising this rounds
// the coastline further and shrinks the region slightly; override to compare.
const SMOOTH_PASSES = Number(process.env.SMOOTH_PASSES ?? 2);

/** Four-connected components of cells where `match` holds. */
function components(mask, match) {
  const seen = Array.from({ length: height }, () => new Array(width).fill(false));
  const found = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (seen[y][x] || match(mask[y][x]) !== true) continue;

      const cells = [[x, y]];
      seen[y][x] = true;
      let touchesEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1;

      for (let head = 0; head < cells.length; head++) {
        const [cx, cy] = cells[head];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (seen[ny][nx] || match(mask[ny][nx]) !== true) continue;
          seen[ny][nx] = true;
          if (nx === 0 || ny === 0 || nx === width - 1 || ny === height - 1) touchesEdge = true;
          cells.push([nx, ny]);
        }
      }
      found.push({ cells, touchesEdge });
    }
  }
  return found;
}

function clean(mask) {
  // Enclosed gaps only: a background region reaching the border is the sea.
  for (const { cells, touchesEdge } of components(mask, (v) => v === false)) {
    if (touchesEdge || cells.length > MAX_HOLE_CHUNKS) continue;
    for (const [x, y] of cells) mask[y][x] = true;
  }

  for (const { cells } of components(mask, (v) => v === true)) {
    if (cells.length >= MIN_ISLAND_CHUNKS) continue;
    for (const [x, y] of cells) mask[y][x] = false;
  }

  return mask;
}

/**
 * Directed boundary edges around the filled chunks.
 *
 * Each edge runs so the region is on its right, which makes outer loops wind one
 * way and holes the other — exactly what SVG's nonzero fill rule needs to punch
 * holes out without any extra bookkeeping.
 */
function boundaryEdges(mask) {
  // A vertex can have more than one outgoing edge where two chunks meet at only
  // a corner, so each start point keeps a list. Collapsing that to a single edge
  // silently drops boundary and closes the loop across the diagonal instead.
  const edges = new Map(); // "x,y" start -> [{ to, coast }, ...]

  // Coast if the chunk on the other side is sea, border if it belongs to another
  // region. Only coastline gets rounded off later, so the frontier two regions
  // share stays a straight line and the two of them keep tiling.
  const sea = (x, y) =>
    x < 0 || y < 0 || x >= width || y >= height || rows[y][x] === '.';

  const add = (ax, ay, bx, by, coast) => {
    const key = `${ax},${ay}`;
    const list = edges.get(key);
    if (list) list.push({ to: [bx, by], coast });
    else edges.set(key, [{ to: [bx, by], coast }]);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y][x]) continue;
      if (!inside(mask, x, y - 1)) add(x, y, x + 1, y, sea(x, y - 1));
      if (!inside(mask, x + 1, y)) add(x + 1, y, x + 1, y + 1, sea(x + 1, y));
      if (!inside(mask, x, y + 1)) add(x + 1, y + 1, x, y + 1, sea(x, y + 1));
      if (!inside(mask, x - 1, y)) add(x, y + 1, x, y, sea(x - 1, y));
    }
  }
  return edges;
}

/** Rotate a unit direction a quarter turn clockwise on screen (y points down). */
const rotateCw = ([x, y]) => [-y, x];

/**
 * Pick the outgoing edge that turns most sharply clockwise.
 *
 * At a corner-touch vertex two loops pass through the same point, and taking the
 * tightest turn keeps them as separate rings rather than splicing them into a
 * self-crossing figure-eight.
 */
function chooseNext(from, candidates, heading) {
  if (candidates.length === 1) return 0;

  let want = rotateCw(heading);
  for (let turn = 0; turn < 4; turn++) {
    const index = candidates.findIndex(({ to }) =>
      to[0] - from[0] === want[0] && to[1] - from[1] === want[1]);
    if (index !== -1) return index;
    want = rotateCw(rotateCw(rotateCw(want))); // next: straight, then left, then back
  }
  return 0;
}

/**
 * Chain edges into closed loops.
 *
 * A loop is a list of `{ p, coast }`, where `coast` describes the edge *leaving*
 * that point — so the flag travels with the geometry through smoothing and out
 * into the path.
 */
function loopsFrom(edges) {
  const remaining = new Map([...edges].map(([k, v]) => [k, [...v]]));
  const loops = [];

  const take = (key, index) => {
    const list = remaining.get(key);
    const [edge] = list.splice(index, 1);
    if (!list.length) remaining.delete(key);
    return edge;
  };

  while (remaining.size) {
    const startKey = remaining.keys().next().value;
    let current = startKey.split(',').map(Number);
    const points = [];

    let heading = [1, 0];
    for (;;) {
      const key = `${current[0]},${current[1]}`;
      const candidates = remaining.get(key);
      if (!candidates) break;

      const edge = take(key, chooseNext(current, candidates, heading));
      points.push({ p: current, coast: edge.coast });
      heading = [edge.to[0] - current[0], edge.to[1] - current[1]];
      current = edge.to;

      if (`${current[0]},${current[1]}` === startKey) break;
    }

    if (points.length) loops.push(simplify(points));
  }

  return loops;
}

/**
 * Drop points sitting on a straight run between their neighbours — but only when
 * both incident edges are the same kind, so the junction where a border meets the
 * coast survives as a real corner.
 */
function simplify(loop) {
  const out = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const prev = loop[(i - 1 + n) % n];
    const cur = loop[i];
    const next = loop[(i + 1) % n];
    const collinear =
      (cur.p[0] - prev.p[0]) * (next.p[1] - cur.p[1]) ===
      (cur.p[1] - prev.p[1]) * (next.p[0] - cur.p[0]);
    if (!collinear || prev.coast !== cur.coast) out.push(cur);
  }
  return out.length ? out : loop;
}

const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * Chaikin corner cutting, applied to coastline only.
 *
 * A corner is cut when both of its edges are coast; anywhere a border is
 * involved the vertex is left exactly where it is. Each pass halves how sharp the
 * remaining corners are, so the chunk grid stops reading as pixels and starts
 * reading as coastline, while region frontiers stay ruler-straight.
 */
function smoothCoast(loop, passes) {
  let current = loop;
  for (let pass = 0; pass < passes; pass++) {
    const n = current.length;
    const next = [];
    for (let i = 0; i < n; i++) {
      const prev = current[(i - 1 + n) % n];
      const cur = current[i];
      const after = current[(i + 1) % n];

      if (prev.coast && cur.coast) {
        next.push({ p: lerp(prev.p, cur.p, 0.75), coast: true });
        next.push({ p: lerp(cur.p, after.p, 0.25), coast: true });
      } else {
        next.push({ p: cur.p, coast: cur.coast });
      }
    }
    current = next;
  }
  return current;
}

// A tenth of a chunk is well under a pixel at any size this map is drawn at, so
// finer coordinates only cost bytes.
const round = (n) => Math.round(n * 10) / 10;
const fmt = ([x, y]) => `${round(x)} ${round(y)}`;

/**
 * Emit a loop, rounding only the corners where coast meets coast.
 *
 * A rounded corner becomes a quadratic with the vertex as its control point and
 * the neighbouring edge midpoints on the curve. Everything else stays as straight
 * segments through the exact vertices.
 */
function loopToPath(loop) {
  const n = loop.length;
  const mid = (i) => lerp(loop[i].p, loop[(i + 1) % n].p, 0.5);
  const rounded = (i) => loop[(i - 1 + n) % n].coast && loop[i].coast;

  // Straight runs otherwise emit the same coordinate twice — once closing one
  // segment and once opening the next — which is most of a border's bytes.
  let at = fmt(rounded(0) ? mid(n - 1) : loop[0].p);
  let d = `M${at}`;
  const lineTo = (point) => {
    const next = fmt(point);
    if (next === at) return;
    d += `L${next}`;
    at = next;
  };

  for (let i = 0; i < n; i++) {
    const target = loop[i].coast ? mid(i) : loop[(i + 1) % n].p;
    if (rounded(i)) {
      d += `Q${fmt(loop[i].p)} ${fmt(target)}`;
      at = fmt(target);
    } else {
      lineTo(loop[i].p);
      lineTo(target);
    }
  }
  return `${d}Z`;
}

function toPath(loops) {
  return loops
    .map((loop) => loopToPath(smoothCoast(loop, SMOOTH_PASSES)))
    .join('');
}

/**
 * Anchor point for the region's badge: the chunk furthest from any edge, so the
 * badge lands well inside the shape instead of drifting outside a concave one
 * the way a centroid would.
 */
function anchor(fullMask) {
  // Confine the search to the biggest landmass. Scattered regions like Fremennik
  // have many small pieces, and picking purely on clearance can strand the badge
  // on an islet away from the bulk of the region.
  const biggest = components(fullMask, (v) => v === true)
    .sort((a, b) => b.cells.length - a.cells.length)[0];
  const mask = Array.from({ length: height }, () => new Array(width).fill(false));
  for (const [x, y] of biggest.cells) mask[y][x] = true;

  const INF = 1e9;
  const dist = Array.from({ length: height }, () => new Array(width).fill(INF));
  const queue = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y][x]) continue;
      const edge =
        !inside(mask, x - 1, y) || !inside(mask, x + 1, y) ||
        !inside(mask, x, y - 1) || !inside(mask, x, y + 1);
      if (edge) {
        dist[y][x] = 0;
        queue.push([x, y]);
      }
    }
  }

  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inside(mask, nx, ny) || dist[ny][nx] <= dist[y][x] + 1) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }

  let best = [0, 0];
  let bestDist = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y][x] && dist[y][x] > bestDist) {
        bestDist = dist[y][x];
        best = [x, y];
      }
    }
  }
  return { x: best[0] + 0.5, y: best[1] + 0.5, clearance: bestDist };
}

const shapes = {};
for (const [code, id] of Object.entries(legend)) {
  const raw = maskFor(code);
  const rawChunks = raw.flat().filter(Boolean).length;
  const mask = clean(raw);
  const loops = loopsFrom(boundaryEdges(mask));
  const chunks = mask.flat().filter(Boolean).length;
  shapes[id] = {
    path: toPath(loops),
    anchor: anchor(mask),
    chunks,
    rawChunks,
    loops: loops.length,
  };
}

const result = {
  _generated: 'scripts/build-region-shapes.mjs — do not edit by hand',
  viewBox: `0 0 ${width} ${height}`,
  width,
  height,
  shapes,
};

writeFileSync(OUTPUT, `${JSON.stringify(result, null, 2)}\n`);

const rank = Object.entries(shapes).sort((a, b) => b[1].chunks - a[1].chunks);
for (const [id, s] of rank) {
  console.log(
    `${id.padEnd(18)} ${String(s.chunks).padStart(4)} chunks ` +
    `(${s.chunks - s.rawChunks >= 0 ? '+' : ''}${s.chunks - s.rawChunks})  ` +
    `${String(s.loops).padStart(3)} loops  ${String(s.path.length).padStart(4)} chars  ` +
    `anchor ${s.anchor.x},${s.anchor.y} (clearance ${s.anchor.clearance})`,
  );
}
console.log(`\nwrote ${OUTPUT}`);
