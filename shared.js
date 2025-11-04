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

// Function to adjust tooltip positions based on screen position
function setupTooltips() {
  // Add mouse enter event listener to all relics and masteries
  const elements = document.querySelectorAll('.relic, .mastery');
  elements.forEach(element => {
    element.addEventListener('mouseenter', function() {
      const tooltip = this.querySelector('.tooltip');
      if (!tooltip) return;
      
      // Reset classes first
      tooltip.classList.remove('flip-up', 'flip-left', 'flip-right');
      
      // Get positions
      const elementRect = this.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      // Check if tooltip goes off the top
      if (elementRect.top < tooltipRect.height + 20) {
        tooltip.classList.add('flip-up');
      }
      
      // Check horizontal alignment
      if (elementRect.left < tooltipRect.width / 2) {
        tooltip.classList.add('flip-left');
      } else if (windowWidth - elementRect.right < tooltipRect.width / 2) {
        tooltip.classList.add('flip-right');
      }
    });
  });
  
  // Also handle on window resize
  window.addEventListener('resize', function() {
    const visibleTooltip = document.querySelector('.tooltip:hover');
    if (visibleTooltip) {
      const parentElement = visibleTooltip.closest('.relic, .mastery');
      if (parentElement) {
        // Trigger the mouseenter event again to recalculate position
        parentElement.dispatchEvent(new MouseEvent('mouseenter'));
      }
    }
  });
}