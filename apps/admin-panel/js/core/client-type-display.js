/**
 * Client Type Display — composes "what kind of client is this?" from services[].
 *
 * Replaces the legacy logic that read a non-existent `client.type` field
 * and defaulted it to 'hours' in ClientsDataManager, causing every fixed
 * client to appear as 'שעות' in the admin table.
 *
 * Source of truth: client.services[] — the array of service objects.
 * Each service has:
 *   - type: 'hours' | 'fixed' | 'legal_procedure'
 *   - pricingType: 'hourly' | 'fixed'  (legal_procedure only)
 *   - status: 'active' | 'completed'   (active = currently used)
 *
 * Output: a stable `typeDisplay` object the UI can render without further logic.
 *
 * Created: 2026-05-14 as part of feature/admin-table-mixed-type-display.
 */

(function () {
    'use strict';

    /**
     * Fixed-service check — kept in sync with the canonical SOT.
     *
     * Canonical: shared/business-rules/service-classification.js
     * Drift guard: tests/unit/shared/business-rules.sync.test.ts
     *
     * This local copy is preserved (not delegated to window.BUSINESS_RULES) so
     * the existing Vitest unit tests (`tests/unit/admin-panel/client-type-display.test.ts`)
     * continue to work without test-setup changes. The sync test enforces parity.
     *
     * DO NOT EDIT THIS FUNCTION DIRECTLY. Edit the canonical and propagate.
     *
     * @param {Object} svc - service object
     * @returns {boolean}
     */
    function isFixedService(svc) {
        if (!svc) {
            return false;
        }
        return svc.type === 'fixed' ||
            (svc.type === 'legal_procedure' && svc.pricingType === 'fixed');
    }

    /**
     * Service status check. Treats missing status as 'active' for backward
     * compatibility with old data (services pre-dating the status field).
     *
     * @param {Object} svc - service object
     * @returns {boolean}
     */
    function isServiceActive(svc) {
        if (!svc) {
            return false;
        }
        // Missing status = legacy data = treat as active
        if (!svc.status) {
            return true;
        }
        return svc.status === 'active';
    }

    /**
     * Compute the "type display" for a client based on active services.
     *
     * Returns an object the UI can render directly. Includes a `breakdown`
     * array suitable for tooltips listing every service (active + completed).
     *
     * @param {Array<Object>} services - client.services array
     * @returns {{
     *   kind: 'none' | 'hours' | 'fixed' | 'mixed',
     *   label: string,    // Hebrew label
     *   icon: string,     // FontAwesome class
     *   breakdown: Array<{name: string, type: string, status: string, isFixed: boolean, isActive: boolean}>
     * }}
     */
    function computeClientTypeDisplay(services) {
        const list = Array.isArray(services) ? services : [];

        // Breakdown: every service with classification flags for tooltips/exports.
        const breakdown = list.map(svc => ({
            name: svc.name || '(ללא שם)',
            type: svc.type || 'unknown',
            pricingType: svc.pricingType || null,
            status: svc.status || 'active',
            isFixed: isFixedService(svc),
            isActive: isServiceActive(svc)
        }));

        const active = breakdown.filter(b => b.isActive);
        const hasHours = active.some(b => !b.isFixed);
        const hasFixed = active.some(b => b.isFixed);

        let kind, label, icon;
        if (active.length === 0) {
            kind = 'none';
            label = 'ללא';
            icon = 'fa-question-circle';
        } else if (hasHours && hasFixed) {
            kind = 'mixed';
            label = 'מעורב';
            icon = 'fa-layer-group';
        } else if (hasHours) {
            kind = 'hours';
            label = 'שעות';
            icon = 'fa-clock';
        } else {
            kind = 'fixed';
            label = 'פיקס';
            icon = 'fa-file-invoice-dollar';
        }

        return { kind, label, icon, breakdown };
    }

    /**
     * Render an HTML tooltip body listing every service with status.
     * Safe — escapes service names against XSS.
     *
     * @param {Array} breakdown - the `.breakdown` from computeClientTypeDisplay
     * @returns {string} HTML string
     */
    function renderTypeTooltip(breakdown) {
        if (!Array.isArray(breakdown) || breakdown.length === 0) {
            return '<div class="type-tooltip"><em>אין שירותים</em></div>';
        }

        // Routed to the shared SSOT escaper (js/core/escape-html.js) — escapes leaf
        // text only (the assembled tooltip HTML is handled by ClientsTable, excluded).
        // Byte-identical for string input (same 5 entities incl. &#039;).
        const escapeHtml = (str) => window.escapeHtml(str);

        const activeRows = breakdown.filter(b => b.isActive).map(b => {
            const typeLabel = b.isFixed ? 'פיקס' : 'שעות';
            const icon = b.isFixed ? 'fa-file-invoice-dollar' : 'fa-clock';
            return `<div class="tooltip-row active">
                <i class="fas ${icon}"></i>
                <span class="svc-name">${escapeHtml(b.name)}</span>
                <span class="svc-type">${typeLabel}</span>
            </div>`;
        }).join('');

        const completedRows = breakdown.filter(b => !b.isActive).map(b => {
            const typeLabel = b.isFixed ? 'פיקס' : 'שעות';
            return `<div class="tooltip-row completed">
                <i class="fas fa-check-circle"></i>
                <span class="svc-name">${escapeHtml(b.name)}</span>
                <span class="svc-type">${typeLabel} (סגור)</span>
            </div>`;
        }).join('');

        return `<div class="type-tooltip">
            ${activeRows ? `<div class="tooltip-section">
                <div class="tooltip-header">פעילים:</div>
                ${activeRows}
            </div>` : ''}
            ${completedRows ? `<div class="tooltip-section">
                <div class="tooltip-header">סגורים:</div>
                ${completedRows}
            </div>` : ''}
        </div>`;
    }

    /**
     * Render an inline CSV-friendly composition string (for exports).
     * Example: "שעות + פיקס" / "שעות" / "פיקס" / "ללא"
     *
     * @param {Array} breakdown
     * @returns {string}
     */
    function renderTypeForCsv(breakdown) {
        if (!Array.isArray(breakdown)) {
            return '';
        }
        const active = breakdown.filter(b => b.isActive);
        const hasHours = active.some(b => !b.isFixed);
        const hasFixed = active.some(b => b.isFixed);
        if (active.length === 0) {
            return 'ללא';
        }
        if (hasHours && hasFixed) {
            return 'שעות + פיקס';
        }
        if (hasHours) {
            return 'שעות';
        }
        return 'פיקס';
    }

    // Expose to window — admin-panel pattern
    if (typeof window !== 'undefined') {
        window.ClientTypeDisplay = {
            computeClientTypeDisplay,
            renderTypeTooltip,
            renderTypeForCsv,
            isFixedService,    // exported for tests + future reuse
            isServiceActive    // same
        };
    }

    // CommonJS export — for vitest tests under Node
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            computeClientTypeDisplay,
            renderTypeTooltip,
            renderTypeForCsv,
            isFixedService,
            isServiceActive
        };
    }
})();
