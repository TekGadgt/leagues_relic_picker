// Main picker initialization script
import { snapdom } from '@zumer/snapdom';
import { isTouchDevice } from './utils';
import { applyTierClick, bonusPickId, reconcileRestoredSelection, type TierSelectionContext } from './tier-selection';
import { getStrategy, itemsIn, type RollPlan } from './randomizer';
import { animateRoll, pause, BONUS_BEAT_MS, ROLLING_BONUS_CLASS, type Reel } from './roll-animation';

interface PickerConfig {
  exportFilename: string;
  /** Names a randomizer strategy; absent means no Randomize button. */
  randomizer?: string;
  /** Relics and blessings allow one pick per tier; masteries and pacts don't. */
  onePickPerTier?: boolean;
}

type ToolTipItem = string | string[];

interface DetailData {
  label: string;
  imageSrc: string;
  items: ToolTipItem[];
}

// Double-tap state for mobile
interface TapState {
  lastTapTime: number;
  lastTapTarget: HTMLElement | null;
  pendingToggle: ReturnType<typeof setTimeout> | null;
}

const tapState: TapState = {
  lastTapTime: 0,
  lastTapTarget: null,
  pendingToggle: null
};

const DOUBLE_TAP_THRESHOLD = 300;

// URL State Management
function updateURLParams(elements: HTMLCollectionOf<Element>, titleSelector: string): void {
  const params = Array.from(elements)
    .filter(element => element.classList.contains('selected'))
    // Derived selections (e.g. blessing god tiers) are computed from the
    // player's other picks, so storing them would let a URL encode an outcome
    // the rules can't produce. They're recomputed on load instead.
    .filter(element => !(element as HTMLElement).dataset.derived)
    .map(element => element.id);
  const titleElement = document.querySelector(titleSelector);
  const title = titleElement?.textContent || '';
  const url = new URL(window.location.href);
  url.searchParams.set('selected', params.join(','));
  url.searchParams.set('title', title);

  // Which relic is the extra can't be inferred from `selected` alone — a bonus
  // spent in an otherwise-empty tier looks like an ordinary pick.
  const ctx = getPickerConfig().onePickPerTier ? tierContext() : null;
  const bonus = ctx ? bonusPickId(ctx) : null;
  if (bonus) url.searchParams.set('bonus', bonus);
  else url.searchParams.delete('bonus');
  window.history.replaceState({}, '', url.toString());
}

/**
 * Announce that the set of selected elements changed. picker.ts owns selection
 * state, so anything derived from it (blessing god tiers) listens for this
 * rather than guessing at script execution order.
 */
function notifySelectionChanged(): void {
  document.dispatchEvent(new CustomEvent('picker:selectionchange'));
}

function setInitialSelections(elements: HTMLCollectionOf<Element>, titleSelector: string): void {
  const urlParams = new URLSearchParams(window.location.search);
  const selected = urlParams.get('selected');
  const title = urlParams.get('title');

  if (selected) {
    selected.split(',').forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add('selected');
        updateElementOpacity(element, true);
      }
    });
  }

  // Force center pact node (node1) to always be selected
  const centerNode = document.getElementById('node1');
  if (centerNode && centerNode.classList.contains('pact') && !centerNode.classList.contains('selected')) {
    centerNode.classList.add('selected');
    updateElementOpacity(centerNode, true);
  }

  if (title) {
    const titleElement = document.querySelector(titleSelector);
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  Array.from(elements).forEach(element => {
    if (!element.classList.contains('selected')) {
      updateElementOpacity(element as HTMLElement, false);
    }
  });

  // Links shared before one-per-tier existed can hold several picks in a tier.
  if (getPickerConfig().onePickPerTier) {
    const ctx = tierContext();
    if (ctx) {
      reconcileRestoredSelection(ctx, urlParams.get('bonus'));
      updateURLParams(elements, titleSelector);
    }
  }

  notifySelectionChanged();
}

/**
 * Groups in render order, skipping derived ones (blessing god tiers), which
 * follow from other picks rather than being chosen.
 */
function tierContext(): TierSelectionContext | null {
  const container = document.querySelector('.colContainer, .rowContainer');
  if (!container) return null;
  const groups = Array.from(container.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && !child.classList.contains('derivedGroup'),
  );
  return groups.length
    ? { groups, setSelected: (el, selected) => updateElementOpacity(el, selected) }
    : null;
}

/**
 * True while a randomised roll is animating. Selection changes are refused
 * during that window, so a stray click can't interleave with the picks the roll
 * is about to apply.
 */
