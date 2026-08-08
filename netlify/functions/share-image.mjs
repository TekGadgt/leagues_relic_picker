/**
 * Renders a share image for a build by screenshotting the real picker page.
 *
 * Screenshotting the live page rather than recomposing the card means there is
 * no second layout to maintain and no drift: whatever the picker looks like is
 * what gets shared. The cost is a browser in a Lambda: a first render takes
 * roughly 7s for relics and 10s for blessings, so the Copy Image Link button
 * warms the cache before anyone can paste. Repeats serve from cache in ~0.15s.
 *
 * Deliberately lives on its own path. Page requests never invoke a function —
 * only a deliberate request for an image does.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/** Mirrors the routes [...slug].astro generates. */
const PAGE_PATTERN = /^(osrs|rs3)\/\d+(\/(relics|masteries|pacts|blessings|regions))?$/;

/** Long enough to be expressive, short enough not to break the layout. */
const MAX_TITLE_LENGTH = 60;

const VIEWPORT = { width: 1600, height: 900, deviceScaleFactor: 1 };

/** Cap and flatten a user-supplied title before it reaches a rendered image. */
function sanitiseTitle(raw) {
  if (!raw) return null;
  const flattened = raw.replace(/\s+/g, ' ').trim();
  if (!flattened) return null;
  return flattened.length > MAX_TITLE_LENGTH
    ? `${flattened.slice(0, MAX_TITLE_LENGTH - 1)}…`
    : flattened;
}

/**
 * Locally there's a real browser on disk; on Lambda the binary is unpacked from
 * the brotli archives shipped in the package.
 */
async function launchBrowser() {
  const localChrome = process.env.LOCAL_CHROME_PATH;
  if (localChrome) {
    return puppeteer.launch({
      executablePath: localChrome,
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: VIEWPORT,
    });
  }

  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
    defaultViewport: VIEWPORT,
  });
}

export async function renderShareImage({ origin, page, selected, bonus, title }) {
  const target = new URL(`/${page}/`, origin);
  if (selected) target.searchParams.set('selected', selected);
  if (bonus) target.searchParams.set('bonus', bonus);
  if (title) target.searchParams.set('title', title);

  const timings = {};
  const mark = (name, from) => { timings[name] = Math.round(performance.now() - from); };

  const launchStart = performance.now();
  const browser = await launchBrowser();
  mark('launchMs', launchStart);

  try {
    const tab = await browser.newPage();

    const navStart = performance.now();
    // networkidle0 waits for the relic images, which is the slow part and the
    // whole reason a naive screenshot comes out half-empty.
    //
    // Generous, because the request that matters here is the cache warm fired by
    // Copy Image Link, and nobody is waiting on it. Timing out returns a 404 and
    // caches nothing, leaving the paste broken; finishing slowly warms the cache
    // and the link works. Warm renders are ~4.5s for relics and ~9s for
    // blessings, which has twice the images, and a cold start adds to both — so
    // the ceiling sits well clear of the slow path rather than just above it.
    // The function itself may run for 60s.
    await tab.goto(target.toString(), { waitUntil: 'networkidle0', timeout: 45000 });
    mark('navigateMs', navStart);

    // The navbar is position:fixed, so it paints over #main's box and lands in
    // an element screenshot even though it isn't inside #main. snapdom composes
    // from the DOM tree and never had this problem; a real browser capture does.
    await tab.addStyleTag({
      content: [
        '.navbar, .detail-sidebar, .picker-buttons { display: none !important; }',
        // The region map is centred inside a full-width #main, so a straight
        // capture is over half dead space. Collapsing #main onto its content
        // needs the title's 99vw released and definite widths for the map and
        // rail, otherwise the shrink-to-fit pass has nothing to measure and they
        // collapse instead. Scoped to regions so cards already cached for the
        // other pickers keep rendering exactly as they were.
        '#main[data-page-type="regions"] .title { min-width: 100% !important; }',
        '#main[data-page-type="regions"] .regionMap { width: 880px !important; }',
        '#main[data-page-type="regions"] .regionRail { width: 660px !important; }',
      ].join('\n'),
    });

    const shotStart = performance.now();
    const main = await tab.$('#main');
    if (!main) throw new Error('#main not found — page did not render');
    const png = await main.screenshot({ type: 'png' });
    mark('screenshotMs', shotStart);

    return { png, timings, url: target.toString() };
  } finally {
    await browser.close();
  }
}

export default async function handler(request) {
  const url = new URL(request.url);
  const page = url.searchParams.get('page') ?? '';

  if (!PAGE_PATTERN.test(page)) {
    return new Response('Unknown page', { status: 404 });
  }

  try {
    const { png } = await renderShareImage({
      origin: url.origin,
      page,
      selected: url.searchParams.get('selected'),
      bonus: url.searchParams.get('bonus'),
      title: sanitiseTitle(url.searchParams.get('title')),
    });

    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Netlify-CDN-Cache-Control': 'public, max-age=31536000, durable',
        // Netlify invalidates the durable cache on every deploy by default. A
        // custom cache ID opts out, so warmed images survive a deploy — which
        // matters most during a league launch, when deploys and sharing spike
        // together. Bump the prefix to force a re-render after a design change.
        'Netlify-Cache-ID': `share-image-v1:${url.search}`,
      },
    });
  } catch (error) {
    // Failing loudly here would show a broken card; 404 lets the crawler fall
    // back to the page's static og:image instead.
    console.error('share-image render failed', error);
    return new Response('Render failed', { status: 404 });
  }
}

export const config = {
  path: '/api/share-image',
  /*
   * Each uncached build costs a browser launch and several seconds of Lambda,
   * so the abuse shape is someone walking distinct query strings — repeats are
   * cached and cost nothing. Twenty a minute per IP leaves ample room for a
   * person copying links and for a crawler unfurling a burst of them, while
   * capping what a single client can force us to render.
   *
   * Rate limits for functions can only be declared here; netlify.toml is
   * ignored for this.
   */
  rateLimit: {
    windowSize: 60,
    windowLimit: 20,
    aggregateBy: ['ip'],
    action: 'rate_limit',
  },
};
