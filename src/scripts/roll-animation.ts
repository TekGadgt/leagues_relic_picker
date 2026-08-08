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

/** Marks the travelling highlight while a bonus is being rolled. */
export const ROLLING_BONUS_CLASS = 'rolling-bonus';

/**
 * A set of items to spin through, and the one it must stop on.
 *
 * Items rather than a container: on a tier page they're a column, but on the
 * region map they're whichever regions are still available, which is no part of
 * the DOM tree.
 */
export interface Reel {
  items: HTMLElement[];
  landOn: HTMLElement;
  /**
   * Dress the travelling highlight as the bonus rather than an ordinary pick.
   *
   * Without it the bonus reel is indistinguishable from a normal one, so a tier
   * that already landed appears to re-roll and change its mind, with the silver
   * glow snapping in only at the end. Carrying the styling through the spin makes
   * it read as rolling the extra.
   *
   * A presentational class, deliberately not the data-bonus attribute the rules
   * use: a transient marker there would make the selection logic think a bonus
   * was already held and apply the pick as an ordinary swap.
   */
  asBonus?: boolean;
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
  const items = reel.items;

  // Picks already made in this column stay lit while the reel spins over them.
  // The bonus lands in a tier that usually already holds a choice, and dimming
  // it would leave that relic looking unselected while it is still very much
  // selected — visible on refresh, when it came back bright.
  const alreadyChosen = new Set(items.filter((item) => item.classList.contains('selected')));

  // A bonus reel cycles only what it could actually land on. Running the
  // highlight over the tier's existing pick would flash the bonus styling across
  // an ordinary choice, which says the wrong thing about a relic that isn't the
  // extra. Ordinary reels cycle everything, since their tier is empty or about
  // to be replaced.
  const cycle = reel.asBonus ? items.filter((item) => !alreadyChosen.has(item)) : items;
  const landIndex = cycle.indexOf(reel.landOn);
  if (landIndex === -1 || cycle.length === 0) return;

  const light = (item: HTMLElement) => {
    options.setHighlighted(item, true);
    if (reel.asBonus) item.classList.add(ROLLING_BONUS_CLASS);
  };
  const dim = (item: HTMLElement) => {
    item.classList.remove(ROLLING_BONUS_CLASS);
    if (!alreadyChosen.has(item)) options.setHighlighted(item, false);
  };

  // Nothing to choose between: spinning would sit on the same relic for a second
  // and read as a stall rather than a roll. Reachable when a bonus lands in a
  // two-relic tier that already holds a pick — no league is shaped that way
  // today, but nothing stops one being.
  if (cycle.length === 1) {
    light(reel.landOn);
    return;
  }

  if (startDelay > 0 && !skipped()) await wait(startDelay);

  const steps = cycle.length * LOOPS + landIndex;
  let previous: HTMLElement | null = null;

  for (let step = 0; step <= steps; step++) {
    if (skipped()) break;

    const current = cycle[step % cycle.length];
    if (previous && previous !== current) dim(previous);
    light(current);
    previous = current;

    if (step === steps) break;

    // Quadratic ease-out: quick at first, laboured at the end.
    const progress = step / steps;
    await wait(FIRST_STEP_MS + (LAST_STEP_MS - FIRST_STEP_MS) * progress * progress);
  }

  // However the loop ended — landed, or cut short — settle on the winner while
  // leaving the column's existing picks lit.
  if (previous && previous !== reel.landOn) dim(previous);
  for (const chosen of alreadyChosen) options.setHighlighted(chosen, true);
  light(reel.landOn);
}

/**
 * Spin every reel, resolving once they've all landed.
 *
 * Resolves true when the spin was cut short or never shown — reduced motion, no
 * reels, or the viewer skipping — so a caller can drop any follow-up flourish
 * instead of making someone who just skipped sit through more of it.
 */
export async function animateRoll(
  reels: Reel[],
  options: RollAnimationOptions,
): Promise<boolean> {
  if (reels.length === 0 || prefersReducedMotion()) return true;

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

  return skipped;
}

/** Pause between a roll landing and its bonus reel starting. */
export const BONUS_BEAT_MS = 420;

export const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
