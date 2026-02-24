/**
 * Description Tooltips & Popovers Module
 * Law Office Management System
 *
 * @module DescriptionTooltips
 * @description מערכת Tooltip + Popover לתיאורים ארוכים - Linear Minimal Style
 * @version 1.0.0
 * @created 2025-01-15
 */

/* ========================================
   CONSTANTS
   ======================================== */

const TOOLTIP_CONFIG = {
  maxLength: 50, // Maximum characters before truncation
  showDelay: 200, // Delay before showing tooltip (ms)
  hideDelay: 100, // Delay before hiding tooltip (ms)
  isMobile: !window.matchMedia('(hover: hover)').matches
};

/* ========================================
   TRUNCATION DETECTION
   ======================================== */

/**
 * Check if text element is truncated
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if truncated
 */
function isTextTruncated(element) {
  if (!element) {
return false;
}

  // Check scrollWidth vs offsetWidth (for single line)
  if (element.scrollWidth > element.offsetWidth) {
    return true;
  }

  // Check scrollHeight vs offsetHeight (for multi-line with line-clamp)
  if (element.scrollHeight > element.offsetHeight) {
    return true;
  }

  return false;
}

/**
 * Add truncation indicator to element
 * @param {HTMLElement} element - Text element
 * @param {string} fullText - Full text content
 */
function addTruncationIndicator(element, fullText) {
  if (!element || !fullText) {
return;
}

  // Check if already has indicator
  if (element.classList.contains('has-description-tooltip')) {
    return;
  }

  // Check if truncated
  if (!isTextTruncated(element)) {
    return;
  }

  // Add truncation class
  element.classList.add('is-truncated');

  // Add info icon
  const infoIcon = document.createElement('i');
  infoIcon.className = 'fas fa-info-circle description-info-icon';
  infoIcon.setAttribute('title', 'לחץ לצפייה במלל המלא');
  infoIcon.setAttribute('data-full-text', fullText);

  // Add click handler for mobile
  if (TOOLTIP_CONFIG.isMobile) {
    infoIcon.classList.add('mobile-only');
    infoIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      showDescriptionPopover(fullText, element);
    });
  }

  // ✅ Insert icon BEFORE the badge (not after)
  const wrapper = element.parentElement;
  const badge = wrapper.querySelector('.combined-info-badge');
  if (badge) {
    wrapper.insertBefore(infoIcon, badge);
  } else {
    wrapper.appendChild(infoIcon);
  }

  element.classList.add('has-description-tooltip');
}

/* ========================================
   TOOLTIP CREATION (Desktop)
   ======================================== */

/**
 * Create tooltip element
 * @param {string} text - Full description text
 * @returns {HTMLElement} Tooltip element
 */
function createTooltipElement(text) {
  const tooltip = document.createElement('div');
  tooltip.className = 'description-tooltip';

  const content = document.createElement('div');
  content.className = 'description-tooltip-content';
  content.textContent = text;

  tooltip.appendChild(content);

  return tooltip;
}

/**
 * Add tooltip to table cell
 * @param {HTMLElement} cell - Table cell element
 * @param {string} fullText - Full description text
 */
function addTooltipToCell(cell, fullText) {
  if (!cell || !fullText) {
return;
}

  // Check if already has tooltip
  if (cell.querySelector('.description-tooltip')) {
    return;
  }

  // Create and append tooltip
  const tooltip = createTooltipElement(fullText);
  cell.appendChild(tooltip);
}

/* ========================================
   POPOVER (Mobile/Tablet)
   ======================================== */

let activePopover = null;

/**
 * Show description popover
 * @param {string} text - Full description text
 * @param {HTMLElement} trigger - Trigger element (optional)
 */
function showDescriptionPopover(text, trigger = null) {
  // Close existing popover
  if (activePopover) {
    closeDescriptionPopover();
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'description-popover-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeDescriptionPopover();
    }
  });

  // Create popover
  const popover = document.createElement('div');
  popover.className = 'description-popover';

  // Header
  const header = document.createElement('div');
  header.className = 'description-popover-header';

  const title = document.createElement('div');
  title.className = 'description-popover-title';
  title.innerHTML = '<i class="fas fa-align-right"></i> תיאור מלא';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'description-popover-close';
  closeBtn.innerHTML = '<i class="fas fa-times"></i>';
  closeBtn.setAttribute('aria-label', 'סגור');
  closeBtn.addEventListener('click', closeDescriptionPopover);

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'description-popover-body';
  body.textContent = text;

  // Assemble
  popover.appendChild(header);
  popover.appendChild(body);
  overlay.appendChild(popover);

  // Add to DOM
  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  // Store reference
  activePopover = overlay;

  // Keyboard support
  document.addEventListener('keydown', handlePopoverKeydown);
}

/**
 * Close active popover
 */
function closeDescriptionPopover() {
  if (!activePopover) {
return;
}

  activePopover.classList.remove('active');

  setTimeout(() => {
    if (activePopover && activePopover.parentElement) {
      activePopover.remove();
    }
    activePopover = null;
  }, 200); // Match transition duration

  document.removeEventListener('keydown', handlePopoverKeydown);
}

/**
 * Handle keyboard events for popover
 * @param {KeyboardEvent} e - Keyboard event
 */
function handlePopoverKeydown(e) {
  if (e.key === 'Escape') {
    closeDescriptionPopover();
  }
}

/* ========================================
   TABLE CELL PROCESSING
   ======================================== */

/**
 * Process table description cells
 * @param {HTMLElement} container - Container element (table or parent)
 */
