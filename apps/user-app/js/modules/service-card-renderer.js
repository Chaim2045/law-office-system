/**
 * ════════════════════════════════════════════════════════════════════
 * Service Card Renderer - Shared Component
 * רכיב משותף לרינדור כרטיסי שירותים
 * ════════════════════════════════════════════════════════════════════
 *
 * @module service-card-renderer
 * @version 1.1.0
 * @updated 2025-01-19
 *
 * פונקציה גלובלית משותפת לרינדור כרטיסי שירותים
 * נמנעת code duplication בין מודולים שונים
 *
 * ════════════════════════════════════════════════════════════════════
 * CHANGELOG | יומן שינויים
 * ════════════════════════════════════════════════════════════════════
 *
 * v1.1.0 - 19/01/2025
 * -------------------
 * 🔄 רפקטורינג: שימוש ב-safeText גלובלי
 * ✅ REFACTORED: משתמש ב-window.safeText במקום יישום מקומי (lines 22-29)
 * 🎯 מטרה: Single Source of Truth להגנת XSS
 *
 * שינויים:
 * - מחק יישום מקומי של escapeHtml
 * - משתמש ב-window.safeText מ-core-utils.js
 * - שומר על fallback לבטיחות
 */

(function() {
  'use strict';

  /**
   * ✅ Use global safeText from core-utils.js (Single Source of Truth)
   * Aliased as escapeHtml for backward compatibility
   */
  const escapeHtml = window.safeText || function(text) {
    if (!text) {
return '';
}
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * ═══════════════════════════════════════════════════════════════════
   * CALCULATION FUNCTIONS (copied from src/modules/deduction/calculators.js)
   * ═══════════════════════════════════════════════════════════════════
   * These functions MUST be available before service cards render.
   * They are copied here to ensure they're loaded synchronously.
   */

  /**
   * Calculate remaining hours from packages
   */
  function calculateRemainingHours(entity) {
    if (!entity) {
return 0;
}

    // Support for legal_procedure with stages
    if (entity.type === 'legal_procedure' && entity.stages && Array.isArray(entity.stages)) {
      return entity.stages
        .filter(stage => stage.status === 'active' || stage.status === 'pending')
        .reduce((sum, stage) => {
          if (stage.packages && Array.isArray(stage.packages) && stage.packages.length > 0) {
            const stageHours = stage.packages
              .filter(pkg => pkg.status === 'active' || pkg.status === 'pending' || !pkg.status)
              .reduce((pkgSum, pkg) => pkgSum + (pkg.hoursRemaining || 0), 0);
            return sum + stageHours;
          }
          return sum + (stage.hoursRemaining || 0);
        }, 0);
    }

    // Regular service with packages
    if (entity.packages && Array.isArray(entity.packages) && entity.packages.length > 0) {
      const activePackages = entity.packages
        .filter(pkg => pkg.status === 'active' || !pkg.status);
      if (activePackages.length > 0) {
        return activePackages.reduce((sum, pkg) => sum + (pkg.hoursRemaining || 0), 0);
      }
      // fallback — אין packages פעילים, קרא מ-service level
      return entity.hoursRemaining || 0;
    }

    return entity.hoursRemaining || 0;
  }

  /**
   * Calculate total hours from packages
   */
  function calculateTotalHours(entity) {
    if (!entity) {
return 0;
}
    if (!entity.packages || entity.packages.length === 0) {
      return entity.totalHours || 0;
    }
    return entity.packages.reduce((sum, pkg) => sum + (pkg.hours || 0), 0);
  }

  /**
   * Calculate hours used from packages
   */
  function calculateHoursUsed(entity) {
    if (!entity) {
return 0;
}
    if (!entity.packages || entity.packages.length === 0) {
      return entity.hoursUsed || 0;
    }
    return entity.packages.reduce((sum, pkg) => sum + (pkg.hoursUsed || 0), 0);
  }

  // Export to window for backward compatibility
  if (!window.calculateRemainingHours) {
window.calculateRemainingHours = calculateRemainingHours;
}
  if (!window.calculateTotalHours) {
window.calculateTotalHours = calculateTotalHours;
}
  if (!window.calculateHoursUsed) {
window.calculateHoursUsed = calculateHoursUsed;
}

  /**
   * רינדור כרטיס שירות בודד
   * @param {Object} service - נתוני השירות/שלב
   * @param {string} type - סוג השירות ('hours' | 'legal_procedure')
   * @param {string} pricingType - סוג תמחור ('hourly' | 'fixed')
   * @param {Object} caseItem - נתוני התיק (אופציונלי)
   * @param {Object} options - אופציות נוספות
   * @returns {string} HTML של הכרטיס
   */
  window.renderServiceCard = function(service, type, pricingType = 'hourly', caseItem = null, options = {}) {
    const serviceId = service.id;
    const isReadOnly = options.readOnly === true; // אם true - לא ניתן ללחוץ
    const showCaseNumber = options.showCaseNumber === true; // default: false (UX improvement)
    const clickHandler = options.onClick || '';

    let iconClass, title, subtitle, statsHtml;

    if (type === 'hours') {
      // תוכנית שעות
      iconClass = 'fa-briefcase';
      title = 'תוכנית שעות';
      subtitle = service.name;

      // חישוב שעות
      const totalHours = window.calculateTotalHours ? window.calculateTotalHours(service) : (service.totalHours || 0);
      const hoursUsed = window.calculateHoursUsed ? window.calculateHoursUsed(service) : 0;
      const hoursRemaining = window.calculateRemainingHours ? window.calculateRemainingHours(service) : 0;
      const progressPercent = totalHours > 0 ? Math.round((hoursUsed / totalHours) * 100) : 0;

      statsHtml = `
        <div style="margin-top: 12px;">
          <!-- Progress Bar -->
          <div style="
            background: #f1f5f9;
            height: 5px;
            border-radius: 2.5px;
            overflow: hidden;
            margin-bottom: 10px;
          ">
            <div style="
              width: ${progressPercent}%;
              height: 100%;
              background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
              transition: width 0.3s ease;
            "></div>
          </div>

          <!-- Stats Row -->
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
          ">
            <div style="display: flex; align-items: center; gap: 5px; color: #3b82f6; font-weight: 600;">
              <i class="fas fa-clock" style="font-size: 11px;"></i>
              <span>${hoursUsed.toFixed(1)} מתוך ${totalHours.toFixed(1)} שעות</span>
            </div>
            <div style="color: ${hoursUsed > totalHours ? '#ef4444' : '#64748b'}; font-size: 11px; font-weight: ${hoursUsed > totalHours ? '600' : 'normal'};">
              ${progressPercent}% ${hoursUsed > totalHours ? '⚠️ חריגה' : 'בשימוש'}
            </div>
          </div>
        </div>
      `;
    } else if (type === 'legal_procedure') {
      // הליך משפטי
      iconClass = 'fa-balance-scale';
      const stageName = service.id === 'stage_a' ? "שלב א'" :
                       service.id === 'stage_b' ? "שלב ב'" :
                       service.id === 'stage_c' ? "שלב ג'" : service.name;

      // 🔥 FIX: הצג שם ההליך המשפטי (ללא השלב בכותרת - השלב יהיה ב-badge)
      const procedureName = options.procedureName || 'הליך משפטי';
      title = procedureName; // רק שם ההליך, ללא "- שלב א'"
      subtitle = service.description || service.name;

      if (pricingType === 'hourly') {
        // תמחור שעתי
        const totalHours = window.calculateTotalHours ? window.calculateTotalHours(service) : (service.totalHours || 0);
        const hoursUsed = window.calculateHoursUsed ? window.calculateHoursUsed(service) : 0;
        const hoursRemaining = window.calculateRemainingHours ? window.calculateRemainingHours(service) : 0;
        const progressPercent = totalHours > 0 ? Math.round((hoursUsed / totalHours) * 100) : 0;

        // 🔍 DEBUG: Log calculation results
        console.log(`🔍 renderServiceCard (${type}) for ${service.id}:`, {
          serviceId: service.id,
          totalHours,
          hoursUsed,
          hoursRemaining,
          progressPercent,
          packages: service.packages,
          hasCalculateFn: !!window.calculateHoursUsed
        });

        statsHtml = `
          <div style="margin-top: 12px;">
            <div style="
              background: #f1f5f9;
              height: 5px;
              border-radius: 2.5px;
              overflow: hidden;
              margin-bottom: 10px;
            ">
              <div style="
                width: ${progressPercent}%;
                height: 100%;
                background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%);
              "></div>
            </div>
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
            ">
              <div style="display: flex; align-items: center; gap: 5px; color: #3b82f6; font-weight: 600;">
                <i class="fas fa-clock" style="font-size: 11px;"></i>
                <span>${hoursUsed.toFixed(1)} מתוך ${totalHours.toFixed(1)} שעות</span>
              </div>
              <div style="color: ${hoursUsed > totalHours ? '#ef4444' : '#64748b'}; font-size: 11px; font-weight: ${hoursUsed > totalHours ? '600' : 'normal'};">
                ${progressPercent}% ${hoursUsed > totalHours ? '⚠️ חריגה' : 'בשימוש'}
              </div>
            </div>
          </div>
        `;
      } else {
        // תמחור קבוע
        statsHtml = `
          <div style="margin-top: 12px;">
            <div style="
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 8px 10px;
              background: #f0fdf4;
              border-radius: 6px;
              border: 1px solid #86efac;
            ">
              <i class="fas fa-check-circle" style="color: #22c55e; font-size: 12px;"></i>
              <span style="color: #166534; font-weight: 500; font-size: 12px;">מחיר פיקס</span>
            </div>
          </div>
        `;
      }
    } else if (type === 'fixed') {
      // שירות במחיר קבוע
      iconClass = 'fa-shekel-sign';
      title = service.name || 'שירות קבוע';
      subtitle = service.description || 'שירות במחיר קבוע';

      const price = service.fixedPrice !== null && service.fixedPrice !== undefined ? `₪${Number(service.fixedPrice).toLocaleString()}` : '';

      statsHtml = `
        <div style="margin-top: 12px;">
          <div style="
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 10px;
            background: #f0fdf4;
            border-radius: 6px;
            border: 1px solid #86efac;
          ">
            <i class="fas fa-shekel-sign" style="color: #22c55e; font-size: 12px;"></i>
            <span style="color: #166534; font-weight: 500; font-size: 12px;">פיקס ${price}</span>
          </div>
        </div>
      `;
    }

    // 🎯 Stage Badge להליכים משפטיים - קומפקטי וקל
    const stageBadge = type === 'legal_procedure' ? `
      <div style="
        position: absolute;
        top: -6px;
        left: 12px;
        padding: 4px 8px;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        border-radius: 10px;
        font-size: 9px;
        font-weight: 600;
        color: white;
        letter-spacing: 0.3px;
        box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
        pointer-events: none;
      ">
        ${escapeHtml(service.id === 'stage_a' ? "שלב א'" :
                     service.id === 'stage_b' ? "שלב ב'" :
                     service.id === 'stage_c' ? "שלב ג'" : service.name)}
      </div>
    ` : '';

    // מספר תיק - badge בפינה
    const caseNumberBadge = showCaseNumber && caseItem && caseItem.caseNumber ? `
      <div style="
        position: absolute;
        top: 12px;
        left: 12px;
        padding: 5px 10px;
        background: #f8fafc;
        border: 1px solid #93c5fd;
        border-radius: 5px;
        font-size: 10px;
        font-weight: 600;
        color: #3b82f6;
        letter-spacing: 0.3px;
      ">
        תיק ${escapeHtml(caseItem.caseNumber)}
      </div>
    ` : '';

    // עיצוב הכרטיס
    const cardStyle = isReadOnly ? `
      padding: 15px;
      padding-top: 25px;
      background: white;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      position: relative;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    ` : `
      padding: 15px;
      padding-top: 25px;
      background: white;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    `;

    const hoverEffects = !isReadOnly ? `
      onmouseover="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 8px 24px rgba(59, 130, 246, 0.12)'; this.style.transform='translateY(-4px)';"
      onmouseout="this.style.borderColor='#e2e8f0'; this.style.boxShadow='0 1px 3px rgba(0, 0, 0, 0.05)'; this.style.transform='translateY(0)';"
    ` : '';

    return `
      <div
        class="service-card"
        data-service-id="${escapeHtml(serviceId)}"
        data-service-type="${type}"
        ${clickHandler ? `onclick="${clickHandler}"` : ''}
        style="${cardStyle}"
        ${hoverEffects}
      >
        ${caseNumberBadge}
        ${stageBadge}

        <!-- Icon & Title -->
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">
            <i class="fas ${iconClass}" style="color: white; font-size: 14px;"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: #0f172a; font-size: 14px; line-height: 1.3;">
              ${escapeHtml(title)}
            </div>
          </div>
        </div>

        <!-- Subtitle -->
        <div style="
          color: #64748b;
          font-size: 12px;
          line-height: 1.5;
          margin-bottom: 3px;
        ">
          ${escapeHtml(subtitle)}
        </div>

        ${statsHtml}
      </div>
    `;
  };

  Logger.log('✅ Service Card Renderer loaded');

})();
