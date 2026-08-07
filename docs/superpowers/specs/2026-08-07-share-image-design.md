# Share Image Design

**Date:** 2026-08-07
**Status:** Draft for review — no implementation yet

## Problem

A share URL like `/rs3/2/?selected=tier1-1,…&title=My%20Build` restores the exact
build when opened, but pasting it into Discord shows a generic card. The site is
`output: "static"`, so every query string serves byte-identical HTML with one
hardcoded `og:image`, and crawlers don't run JavaScript. Nothing client-side can
change what an unfurl shows.

Worse today: the two Equilibrium pages point at `poster_relics.png` and
`poster_blessings.png`, **neither of which exists**. Shared links currently
unfurl with a broken image.

## Constraints

1. **Minimise edge function invocations.** Verified: page loads must not invoke
   anything. Only a deliberate image request may.
2. **No surprise billing.** Legacy plan, hard ceilings, service pauses rather
   than charges. 1M edge invocations, 100 GB bandwidth, 300 build minutes.
3. **Nothing accumulates.** No generated artifact may pile up in storage.
4. **The card should look like the Export Image output.**

## Answering the headless-browser question

**Not possible in Edge Functions, and not marginally.** Per
[Netlify's limits](https://docs.netlify.com/build/edge-functions/limits/):

| Limit | Value |
|---|---|
| CPU execution time per request | **50 ms** |
| Bundle size | 20 MB compressed |
| Memory (all deployed edge functions) | 512 MB |
| Response header timeout | 40 s |

Chromium is ~100 MB before you count the driver, and the runtime is a sandboxed
isolate with no subprocess spawning. The 50 ms CPU ceiling rules it out
regardless — that budget is for script execution, not waiting on I/O.

That same 50 ms ceiling is the important finding for the *rest* of this design:
it likely rules out rasterising a PNG at the edge at all. Satori composing an SVG
plus resvg rasterising 1200×630 with ~20 embedded images is plausibly over 50 ms
of pure CPU. **Image generation therefore belongs in a serverless function, not
an edge function** — different runtime, seconds of execution rather than
milliseconds.

A headless browser *is* technically possible in a serverless function via
`@sparticuz/chromium`, and it's genuinely attractive here because it would render
the real page — actual CSS, actual layout, glows included, no reimplementation
and no drift. The costs are steep: a ~50 MB dependency against Lambda's bundle
limits, multi-second cold starts, and the function must load the page and wait
for 20 images before capturing. Discord and Slack abandon slow unfurls, so a
cold start could mean no card at all.

**Exact serverless limits (timeout, memory, bundle) are not yet confirmed** and
must be verified before committing — see Open Questions.

## Options

### A. Serverless function + Satori (recommended)

Compose the card as JSX in a Satori-supported CSS subset, rasterise with
resvg-wasm, return `image/png`.

- Fast (tens to low hundreds of ms), small bundle, no browser
- Card layout is reimplemented, so it can drift from the real export
- **No CSS filter support** — the gold and silver glows won't render

### B. Serverless function + headless Chromium

Load the actual share URL in Chromium and screenshot `#main`.

- Perfect fidelity by construction; no second layout to maintain
- Cold starts risk crawler timeouts; heavy bundle; renders the whole page to
  produce one image; more moving parts to break

### C. Third-party screenshot API

Hand the share URL to an external service.

- Almost no code, perfect fidelity
- Another vendor, another bill, another dependency — and it fetches your site on
  every unfurl

### D. Static posters only

Design one good poster per page. No dynamic images at all.

- Zero infrastructure, zero invocations
- Shared links never show the build

## Recommendation

**A, with D as an immediate prerequisite.**

The posters are needed regardless — they're 404ing now and remain the `og:image`
for page unfurls under the image-only approach. That's worth doing first and on
its own.

A is recommended over B mainly on the crawler-timeout risk: a card that
sometimes fails to appear is worse than one that's slightly simplified. B stays
the fallback if fidelity turns out to matter more than latency in practice.

The glow limitation is already solved: when html2canvas had the same gap we
substituted a gold/silver border, and it read fine in exports for weeks. Same
substitution applies.

## Shape

### Endpoint

```
GET /api/share-image?page=rs3/2&selected=tier1-1,tier3-2&bonus=tier3-2&title=My%20Build
→ 200 image/png
```

Deliberately a separate path rather than a query flag on the picker route, so no
page request can ever touch a function.

### Caching

```
Cache-Control: public, max-age=31536000, immutable
Netlify-CDN-Cache-Control: public, max-age=31536000
```

Netlify's docs state cached edge responses don't count as invocations; the
equivalent for serverless functions needs confirming. Either way the URL is
fully determined by its query string, so a build renders once and is served from
cache thereafter. Nothing is written to storage — the PNG is composed in memory
per request. Permutations cannot accumulate.

### Copy Image Link

A button beside Export Image and Add to Showcase, building the endpoint URL from
the current selection. Same enablement rule as the randomizer: opt in per league
through content data, so past leagues are untouched.

### Card contents

Mirroring the Export Image output: themed background, tier columns, chosen
relics bright and the rest dimmed, title across the top. Rendered at 1200×630
rather than the export's ~2.2:1, so the grid needs rescaling rather than a
straight copy.

### Title handling

User-supplied free text rendered into an image served from our domain. Needs a
hard length cap with ellipsis, newline stripping, and a decision about content
filtering. Worth deciding deliberately rather than discovering.

### Fonts

Satori needs font files rather than CSS. The picker uses Comic Sans MS, which
isn't ours to embed — a substitute is needed, which is a visible difference from
the export.

## Failure modes

| Failure | Behaviour |
|---|---|
| Unknown league/page | 404, crawler falls back to the static poster |
| Malformed `selected` | Render what parses, ignore the rest |
| Function errors or times out | Crawler shows the static poster |
| Function invocations exhausted | Images stop; **site pauses**, per the plan's hard limits |
| Title too long or hostile | Capped and sanitised before rendering |

The static `og:image` is the safety net throughout: every failure degrades to
the poster rather than to a broken card.

## Open questions

1. **Serverless function limits** — timeout, memory, bundle size on the legacy
   plan. Determines whether B is viable at all and confirms A's headroom.
2. **Does Satori fit the export layout** at 1200×630 with 7 tier columns, or does
   the card want its own composition after all?
3. **Font substitute** for Comic Sans MS.
4. **Title policy** — cap length only, or filter content?
5. **Measure before building:** a spike rendering one card with Satori would
   settle both the CPU cost and the fidelity question in about an hour.

## Out of scope

- Dynamic `og:image` on page routes — rejected: it would invoke a function on
  every page view.
- Backfilling past leagues.
- Showcase share images.
