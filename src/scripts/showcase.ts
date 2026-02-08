// Showcase page client-side logic

interface LeagueItem {
  id: string;
  src: string;
  relicLabel?: string;
  title?: string;
  toolTipItems: string[];
}

interface LeagueData {
  game: string;
  leagueNumber: number;
  name: string;
  pageType: 'relics' | 'masteries' | 'pacts';
  theme: {
    titleColor: string;
    navItemColor: string;
    headerBackgroundColor: string;
    backgroundColor: string;
  };
  items: Record<string, LeagueItem[]>;
}

interface ParsedURL {
  leagueKey: string;
  selectedIds: string[];
  title: string;
}

interface BuildData {
  title: string;
  items: LeagueItem[];
  theme: LeagueData['theme'];
  error?: string;
}

// Get pre-bundled league data from window
function getLeagueData(): Record<string, LeagueData> {
  const w = window as Window & { LEAGUE_DATA?: Record<string, LeagueData> };
  return w.LEAGUE_DATA || {};
}

/**
 * Parse a share URL to extract league key, selected item IDs, and title
 * URL patterns:
 * - /osrs/5/           → osrs-5 (relics)
 * - /osrs/5/masteries/ → osrs-5-masteries
 * - /osrs/6/pacts/     → osrs-6-pacts
 * - /rs3/1/            → rs3-1 (relics)
 */
function parseShareURL(urlString: string): ParsedURL | null {
  try {
    const url = new URL(urlString);
    const pathname = url.pathname;

    // Match: /(osrs|rs3)/(\d+)(?:/(masteries|pacts))?/?
    const match = pathname.match(/^\/(osrs|rs3)\/(\d+)(?:\/(masteries|pacts))?\/?$/);
    if (!match) return null;

    const [, game, number, pageType] = match;

    // Construct league key
    const leagueKey = pageType
      ? `${game}-${number}-${pageType}`
      : `${game}-${number}`;

    // Extract selected items from query params
    const selected = url.searchParams.get('selected');
    const selectedIds = selected
      ? selected.split(',').map(id => id.trim()).filter(id => id)
      : [];

    // Extract title from query params
    const rawTitle = url.searchParams.get('title');
    const title = rawTitle || 'Untitled Build';

    return { leagueKey, selectedIds, title };
  } catch {
    return null;
  }
}

/**
 * For masteries/pacts: get only the highest selected item per category
 * "Highest" = largest numeric ID among selected items in that group
 */
function getHighestPerGroup(selectedIds: string[], items: Record<string, LeagueItem[]>): LeagueItem[] {
  // Map: groupKey -> highest selected item ID
  const highestPerGroup: Record<string, { id: number; item: LeagueItem }> = {};

  for (const selectedId of selectedIds) {
    // Parse selectedId format: "groupKey-itemId" (e.g., "melee-3")
    const dashIndex = selectedId.lastIndexOf('-');
    if (dashIndex === -1) continue;

    const groupKey = selectedId.substring(0, dashIndex);
    const itemIdStr = selectedId.substring(dashIndex + 1);
    const itemIdNum = parseInt(itemIdStr, 10);

    if (isNaN(itemIdNum)) continue;

    // Find the item in the group
    const group = items[groupKey];
    if (!group) continue;

    const item = group.find(i => i.id === itemIdStr);
    if (!item) continue;

    // Track highest per group
    if (!highestPerGroup[groupKey] || itemIdNum > highestPerGroup[groupKey].id) {
      highestPerGroup[groupKey] = { id: itemIdNum, item };
    }
  }

  // Return items in group key order (alphabetical)
  return Object.keys(highestPerGroup)
    .sort()
    .map(key => highestPerGroup[key].item);
}

/**
 * For relics: get all selected items in tier order
 */
function getAllSelectedItems(selectedIds: string[], items: Record<string, LeagueItem[]>): LeagueItem[] {
  const result: LeagueItem[] = [];

  // Convert selectedIds to Set for O(1) lookups
  const selectedSet = new Set(selectedIds);

  // Sort groups by key (tier1, tier2, tier3, etc.)
  const sortedGroups = Object.keys(items).sort((a, b) => {
    // Extract numbers from group names for proper sorting
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });

  for (const groupKey of sortedGroups) {
    const group = items[groupKey];

    for (const item of group) {
      const elementId = `${groupKey}-${item.id}`;
      if (selectedSet.has(elementId)) {
        result.push(item);
      }
    }
  }

  return result;
}

/**
 * Render a single build row
 */