let rollInProgress = false;

export function setRollInProgress(value: boolean): void {
  rollInProgress = value;
}

function toggleElement(element: HTMLElement, elements: HTMLCollectionOf<Element>, titleSelector: string): void {
  if (rollInProgress) return;

  // Prevent deselecting the center pact node
  if (element.id === 'node1' && element.classList.contains('selected')) return;

  // Derived items (blessing god tiers) follow from other picks and can't be
  // toggled directly. Right-click still opens their detail sidebar.
  if (element.dataset.derived) return;

  const config = getPickerConfig();
  const ctx = config.onePickPerTier ? tierContext() : null;

  if (ctx && applyTierClick(element, ctx)) {
    updateURLParams(elements, titleSelector);
    updateEdgeStyles();
    updatePactCounter(elements);
    notifySelectionChanged();
    return;
  }

  const isSelected = element.classList.toggle('selected');
  updateElementOpacity(element, isSelected);
  updateURLParams(elements, titleSelector);
  updateEdgeStyles();
  updatePactCounter(elements);
  notifySelectionChanged();
}

function updateElementOpacity(element: HTMLElement, isSelected: boolean): void {
  // Pact nodes swap between active/inactive images
  if (element.classList.contains('pact')) {
    updatePactImages(element, isSelected);
    return;
  }

  const img = element.querySelector('.relicImg, .masteryImg') as HTMLElement | null;
  const label = element.querySelector('.relicLabel, .masteryLabel') as HTMLElement | null;

  if (img) img.style.opacity = isSelected ? '1' : '0.25';
  if (label) label.style.opacity = isSelected ? '1' : '0.25';
}

function updatePactImages(element: HTMLElement, isSelected: boolean): void {
  const img = element.querySelector('.pactImg') as HTMLImageElement | null;
  const activeSrc = element.dataset.activeSrc || '';
  const inactiveSrc = element.dataset.inactiveSrc || '';
  const activeFrame = element.dataset.activeFrame || '';
  const inactiveFrame = element.dataset.inactiveFrame || '';

  if (img && activeSrc && inactiveSrc) {
    img.src = isSelected ? activeSrc : inactiveSrc;
  }

  const frameSrc = isSelected ? activeFrame : inactiveFrame;
  element.style.backgroundImage = frameSrc ? `url(${frameSrc})` : '';
}

function preloadPactImages(elements: HTMLCollectionOf<Element>): void {
  const srcs = new Set<string>();
  Array.from(elements).forEach(el => {
    const activeSrc = (el as HTMLElement).dataset.activeSrc;
    const activeFrame = (el as HTMLElement).dataset.activeFrame;
    if (activeSrc) srcs.add(activeSrc);
    if (activeFrame) srcs.add(activeFrame);
  });
  srcs.forEach(src => {
    const img = new Image();
    img.src = src;
  });
}

function updatePactCounter(elements: HTMLCollectionOf<Element>): void {
  const counter = document.getElementById('pactCounter');
  if (!counter) return;
  const count = Array.from(elements).filter(el => el.classList.contains('selected')).length;
  counter.textContent = `${count} / 40`;
  counter.classList.toggle('over-limit', count > 40);
}

function updateEdgeStyles(): void {
  const edges = document.querySelectorAll('.pact-edge');
  edges.forEach(edge => {
    const from = edge.getAttribute('data-from');
    const to = edge.getAttribute('data-to');
    const fromEl = from ? document.getElementById(from) : null;
    const toEl = to ? document.getElementById(to) : null;
    const bothSelected = fromEl?.classList.contains('selected') && toEl?.classList.contains('selected');
    edge.classList.toggle('active', !!bothSelected);
  });
}

let currentSidebarElementId: string | null = null;

