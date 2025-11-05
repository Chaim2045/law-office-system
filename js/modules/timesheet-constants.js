/**
 * Timesheet Module Constants
 * Centralized styling and configuration constants for timesheet components
 *
 * @module TimesheetConstants
 */

/* ========================================
   BADGE STYLES
   ======================================== */

export const BADGE_STYLES = {
  caseNumber: {
    small: {
      padding: '3px 8px',
      fontSize: '10px',
      borderRadius: '12px',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      icon: '📋',
      marginRight: '4px'  // רווח בין badges
    },
    normal: {
      padding: '4px 10px',
      fontSize: '11px',
      borderRadius: '16px',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      icon: '📋',
      marginBottom: '6px'
    },
    large: {
      padding: '6px 14px',
      fontSize: '12px',
      borderRadius: '20px',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      icon: '📋'
    }
  },

  service: {
    small: {
      padding: '2px 8px',
      fontSize: '10px',
      borderRadius: '12px',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      icon: '💼'
    },
    normal: {
      padding: '6px 12px',
      fontSize: '12px',
      borderRadius: '8px',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      icon: '💼'
    },
    large: {
      padding: '8px 16px',
      fontSize: '14px',
      borderRadius: '12px',
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      icon: '💼'
    }
  },

  status: {
    פעיל: {
      padding: '5px 10px',
      fontSize: '10px',
      fontWeight: '500',
      borderRadius: '16px',
      background: '#f0f9ff', // רקע כחול בהיר מאוד - מינימליסטי
      color: '#0369a1', // כחול כהה
      border: '0.5px solid #bae6fd' // גבול דק וקל
    },
    הושלם: {
      padding: '5px 10px',
      fontSize: '10px',
      fontWeight: '500',
      borderRadius: '16px',
      background: '#ecfdf5', // רקע ירוק בהיר מאוד - מינימליסטי
      color: '#047857', // ירוק כהה
      border: '0.5px solid #a7f3d0', // גבול דק וקל
      icon: '✓'
    }
  }
};

/* ========================================
   COMMON STYLES
   ======================================== */

