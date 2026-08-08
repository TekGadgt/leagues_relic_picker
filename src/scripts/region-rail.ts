/**
 * Fills the unlock rail from the current picks.
 *
 * picker.ts owns selection, so this listens for its change event rather than
 * guessing at script order — the same arrangement blessings.ts uses for derived
 * god tiers. Which slot a region occupies is read off `data-slot`, so the rail
 * can't disagree with the map about the order.
 */

const EMPTY_LABEL = 'Pick a region';

function fillRail(): void {
  const slots = Array.from(document.querySelectorAll<HTMLElement>('.railSlot[data-rail-slot]'));
  if (!slots.length) return;

  const picked = new Map<string, HTMLElement>();
  for (const region of Array.from(document.querySelectorAll<HTMLElement>('.region.selected'))) {
    if (region.dataset.slot) picked.set(region.dataset.slot, region);
  }

  for (const slot of slots) {
    const region = picked.get(slot.dataset.railSlot ?? '');
    const badge = slot.querySelector<HTMLImageElement>('.railBadge');
    const name = slot.querySelector<HTMLElement>('.railName');

    slot.classList.toggle('filled', Boolean(region));

    if (!badge || !name) continue;

    if (region) {
      badge.src = region.dataset.imageSrc ?? '';
      badge.alt = '';
      badge.hidden = false;
      name.textContent = region.dataset.label ?? '';
    } else {
      // Clearing src rather than leaving the last pick's image avoids a stale
      // badge flashing in the slot the moment before it's hidden.
      badge.hidden = true;
      badge.removeAttribute('src');
      name.textContent = EMPTY_LABEL;
    }
  }
}

document.addEventListener('picker:selectionchange', fillRail);
document.addEventListener('DOMContentLoaded', fillRail);
fillRail();