// Detail Sidebar Management
function openDetailSidebar(data: DetailData, _elementId: string): void {
  const sidebar = document.querySelector('.detail-sidebar');
  if (!sidebar) return;

  const titleEl = sidebar.querySelector('.detail-sidebar-title');
  if (titleEl) titleEl.textContent = data.label;

  const imageContainer = sidebar.querySelector('.detail-sidebar-image');
  if (imageContainer) {
    while (imageContainer.firstChild) imageContainer.removeChild(imageContainer.firstChild);

    const sourceEl = document.getElementById(_elementId);
    const isPact = sourceEl?.classList.contains('pact');

    if (isPact && sourceEl) {
      const activeFrame = sourceEl.dataset.activeFrame || '';
      const activeIcon = sourceEl.dataset.activeSrc || data.imageSrc;
      const composite = document.createElement('div');
      composite.className = 'sidebar-pact-composite';
      if (activeFrame) {
        composite.style.backgroundImage = `url(${activeFrame})`;
        composite.style.backgroundSize = 'contain';
        composite.style.backgroundRepeat = 'no-repeat';
        composite.style.backgroundPosition = 'center';
      }
      const img = document.createElement('img');
      img.src = activeIcon;
      img.alt = data.label;
      composite.appendChild(img);
      imageContainer.appendChild(composite);
    } else {
      const img = document.createElement('img');
      img.src = data.imageSrc;
      img.alt = data.label;
      imageContainer.appendChild(img);
    }
  }

  const descriptionContainer = sidebar.querySelector('.detail-sidebar-description');
  if (descriptionContainer) {
    if (data.items && data.items.length > 0) {
      const list = document.createElement('ul');
      data.items.forEach(item => {
        if (Array.isArray(item)) {
          const subList = document.createElement('ul');
          item.forEach(subItem => {
            const subLi = document.createElement('li');
            subLi.textContent = subItem;
            subList.appendChild(subLi);
          });
          list.appendChild(subList);
        } else {
          const li = document.createElement('li');
          li.textContent = item;
          list.appendChild(li);
        }
      });
      while (descriptionContainer.firstChild) descriptionContainer.removeChild(descriptionContainer.firstChild);
      descriptionContainer.appendChild(list);
    } else {
      while (descriptionContainer.firstChild) descriptionContainer.removeChild(descriptionContainer.firstChild);
      const p = document.createElement('p');
      p.textContent = 'No additional details available.';
      descriptionContainer.appendChild(p);
    }
  }

  sidebar.classList.add('open');
  currentSidebarElementId = _elementId;
}

function closeDetailSidebar(): void {
  const sidebar = document.querySelector('.detail-sidebar');
  if (sidebar) sidebar.classList.remove('open');
  currentSidebarElementId = null;
}

function isDetailSidebarOpen(): boolean {
  const sidebar = document.querySelector('.detail-sidebar');
  return sidebar !== null && sidebar.classList.contains('open');
}

// Get picker config from global variable
function getPickerConfig(): PickerConfig {
  const w = window as Window & { PICKER_CONFIG?: PickerConfig };
  return w.PICKER_CONFIG || { exportFilename: 'export.png' };
}

// The export background comes from the active theme rather than page config, so
// themes.css stays the only place a league colour is written down.
function getExportBackgroundColor(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--background-color')
    .trim();
}