export const COMMON_STYLES = {
  fontWeight: '600',
  color: 'white',
  display: 'inline-block',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

/* ========================================
   HELPER FUNCTIONS
   ======================================== */

/**
 * Create case number badge HTML
 * @param {string} caseNumber - Case number to display
 * @param {string} size - Badge size ('small', 'normal', 'large')
 * @param {Object} customStyles - Additional inline styles
 * @returns {string} HTML string for badge
 */
export function createCaseNumberBadge(caseNumber, size = 'normal', customStyles = {}) {
  if (!caseNumber || typeof caseNumber !== 'string') {
    return '';
  }

  const style = BADGE_STYLES.caseNumber[size] || BADGE_STYLES.caseNumber.normal;

  const allStyles = {
    ...COMMON_STYLES,
    padding: style.padding,
    fontSize: style.fontSize,
    borderRadius: style.borderRadius,
    background: style.gradient,
    ...customStyles
  };

  const styleString = Object.entries(allStyles)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');

  return `
    <div style="${styleString}">
      ${style.icon} תיק ${escapeHtml(caseNumber)}
    </div>
  `;
}

/**
 * Create service name badge HTML
 * @param {string} serviceName - Service name to display
 * @param {string} size - Badge size ('small', 'normal', 'large')
 * @param {Object} customStyles - Additional inline styles
 * @returns {string} HTML string for badge
 */
export function createServiceBadge(serviceName, size = 'normal', customStyles = {}) {
  if (!serviceName || typeof serviceName !== 'string') {
    return '';
  }

  const style = BADGE_STYLES.service[size] || BADGE_STYLES.service.normal;

  const allStyles = {
    ...COMMON_STYLES,
    padding: style.padding,
    fontSize: style.fontSize,
    borderRadius: style.borderRadius,
    background: style.gradient,
    ...customStyles
  };

  const styleString = Object.entries(allStyles)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');

  return `
    <div style="${styleString}">
      ${style.icon} ${escapeHtml(serviceName)}
    </div>
  `;
}

/**
 * Create status badge HTML
 * @param {string} status - Status text ('פעיל' or 'הושלם')
 * @param {Object} customStyles - Additional inline styles
 * @returns {string} HTML string for badge
 */
export function createStatusBadge(status, customStyles = {}) {
  if (!status || typeof status !== 'string') {
    return status || '';
  }

  // Get style for specific status
  const style = BADGE_STYLES.status[status];

  if (!style) {
    // Fallback for unknown status - return plain text
    return `<span style="color: #6b7280;">${escapeHtml(status)}</span>`;
  }

  const allStyles = {
    fontWeight: style.fontWeight || '500',
    color: style.color || '#6b7280',
    display: 'inline-block',
    padding: style.padding,
    fontSize: style.fontSize,
    borderRadius: style.borderRadius,
    background: style.background || style.gradient, // תמיכה גם בbackground וגם בgradient לתאימות
    border: style.border || 'none',
    boxShadow: 'none', // מינימליסטי - ללא צל
    ...customStyles
  };

  const styleString = Object.entries(allStyles)
    .map(([key, value]) => {
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${cssKey}: ${value}`;
    })
    .join('; ');

  const icon = style.icon ? `${style.icon} ` : '';

  return `
    <span style="${styleString}">
      ${icon}${escapeHtml(status)}
    </span>
  `;
}

/**
 * Create service info header (case + service together)
 * @param {string} caseNumber - Case number
 * @param {string} serviceName - Service name
 * @returns {string} HTML string for combined header
 */
export function createServiceInfoHeader(caseNumber, serviceName) {
  if (!caseNumber && !serviceName) {
    return '';
  }

  return `
    <div style="
      margin-bottom: 20px;
      padding: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 12px;
      color: white;
    ">
      ${caseNumber ? `
      <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">
        📋 תיק ${escapeHtml(caseNumber)}
      </div>
      ` : ''}
      ${serviceName ? `
      <div style="font-size: 14px; font-weight: 700;">
        💼 ${escapeHtml(serviceName)}
      </div>
      ` : ''}
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/* ========================================
   COMBINED INFO BADGE
   ======================================== */

/**
 * Create combined info badge with case and service info
 * @param {string} caseNumber - Case number to display
 * @param {string} serviceName - Service name to display
 * @param {string} serviceType - Service type ('legal_procedure' or other)
 * @returns {string} HTML string for combined badge
 */
export function createCombinedInfoBadge(caseNumber, serviceName, serviceType) {
  if (!caseNumber && !serviceName) {
    return '';
  }

  // Generate unique ID for this badge
  const badgeId = `badge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Determine service icon based on type
  const serviceIcon = (serviceType === 'legal_procedure')
    ? '<i class="fas fa-balance-scale"></i>'
    : '<i class="fas fa-briefcase"></i>';

  const caseIcon = '<i class="fas fa-folder"></i>';

  return `
    <div class="combined-info-badge" onclick="event.stopPropagation(); window.TimesheetConstants.showCombinedInfoPopup('${escapeHtml(caseNumber)}', '${escapeHtml(serviceName)}', '${serviceType}')">
      ${caseNumber ? caseIcon : ''}
      ${serviceName ? serviceIcon : ''}
    </div>
  `;
}

/**
 * Show popup with combined case and service info
 * @param {string} caseNumber - Case number
 * @param {string} serviceName - Service name
 * @param {string} serviceType - Service type
 */
export function showCombinedInfoPopup(caseNumber, serviceName, serviceType) {
  // Remove existing popup if any
  const existingPopup = document.querySelector('.info-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // Determine service icon and label
  const serviceIcon = (serviceType === 'legal_procedure')
    ? '<i class="fas fa-balance-scale"></i>'
    : '<i class="fas fa-briefcase"></i>';

  const serviceLabel = (serviceType === 'legal_procedure')
    ? 'הליך משפטי'
    : 'שירות';

  // Create popup HTML
  const popupHtml = `
    <div class="info-popup combined-popup">
      <div class="info-popup-content">
        <div class="info-popup-header">
          <i class="fas fa-info-circle"></i>
          <span>פרטי משימה</span>
        </div>
        <div class="info-popup-body">
          ${caseNumber ? `
          <div class="info-row">
            <i class="fas fa-folder"></i>
            <span class="info-label">תיק:</span>
            <strong>${escapeHtml(caseNumber)}</strong>
          </div>
          ` : ''}
          ${serviceName ? `
          <div class="info-row">
            ${serviceIcon}
            <span class="info-label">${serviceLabel}:</span>
            <strong>${escapeHtml(serviceName)}</strong>
          </div>
          ` : ''}
        </div>
        <div class="info-popup-footer">
          <button onclick="window.TimesheetConstants.closeInfoPopup()">
            <i class="fas fa-times"></i>
            סגור
          </button>
        </div>
      </div>
    </div>
  `;

  // Add popup to body
  document.body.insertAdjacentHTML('beforeend', popupHtml);

  // Activate popup with animation
  setTimeout(() => {
    const popup = document.querySelector('.info-popup');
    if (popup) {
      popup.classList.add('active');
    }
  }, 10);

  // Close on background click
  const popup = document.querySelector('.info-popup');
  if (popup) {
    popup.addEventListener('click', (e) => {
      if (e.target === popup) {
        closeInfoPopup();
      }
    });
  }
}

/**
 * Close info popup
 */
export function closeInfoPopup() {
  const popup = document.querySelector('.info-popup');
  if (popup) {
    popup.classList.remove('active');
    setTimeout(() => popup.remove(), 300);
  }
}

// Expose functions globally for onclick handlers
if (typeof window !== 'undefined') {
  window.TimesheetConstants = {
    showCombinedInfoPopup,
    closeInfoPopup
  };
}
