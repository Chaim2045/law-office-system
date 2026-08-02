/**
 * UnifiedServiceCard — the one renderer both modal tabs converge on.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U4 (mode 'report-select' only;
 * mode 'manage' is added in U5 when the management panel adopts this renderer).
 *
 * `report-select` builds the selectable service cards for the report tab, driven by
 * the pure ServiceCardModel (U2) — so it inherits the D1/D2 fixes: one selectable unit
 * per service (hours/fixed) or per active/completed stage (legal_procedure), keyed by
 * service.id (no client-wide stage.id Map → no D2 collision), and it never reads the
 * timesheet ledger (→ no D1 phantom). The cards reuse the existing report-service-cards.css
 * classes so the visual language matches the current report modal.
 *
 * DA-2: a legal_procedure with NO active/completed stage yields a NON-selectable muted
 * card (never a `{type:'legal_procedure', stage:''}` selection — that would make
 * ReportGenerator.resolveServiceHours fall to the parent-sum over-count path).
 *
 * Pure DOM: this module BUILDS elements + returns each element's `selection` payload.
 * The controller (ReportTab) owns selection state + the click wiring — this file has no
 * global state and no window.* dependency except the SSOT window.escapeHtml.
 */
(function () {
    'use strict';

    function esc(v) {
        return (typeof window !== 'undefined' && typeof window.escapeHtml === 'function')
            ? window.escapeHtml(v)
            : (v === null || v === undefined ? '' : String(v));
    }

    function num(v) {
        return Number.isFinite(v) ? v : 0;
    }

    // Badge text + variant class for a card (mirrors the report-service-cards.css badge set).
    function badgeFor(type, isFixed, status) {
        if (status === 'archived') {
            return { cls: 'archived', text: 'בארכיון' };
        }
        if (type === 'legal_procedure') {
            return { cls: 'legal-hourly', text: 'הליך משפטי' };
        }
        if (isFixed || type === 'fixed') {
            return { cls: 'fixed', text: 'מחיר קבוע' };
        }
        return { cls: 'hours', text: 'שעות' };
    }

    // Build ONE selectable card element. `data` = {name, badge:{cls,text}, hoursUsed,
    // totalHours, variantClasses:[], selectable, note}. `ds` = {serviceId, stage, type, name}.
    function buildCard(data, ds) {
        const card = document.createElement('div');
        card.className = ['report-service-card'].concat(data.variantClasses || []).join(' ');
        if (data.selectable) {
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-pressed', 'false');
            card.dataset.serviceName = ds.name || '';
            card.dataset.serviceId = ds.serviceId || '';
            card.dataset.stage = ds.stage || '';
            card.dataset.serviceType = ds.type || '';
        } else {
            card.classList.add('report-service-card--disabled');
            card.setAttribute('aria-disabled', 'true');
        }

        const showHours = num(data.totalHours) > 0 || num(data.hoursUsed) > 0;
        const hoursStat = showHours
            ? `<div class="report-card-stat">
                   <span class="report-card-stat-label">נוצלו/סה"כ:</span>
                   <span class="report-card-stat-value">${num(data.hoursUsed).toFixed(1)} / ${num(data.totalHours).toFixed(1)}</span>
               </div>`
            : '';

        card.innerHTML = `
            <div class="report-card-header">
                <div class="report-card-main">
                    <div class="report-card-name">${esc(data.name || 'ללא שם')}</div>
                    <div class="report-card-meta">
                        <span class="report-card-badge ${data.badge.cls}">${esc(data.badge.text)}</span>
                    </div>
                </div>
                <div class="report-card-selected-indicator"><i class="fas fa-check-circle"></i></div>
            </div>
            <div class="report-card-stats">
                ${hoursStat}
                ${data.note ? `<div class="report-card-note">${esc(data.note)}</div>` : ''}
            </div>`;
        return card;
    }

    /**
     * Build the selectable units for ONE ServiceCardModel card.
     * @param {Object} card - a ServiceCardModel card.
     * @param {Object} [options]
     * @param {Function} [options.getStageName] - (stageId)=>label. When provided, a legal stage's
     *        display name + `selection.service` use getStageName(stage.id) — BYTE-MATCHING the old
     *        ClientReportModal (which labels legal stages by getStageName, not stage.name), so the
     *        generated report reads identically no matter which surface produced the formData.
     * @returns {Array<{el: HTMLElement, selection: {service,serviceId,stage,type}|null}>}
     *   selection===null → a non-selectable card (DA-2 or a data gap). ReportTab skips wiring it.
     */
    function buildReportSelectCards(card, options) {
        const type = card.type || 'hours';
        const getStageName = options && typeof options.getStageName === 'function' ? options.getStageName : null;

        if (type === 'legal_procedure') {
            const stages = (Array.isArray(card.stages) ? card.stages : [])
                .filter((s) => s.status === 'active' || s.status === 'completed');

            if (stages.length === 0) {
                // DA-2: no stage to attach → not selectable (never emit stage:'' for a legal service).
                const badge = badgeFor(type, card.isFixed, card.status);
                return [{
                    el: buildCard({
                        name: card.name, badge, totalHours: card.totalHours, hoursUsed: card.hoursUsed,
                        variantClasses: card.nonAggregating ? ['archived'] : [],
                        selectable: false, note: 'אין שלב פעיל לבחירה'
                    }, {}),
                    selection: null
                }];
            }

            return stages.map((stage) => {
                const badge = stage.status === 'active'
                    ? { cls: 'current-stage', text: 'שלב פעיל' }
                    : { cls: 'completed', text: 'הושלם' };
                // Match the old report label (getStageName by stage.id); stage.name is the fallback.
                const name = getStageName ? getStageName(stage.id) : (stage.name || card.name);
                const ds = { serviceId: card.serviceId, stage: stage.id, type: 'legal_procedure', name };
                return {
                    el: buildCard({
                        name, badge, totalHours: stage.totalHours, hoursUsed: stage.hoursUsed,
                        variantClasses: card.nonAggregating ? ['archived'] : [], selectable: true
                    }, ds),
                    selection: { service: name, serviceId: card.serviceId, stage: stage.id, type: 'legal_procedure' }
                };
            });
        }

        // hours / fixed — one selectable card, no stage.
        const badge = badgeFor(type, card.isFixed, card.status);
        const variants = [];
        if (card.isFixed || type === 'fixed') {
            variants.push('fixed');
        }
        if (card.nonAggregating) {
            variants.push('archived');
        }
        // overdraft styling parity: an unresolved negative remainder shows the overdraft variant.
        if (Number.isFinite(card.hoursRemaining) && card.hoursRemaining < 0) {
            variants.push(card.overdraftResolved && card.overdraftResolved.isResolved ? 'resolved' : 'overdraft');
        }
        const ds = { serviceId: card.serviceId, stage: '', type, name: card.name };
        return [{
            el: buildCard({
                name: card.name, badge, totalHours: card.totalHours, hoursUsed: card.hoursUsed,
                variantClasses: variants, selectable: true
            }, ds),
            selection: { service: card.name, serviceId: card.serviceId, stage: '', type }
        }];
    }

    const api = { buildReportSelectCards: buildReportSelectCards };

    if (typeof window !== 'undefined') {
        window.UnifiedServiceCard = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
