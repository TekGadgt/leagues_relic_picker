/**
 * Derived-group selection for Equilibrium League blessings.
 *
 * Each blessing belongs to one of three paths (chaos, order, balance), and each
 * tier offers exactly one of each. A god tier isn't chosen — it's decided by the
 * paths picked in the tiers feeding it: two or more of one path unlocks that
 * path's god blessing, and one of each unlocks balance.
 *
 * Because three picks across three paths either contain a majority or are all
 * distinct, the rule is total. It also resolves early: once two picks share a
 * path, no third pick can overturn them, so the result is shown immediately
 * rather than waiting for the tier run to be complete.
 *
 * Derived selections are presentational only. They carry data-derived, which
 * keeps them out of the shareable URL, so the URL records what the player chose
 * and the outcome is always recomputed from it.
 */

type Path = 'chaos' | 'order' | 'balance';

interface DerivedGroup {
  group: string;
  from: string[];
}

const PATHS: Path[] = ['chaos', 'order', 'balance'];

function getDerivedGroups(): DerivedGroup[] {
  const w = window as Window & { PICKER_CONFIG?: { derivedGroups?: DerivedGroup[] } };
  return w.PICKER_CONFIG?.derivedGroups ?? [];
}

/**
 * The path a run of source groups resolves to, or null while still undecided.
 * Undecided means fewer than three picks with no path yet holding two.
 */
export function resolvePath(picked: (Path | null)[]): Path | null {
  const paths = picked.filter((p): p is Path => p !== null);

  for (const path of PATHS) {
    if (paths.filter((p) => p === path).length >= 2) return path;
  }
  // No majority yet. Only a complete run of three can resolve, and a complete
  // run with no majority is necessarily one of each.
  return paths.length >= 3 ? 'balance' : null;
}

function pickedPathsFor(sourceGroups: string[]): (Path | null)[] {
  return sourceGroups.map((groupId) => {
    const selected = document.querySelector<HTMLElement>(`#${CSS.escape(groupId)} .selected`);
    return (selected?.dataset.path as Path | undefined) ?? null;
  });
}

/**
 * Match how picker.ts's updateElementOpacity dims a non-pact item: it fades the
 * inner image and label to 0.25, not the container. Deriving a god tier has to
 * look identical to choosing a blessing directly, so the values are kept in
 * step with that function.
 */
function setItemDimming(item: HTMLElement, isSelected: boolean): void {
  const img = item.querySelector<HTMLElement>('.masteryImg');
  const label = item.querySelector<HTMLElement>('.masteryLabel');
  const opacity = isSelected ? '1' : '0.25';
  if (img) img.style.opacity = opacity;
  if (label) label.style.opacity = opacity;
}

function applyDerivedSelection(group: string, resolved: Path | null): void {
  const groupEl = document.getElementById(group);
  if (!groupEl) return;

  groupEl.classList.toggle('undecided', resolved === null);

  for (const item of Array.from(groupEl.querySelectorAll<HTMLElement>('[data-derived="true"]'))) {
    const isMatch = resolved !== null && item.dataset.path === resolved;
    item.classList.toggle('selected', isMatch);
    setItemDimming(item, isMatch);
  }
}

export function refreshDerivedGroups(): void {
  for (const { group, from } of getDerivedGroups()) {
    applyDerivedSelection(group, resolvePath(pickedPathsFor(from)));
  }
}

function initBlessings(): void {
  if (getDerivedGroups().length === 0) return; // not a page with derived groups

  // picker.ts owns selection state and announces every change — both the
  // initial restore from the URL and each subsequent toggle. Listening for that
  // instead of for clicks avoids depending on which script initialises first.
  document.addEventListener('picker:selectionchange', refreshDerivedGroups);

  // Covers the case where picker.ts already restored selections before this
  // script ran, so its initial announcement was missed.
  refreshDerivedGroups();
}

// Registered before picker.ts's initial announcement when this script runs
// first; the direct call above covers the opposite order.
document.addEventListener('DOMContentLoaded', initBlessings);
initBlessings();
