function updateURLParams(elements, titleSelector) {
  var params = Array.from(elements)
    .filter(element => element.classList.contains('selected'))
    .map(element => element.id);
  var title = document.querySelector(titleSelector).innerText;
  var url = new URL(window.location);
  url.searchParams.set('selected', params.join(','));
  url.searchParams.set('title', encodeURIComponent(title));
  window.history.replaceState({}, '', url);
}

function setInitialSelections(elements, titleSelector) {
  var urlParams = new URLSearchParams(window.location.search);
  var selected = urlParams.get('selected');
  var title = urlParams.get('title');
  if (selected) {
    selected.split(',').forEach(id => {
      var element = document.getElementById(id);
      if (element) {
        element.classList.add('selected');
        updateElementOpacity(element, true);
      }
    });
  }
  if (title) {
    document.querySelector(titleSelector).innerText = decodeURIComponent(title);
  }
  Array.from(elements).forEach(element => {
    if (!element.classList.contains('selected')) {
      updateElementOpacity(element, false);
    }
  });
  
  // Add event listeners for tooltips
  setupTooltips();
}

function toggleElement(element, elements, titleSelector) {
  const isSelected = element.classList.toggle('selected');
  updateElementOpacity(element, isSelected);
  updateURLParams(elements, titleSelector);
}

function updateElementOpacity(element, isSelected) {
  // Only apply opacity to image and label, not the tooltip
  const img = element.querySelector('.relicImg, .masteryImg');
  const label = element.querySelector('.relicLabel, .masteryLabel');
  
  if (img) img.style.opacity = isSelected ? '1' : '0.25';
  if (label) label.style.opacity = isSelected ? '1' : '0.25';
}

// Initialize tooltips (simplified - no positioning needed for hint tooltips)
function setupTooltips() {
  // Tooltips now just show a simple hint, no complex positioning needed
}

// Detail sidebar functionality
let currentSidebarElementId = null;

function createDetailSidebar() {
  // Create sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'detail-sidebar';
  sidebar.innerHTML = `
    <div class="detail-sidebar-header">
      <h2 class="detail-sidebar-title"></h2>
      <button class="detail-sidebar-close" aria-label="Close">&times;</button>
    </div>
    <div class="detail-sidebar-content">
      <div class="detail-sidebar-image"></div>
      <div class="detail-sidebar-description"></div>
    </div>
  `;
  document.body.appendChild(sidebar);

  // Close button handler
  sidebar.querySelector('.detail-sidebar-close').addEventListener('click', closeDetailSidebar);

  // Click outside to close (but not on relics/masteries)
  document.addEventListener('click', function(e) {
    if (!isDetailSidebarOpen()) return;

    // Check if click is inside sidebar
    if (sidebar.contains(e.target)) return;

    // Check if click is on a relic or mastery (handled separately)
    if (e.target.closest('.relic, .mastery')) return;

    closeDetailSidebar();
  });
}

function openDetailSidebar(data, elementId) {
  const sidebar = document.querySelector('.detail-sidebar');
  if (!sidebar) return;

  currentSidebarElementId = elementId;

  // Update content
  sidebar.querySelector('.detail-sidebar-title').textContent = data.label;

  const imageContainer = sidebar.querySelector('.detail-sidebar-image');
  imageContainer.innerHTML = `<img src="${data.imageSrc}" alt="${data.label}">`;

  const descriptionContainer = sidebar.querySelector('.detail-sidebar-description');
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

  // Open sidebar
  sidebar.classList.add('open');
}

function closeDetailSidebar() {
  const sidebar = document.querySelector('.detail-sidebar');
  if (sidebar) sidebar.classList.remove('open');
  currentSidebarElementId = null;
}

function isDetailSidebarOpen() {
  const sidebar = document.querySelector('.detail-sidebar');
  return sidebar && sidebar.classList.contains('open');
}