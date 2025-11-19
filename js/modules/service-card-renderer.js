/**
 * ════════════════════════════════════════════════════════════════════
 * Service Card Renderer - Shared Component
 * רכיב משותף לרינדור כרטיסי שירותים
 * ════════════════════════════════════════════════════════════════════
 *
 * @module service-card-renderer
 * @version 1.0.0
 * @updated 2025-01-18
 *
 * פונקציה גלובלית משותפת לרינדור כרטיסי שירותים
 * נמנעת code duplication בין מודולים שונים
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
    const showCaseNumber = options.showCaseNumber !== false; // default: true
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
              <span>${hoursRemaining.toFixed(1)} שעות</span>
            </div>
            <div style="color: #64748b; font-size: 11px;">
              ${progressPercent}% בשימוש
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
      title = `הליך משפטי - ${stageName}`;
      subtitle = service.description || service.name;

      if (pricingType === 'hourly') {
        // תמחור שעתי
        const totalHours = window.calculateTotalHours ? window.calculateTotalHours(service) : (service.totalHours || 0);
        const hoursUsed = window.calculateHoursUsed ? window.calculateHoursUsed(service) : 0;
        const hoursRemaining = window.calculateRemainingHours ? window.calculateRemainingHours(service) : 0;
        const progressPercent = totalHours > 0 ? Math.round((hoursUsed / totalHours) * 100) : 0;

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
                <span>${hoursRemaining.toFixed(1)} שעות</span>
              </div>
              <div style="color: #64748b; font-size: 11px;">
                ${progressPercent}% בשימוש
              </div>
            </div>
          </div>
        `;
      } else {
        // תמחור קבוע
        statsHtml = `
          <div style="margin-top: 12px;">
            <div style="
              display: flex;
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
      title = 'מחיר קבוע';
      subtitle = service.name || 'שירות במחיר קבוע';

      statsHtml = `
        <div style="margin-top: 12px;">
          <div style="
            display: flex;
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
      padding-top: 40px;
      background: white;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      position: relative;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    ` : `
      padding: 15px;
      padding-top: 40px;
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

        <!-- Icon & Title -->
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <div style="
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          ">
            <i class="fas ${iconClass}" style="color: white; font-size: 16px;"></i>
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
