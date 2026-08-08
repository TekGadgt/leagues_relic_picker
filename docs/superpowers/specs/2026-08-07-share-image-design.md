# Share Image Design

**Date:** 2026-08-07
**Status:** Draft for review — no implementation yet
**Revised:** recommendation changed from Satori to headless Chromium once the 60 s function timeout was confirmed

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

A headless browser *is* viable in a serverless function via `puppeteer-core` and
`@sparticuz/chromium`, and the confirmed limits are far more generous than first
assumed ([configuration
docs](https://docs.netlify.com/build/functions/optional-configuration/)):

| Limit | Value |
|---|---|
| Synchronous execution | **60 s**, not configurable |
| Memory | **1024–4096 MB**, configurable |
| Buffered response payload | 6 MB (~4.5 MB after base64) |
| Streamed response payload | 20 MB |

60 s dwarfs a 2–5 s cold start plus a 2–3 s render, and memory can be raised to
where Chromium is comfortable. A 1200×630 PNG is well inside the payload limit.

Deployment package size is the one real constraint and Netlify defers to AWS
Lambda's limits (50 MB zipped). `@sparticuz/chromium` is close to that on its
own; it also supports fetching its brotli-compressed binary from a remote URL at
runtime, which sidesteps the bundle entirely at the cost of a download on cold
start.

### Which Chromium package

`chrome-aws-lambda` is the smaller of the two — 49.7 MB unpacked against
`@sparticuz/chromium`'s 69.7 MB — but its last release was **2021-07-17**,
pinning it to Chromium ~92 and to runtimes we no longer use. `@sparticuz/chromium`
is the maintained successor and the only realistic option.

**Version pin matters.** `netlify.toml` sets `NODE_VERSION = "20"`, and the
current `@sparticuz/chromium` 149.0.0 declares `engines.node ^22.17.0 || >=24.0.0`
— it will not run as configured. Either pin **147.0.0** (2026-04-10,
`node >=20.11.0`) or raise Netlify to Node 22. Decide deliberately; discovering
this from a first-deploy failure would be an unpleasant hour.

## Options

### A. Serverless function + Satori

Compose the card as JSX in a Satori-supported CSS subset, rasterise with
resvg-wasm, return `image/png`.

- Fast (tens to low hundreds of ms), small bundle, no browser
- Card layout is reimplemented, so it can drift from the real export
- **No CSS filter support** — the gold and silver glows won't render

### B. Serverless function + headless Chromium (recommended)

`puppeteer-core` drives `@sparticuz/chromium`, loads the actual share URL, and
screenshots `#main` — the same element Export Image captures.

- Perfect fidelity by construction: it *is* the page. No second layout, no drift,
  glows and fonts included, and the card tracks any future design change for free
- Deletes most of this design's complexity: no Satori CSS subset to work within,
  no font embedding, no glow substitution, no rescaled reimplementation
- Cold starts are the risk, and the Copy Image Link button neutralises it (below)
- Bundle size is tight; the remote-binary option is the escape hatch

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

**B, with D as an immediate prerequisite.**

The posters are needed regardless — they're 404ing now and remain the `og:image`
for page unfurls under the image-only approach. Worth doing first and on its own.

An earlier draft of this document recommended A, on an assumed ~10 s function
timeout that made cold starts look fatal. The real ceiling is 60 s, which removes
that objection, and B is otherwise better on every axis that matters here: the
card is the export rather than an imitation of it, and it cannot drift.

### Cold starts, and why the copy button fixes them

The genuine risk was never Netlify's limits — it's that Discord and Slack abandon
slow unfurls, so a cold start could mean no card at all.

But the first request for a given image is one *we* trigger. When the player
clicks Copy Image Link, the page fires a background `fetch` for that same URL.
The slow render happens while nobody is waiting on it, and by the time the link
is pasted seconds later the CDN has a cached PNG to serve.

Residual gaps, both acceptable: a hand-crafted URL that never went through the
button gets no pre-warm, and an evicted cache entry means one slow render later.
Both degrade to the static poster rather than to a broken card.

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

Still a problem under B, for a different reason: a Lambda container ships with no
system fonts, so Comic Sans MS won't resolve there any more than it would in
Satori and Chromium will fall back to something generic. `@sparticuz/chromium`
can load font files at runtime, so the card can match the site — but only with a
font we're entitled to ship. The picker relies on Comic Sans MS being present on
the viewer's machine, which is fine in a browser and not an option server-side.

Worth deciding what the card uses before building, since it's the most visible
way a "screenshot of the real page" can still fail to look like the real page.

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

1. **Does `@sparticuz/chromium` fit the deployment package?** The one unresolved
   blocker. If not, load the binary remotely at runtime.
2. **Cold start and render duration, measured.** Determines whether pre-warming
   is sufficient or whether the card needs a cheaper path after all.
3. **What does the function load?** The live production URL, or a local render.
   Loading production means the function fetches the site on each cold render,
   which costs bandwidth and web requests.
4. **Title policy** — cap length only, or filter content?
5. **Aspect ratio.** The export is ~2.2:1 and cards want 1.91:1. Screenshot a
   wider viewport and letterbox, or accept cropping.
6. **Spike first:** stand the function up and render one card. Settles 1, 2 and 5
   together, and is the cheapest way to find out if this is pleasant or painful.

## Out of scope

- Dynamic `og:image` on page routes — rejected: it would invoke a function on
  every page view.
- Backfilling past leagues.
- Showcase share images.
