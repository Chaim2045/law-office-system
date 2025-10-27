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

  // Export to global scope
  if (typeof window !== 'undefined') {
    window.SVGRings = {
      createSVGRing,
      createDualRings,
      createOverageIndicator,
      calculateDashOffset
    };
  }

})();
