/**
 * Decides random legal builds.
 *
 * A strategy chooses *which items to pick* and returns them as a plan; it never
 * touches the DOM. The caller applies each pick through the page's normal click
 * handling, so one pick per tier, bonus arming and revocation, and derived god
 * tiers all apply exactly as they do for a real player. An illegal build isn't
 * something to guard against — it isn't expressible.
 *
 * Returning a plan rather than clicking is also what lets the roll be animated:
 * the outcome has to be known before the reels can land on it.
 *
 * That separation is what makes this portable. A new mode needs a strategy
 * describing what to pick, not a reimplementation of that mode's rules. Pacts
 * would need one that walks the graph honouring adjacency and the node cap, and
 * nothing here would change.
 */

export interface RandomizerContext {
  /** Groups in render order, excluding derived ones. */
  groups: HTMLElement[];
}

export interface RollPlan {
  /** Whether to drop the current selection before applying the picks. */
  clearFirst: boolean;
  /** Items to pick, in the order they should be applied. */
  picks: HTMLElement[];
}

export interface RandomizerStrategy {
  /** A complete build, replacing whatever is picked. */
  rollAll: (ctx: RandomizerContext) => RollPlan;
  /**
   * Only the next unfilled group, for revealing a build tier by tier. Returns an
   * empty plan when there's nothing left. Optional: modes without a natural
   * progression (a pact graph, say) omit it, and the UI hides the button rather
   * than offering something meaningless.
   */
  rollNext?: (ctx: RandomizerContext) => RollPlan;
}

const EMPTY_PLAN: RollPlan = { clearFirst: false, picks: [] };

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export function itemsIn(group: HTMLElement): HTMLElement[] {
  return Array.from(group.querySelectorAll<HTMLElement>('.relic, .mastery'));
}

function isSelected(element: HTMLElement): boolean {
  return element.classList.contains('selected');
}

function grantsBonus(element: HTMLElement): boolean {
  return element.dataset.grantsBonusPick === 'true';
}

/**
 * Choose the extra pick the granting relic allows, from a tier below its own.
 *
 * `taken` is what the plan already commits to, so this doesn't propose an item
 * the same roll is about to pick anyway.
 */
function planBonus(
  ctx: RandomizerContext,
  granterIndex: number,
  taken: Set<HTMLElement>,
): HTMLElement | undefined {
  const eligible = ctx.groups.slice(0, granterIndex).filter((group) =>
    itemsIn(group).some((item) => !isSelected(item) && !taken.has(item)),
  );

  const group = pickRandom(eligible);
  if (!group) return undefined;

  return pickRandom(itemsIn(group).filter((item) => !isSelected(item) && !taken.has(item)));
}

/** One pick per tier, plus the extra relic when the granting one comes up. */
export const onePerTierStrategy: RandomizerStrategy = {
  rollAll: (ctx) => {
    const picks: HTMLElement[] = [];

    for (const group of ctx.groups) {
      const choice = pickRandom(itemsIn(group));
      if (choice) picks.push(choice);
    }

    const granterIndex = picks.findIndex(grantsBonus);
    if (granterIndex !== -1) {
      const granterGroupIndex = ctx.groups.findIndex((g) => g.contains(picks[granterIndex]));
      // Everything is about to be replaced, so only this plan's picks are taken.
      const bonus = planBonus(ctx, granterGroupIndex, new Set(picks));
      if (bonus) picks.push(bonus);
    }

    return { clearFirst: true, picks };
  },

  rollNext: (ctx) => {
    // The first group with nothing in it, so a partly-built board carries on from
    // where it is rather than restarting.
    const next = ctx.groups.find((group) => !itemsIn(group).some(isSelected));
    if (!next) return EMPTY_PLAN;

    const choice = pickRandom(itemsIn(next));
    if (!choice) return EMPTY_PLAN;

    const picks = [choice];

    // Unlocking the granter grants the extra pick immediately, as it would in
    // game — every earlier tier is already filled, so the extra stacks onto one.
    const holdsBonus = ctx.groups.some((g) => itemsIn(g).some((i) => i.hasAttribute('data-bonus')));
    if (grantsBonus(choice) && !holdsBonus) {
      const bonus = planBonus(ctx, ctx.groups.indexOf(next), new Set(picks));
      if (bonus) picks.push(bonus);
    }

    return { clearFirst: false, picks };
  },
};

/**
 * Strategies by name. A league opts in through `randomizer` in its content data,
 * so adding the buttons to another league is a one-line change unless it needs a
 * genuinely new mode.
 */
export const STRATEGIES: Record<string, RandomizerStrategy> = {
  'one-per-tier': onePerTierStrategy,
};

export function getStrategy(name: string | undefined): RandomizerStrategy | null {
  if (!name) return null;
  return STRATEGIES[name] ?? null;
}
