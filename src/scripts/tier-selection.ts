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
 * grantsBonusPick in the content data, and tier ordering comes from the rendered
 * group order.
 *
 * "Armed" is derived, never toggled: a bonus can be spent whenever the granting
 * relic is selected and none is currently held. So the granter clicks on and off
 * like any other relic, and a player changes their extra by removing the extra
 * itself, which re-opens the slot. An earlier design re-armed on clicking the
 * granter, which left no way to deselect it by clicking at all.
 *
 * Which relic is the bonus is recorded in the URL, because it can't be inferred:
 * a bonus spent in a tier that had no pick is indistinguishable from an ordinary
 * pick, and reloading such a link would hand the player a second bonus.
 */

const SELECTED = 'selected';
const BONUS_ATTR = 'data-bonus';

export interface TierSelectionContext {
  /** Group elements in render order; index doubles as tier order. */
  groups: HTMLElement[];
  /** Apply the same visual treatment picker.ts gives a (de)selected item. */
  setSelected: (element: HTMLElement, selected: boolean) => void;
}

function groupIndexOf(element: HTMLElement, groups: HTMLElement[]): number {
  return groups.findIndex((group) => group.contains(element));
}

function itemsIn(group: HTMLElement): HTMLElement[] {
  return Array.from(group.querySelectorAll<HTMLElement>('.relic, .mastery'));
}

function selectedIn(group: HTMLElement): HTMLElement[] {
  return itemsIn(group).filter((item) => item.classList.contains(SELECTED));
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

function releaseBonus(ctx: TierSelectionContext): void {
  const bonus = bonusItem(ctx.groups);
  if (!bonus) return;
  bonus.removeAttribute(BONUS_ATTR);
  bonus.classList.remove(SELECTED);
  ctx.setSelected(bonus, false);
}

/** The id of the relic currently held as a bonus, for the URL. */
export function bonusPickId(ctx: TierSelectionContext): string | null {
  return bonusItem(ctx.groups)?.id ?? null;
}

/** A bonus can be spent while the granter is selected and none is held. */
export function isArmed(ctx: TierSelectionContext): boolean {
  return grantingItem(ctx.groups) !== null && bonusItem(ctx.groups) === null;
}

/**
 * Apply a click to the selection, enforcing one pick per tier.
 *
 * Returns true if the click was handled here; false means the caller should fall
 * back to plain toggling (pages that don't enforce tiers).
 */
export function applyTierClick(element: HTMLElement, ctx: TierSelectionContext): boolean {
  const index = groupIndexOf(element, ctx.groups);
  if (index === -1) return false;

  if (element.classList.contains(SELECTED)) {
    element.classList.remove(SELECTED);
    ctx.setSelected(element, false);

    // Dropping the extra re-opens the slot; dropping the granter pays for it no
    // longer, so the extra goes too.
    element.removeAttribute(BONUS_ATTR);
    if (element.dataset.grantsBonusPick === 'true') releaseBonus(ctx);
    return true;
  }

  const granter = grantingItem(ctx.groups);
  const granterIndex = granter ? groupIndexOf(granter, ctx.groups) : -1;

  // Spend the bonus: only a tier below the granter's qualifies, and it stacks on
  // top of whatever that tier already holds.
  if (granterIndex !== -1 && index < granterIndex && bonusItem(ctx.groups) === null) {
    element.setAttribute(BONUS_ATTR, 'true');
    element.classList.add(SELECTED);
    ctx.setSelected(element, true);
    return true;
  }

  // Normal pick: replace this tier's existing choice. A bonus sitting in the same
  // tier is left alone — it's removed by clicking it, not by picking around it.
  for (const sibling of selectedIn(ctx.groups[index])) {
    if (sibling === element || sibling.hasAttribute(BONUS_ATTR)) continue;

    sibling.classList.remove(SELECTED);
    ctx.setSelected(sibling, false);
    if (sibling.dataset.grantsBonusPick === 'true') releaseBonus(ctx);
  }

  element.classList.add(SELECTED);
  ctx.setSelected(element, true);
  return true;
}

/**
 * Bring a restored selection in line with the rules.
 *
 * `bonusId` comes from the URL and is authoritative when present. Links shared
 * before the bonus was recorded fall back to a guess: the highest tier below the
 * granter holding more than one pick, since that's the only shape the old format
 * could express. A bonus that sat alone in its tier is unrecoverable from those
 * links and reads as an ordinary pick.
 */
export function reconcileRestoredSelection(
  ctx: TierSelectionContext,
  bonusId?: string | null,
): void {
  const granter = grantingItem(ctx.groups);
  const granterIndex = granter ? groupIndexOf(granter, ctx.groups) : -1;

  let bonus: HTMLElement | null = null;
  if (bonusId) {
    const candidate = document.getElementById(bonusId);
    const index = candidate ? groupIndexOf(candidate, ctx.groups) : -1;
    // Ignore a bonus the build can't justify: no granter, or not below it.
    if (candidate?.classList.contains(SELECTED) && granterIndex !== -1 && index < granterIndex) {
      bonus = candidate;
    }
  }

  if (!bonus && granterIndex !== -1) {
    for (let i = 0; i < granterIndex; i++) {
      if (selectedIn(ctx.groups[i]).length > 1) {
        bonus = selectedIn(ctx.groups[i]).at(-1) ?? null;
      }
    }
  }

  const bonusGroupIndex = bonus ? groupIndexOf(bonus, ctx.groups) : -1;

  ctx.groups.forEach((group, index) => {
    const selected = selectedIn(group);
    const keep = index === bonusGroupIndex ? 2 : 1;
    if (selected.length <= keep) return;

    // Keep the bonus and the last ordinary pick; drop the rest.
    const droppable = selected.filter((item) => item !== bonus);
    for (const extra of droppable.slice(0, selected.length - keep)) {
      extra.classList.remove(SELECTED);
      ctx.setSelected(extra, false);
    }
  });

  bonusItem(ctx.groups)?.removeAttribute(BONUS_ATTR);
  bonus?.setAttribute(BONUS_ATTR, 'true');
}