function renderBuildRow(build: BuildData): HTMLElement {
  const row = document.createElement('div');
  row.className = 'showcase-row';

  if (build.error) {
    row.classList.add('showcase-row-error');
    row.innerHTML = `<span class="showcase-row-title">${escapeHtml(build.title)}</span><span class="showcase-row-error-msg">${escapeHtml(build.error)}</span>`;
    return row;
  }

  // Apply theme colors to row
  row.style.borderLeftColor = build.theme.titleColor;
  row.style.backgroundColor = build.theme.backgroundColor;

  const titleSpan = document.createElement('span');
  titleSpan.className = 'showcase-row-title';
  titleSpan.style.color = build.theme.titleColor;
  titleSpan.textContent = build.title;
  row.appendChild(titleSpan);

  const separator = document.createElement('span');
  separator.className = 'showcase-row-separator';
  separator.style.color = build.theme.titleColor;
  separator.textContent = '|';
  row.appendChild(separator);

  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'showcase-row-items';

  for (const item of build.items) {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.relicLabel || item.title || 'Item';
    img.className = 'showcase-item-img';
    img.title = item.relicLabel || item.title || '';
    itemsContainer.appendChild(img);
  }

  row.appendChild(itemsContainer);

  return row;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Process all URLs and generate build data
 */
function processURLs(urls: string[]): BuildData[] {
  const leagueData = getLeagueData();
  const builds: BuildData[] = [];

  for (const urlString of urls) {
    const trimmedUrl = urlString.trim();
    if (!trimmedUrl) continue;

    const parsed = parseShareURL(trimmedUrl);

    if (!parsed) {
      builds.push({
        title: trimmedUrl.substring(0, 50) + (trimmedUrl.length > 50 ? '...' : ''),
        items: [],
        theme: { titleColor: '#ff6b6b', navItemColor: '', headerBackgroundColor: '', backgroundColor: '' },
        error: 'Invalid URL format'
      });
      continue;
    }

    const league = leagueData[parsed.leagueKey];

    if (!league) {
      builds.push({
        title: parsed.title,
        items: [],
        theme: { titleColor: '#ff6b6b', navItemColor: '', headerBackgroundColor: '', backgroundColor: '' },
        error: `Unknown league: ${parsed.leagueKey}`
      });
      continue;
    }

    // Get items based on page type
    const items = league.pageType === 'relics'
      ? getAllSelectedItems(parsed.selectedIds, league.items)
      : getHighestPerGroup(parsed.selectedIds, league.items);

    builds.push({
      title: parsed.title,
      items,
      theme: league.theme
    });
  }

  return builds;
}

/**
 * Generate the preview from textarea input
 */
function generatePreview(): void {
  const textarea = document.getElementById('urlInput') as HTMLTextAreaElement;
  const container = document.getElementById('showcaseContainer');
  const exportBtn = document.getElementById('exportBtn');

  if (!textarea || !container) return;

  const urls = textarea.value.split('\n').filter(url => url.trim());

  if (urls.length === 0) {
    container.innerHTML = '<p class="showcase-empty">No URLs entered. Paste share URLs above to generate a preview.</p>';
    if (exportBtn) exportBtn.style.display = 'none';
    return;
  }

  const builds = processURLs(urls);

  // Clear and render
  container.innerHTML = '';

  for (const build of builds) {
    container.appendChild(renderBuildRow(build));
  }

  // Show export button
  if (exportBtn) exportBtn.style.display = 'inline-block';
}

/**
 * Export the showcase as a PNG image
 */
function exportImage(): void {
  const container = document.getElementById('showcaseContainer');
  const exportBtn = document.getElementById('exportBtn') as HTMLButtonElement | null;
  
  if (!container) return;

  // Add exporting class for styling
  container.classList.add('exporting');
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.classList.add('exporting');
  }

  // Access html2canvas from window
  const w = window as Window & { html2canvas?: (element: HTMLElement, options?: object) => Promise<HTMLCanvasElement> };

  if (!w.html2canvas) {
    // Clean up state and inform the user that export is not available
    container.classList.remove('exporting');
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.classList.remove('exporting');
    }
    window.alert('Export is not available - html2canvas library failed to load.');
    return;
  }

  w.html2canvas(container, {
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#000000',
    scale: 2 // Higher quality
  }).then(async function(canvas: HTMLCanvasElement) {
    // Try Web Share API for mobile (lets users save to Photos)
    if (navigator.share && navigator.canShare) {
      try {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('Failed to create blob')), 'image/png');
        });
        const file = new File([blob], 'showcase.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
          container.classList.remove('exporting');
          if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.classList.remove('exporting');
          }
          return;
        }
      } catch (shareError) {
        // User cancelled share or share failed - fall through to download
        if (shareError instanceof Error && shareError.name === 'AbortError') {
          container.classList.remove('exporting');
          if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.classList.remove('exporting');
          }
          return;
        }
      }
    }

    // Fallback: standard download
    const link = document.createElement('a');
    link.download = 'showcase.png';
    link.href = canvas.toDataURL();
    link.click();

    // Remove exporting class and reset button state
    container.classList.remove('exporting');
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.classList.remove('exporting');
    }
  }).catch(function(error: unknown) {
    // Log the error for debugging
    console.error('Failed to export showcase image', error);

    // Remove exporting class and reset button state
    container.classList.remove('exporting');
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.classList.remove('exporting');
    }

    // Surface a visible error message to the user
    window.alert('Failed to export image. This may be caused by browser security restrictions (CORS) or image loading issues.');
  });
}

/**
 * Load stored URLs from localStorage and populate textarea
 */
function loadStoredUrls(): void {
  const textarea = document.getElementById('urlInput') as HTMLTextAreaElement;
  if (!textarea) return;

  const stored = localStorage.getItem('showcaseUrls');
  if (stored) {
    const urls: string[] = JSON.parse(stored);
    textarea.value = urls.join('\n');
  }
}

/**
 * Clear the showcase: textarea, preview, and localStorage
 */
function clearShowcase(): void {
  const textarea = document.getElementById('urlInput') as HTMLTextAreaElement;
  const container = document.getElementById('showcaseContainer');
  const exportBtn = document.getElementById('exportBtn');

  if (textarea) textarea.value = '';
  if (container) container.innerHTML = '';
  if (exportBtn) exportBtn.style.display = 'none';

  localStorage.removeItem('showcaseUrls');
}

/**
 * Initialize the showcase page
 */
function initShowcase(): void {
  const generateBtn = document.getElementById('generateBtn');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');

  // Load stored URLs on init
  loadStoredUrls();

  if (generateBtn) {
    generateBtn.addEventListener('click', generatePreview);
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', exportImage);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearShowcase);
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShowcase);
} else {
  initShowcase();
}

export {};
