/**
 * Renders a share image for a build by screenshotting the real picker page.
 *
 * SPIKE — not wired into the UI. Exists to answer three questions that can only
 * be answered by deploying: does the Chromium bundle fit, how long does a cold
 * start actually take, and does the capture look like Export Image.
 *
 * Screenshotting the live page rather than recomposing the card means there is
 * no second layout to maintain and no drift: whatever the picker looks like is
 * what gets shared. The cost is a browser in a Lambda, which is what the spike
 * is measuring.
 *
 * Deliberately lives on its own path. Page requests never invoke a function —
 * only a deliberate request for an image does.
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

/** Mirrors the routes [...slug].astro generates. */
const PAGE_PATTERN = /^(osrs|rs3)\/\d+(\/(relics|masteries|pacts|blessings))?$/;

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
    await tab.goto(target.toString(), { waitUntil: 'networkidle0', timeout: 20000 });
    mark('navigateMs', navStart);

    // The navbar is position:fixed, so it paints over #main's box and lands in
    // an element screenshot even though it isn't inside #main. snapdom composes
    // from the DOM tree and never had this problem; a real browser capture does.
    await tab.addStyleTag({
      content: '.navbar, .detail-sidebar, .picker-buttons { display: none !important; }',
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

export const config = { path: '/api/share-image' };