function processTableDescriptions(container = document) {
  // Find all description cells
  const descriptionCells = container.querySelectorAll(
    '.td-description, .timesheet-cell-action, .task-description-cell'
  );

  console.log('🔵 Description Tooltips: Found', descriptionCells.length, 'description cells');

  descriptionCells.forEach(cell => {
    // Find description wrapper
    const wrapper = cell.querySelector('.table-description-with-icons');
    if (!wrapper) {
return;
}

    // Find description span
    const descSpan = wrapper.querySelector('span');
    if (!descSpan) {
return;
}

    // Get full text
    const fullText = descSpan.textContent.trim();
    if (!fullText) {
return;
}

    // Check if truncated
    const isTruncated = isTextTruncated(descSpan);
    console.log('🔍 Checking truncation:', {
      text: fullText.substring(0, 30) + '...',
      isTruncated,
      scrollHeight: descSpan.scrollHeight,
      offsetHeight: descSpan.offsetHeight,
      scrollWidth: descSpan.scrollWidth,
      offsetWidth: descSpan.offsetWidth
    });

    if (!isTruncated) {
      return;
    }

    console.log('✅ Adding info icon for:', fullText.substring(0, 30) + '...');

    // Add truncation indicator
    addTruncationIndicator(descSpan, fullText);

    // Add tooltip for desktop
    if (!TOOLTIP_CONFIG.isMobile) {
      addTooltipToCell(cell, fullText);
    }

    // Add click handler for mobile
    if (TOOLTIP_CONFIG.isMobile) {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', (e) => {
        // Don't interfere with badges or action buttons
        if (e.target.closest('.combined-info-badge, .action-btn, button')) {
          return;
        }
        e.stopPropagation();
        showDescriptionPopover(fullText, cell);
      });
    }
  });
}

/* ========================================
   CARD TITLE WITH INFO ICON
   ======================================== */

/**
 * Add info icon to card title
 * @param {HTMLElement} titleElement - Card title element
 */
function addCardTitleInfoIcon(titleElement) {
  if (!titleElement) {
return;
}

  const fullText = titleElement.textContent.trim();
  if (!fullText) {
return;
}

  // Check if already has icon
  if (titleElement.querySelector('.card-description-info-icon')) {
    return;
  }

  // Check if truncated
  if (!isTextTruncated(titleElement)) {
    return;
  }

  // Wrap existing text
  const textSpan = document.createElement('span');
  textSpan.className = 'linear-card-title-text';
  textSpan.textContent = fullText;
  titleElement.textContent = '';
  titleElement.appendChild(textSpan);

  // Create info icon
  const infoIcon = document.createElement('i');
  infoIcon.className = 'fas fa-info-circle card-description-info-icon';
  infoIcon.setAttribute('title', 'לחץ לצפייה בתיאור המלא');

  // Add click handler
  infoIcon.addEventListener('click', (e) => {
    e.stopPropagation();
    showDescriptionPopover(fullText, titleElement);
  });

  titleElement.appendChild(infoIcon);

  // Add tooltip for desktop
  if (!TOOLTIP_CONFIG.isMobile) {
    const tooltip = document.createElement('div');
    tooltip.className = 'card-description-tooltip';

    const content = document.createElement('div');
    content.className = 'card-description-tooltip-content';
    content.textContent = fullText;

    tooltip.appendChild(content);
    titleElement.appendChild(tooltip);
  }
}

/**
 * Process card titles
 * @param {HTMLElement} container - Container element
 */
function processCardTitles(container = document) {
  const cardTitles = container.querySelectorAll('.linear-card-title');

  cardTitles.forEach(title => {
    addCardTitleInfoIcon(title);
  });
}

/* ========================================
   INITIALIZATION
   ======================================== */

/**
 * Initialize description tooltips system
 * @param {HTMLElement} container - Optional container to process
 */
function initDescriptionTooltips(container = document) {
  // Process tables
  processTableDescriptions(container);

  // Process cards
  processCardTitles(container);
}

/**
 * Refresh tooltips after content update
 * @param {HTMLElement} container - Container that was updated
 */
function refreshTooltips(container = document) {
  // Remove old tooltips and icons
  container.querySelectorAll('.description-tooltip').forEach(el => el.remove());
  container.querySelectorAll('.description-info-icon').forEach(el => el.remove());
  container.querySelectorAll('.card-description-tooltip').forEach(el => el.remove());
  container.querySelectorAll('.card-description-info-icon').forEach(el => el.remove());
  container.querySelectorAll('.has-description-tooltip').forEach(el => {
    el.classList.remove('has-description-tooltip', 'is-truncated');
  });

  // Reset card titles
  container.querySelectorAll('.linear-card-title').forEach(el => {
    const textSpan = el.querySelector('.linear-card-title-text');
    if (textSpan) {
      el.textContent = textSpan.textContent;
    }
  });

  // ✅ Wait for browser to render elements before checking truncation
  requestAnimationFrame(() => {
    setTimeout(() => {
      console.log('⏰ Running truncation check after render...');
      initDescriptionTooltips(container);
    }, 50);
  });
}

/* ========================================
   AUTO-INITIALIZATION
   ======================================== */

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initDescriptionTooltips();
  });
} else {
  initDescriptionTooltips();
}

// Re-initialize on window resize (for responsive changes)
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    refreshTooltips();
  }, 300);
});

/* ========================================
   EXPORTS
   ======================================== */

export default {
  init: initDescriptionTooltips,
  refresh: refreshTooltips,
  showPopover: showDescriptionPopover,
  closePopover: closeDescriptionPopover,
  processTable: processTableDescriptions,
  processCards: processCardTitles
};

// Expose globally for inline event handlers
window.DescriptionTooltips = {
  init: initDescriptionTooltips,
  refresh: refreshTooltips,
  showPopover: showDescriptionPopover,
  closePopover: closeDescriptionPopover
};
