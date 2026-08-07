/**
 * Rolls a random legal build.
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

/** Decides what to click for one page's rules. */
export type RandomizerStrategy = (ctx: RandomizerContext) => void;

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

/**
 * One pick per tier, plus the extra relic when the granting one is rolled.
 *
 * Used by relics and blessings. The bonus is handled by rolling a tier strictly
 * below the granter's and an unpicked item within it, then clicking it — the
 * selection rules recognise that as spending the bonus, because the granter is
 * selected and none is held yet.
 */
export const onePerTierStrategy: RandomizerStrategy = (ctx) => {
  ctx.clearSelection();

  for (const group of ctx.groups) {
    const choice = pickRandom(itemsIn(group));
    if (choice) ctx.click(choice);
  }

  const granterIndex = ctx.groups.findIndex((group) =>
    itemsIn(group).some((item) => item.dataset.grantsBonusPick === 'true' && isSelected(item)),
  );
  if (granterIndex <= 0) return; // not rolled, or nothing below it to spend on

  // Tiers below the granter that still have an unpicked item to take.
  const eligible = ctx.groups
    .slice(0, granterIndex)
    .filter((group) => itemsIn(group).some((item) => !isSelected(item)));

  const group = pickRandom(eligible);
  if (!group) return;

  const bonus = pickRandom(itemsIn(group).filter((item) => !isSelected(item)));
  if (bonus) ctx.click(bonus);
};

/**
 * Strategies by name. A league opts in through `randomizer` in its content data,
 * so adding the button to another league is a one-line change unless it needs a
 * genuinely new mode.
 */
export const STRATEGIES: Record<string, RandomizerStrategy> = {
  'one-per-tier': onePerTierStrategy,
};

export function getStrategy(name: string | undefined): RandomizerStrategy | null {
  if (!name) return null;
  return STRATEGIES[name] ?? null;
}
