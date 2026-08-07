/**
 * Rolls random legal builds.
 *
 * The randomizer deliberately knows no rules. It decides *which items to click*
 * and routes every one through the page's normal click handling, so one pick per
 * tier, bonus arming and revocation, and derived god tiers all apply exactly as
 * they do for a real player. An illegal build isn't something to guard against —
 * it isn't expressible.
 *
 * That's also what makes it portable. A new mode needs a strategy describing what
 * to click, not a reimplementation of that mode's rules. Pacts, for instance,
 * would need a strategy that walks the graph honouring adjacency and the 40-node
 * cap, and nothing here would change.
 */

export interface RandomizerContext {
  /** Groups in render order, excluding derived ones. */
  groups: HTMLElement[];
  /** Deselect everything currently picked. */
  clearSelection: () => void;
  /** Route a click through the page's real selection handling. */
  click: (element: HTMLElement) => void;
}

export interface RandomizerStrategy {
  /** Roll a complete build, replacing whatever is picked. */
  rollAll: (ctx: RandomizerContext) => void;
  /**
   * Roll only the next unfilled group, for revealing a build tier by tier.
   * Returns false when there's nothing left to roll. Optional: modes without a
   * natural progression (a pact graph, say) simply omit it, and the UI hides the
   * button rather than offering something meaningless.
   */
  rollNext?: (ctx: RandomizerContext) => boolean;
}

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

function itemsIn(group: HTMLElement): HTMLElement[] {
  return Array.from(group.querySelectorAll<HTMLElement>('.relic, .mastery'));
}

function isSelected(element: HTMLElement): boolean {
  return element.classList.contains('selected');
}

function selectedGranterIndex(ctx: RandomizerContext): number {
  return ctx.groups.findIndex((group) =>
    itemsIn(group).some((item) => item.dataset.grantsBonusPick === 'true' && isSelected(item)),
  );
}

/**
 * Spend the extra pick the granting relic allows, on a random tier below it.
 *
 * The selection rules recognise this as the bonus rather than an ordinary swap,
 * because the granter is selected and no bonus is held yet.
 */
function spendBonus(ctx: RandomizerContext): void {
  const granterIndex = selectedGranterIndex(ctx);
  if (granterIndex <= 0) return; // not picked, or nothing below it
  if (ctx.groups.some((group) => itemsIn(group).some((item) => item.hasAttribute('data-bonus')))) {
    return; // already holding one
  }

  const eligible = ctx.groups
    .slice(0, granterIndex)
    .filter((group) => itemsIn(group).some((item) => !isSelected(item)));

  const group = pickRandom(eligible);
  if (!group) return;

  const bonus = pickRandom(itemsIn(group).filter((item) => !isSelected(item)));
  if (bonus) ctx.click(bonus);
}

/** One pick per tier, plus the extra relic when the granting one comes up. */
export const onePerTierStrategy: RandomizerStrategy = {
  rollAll: (ctx) => {
    ctx.clearSelection();

    for (const group of ctx.groups) {
      const choice = pickRandom(itemsIn(group));
      if (choice) ctx.click(choice);
    }

    spendBonus(ctx);
  },

  rollNext: (ctx) => {
    // The first group with nothing in it, so a partly-built board carries on
    // from where it is rather than restarting.
    const next = ctx.groups.find((group) => !itemsIn(group).some(isSelected));
    if (!next) return false;

    const choice = pickRandom(itemsIn(next));
    if (!choice) return false;
    ctx.click(choice);

    // Unlocking the granter grants the extra pick immediately, the same way it
    // would in game — every earlier tier is already filled, so it stacks.
    spendBonus(ctx);
    return true;
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
