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
   * Single SVG ring — Claude.ai / Emil 2-signals minimal.
   *
   * Visual language:
   * - 72x72 ring (was 100x100), 3px stroke (was 6px). A smaller ring lets
   *   the card breathe and reads as a refined status badge, not a centerpiece.
   * - Flat strokes, no gradient <defs>, no <linearGradient>. Every decoration
   *   that didn't carry information is gone.
   * - "2 signals only" palette: gray for every non-overrun state, red only
   *   when progress >= 100 (budget overrun) or when the caller passes color
   *   = 'red' (e.g. overdue deadline from the caller).
   * - No Font Awesome icon inside the ring — the percentage (or the caller's
   *   `centerText`) IS the content. Keeps the ring SVG-only (no font deps).
   *
   * @param {Object} config
   * @param {number} config.progress - 0..N; >=100 flips the ring to red
   * @param {string} [config.color]  - 'red' forces red (e.g. overdue); other
   *                                   values fall back to the gray ramp
   * @param {string} config.label    - external label under the ring
   * @param {string} config.value    - external secondary text under the label
   * @param {string} [config.centerText] - override text inside the ring;
   *                                       defaults to `${Math.round(progress)}%`
   * @param {number} [config.size=72]
   * @param {boolean} [config.overage=false]
   * @param {Object} [config.button] - { text, onclick, show, cssClass, icon }
   * @returns {string} HTML string
   */
  function createSVGRing(config) {
    const {
      progress,
      color,
      label,
      value,
      centerText,
      size = 56,
      overage = false,
      button = null
    } = config;

    // Ring geometry scaled for the compact 56px size: smaller radius,
    // thinner stroke (2.5px) reads cleanly without dominating.
    const radius = 22;
    const strokeWidth = 2.5;
    const viewBox = 56;
    const center = viewBox / 2;
    const circumference = 2 * Math.PI * radius;
    // Ring maxes visually at 100% even if progress overruns — the "how much
    // over" is carried by the red color + the textual label underneath.
    const dashOffset = calculateDashOffset(Math.min(progress, 100), radius);

    // 2-signals palette: red only if caller forced it, or if progress is
    // actually past 100% (real overrun). Otherwise gray.
    const isAlarm = progress >= 100 || color === 'red';
    const strokeColor = isAlarm ? '#dc2626' : 'var(--gray-500)';
    const bgColor = 'var(--gray-200)';
    const centerColor = isAlarm ? '#dc2626' : 'var(--gray-900)';

    const statusClass = isAlarm ? 'status-danger' : '';
    const displayText = centerText !== null && centerText !== undefined ? centerText : `${Math.round(progress)}%`;

    return `
      <div class="svg-ring-container ${overage ? 'overage-ring' : ''}">
        <div class="svg-ring-wrapper ${statusClass}">
          <svg width="${size}" height="${size}" viewBox="0 0 ${viewBox} ${viewBox}" class="svg-ring">
            <circle
              cx="${center}"
              cy="${center}"
              r="${radius}"
              fill="none"
              stroke="${bgColor}"
              stroke-width="${strokeWidth}"
            />
            <circle
              cx="${center}"
              cy="${center}"
              r="${radius}"
              fill="none"
              stroke="${strokeColor}"
              stroke-width="${strokeWidth}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${dashOffset}"
              stroke-linecap="round"
              transform="rotate(-90 ${center} ${center})"
              class="svg-ring-progress"
            />
          </svg>

          <div class="svg-ring-percentage" style="color: ${centerColor};">
            ${displayText}
          </div>
        </div>

        <div class="svg-ring-info">
          <div class="svg-ring-label">${label}</div>
          <div class="svg-ring-value">${value}</div>
        </div>

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
   * @param {Date} [config.deadline] - Deadline date object (for displaying full date)
   * @param {string} [config.size=52] - Ring size in pixels
   * @returns {string} - Compact ring HTML
   */
  function createCompactDeadlineRing(config) {
    const {
      daysRemaining,
      progress,
      deadline,
      size = 52,
      format = 'date'
    } = config;

    const radius = 20;
    const strokeWidth = 3;
    const circumference = 2 * Math.PI * radius;
    // Keep ring visually capped at 100% — overrun is surfaced by the days
    // counter ("איחור N ימים"), not by a ring that spins past full.
    const dashOffset = calculateDashOffset(Math.min(progress, 100), radius);

    /*
     * "2 Signals Only" palette — Emil: gray by default, red ONLY for overdue.
     * Prior version had 4 color schemes (red / dark-orange / amber / blue)
     * + gradients + colored backgrounds, which made every row shout. The
     * compact ring is a small chrome element in each row; it deserves calm.
     * Flat strokes (no gradient) keep the numeric in the center legible.
     */
    const isOverdue = daysRemaining < 0;
    const colorScheme = isOverdue
      ? {
          stroke: '#dc2626',
          bg: 'var(--gray-100)',
          text: '#dc2626'
        }
      : {
          stroke: 'var(--gray-500)',
          bg: 'var(--gray-100)',
          text: 'var(--gray-700)'
        };

    const displayDays = Math.abs(daysRemaining);

    // Compact date formats:
    //   shortDate: dd.mm.yy — fits inside the 52px ring center
    //   fullDate:  dd.mm.yyyy — used as sublabel or tooltip
    let shortDateStr = '';
    let fullDateStr = '';
    if (deadline) {
      const day = String(deadline.getDate()).padStart(2, '0');
      const month = String(deadline.getMonth() + 1).padStart(2, '0');
      const year = deadline.getFullYear();
      const yy = String(year).slice(-2);
      shortDateStr = `${day}.${month}.${yy}`;
      fullDateStr = `${day}.${month}.${year}`;
    }

    // Which token goes in the ring's center vs under the ring depends on
    // the user's format preference. We keep the ring itself identical so
    // the visual progress indicator stays consistent across formats.
    const showDate = format === 'date';
    const centerText = showDate ? shortDateStr : String(displayDays);
    const centerFontSize = showDate ? 11 : 16;
    const sublabelText = showDate
      ? `${displayDays} ימים`
      : fullDateStr;

    // Flat stroke (no gradient) — Emil: no unnecessary visual effects.
    // Text color on date + label inherits from the ring's colorScheme so
    // the whole cell reads as one calm unit (gray) or one alarm (red).
    return `
      <div class="compact-deadline-ring">
        <svg width="${size}" height="${size}" viewBox="0 0 60 60" class="compact-svg-ring">
          <circle
            cx="30"
            cy="30"
            r="${radius}"
            fill="none"
            stroke="${colorScheme.bg}"
            stroke-width="${strokeWidth}"
          />
          <circle
            cx="30"
            cy="30"
            r="${radius}"
            fill="none"
            stroke="${colorScheme.stroke}"
            stroke-width="${strokeWidth}"
            stroke-dasharray="${circumference}"
            stroke-dashoffset="${dashOffset}"
            stroke-linecap="round"
            transform="rotate(-90 30 30)"
            class="compact-ring-progress"
          />
          <text
            x="30"
            y="30"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="${centerFontSize}"
            font-weight="600"
            fill="${colorScheme.text}"
            class="compact-ring-number">
            ${centerText}
          </text>
        </svg>
        <div class="compact-ring-label-below" style="color: ${colorScheme.text};">${sublabelText}</div>
        ${isOverdue ? '<div class="compact-ring-status">איחור!</div>' : ''}
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

  /**
   * יצירת טבעת תאריך יעד עם ימים נותרים (במקום אחוזים)
   * @param {Object} config - Configuration object
   * @param {Date} config.deadline - Deadline date
   * @param {number} config.daysRemaining - Days until deadline (negative = overdue)
   * @param {number} [config.size=100] - Ring size in pixels
   * @param {Object} [config.button] - Button configuration { text, onclick, show }
   * @returns {string} - HTML string
   */
  /*
   * Deadline ring — Claude.ai / Emil 2-signals minimal.
   *
   * Aligned with createSVGRing: 56x56, 2.5px stroke, flat (no gradient
   * <defs>), gray by default, red only when overdue. Dropped the third
   * "orange / ≤3 days approaching" scheme — that was a warning signal
   * competing with the real signal (overdue), exactly what the "2
   * signals only" rule is meant to prevent.
   */
  function createDeadlineDisplay(config) {
    const {
      deadline,
      daysRemaining,
      size = 56,
      button = null
    } = config;

    const isOverdue = daysRemaining < 0;
    const displayDays = Math.abs(daysRemaining);

    const strokeColor = isOverdue ? '#dc2626' : 'var(--gray-500)';
    const bgColor = 'var(--gray-200)';
    const centerColor = isOverdue ? '#dc2626' : 'var(--gray-900)';

    const radius = 22;
    const strokeWidth = 2.5;
    const viewBox = 56;
    const center = viewBox / 2;
    const circumference = 2 * Math.PI * radius;

    const day = String(deadline.getDate()).padStart(2, '0');
    const month = String(deadline.getMonth() + 1).padStart(2, '0');
    const year = deadline.getFullYear();
    const fullDateStr = `${day}.${month}.${year}`;

    return `
      <div class="svg-ring-container ${isOverdue ? 'status-danger' : ''}">
        <div class="svg-ring-wrapper">
          <svg width="${size}" height="${size}" viewBox="0 0 ${viewBox} ${viewBox}" class="svg-ring">
            <circle
              cx="${center}"
              cy="${center}"
              r="${radius}"
              fill="none"
              stroke="${bgColor}"
              stroke-width="${strokeWidth}"
            />
            <circle
              cx="${center}"
              cy="${center}"
              r="${radius}"
              fill="none"
              stroke="${strokeColor}"
              stroke-width="${strokeWidth}"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="0"
              stroke-linecap="round"
              transform="rotate(-90 ${center} ${center})"
              class="svg-ring-progress"
            />
          </svg>
          <div class="svg-ring-percentage" style="color: ${centerColor};">
            ${displayDays}
          </div>
        </div>

        <div class="svg-ring-info">
          <div class="svg-ring-label">תאריך יעד</div>
          <div class="svg-ring-value">${fullDateStr}</div>
          ${isOverdue ? `<div class="svg-ring-overdue-badge">איחור ${displayDays} ימים</div>` : ''}
        </div>

        ${button && button.show ? `
          <button class="svg-ring-action-btn ${button.cssClass || ''}" onclick="${button.onclick}">
            <i class="${button.icon || 'fas fa-edit'}"></i> ${button.text}
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
      createCompactDeadlineRing,
      createTableProgressBar,
      createDeadlineDisplay,
      calculateDashOffset
    };
  }

})();
