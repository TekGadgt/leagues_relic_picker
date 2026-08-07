/**
 * The Equilibrium League god-tier rule, shared by the picker and the showcase.
 *
 * Each blessing belongs to one of three paths, and each tier offers exactly one
 * of each. A god tier isn't chosen: two or more picks of one path across the
 * tiers feeding it unlock that path's god blessing, and one of each unlocks
 * balance.
 *
 * This lives in its own module because two callers need it — blessings.ts to
 * light up the god tier on the picker, and showcase.ts to reconstruct it from a
 * shared URL. Copying it into both is how the two would quietly disagree.
 */

export type Path = 'chaos' | 'order' | 'balance';

export const PATHS: Path[] = ['chaos', 'order', 'balance'];

/**
 * The path a run of picks resolves to, or null while still undecided.
 *
 * Resolves early: once two picks share a path, no third pick can overturn them,
 * so there's no reason to wait for a complete run. A complete run with no
 * majority is necessarily one of each, which is balance — so every complete run
 * resolves, making the rule total.
 */
export function resolvePath(picked: (Path | null)[]): Path | null {
  const paths = picked.filter((p): p is Path => p !== null);

  for (const path of PATHS) {
    if (paths.filter((p) => p === path).length >= 2) return path;
  }

  return paths.length >= 3 ? 'balance' : null;
}
