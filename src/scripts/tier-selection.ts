/**
 * One-pick-per-tier selection for relics and blessings.
 *
 * In game you activate a single relic per tier, so picking another in the same
 * tier swaps rather than stacks. Masteries and pacts work differently and are
 * left alone.
 *
 * The exception is Reloaded (OSRS) / Rejuvenated (RS3), which grants one extra
 * relic from a tier below its own. Rather than matching those by name — they're
 * named differently and sit at different tiers per league — the item carries
 * grantsBonusPick in the content data, and the tier ordering comes from the
 * rendered group order.
 *
 * The granting relic behaves unlike anything else here: clicking it while it's
 * already selected re-arms the bonus instead of deselecting, which is how a
 * player changes which extra relic they hold. It leaves the build only by being
 * swapped out within its own tier, and that revokes the bonus with it — so no
 * reachable state has an extra relic with nothing granting it.
 */

const SELECTED = 'selected';
const BONUS_ATTR = 'data-bonus';

export interface TierSelectionContext {
  /** Group elements in render order; index doubles as tier order. */
  groups: HTMLElement[];
  /** Apply the same visual treatment picker.ts gives a (de)selected item. */
  setSelected: (element: HTMLElement, selected: boolean) => void;
}

/** Whether a bonus pick is currently available to spend. */
let armed = false;

export function isArmed(): boolean {
  return armed;
}

export function disarm(): void {
  armed = false;
}

function groupIndexOf(element: HTMLElement, groups: HTMLElement[]): number {
  return groups.findIndex((group) => group.contains(element));
}

function itemsIn(group: HTMLElement): HTMLElement[] {
  return Array.from(group.querySelectorAll<HTMLElement>('.relic, .mastery'));
}

function bonusItem(groups: HTMLElement[]): HTMLElement | null {
  for (const group of groups) {
    const found = group.querySelector<HTMLElement>(`[${BONUS_ATTR}]`);
    if (found) return found;
  }
  return null;
}

function grantingItem(groups: HTMLElement[]): HTMLElement | null {
  for (const group of groups) {
    for (const item of itemsIn(group)) {
      if (item.dataset.grantsBonusPick === 'true' && item.classList.contains(SELECTED)) {
        return item;
      }
    }
  }
  return null;
}

function clearBonus(ctx: TierSelectionContext): void {
  const bonus = bonusItem(ctx.groups);
  if (!bonus) return;
  bonus.removeAttribute(BONUS_ATTR);
  bonus.classList.remove(SELECTED);
  ctx.setSelected(bonus, false);
}

/**
 * Apply a click to the selection, enforcing one pick per tier.
 *
 * Returns true if the click was handled here; false means the caller should
 * fall back to plain toggling (pages that don't enforce tiers).
 */
export function applyTierClick(element: HTMLElement, ctx: TierSelectionContext): boolean {
  const index = groupIndexOf(element, ctx.groups);
  if (index === -1) return false;

  const isGranter = element.dataset.grantsBonusPick === 'true';
  const alreadySelected = element.classList.contains(SELECTED);

  // Re-arming: clicking the granting relic again re-opens the bonus rather than
  // dropping it, so a player can change which extra relic they hold.
  if (isGranter && alreadySelected) {
    armed = true;
    return true;
  }

  if (alreadySelected) {
    element.classList.remove(SELECTED);
    ctx.setSelected(element, false);
    if (element.hasAttribute(BONUS_ATTR)) element.removeAttribute(BONUS_ATTR);
    armed = false;
    return true;
  }

  const granter = grantingItem(ctx.groups);
  const granterIndex = granter ? groupIndexOf(granter, ctx.groups) : -1;

  // Spend the bonus: only a tier below the granter's qualifies, and it stacks
  // on top of whatever that tier already holds.
  if (armed && granterIndex !== -1 && index < granterIndex) {
    clearBonus(ctx);
    element.setAttribute(BONUS_ATTR, 'true');
    element.classList.add(SELECTED);
    ctx.setSelected(element, true);
    armed = false;
    return true;
  }

  // Normal pick: replace this tier's existing choice. A bonus sitting in the
  // same tier is left alone — it's only replaced by re-arming.
  for (const sibling of itemsIn(ctx.groups[index])) {
    if (sibling === element) continue;
    if (!sibling.classList.contains(SELECTED)) continue;
    if (sibling.hasAttribute(BONUS_ATTR)) continue;

    sibling.classList.remove(SELECTED);
    ctx.setSelected(sibling, false);

    // Swapping the granter out removes the extra relic it was paying for.
    if (sibling.dataset.grantsBonusPick === 'true') clearBonus(ctx);
  }

  element.classList.add(SELECTED);
  ctx.setSelected(element, true);

  // Any pick that isn't spent on the bonus consumes the arm.
  armed = isGranter;
  return true;
}

/**
 * Bring a restored selection in line with the rules.
 *
 * Links shared before one-per-tier existed can hold several picks in a tier.
 * Each tier keeps its last id, except that when the granting relic is selected
 * the highest tier below it that held more than one keeps two — read as the
 * player's bonus pick, which is the only way that state could legitimately
 * arise.
 */
export function reconcileRestoredSelection(ctx: TierSelectionContext): void {
  const granter = grantingItem(ctx.groups);
  const granterIndex = granter ? groupIndexOf(granter, ctx.groups) : -1;

  let bonusGroupIndex = -1;
  if (granterIndex !== -1) {
    for (let i = 0; i < granterIndex; i++) {
      if (itemsIn(ctx.groups[i]).filter(item => item.classList.contains(SELECTED)).length > 1) {
        bonusGroupIndex = i;
      }
    }
  }

  ctx.groups.forEach((group, index) => {
    const selected = itemsIn(group).filter(item => item.classList.contains(SELECTED));
    const keep = index === bonusGroupIndex ? 2 : 1;
    if (selected.length <= keep) return;

    for (const extra of selected.slice(0, selected.length - keep)) {
      extra.classList.remove(SELECTED);
      ctx.setSelected(extra, false);
    }
  });

  if (bonusGroupIndex !== -1) {
    const selected = itemsIn(ctx.groups[bonusGroupIndex]).filter(i => i.classList.contains(SELECTED));
    selected[selected.length - 1]?.setAttribute(BONUS_ATTR, 'true');
  }

  armed = false;
}
