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
    pending_approval: {
      padding: '5px 10px',
      fontSize: '10px',
      fontWeight: '500',
      borderRadius: '16px',
      background: '#f0f9ff', // רקע כחול בהיר (כמו "פעיל")
      color: '#0369a1', // כחול כהה
      border: '0.5px solid #bae6fd', // גבול כחול
      icon: '🔒',
      displayText: '' // רק אייקון, ללא טקסט
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
  const displayText = style.displayText || status; // שימוש ב-displayText אם קיים, אחרת status

  return `
    <span style="${styleString}">
      ${icon}${escapeHtml(displayText)}
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
  if (!text) {
return '';
}
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
 * @param {string} serviceId - Service ID (e.g., 'stage_a', 'stage_b', 'stage_c')
 * @returns {string} HTML string for combined badge
 */
export function createCombinedInfoBadge(caseNumber, serviceName, serviceType, serviceId = '') {
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
    <div class="combined-info-badge" onclick="event.stopPropagation(); window.TimesheetConstants.showCombinedInfoPopup('${escapeHtml(caseNumber)}', '${escapeHtml(serviceName)}', '${serviceType}', '${escapeHtml(serviceId)}')">
      ${caseNumber ? caseIcon : ''}
      ${serviceName ? serviceIcon : ''}
    </div>
  `;
}

/**
 * Show popup with combined case and service info - Linear Style
 * @param {string} caseNumber - Case number
 * @param {string} serviceName - Service name
 * @param {string} serviceType - Service type
 * @param {string} serviceId - Service ID (e.g., 'stage_a', 'stage_b', 'stage_c')
 */
export function showCombinedInfoPopup(caseNumber, serviceName, serviceType, serviceId = '') {
  // Map serviceId to Hebrew stage
  let stageInfo = '';
  if (serviceType === 'legal_procedure' && serviceId) {
    const stageMap = {
      'stage_a': 'א\'',
      'stage_b': 'ב\'',
      'stage_c': 'ג\''
    };
    stageInfo = stageMap[serviceId] || '';
  }

  // Debug logging
  console.log('🎯 showCombinedInfoPopup called with:', {
    caseNumber, serviceName, serviceType, serviceId,
    mappedStage: stageInfo
  });

  // Remove existing popup if any
  const existingPopup = document.querySelector('.info-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // Determine service icon and label (professional icons only)
  const serviceIcon = (serviceType === 'legal_procedure')
    ? '<i class="fas fa-balance-scale"></i>'
    : '<i class="fas fa-briefcase"></i>';

  const serviceLabel = (serviceType === 'legal_procedure')
    ? 'הליך משפטי'
    : 'שירות';

  // Create popup HTML with Linear-style minimal design
  const popupHtml = `
    <div class="info-popup combined-popup" style="
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(2px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.2s ease;
    ">
      <div class="info-popup-content" style="
        background: white;
        border-radius: 12px;
        width: 360px;
        max-width: 90vw;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        transform: scale(0.95);
        transition: transform 0.2s ease;
      ">
        <!-- Header - Linear Style -->
        <div class="info-popup-header" style="
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          padding: 20px 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: white;
        ">
          <i class="fas fa-info-circle" style="font-size: 18px; opacity: 0.9;"></i>
          <span style="font-size: 16px; font-weight: 600;">פרטי משימה</span>
        </div>

        <!-- Body - Minimal Info Rows -->
        <div class="info-popup-body" style="
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        ">
          ${caseNumber ? `
          <div class="info-row" style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            background: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
          ">
            <i class="fas fa-folder" style="
              color: #64748b;
              font-size: 16px;
              width: 20px;
              text-align: center;
            "></i>
            <span style="
              color: #64748b;
              font-size: 13px;
              font-weight: 500;
              min-width: 60px;
            ">תיק:</span>
            <strong style="
              color: #1e293b;
              font-size: 14px;
              font-weight: 600;
              flex: 1;
            ">${escapeHtml(caseNumber)}</strong>
          </div>
          ` : ''}
          ${serviceName ? `
          <div class="info-row" style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            background: #f0f9ff;
            border-radius: 8px;
            border: 1px solid #bae6fd;
          ">
            ${serviceIcon.replace('>', ' style="color: #3b82f6; font-size: 16px; width: 20px; text-align: center;">')}
            <span style="
              color: #0369a1;
              font-size: 13px;
              font-weight: 500;
              min-width: 60px;
            ">${serviceLabel}:</span>
            <strong style="
              color: #0c4a6e;
              font-size: 14px;
              font-weight: 600;
              flex: 1;
            ">${escapeHtml(serviceName)}</strong>
          </div>
          ` : ''}
          ${stageInfo && serviceType === 'legal_procedure' ? `
          <div class="info-row" style="
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 14px 16px;
            background: #faf5ff;
            border-radius: 8px;
            border: 1px solid #e9d5ff;
          ">
            <i class="fas fa-layer-group" style="
              color: #9333ea;
              font-size: 16px;
              width: 20px;
              text-align: center;
            "></i>
            <span style="
              color: #7e22ce;
              font-size: 13px;
              font-weight: 500;
              min-width: 60px;
            ">שלב:</span>
            <strong style="
              color: #6b21a8;
              font-size: 14px;
              font-weight: 600;
              flex: 1;
            ">שלב ${escapeHtml(stageInfo)}</strong>
          </div>
          ` : ''}
        </div>

        <!-- Footer - Single Close Button -->
        <div class="info-popup-footer" style="
          padding: 16px 24px 20px;
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid #f1f5f9;
        ">
          <button onclick="window.TimesheetConstants.closeInfoPopup()" style="
            background: white;
            border: 1px solid #e2e8f0;
            color: #64748b;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.15s ease;
          " onmouseover="this.style.background='#f8fafc'; this.style.borderColor='#cbd5e1'" onmouseout="this.style.background='white'; this.style.borderColor='#e2e8f0'">
            <i class="fas fa-times" style="font-size: 12px;"></i>
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
      popup.style.opacity = '1';
      const content = popup.querySelector('.info-popup-content');
      if (content) {
        content.style.transform = 'scale(1)';
      }
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
 * Close info popup with smooth animation
 */
export function closeInfoPopup() {
  const popup = document.querySelector('.info-popup');
  if (popup) {
    // Fade out animation
    popup.style.opacity = '0';
    const content = popup.querySelector('.info-popup-content');
    if (content) {
      content.style.transform = 'scale(0.95)';
    }

    // Remove after animation completes
    setTimeout(() => popup.remove(), 200);
  }
}

// Expose functions globally for onclick handlers
if (typeof window !== 'undefined') {
  window.TimesheetConstants = {
    showCombinedInfoPopup,
    closeInfoPopup
  };
}
