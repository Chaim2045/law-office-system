/**
 * SVG Progress Rings Module
 * משרד עורכי דין - מערכת ניהול מתקדמת
 *
 * Created: 27 October 2025
 * Version: 1.0.0
 *
 * Features:
 * - SVG circular progress rings
 * - Animated with stroke-dashoffset
 * - Gradient backgrounds
 * - Responsive & accessible
 */

(function() {
  'use strict';

  /**
   * חישוב stroke-dashoffset עבור progress ring
   * @param {number} progress - Progress percentage (0-100)
   * @param {number} radius - Ring radius
   * @returns {number} - Dashoffset value
   */
  function calculateDashOffset(progress, radius) {
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;
    return offset;
  }

  /**
   * יצירת SVG Ring יחיד
   * @param {Object} config - Configuration object
   * @param {number} config.progress - Progress percentage (0-100)
   * @param {string} config.color - Color theme ('green', 'blue', 'red', 'orange')
   * @param {string} config.icon - FontAwesome icon class
   * @param {string} config.label - Label text
   * @param {string} config.value - Value text (e.g., "12.5h / 20h")
   * @param {number} [config.size=100] - Ring size in pixels
   * @param {boolean} [config.overage=false] - Is this an overage ring?
   * @param {Object} [config.button] - Button configuration { text, onclick, show }
   * @returns {string} - SVG HTML string
   */
  function createSVGRing(config) {
    const {
      progress,
      color,
      icon,
      label,
      value,
      size = 100,
      overage = false,
      button = null
    } = config;

    const radius = 32;
    const strokeWidth = 6;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = calculateDashOffset(Math.min(progress, 100), radius);

    // Generate unique gradient ID
    const gradientId = `ring-gradient-${Math.random().toString(36).substr(2, 9)}`;

    // Color schemes - צבעים עשירים וכהים
    const colors = {
      green: {
        start: '#059669',
        end: '#047857',
        bg: '#d1fae5',
        text: '#065f46'
      },
      blue: {
        start: '#2563eb',
        end: '#1e40af',
        bg: '#dbeafe',
        text: '#1e3a8a'
      },
      red: {
        start: '#dc2626',
        end: '#b91c1c',
        bg: '#fee2e2',
        text: '#991b1b'
      },
      orange: {
        start: '#ea580c',
        end: '#c2410c',
        bg: '#fed7aa',
        text: '#9a3412'
      }
    };

    const colorScheme = colors[color] || colors.green;

    // Meta Clean: Only add status class for DANGER (overage)
    // Color alone is enough for warning/ok states
    const statusClass = (progress >= 100 || color === 'red') ? 'status-danger' : '';

    return `
      <div class="svg-ring-container ${overage ? 'overage-ring' : ''}">
        <div class="svg-ring-wrapper ${statusClass}">
          <svg width="${size}" height="${size}" viewBox="0 0 80 80" class="svg-ring">
            <!-- Background circle -->
            <circle
              cx="40"
              cy="40"
              r="${radius}"
              fill="none"
              stroke="${colorScheme.bg}"
              stroke-width="${strokeWidth}"
            />

            <!-- Progress circle -->
            <circle
              cx="40"
              cy="40"
              r="${radius}"
              fill="none"
              stroke="url(#${gradientId})"
              stroke-width="${strokeWidth}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${dashOffset}"
              stroke-linecap="round"
              transform="rotate(-90 40 40)"
              class="svg-ring-progress"
            />

            <!-- Gradient definition -->
            <defs>
              <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${colorScheme.start}" />
                <stop offset="100%" stop-color="${colorScheme.end}" />
              </linearGradient>
            </defs>

            <!-- Center icon -->
            <g transform="translate(40, 40)">
              <text
                text-anchor="middle"
                dominant-baseline="central"
                font-size="18"
                fill="${colorScheme.text}"
                class="svg-ring-icon">
                <tspan class="${icon}"></tspan>
              </text>
            </g>
          </svg>

          <!-- Percentage text (overlay) -->
          <div class="svg-ring-percentage" style="color: ${colorScheme.text};">
            ${Math.round(progress)}%
          </div>
        </div>

        <!-- Label and value -->
        <div class="svg-ring-info">
          <div class="svg-ring-label">${label}</div>
          <div class="svg-ring-value">${value}</div>
        </div>

        <!-- Action button (if provided) -->
        ${button && button.show ? `
          <button class="svg-ring-action-btn ${button.cssClass || ''}" onclick="${button.onclick}">
            <i class="${button.icon || 'fas fa-edit'}"></i> ${button.text}
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * יצירת layout של שני rings (Budget + Deadline)
   * @param {Object} budgetConfig - Budget ring configuration
   * @param {Object} deadlineConfig - Deadline ring configuration
   * @returns {string} - HTML string with both rings
   */
  function createDualRings(budgetConfig, deadlineConfig) {
    const budgetRing = createSVGRing(budgetConfig);
    const deadlineRing = createSVGRing(deadlineConfig);

    return `
      <div class="svg-rings-dual-layout">
        ${budgetRing}
        ${deadlineRing}
      </div>
    `;
  }

  /**
   * יצירת overage indicator (קטן יותר, מתחת ל-ring)
   * @param {Object} config - Overage configuration
   * @returns {string} - HTML string
   */
  function createOverageIndicator(config) {
    const {
      type, // 'budget' or 'deadline'
      amount, // e.g., "+5h" or "+3 ימים"
      buttonText, // e.g., "עדכן תקציב"
      buttonClick, // onclick handler
      showButton = true
    } = config;

    const icon = type === 'budget'
      ? '<i class="fas fa-exclamation-triangle"></i>'
      : '<i class="fas fa-calendar-times"></i>';

    return `
      <div class="svg-ring-overage">
        <div class="svg-ring-overage-badge">
          ${icon}
          <span class="svg-ring-overage-text">${amount}</span>
        </div>
        ${showButton ? `
          <button class="svg-ring-overage-btn" onclick="${buttonClick}">
            <i class="fas fa-edit"></i> ${buttonText}
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * יצירת Compact Ring לטבלה - קטן ומינימלי
   * @param {Object} config - Configuration object
   * @param {number} config.daysRemaining - Days until deadline (can be negative for overdue)
   * @param {number} config.progress - Progress percentage (0-100)
   * @param {string} [config.size=52] - Ring size in pixels
   * @returns {string} - Compact ring HTML
   */
  function createCompactDeadlineRing(config) {
    const {
      daysRemaining,
      progress,
      size = 52
    } = config;

    const radius = 20;
    const strokeWidth = 3;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = calculateDashOffset(Math.min(progress, 100), radius);

    // Determine color based on days remaining
    let color, colorScheme;
    const isOverdue = daysRemaining < 0;

    if (isOverdue) {
      color = 'red';
      colorScheme = {
        start: '#dc2626',
        end: '#b91c1c',
        bg: '#fee2e2',
        text: '#991b1b'
      };
    } else if (daysRemaining <= 1) {
      color = 'orange';
      colorScheme = {
        start: '#ea580c',
        end: '#c2410c',
        bg: '#fed7aa',
        text: '#9a3412'
      };
    } else if (daysRemaining <= 3) {
      color = 'orange';
      colorScheme = {
        start: '#f59e0b',
        end: '#d97706',
        bg: '#fef3c7',
        text: '#92400e'
      };
    } else {
      color = 'blue';
      colorScheme = {
        start: '#2563eb',
        end: '#1e40af',
        bg: '#dbeafe',
        text: '#1e3a8a'
      };
    }

    const gradientId = `compact-ring-${Math.random().toString(36).substr(2, 9)}`;
    const displayDays = Math.abs(daysRemaining);

    return `
      <div class="compact-deadline-ring">
        <svg width="${size}" height="${size}" viewBox="0 0 60 60" class="compact-svg-ring">
          <!-- Background circle -->
          <circle
            cx="30"
            cy="30"
            r="${radius}"
            fill="none"
            stroke="${colorScheme.bg}"
            stroke-width="${strokeWidth}"
          />

          <!-- Progress circle -->
          <circle
            cx="30"
            cy="30"
            r="${radius}"
            fill="none"
            stroke="url(#${gradientId})"
            stroke-width="${strokeWidth}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"
            stroke-linecap="round"
            transform="rotate(-90 30 30)"
            class="compact-ring-progress"
          />

          <!-- Gradient definition -->
          <defs>
            <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${colorScheme.start}" />
              <stop offset="100%" stop-color="${colorScheme.end}" />
            </linearGradient>
          </defs>

          <!-- Days number in center (only number) -->
          <text
            x="30"
            y="30"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="16"
            font-weight="700"
            fill="${colorScheme.text}"
            class="compact-ring-number">
            ${displayDays}
          </text>
        </svg>
        <!-- "ימים" label below ring -->
        <div class="compact-ring-label-below" style="color: ${colorScheme.text};">ימים</div>
        ${isOverdue ? `<div class="compact-ring-status">איחור!</div>` : ''}
      </div>
    `;
  }

  /**
   * יצירת Progress Bar לטבלה - עבור עמודת התקדמות הזמן
   * @param {Object} config - Configuration object
   * @param {number} config.progress - Progress percentage (0-100+)
   * @param {number} config.actualMinutes - Actual time worked
   * @param {number} config.estimatedMinutes - Estimated time
   * @returns {string} - Progress bar HTML
   */
  function createTableProgressBar(config) {
    const {
      progress,
      actualMinutes,
      estimatedMinutes
    } = config;

    // Convert to hours for display
    const actualHours = Math.round((actualMinutes / 60) * 10) / 10;
    const estimatedHours = Math.round((estimatedMinutes / 60) * 10) / 10;

    // Determine color class
    let colorClass;
    if (progress >= 100) {
      colorClass = 'progress-complete';
    } else if (progress >= 85) {
      colorClass = 'progress-high';
    } else if (progress >= 50) {
      colorClass = 'progress-medium';
    } else {
      colorClass = 'progress-low';
    }

    // Cap visual progress at 100%
    const visualProgress = Math.min(progress, 100);

    return `
      <div class="table-progress-container">
        <div class="table-progress-header">
          <span class="table-progress-label">${actualHours}ש / ${estimatedHours}ש</span>
          <span class="table-progress-percentage">${Math.round(progress)}%</span>
        </div>
        <div class="table-progress-bar">
          <div class="table-progress-fill ${colorClass}" style="width: ${visualProgress}%"></div>
        </div>
      </div>
    `;
  }

  // Export to global scope
  if (typeof window !== 'undefined') {
    window.SVGRings = {
      createSVGRing,
      createDualRings,
      createOverageIndicator,
      createCompactDeadlineRing,
      createTableProgressBar,
      calculateDashOffset
    };
  }

})();
