export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * html2canvas doesn't implement object-fit: it draws every image stretched to
 * its box, which squashes RS3 icons whose aspect ratio isn't the box's.
 *
 * Resolving object-fit: contain ourselves — sizing each image to the box it
 * would actually paint into, and centring it with the freed-up space as margin
 * — leaves html2canvas nothing to get wrong, because the element's own
 * dimensions now carry the correct ratio. Keeping the total footprint identical
 * means surrounding layout doesn't shift during capture.
 *
 * Returns a function that puts the original inline styles back.
 */
export function resolveObjectFitForExport(root: HTMLElement): () => void {
  const images = Array.from(root.querySelectorAll('img'));
  const restores: (() => void)[] = [];

  for (const img of images) {
    if (getComputedStyle(img).objectFit !== 'contain') continue;
    if (!img.naturalWidth || !img.naturalHeight) continue;

    const box = img.getBoundingClientRect();
    if (!box.width || !box.height) continue;

    const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    const width = img.naturalWidth * scale;
    const height = img.naturalHeight * scale;
    if (Math.abs(width - box.width) < 0.5 && Math.abs(height - box.height) < 0.5) continue;

    const prev = img.getAttribute('style');
    restores.push(() => {
      if (prev === null) img.removeAttribute('style');
      else img.setAttribute('style', prev);
    });

    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    img.style.marginLeft = `${(box.width - width) / 2}px`;
    img.style.marginRight = `${(box.width - width) / 2}px`;
    img.style.marginTop = `${(box.height - height) / 2}px`;
    img.style.marginBottom = `${(box.height - height) / 2}px`;
  }

  return () => restores.forEach((restore) => restore());
}
