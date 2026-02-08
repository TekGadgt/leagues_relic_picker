// Main picker initialization script

interface PickerConfig {
  backgroundColor: string;
  exportFilename: string;
}

interface DetailData {
  label: string;
  imageSrc: string;
  items: string[];
}

// Double-tap state for mobile
interface TapState {
  lastTapTime: number;
  lastTapTarget: HTMLElement | null;
}

const tapState: TapState = {
  lastTapTime: 0,
  lastTapTarget: null
};

const DOUBLE_TAP_THRESHOLD = 300;

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// URL State Management
function updateURLParams(elements: HTMLCollectionOf<Element>, titleSelector: string): void {
  const params = Array.from(elements)
    .filter(element => element.classList.contains('selected'))
    .map(element => element.id);
  const titleElement = document.querySelector(titleSelector);
  const title = titleElement?.textContent || '';
  const url = new URL(window.location.href);
  url.searchParams.set('selected', params.join(','));
  url.searchParams.set('title', title);
  window.history.replaceState({}, '', url.toString());
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
}

function toggleElement(element: HTMLElement, elements: HTMLCollectionOf<Element>, titleSelector: string): void {
  const isSelected = element.classList.toggle('selected');
  updateElementOpacity(element, isSelected);
  updateURLParams(elements, titleSelector);
}

function updateElementOpacity(element: HTMLElement, isSelected: boolean): void {
  const img = element.querySelector('.relicImg, .masteryImg') as HTMLElement | null;
  const label = element.querySelector('.relicLabel, .masteryLabel') as HTMLElement | null;

  if (img) img.style.opacity = isSelected ? '1' : '0.25';
  if (label) label.style.opacity = isSelected ? '1' : '0.25';
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
    imageContainer.innerHTML = `<img src="${data.imageSrc}" alt="${data.label}">`;
  }

  const descriptionContainer = sidebar.querySelector('.detail-sidebar-description');
  if (descriptionContainer) {
    if (data.items && data.items.length > 0) {
      const list = document.createElement('ul');
      data.items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
      });
      descriptionContainer.innerHTML = '';
      descriptionContainer.appendChild(list);
    } else {
      descriptionContainer.innerHTML = '<p>No additional details available.</p>';
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
  return w.PICKER_CONFIG || { backgroundColor: '#071022', exportFilename: 'export.png' };
}

// Initialize the picker
function initPicker(): void {
  const itemClass = document.querySelector('.relic') ? 'relic' : 'mastery';
  const elements = document.getElementsByClassName(itemClass);
  const titleSelector = '.title';

  // Set initial selections from URL
  setInitialSelections(elements, titleSelector);

  // Add click/touch handlers to all items
  const isTouch = isTouchDevice();

  Array.from(elements).forEach(element => {
    if (isTouch) {
      // Touch device: single tap = toggle, double tap = sidebar
      element.addEventListener('click', function(this: HTMLElement, e: Event) {
        const now = Date.now();
        const timeSinceLastTap = now - tapState.lastTapTime;
        const isSameTarget = tapState.lastTapTarget === this;

        if (isSameTarget && timeSinceLastTap < DOUBLE_TAP_THRESHOLD) {
          // Double tap detected - open sidebar
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
          // Single tap - toggle selection
          toggleElement(this, elements, titleSelector);
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

    closeDetailSidebar();
  });

  // Title input handler
  const titleElement = document.querySelector(titleSelector);
  if (titleElement) {
    titleElement.addEventListener('input', function() {
      updateURLParams(elements, titleSelector);
    });
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

      mainElement.style.backgroundColor = config.backgroundColor;
      mainElement.style.paddingTop = '50px';
      mainElement.style.paddingBottom = '50px';

      // Access html2canvas from window
      const w = window as Window & { html2canvas?: (element: HTMLElement, options?: object) => Promise<HTMLCanvasElement> };
      if (w.html2canvas) {
        w.html2canvas(mainElement, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: config.backgroundColor
        }).then(function(canvas: HTMLCanvasElement) {
          const link = document.createElement('a');
          link.download = config.exportFilename;
          link.href = canvas.toDataURL();
          link.click();
        });
      }
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
