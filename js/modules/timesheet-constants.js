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