// Initialize the picker
function initPicker(): void {
  const itemClass = document.querySelector('.pact') ? 'pact' : document.querySelector('.relic') ? 'relic' : 'mastery';
  const elements = document.getElementsByClassName(itemClass);
  const isPactGraph = itemClass === 'pact';
  const titleSelector = '.title';

  // Set initial selections from URL
  setInitialSelections(elements, titleSelector);
  if (isPactGraph) {
    updateEdgeStyles();
    updatePactCounter(elements);
    preloadPactImages(elements);
  }

  // Add click/touch handlers to all items
  const isTouch = isTouchDevice();

  Array.from(elements).forEach(element => {
    if (isTouch) {
      // Touch device: single tap = toggle (delayed), double tap = sidebar
      element.addEventListener('click', function(this: HTMLElement, e: Event) {
        const now = Date.now();
        const timeSinceLastTap = now - tapState.lastTapTime;
        const isSameTarget = tapState.lastTapTarget === this;

        if (isSameTarget && timeSinceLastTap < DOUBLE_TAP_THRESHOLD) {
          // Double tap detected - cancel pending toggle and open sidebar
          if (tapState.pendingToggle) {
            clearTimeout(tapState.pendingToggle);
            tapState.pendingToggle = null;
          }
          e.preventDefault();
          e.stopPropagation();
          if (isDetailSidebarOpen() && currentSidebarElementId === this.id) {
            closeDetailSidebar();
          } else {
            openDetailSidebar({
              label: this.dataset.label || '',
              imageSrc: this.dataset.imageSrc || '',
              items: JSON.parse(this.dataset.items || '[]')
            }, this.id);
          }
          // Reset tap state
          tapState.lastTapTime = 0;
          tapState.lastTapTarget = null;
        } else {
          // Potential single tap - delay toggle to allow for double tap
          if (tapState.pendingToggle) {
            clearTimeout(tapState.pendingToggle);
          }
          const element = this;
          tapState.pendingToggle = setTimeout(() => {
            toggleElement(element, elements, titleSelector);
            tapState.pendingToggle = null;
          }, DOUBLE_TAP_THRESHOLD);
          tapState.lastTapTime = now;
          tapState.lastTapTarget = this;
        }
      });
    } else {
      // Non-touch device: click = toggle, right-click = sidebar
      element.addEventListener('click', function(this: HTMLElement) {
        toggleElement(this, elements, titleSelector);
      });

      element.addEventListener('contextmenu', function(this: HTMLElement, e: Event) {
        e.preventDefault();

        if (isDetailSidebarOpen() && currentSidebarElementId === this.id) {
          closeDetailSidebar();
        } else {
          openDetailSidebar({
            label: this.dataset.label || '',
            imageSrc: this.dataset.imageSrc || '',
            items: JSON.parse(this.dataset.items || '[]')
          }, this.id);
        }
      });
    }
  });

  // Close button handler for sidebar
  const closeBtn = document.querySelector('.detail-sidebar-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDetailSidebar);
  }

  // Click outside to close sidebar
  document.addEventListener('click', function(e) {
    if (!isDetailSidebarOpen()) return;

    const sidebar = document.querySelector('.detail-sidebar');
    if (sidebar && sidebar.contains(e.target as Node)) return;

    // Don't close sidebar when interacting with pact graph viewport
    const pactViewport = document.getElementById('pactViewport');
    if (pactViewport && pactViewport.contains(e.target as Node)) return;

    closeDetailSidebar();
  });

  // Title input handler
  const titleElement = document.querySelector(titleSelector);
  if (titleElement) {
    titleElement.addEventListener('input', function() {
      updateURLParams(elements, titleSelector);
    });
  }

  // Randomizer handlers
  const strategy = getStrategy(getPickerConfig().randomizer);
  if (strategy) {
    const rollNextBtn = document.getElementById('rollNextBtn') as HTMLButtonElement | null;
    const randomizeBtn = document.getElementById('randomizeBtn') as HTMLButtonElement | null;
    const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement | null;
    const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement | null;
    const showcaseBtn = document.getElementById('addToShowcaseBtn') as HTMLButtonElement | null;
    const lockable = [rollNextBtn, randomizeBtn, clearBtn, exportBtn, showcaseBtn];

    let rolling = false;

    const clearSelection = () => {
      for (const element of Array.from(elements)) {
        if (!element.classList.contains('selected')) continue;
        const item = element as HTMLElement;
        item.classList.remove('selected');
        item.removeAttribute('data-bonus');
        updateElementOpacity(item, false);
      }
    };

    const commit = () => {
      updateURLParams(elements, titleSelector);
      updateEdgeStyles();
      updatePactCounter(elements);
      notifySelectionChanged();
      refreshRollNextState();
    };

    // Nothing left to reveal once every tier is filled.
    function refreshRollNextState(): void {
      if (!rollNextBtn) return;
      const ctx = tierContext();
      rollNextBtn.disabled = rolling || !ctx?.groups.some(
        group => !itemsIn(group).some(item => item.classList.contains('selected')),
      );
    }

    /**
     * Reveal a plan, then apply it.
     *
     * The spin is decoration over an already-decided outcome, so the same picks
     * are applied whether it played, was skipped, or was never shown. Controls
     * stay locked throughout, which is what stops a half-settled board being
     * exported or mutated.
     */
    const performRoll = async (plan: RollPlan) => {
      if (rolling || plan.picks.length === 0) return;

      const ctx = tierContext();
      if (!ctx) return;

      rolling = true;
      setRollInProgress(true);
      for (const button of lockable) if (button) button.disabled = true;

      try {
        if (plan.clearFirst) clearSelection();

        const highlight = {
          setHighlighted: (element: HTMLElement, on: boolean) => updateElementOpacity(element, on),
        };
        const reelFor = (pick: HTMLElement): Reel | null => {
          const group = ctx.groups.find(candidate => candidate.contains(pick));
          return group ? { group, landOn: pick } : null;
        };

        const reels = plan.picks.map(reelFor).filter((reel): reel is Reel => reel !== null);
        const skipped = await animateRoll(reels, highlight);
        for (const pick of plan.picks) applyTierClick(pick, ctx);

        if (plan.bonusPick) {
          const bonusReel = reelFor(plan.bonusPick);
          // Beat between the granter landing and its extra rolling, so the two
          // read as cause and effect rather than one simultaneous event. Dropped
          // for anyone who skipped — they've asked not to wait.
          if (bonusReel && !skipped) {
            await pause(BONUS_BEAT_MS);
            await animateRoll([{ ...bonusReel, asBonus: true }], highlight);
          }
          applyTierClick(plan.bonusPick, ctx);
          // The real data-bonus attribute now drives the styling.
          for (const el of Array.from(document.querySelectorAll('.' + ROLLING_BONUS_CLASS))) {
            el.classList.remove(ROLLING_BONUS_CLASS);
          }
        }
      } finally {
        rolling = false;
        setRollInProgress(false);
        for (const button of lockable) if (button) button.disabled = false;
        commit();
      }
    };

    if (rollNextBtn && strategy.rollNext) {
      rollNextBtn.addEventListener('click', function() {
        const ctx = tierContext();
        if (ctx) void performRoll(strategy.rollNext!(ctx));
      });
    } else if (rollNextBtn) {
      // Strategy has no natural progression — don't offer a button that can't work.
      rollNextBtn.remove();
    }

    if (randomizeBtn) {
      randomizeBtn.addEventListener('click', function() {
        const ctx = tierContext();
        if (ctx) void performRoll(strategy.rollAll(ctx));
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        if (rolling) return;
        clearSelection();
        commit();
      });
    }

    refreshRollNextState();
  }

  // Export button handler
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      const mainElement = document.getElementById('main');
      if (!mainElement) return;

      const config = getPickerConfig();

      // Close sidebar before export
      closeDetailSidebar();

      // Reset graph transform for export
      const wExport = window as Window & {
        resetPactGraphTransform?: () => void;
        restorePactGraphTransform?: () => void;
      };
      if (wExport.resetPactGraphTransform) wExport.resetPactGraphTransform();

      // Force desktop layout for export
      mainElement.classList.add('exporting');
      const exportBackgroundColor = getExportBackgroundColor();
      mainElement.style.backgroundColor = exportBackgroundColor;
      mainElement.style.paddingTop = '50px';
      mainElement.style.paddingBottom = '50px';

      // Wait for repaint before capturing
      requestAnimationFrame(async () => {
        const restoreLayout = () => {
          mainElement.classList.remove('exporting');
          mainElement.style.paddingTop = '';
          mainElement.style.paddingBottom = '';
          mainElement.style.backgroundColor = '';
          if (wExport.restorePactGraphTransform) wExport.restorePactGraphTransform();
        };

        try {
          // snapdom captures through SVG, so the browser renders the CSS and
          // filters, object-fit and modern colour functions come out as seen.
          // Only #main is captured, which keeps the navbar out of the image.
          const canvas = await snapdom.toCanvas(mainElement, {
            backgroundColor: exportBackgroundColor,
          });
          restoreLayout();

          // Try Web Share API for mobile only (lets users save to Photos)
          if (isTouchDevice() && navigator.share && navigator.canShare) {
            try {
              const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((b) => {
                  if (b) {
                    resolve(b);
                  } else {
                    reject(new Error('Failed to generate image blob'));
                  }
                }, 'image/png');
              });
              const file = new File([blob], config.exportFilename, { type: 'image/png' });
              if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file] });
                return;
              }
            } catch (shareError) {
              // User cancelled or share failed - fall through to download
              if (shareError instanceof Error && shareError.name === 'AbortError') return;
            }
          }

          // Fallback: standard download
          const link = document.createElement('a');
          link.download = config.exportFilename;
          link.href = canvas.toDataURL();
          link.click();
        } catch (error) {
          restoreLayout();
          console.error('Export failed:', error);
          alert('Failed to export image. Please try again.');
        }
      });
    });
  }

  // Add to Showcase button handler
  const addToShowcaseBtn = document.getElementById('addToShowcaseBtn');
  if (addToShowcaseBtn) {
    addToShowcaseBtn.addEventListener('click', function() {
      // Get current URL with all params
      const currentUrl = window.location.href;

      // Load existing URLs
      const stored = localStorage.getItem('showcaseUrls');
      const urls: string[] = stored ? JSON.parse(stored) : [];

      // Add current URL (avoid duplicates)
      if (!urls.includes(currentUrl)) {
        urls.push(currentUrl);
        localStorage.setItem('showcaseUrls', JSON.stringify(urls));
      }

      // Visual feedback
      const originalText = addToShowcaseBtn.textContent;
      addToShowcaseBtn.textContent = 'Added!';
      setTimeout(() => { addToShowcaseBtn.textContent = originalText; }, 1500);
    });
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPicker);
} else {
  initPicker();
}

export {};
