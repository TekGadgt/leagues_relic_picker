/**
 * Applies the god-tier rule to the picker page. The rule itself lives in
 * ./blessing-path, shared with the showcase.
 *
 * Derived selections are presentational only. They carry data-derived, which
 * keeps them out of the shareable URL, so the URL records what the player chose
 * and the outcome is always recomputed from it.
 */

import { resolvePath, type Path } from './blessing-path';

interface DerivedGroup {
  group: string;
  from: string[];
}

function getDerivedGroups(): DerivedGroup[] {
  const w = window as Window & { PICKER_CONFIG?: { derivedGroups?: DerivedGroup[] } };
  return w.PICKER_CONFIG?.derivedGroups ?? [];
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
