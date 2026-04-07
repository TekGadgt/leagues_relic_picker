// Pan & zoom for the pact graph canvas

function initPactGraph(): void {
  const viewport = document.getElementById('pactViewport');
  const canvas = document.getElementById('pactCanvas');
  if (!viewport || !canvas) return;

  const CANVAS_SIZE = 5000;
  const MIN_SCALE = 0.05;
  const MAX_SCALE = 1.0;
  const ZOOM_STEP = 0.02;

  // Compute initial scale to fit the viewport
  const initVw = viewport.clientWidth;
  const initVh = viewport.clientHeight;
  const defaultScale = Math.min(initVw, initVh) / CANVAS_SIZE;
  let scale = defaultScale;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  function applyTransform(): void {
    canvas!.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
  }

  function centerGraph(): void {
    const vw = viewport!.clientWidth;
    const vh = viewport!.clientHeight;
    const cw = CANVAS_SIZE * scale;
    const ch = CANVAS_SIZE * scale;
    panX = (vw - cw) / 2;
    panY = (vh - ch) / 2;
    applyTransform();
  }

  // Initial center
  centerGraph();

  // Mouse wheel zoom
  viewport.addEventListener('wheel', (e: WheelEvent) => {
    e.preventDefault();
    const rect = viewport!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldScale = scale;
    scale += e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

    // Zoom toward cursor
    const ratio = scale / oldScale;
    panX = mouseX - ratio * (mouseX - panX);
    panY = mouseY - ratio * (mouseY - panY);
    applyTransform();
  }, { passive: false });

  // Mouse drag pan
  viewport.addEventListener('mousedown', (e: MouseEvent) => {
    // Only start drag on the viewport/canvas background, not on pact nodes
    const target = e.target as HTMLElement;
    if (target.closest('.pact')) return;
    isDragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    viewport!.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      viewport!.style.cursor = 'grab';
    }
  });

  // Touch pan/zoom
  let lastTouchDist = 0;
  let lastTouchMidX = 0;
  let lastTouchMidY = 0;
  let touchStartPanX = 0;
  let touchStartPanY = 0;
  let touchStartMidX = 0;
  let touchStartMidY = 0;
  let isTouchPanning = false;

  viewport.addEventListener('touchstart', (e: TouchEvent) => {
    if (e.touches.length === 1) {
      const target = e.target as HTMLElement;
      if (target.closest('.pact')) return;
      isTouchPanning = true;
      startX = e.touches[0].clientX - panX;
      startY = e.touches[0].clientY - panY;
    } else if (e.touches.length === 2) {
      isTouchPanning = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.hypot(dx, dy);

      const rect = viewport!.getBoundingClientRect();
      lastTouchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      lastTouchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      touchStartPanX = panX;
      touchStartPanY = panY;
      touchStartMidX = lastTouchMidX;
      touchStartMidY = lastTouchMidY;
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e: TouchEvent) => {
    if (e.touches.length === 1 && isTouchPanning) {
      e.preventDefault();
      panX = e.touches[0].clientX - startX;
      panY = e.touches[0].clientY - startY;
      applyTransform();
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);

      const rect = viewport!.getBoundingClientRect();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      const oldScale = scale;
      scale *= dist / lastTouchDist;
      scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      lastTouchDist = dist;

      // Zoom toward pinch midpoint + pan with midpoint movement
      const ratio = scale / oldScale;
      panX = midX - ratio * (touchStartMidX - touchStartPanX) + (midX - touchStartMidX);
      panY = midY - ratio * (touchStartMidY - touchStartPanY) + (midY - touchStartMidY);

      touchStartPanX = panX;
      touchStartPanY = panY;
      touchStartMidX = midX;
      touchStartMidY = midY;

      applyTransform();
    }
  }, { passive: false });

  viewport.addEventListener('touchend', () => {
    isTouchPanning = false;
    lastTouchDist = 0;
  }, { passive: true });

  // Zoom control buttons
  document.getElementById('pactZoomIn')?.addEventListener('click', () => {
    const vw = viewport!.clientWidth;
    const vh = viewport!.clientHeight;
    const centerX = vw / 2;
    const centerY = vh / 2;
    const oldScale = scale;
    scale = Math.min(MAX_SCALE, scale + ZOOM_STEP * 2);
    const ratio = scale / oldScale;
    panX = centerX - ratio * (centerX - panX);
    panY = centerY - ratio * (centerY - panY);
    applyTransform();
  });

  document.getElementById('pactZoomOut')?.addEventListener('click', () => {
    const vw = viewport!.clientWidth;
    const vh = viewport!.clientHeight;
    const centerX = vw / 2;
    const centerY = vh / 2;
    const oldScale = scale;
    scale = Math.max(MIN_SCALE, scale - ZOOM_STEP * 2);
    const ratio = scale / oldScale;
    panX = centerX - ratio * (centerX - panX);
    panY = centerY - ratio * (centerY - panY);
    applyTransform();
  });

  document.getElementById('pactZoomReset')?.addEventListener('click', () => {
    scale = defaultScale;
    centerGraph();
  });

  // Arrow key panning
  const PAN_STEP = 40;
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable)) return;
    if (e.ctrlKey || e.metaKey) {
      const vw = viewport!.clientWidth;
      const vh = viewport!.clientHeight;
      const centerX = vw / 2;
      const centerY = vh / 2;
      const oldScale = scale;
      if (e.key === 'ArrowUp') {
        scale = Math.min(MAX_SCALE, scale + ZOOM_STEP * 2);
      } else if (e.key === 'ArrowDown') {
        scale = Math.max(MIN_SCALE, scale - ZOOM_STEP * 2);
      } else {
        return;
      }
      const ratio = scale / oldScale;
      panX = centerX - ratio * (centerX - panX);
      panY = centerY - ratio * (centerY - panY);
    } else {
      switch (e.key) {
        case 'ArrowLeft':  panX += PAN_STEP; break;
        case 'ArrowRight': panX -= PAN_STEP; break;
        case 'ArrowUp':    panY += PAN_STEP; break;
        case 'ArrowDown':  panY -= PAN_STEP; break;
        default: return;
      }
    }
    e.preventDefault();
    applyTransform();
  });

  // Expose reset for export
  (window as Window & { resetPactGraphTransform?: () => void }).resetPactGraphTransform = () => {
    canvas!.style.transform = 'none';
  };

  (window as Window & { restorePactGraphTransform?: () => void }).restorePactGraphTransform = () => {
    applyTransform();
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPactGraph);
} else {
  initPactGraph();
}

export {};
