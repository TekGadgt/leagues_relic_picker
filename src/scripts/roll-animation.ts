/**
 * Slot-machine reveal for a randomised roll.
 *
 * The picker already renders each tier as a column of items where the chosen one
 * is bright and the rest are dimmed, so "spinning a reel" is just walking that
 * highlight down the column and slowing to a stop on the winner.
 *
 * The outcome is decided before any of this runs — the strategy returns a plan
 * and the caller applies it once the reels land. Nothing here influences what is
 * picked, so a spin can be skipped or never shown at all and the build is
 * identical.
 */

import { itemsIn } from './randomizer';

/** A column to spin, and the item it must stop on. */
export interface Reel {
  group: HTMLElement;
  landOn: HTMLElement;
}

export interface RollAnimationOptions {
  /** Brighten or dim one item, matching how a real selection is shown. */
  setHighlighted: (element: HTMLElement, highlighted: boolean) => void;
}

/** Times the reel takes per step, accelerating away and easing to a stop. */
const FIRST_STEP_MS = 40;
const LAST_STEP_MS = 190;
/** Full passes before it begins settling; enough to read as a spin. */
const LOOPS = 3;
/** Reels start fractionally apart so a full roll cascades instead of flashing. */
const REEL_STAGGER_MS = 55;
/** How long a pointer skip suppresses the click it generates. */
const CLICK_SWALLOW_WINDOW_MS = 700;

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Spin one column, resolving when it lands.
 *
 * `skipped` is checked between steps rather than aborting mid-flight, so a skip
 * always leaves the reel on its winner rather than wherever it happened to be.
 */
async function spinReel(
  reel: Reel,
  options: RollAnimationOptions,
  startDelay: number,
  skipped: () => boolean,
): Promise<void> {
  const items = itemsIn(reel.group);
  const landIndex = items.indexOf(reel.landOn);
  if (landIndex === -1 || items.length === 0) return;

  if (startDelay > 0 && !skipped()) await wait(startDelay);

  const steps = items.length * LOOPS + landIndex;
  let previous: HTMLElement | null = null;

  for (let step = 0; step <= steps; step++) {
    if (skipped()) break;

    const current = items[step % items.length];
    if (previous && previous !== current) options.setHighlighted(previous, false);
    options.setHighlighted(current, true);
    previous = current;

    if (step === steps) break;

    // Quadratic ease-out: quick at first, laboured at the end.
    const progress = step / steps;
    await wait(FIRST_STEP_MS + (LAST_STEP_MS - FIRST_STEP_MS) * progress * progress);
  }

  // However the loop ended — landed, or cut short — settle on the winner.
  if (previous && previous !== reel.landOn) options.setHighlighted(previous, false);
  options.setHighlighted(reel.landOn, true);
}

/**
 * Spin every reel, resolving once they've all landed.
 *
 * Returns immediately when reduced motion is requested, so the caller applies the
 * result with no spin at all.
 */
export async function animateRoll(
  reels: Reel[],
  options: RollAnimationOptions,
): Promise<void> {
  if (reels.length === 0 || prefersReducedMotion()) return;

  let skipped = false;

  /**
   * Swallow the click that completes a skip gesture.
   *
   * Skipping listens on pointerdown so it feels immediate, but the click that
   * follows would otherwise reach whatever is underneath — and if that's a relic,
   * it toggles it, corrupting a build the roll just applied. The swallower is
   * armed only by a pointer skip and expires on its own, so it can never eat an
   * unrelated click later on.
   */
  const armClickSwallow = () => {
    let expiry = 0;
    const release = () => {
      document.removeEventListener('click', swallow, true);
      clearTimeout(expiry);
    };
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      release();
    };
    expiry = window.setTimeout(release, CLICK_SWALLOW_WINDOW_MS);
    document.addEventListener('click', swallow, true);
  };

  const skipByPointer = (event: Event) => {
    skipped = true;
    event.stopPropagation();
    armClickSwallow();
  };
  const skipByKey = () => { skipped = true; };

  // Anywhere on the page, so an impatient click doesn't have to find a target.
  document.addEventListener('pointerdown', skipByPointer, { capture: true, once: true });
  document.addEventListener('keydown', skipByKey, { capture: true, once: true });

  try {
    await Promise.all(
      reels.map((reel, index) => spinReel(reel, options, index * REEL_STAGGER_MS, () => skipped)),
    );
  } finally {
    document.removeEventListener('pointerdown', skipByPointer, { capture: true });
    document.removeEventListener('keydown', skipByKey, { capture: true });
  }
}
