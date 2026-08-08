/**
 * Ordered region selection for Equilibrium.
 *
 * A run unlocks six regions. Three aren't choices — Misthalin and Havenhythe
 * from the start, Karamja forced at 50 tasks — and the other three are free
 * picks from a pool of eight, taken in order at 175, 300 and 450 tasks. No
 * region can be taken twice, and there is no adjacency rule: the game is dense
 * with teleports, so any three of the eight is legal.
 *
 * This deliberately doesn't reuse tier-selection.ts. Tier groups work because a
 * relic exists in exactly one tier, so the group containing an element *is* its
 * tier. On a map there is one badge per region and any of the eight can land in
 * any of the three slots, so there's no containment to read a slot out of. The
 * state here is an ordered list, and the slot is just the index.
 *
 * That order is worth keeping: it says what a player rushes first and at what
 * task cost, which is real information in a shared build. It lives in the DOM as
 * `data-slot` rather than in a module variable, so — as with `armed` in
 * tier-selection — there is one source of truth and nothing to desync.
 */

const SELECTED = 'selected';
const SLOT_ATTR = 'data-slot';

export interface RegionSelectionContext {
  /** Every region badge on the map, mandatory ones included. */
  regions: HTMLElement[];
  /** Slot numbers for the free picks, in unlock order — [4, 5, 6]. */
  slots: number[];
  /** Apply the same visual treatment picker.ts gives a (de)selected item. */
  setSelected: (element: HTMLElement, selected: boolean) => void;
}

const isMandatory = (element: HTMLElement): boolean =>
  element.dataset.mandatory === 'true';

/**
 * Chosen regions in slot order. Mandatory ones are never included.
 *
 * A pick that has just been made carries no slot yet, and sorts last — it is by
 * definition the newest. Defaulting it to 0 instead would let every new pick
 * seize the first slot and push the earlier ones back.
 */
function chosen(ctx: RegionSelectionContext): HTMLElement[] {
  const slotOf = (region: HTMLElement) =>
    region.dataset.slot ? Number(region.dataset.slot) : Number.POSITIVE_INFINITY;

  return ctx.regions
    .filter((region) => region.classList.contains(SELECTED) && !isMandatory(region))
    .sort((a, b) => slotOf(a) - slotOf(b));
}

/**
 * Renumber the picks so they fill slots from the top.
 *
 * Dropping your 175-task pick promotes the later ones rather than leaving a hole
 * — the thresholds mean "your Nth unlock", so shifting up is what actually
 * happens in game.
 */
function renumber(ctx: RegionSelectionContext): void {
  chosen(ctx).forEach((region, index) => {
    region.setAttribute(SLOT_ATTR, String(ctx.slots[index]));
  });
}

/** The ids of the chosen regions, in slot order, for the URL. */
export function chosenRegionIds(ctx: RegionSelectionContext): string[] {
  return chosen(ctx).map((region) => region.id);
}

/** How many free picks are still unspent. */
export function remainingPicks(ctx: RegionSelectionContext): number {
  return ctx.slots.length - chosen(ctx).length;
}

/**
 * Apply a click to the region selection.
 *
 * Always returns true: on a region map every click is ours to interpret, and
 * falling through to plain toggling would let a player exceed three picks or
 * deselect a region the game hands them.
 */
export function applyRegionClick(
  element: HTMLElement,
  ctx: RegionSelectionContext,
): boolean {
  // Handed to you, not chosen — nothing to toggle.
  if (isMandatory(element)) return true;

  if (element.classList.contains(SELECTED)) {
    element.classList.remove(SELECTED);
    element.removeAttribute(SLOT_ATTR);
    ctx.setSelected(element, false);
    renumber(ctx);
    return true;
  }

  // Full. Ignore rather than silently evicting a pick the player made earlier —
  // which one we dropped would be a guess, and the rail shows what to free up.
  if (remainingPicks(ctx) === 0) return true;

  element.classList.add(SELECTED);
  ctx.setSelected(element, true);
  renumber(ctx);
  return true;
}

/**
 * Bring a restored selection in line with the rules.
 *
 * `order` is the raw `selected` parameter, which is authoritative for slot order
 * — the URL preserves it, so nothing extra had to be recorded. Anything the
 * build can't justify is dropped: unknown ids, mandatory regions (implied, never
 * chosen), duplicates, and picks past the third.
 */
export function reconcileRestoredRegions(
  ctx: RegionSelectionContext,
  order: string | null,
): void {
  const byId = new Map(ctx.regions.map((region) => [region.id, region]));
  const keep: HTMLElement[] = [];
  const seen = new Set<string>();

  for (const id of (order ?? '').split(',')) {
    const region = byId.get(id.trim());
    if (!region || isMandatory(region) || seen.has(region.id)) continue;
    if (keep.length >= ctx.slots.length) break;
    seen.add(region.id);
    keep.push(region);
  }

  for (const region of ctx.regions) {
    const wanted = keep.includes(region);
    if (isMandatory(region)) {
      // Mandatory regions read as unlocked but are not picks, so they carry
      // neither the selected class nor a slot. This has to go through
      // setSelected rather than just dropping the class: a link naming a
      // mandatory region gets it marked selected on the way in, and that lands
      // on the map shape as well as the badge.
      region.removeAttribute(SLOT_ATTR);
      ctx.setSelected(region, false);
      continue;
    }
    region.classList.toggle(SELECTED, wanted);
    if (!wanted) region.removeAttribute(SLOT_ATTR);
    ctx.setSelected(region, wanted);
  }

  keep.forEach((region, index) => region.setAttribute(SLOT_ATTR, String(ctx.slots[index])));
}
