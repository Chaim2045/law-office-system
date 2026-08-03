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

    // Legacy `||`-chain (mirrors renderStages/getServiceInfo) — first truthy finite, else 0.
    function pickHours() {
        for (let i = 0; i < arguments.length; i++) {
            const raw = arguments[i];
            const n = typeof raw === 'string' ? parseFloat(raw) : raw;
            if (Number.isFinite(n) && n) {
                return n;
            }
        }
        return 0;
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

    // ── mode 'manage-detail' (U5a, dead code until the U5b cutover) ──────────────
    // Reproduces the management service-card DOM byte-for-byte (the classes + data-attrs
    // the overdraft/add-package injectors + the 5 data-service-action buttons + the
    // .override-btn + the .edit-pkg-date-btn depend on), driven by the extended
    // ServiceCardModel card. SEC-1: every interpolated value (incl. attributes:
    // title / data-name / overrideApprovedBy / overrideNote) is escaped at the sink.

    function truncate(name) {
        const s = name || '';
        return s.length <= 20 ? s : (s.substring(0, 20) + '...');
    }

    const MANAGE_TYPE_BADGE = {
        hours: '<span class="management-service-badge hours"><i class="fas fa-clock"></i> שעות</span>',
        legal_procedure: '<span class="management-service-badge legal"><i class="fas fa-gavel"></i> הליך משפטי</span>',
        fixed: '<span class="management-service-badge fixed"><i class="fas fa-dollar-sign"></i> מחיר קבוע</span>'
    };
    const MANAGE_STATUS_BADGE = {
        active: '<span class="service-status-badge status-active"><i class="fas fa-check-circle"></i> פעיל</span>',
        completed: '<span class="service-status-badge status-completed"><i class="fas fa-lock"></i> הושלם</span>',
        on_hold: '<span class="service-status-badge status-on-hold"><i class="fas fa-pause-circle"></i> בהמתנה</span>',
        archived: '<span class="service-status-badge status-archived"><i class="fas fa-archive"></i> בארכיון</span>'
    };
    function manageServiceIcon(type) {
        if (type === 'legal_procedure') {
            return 'fa-gavel';
        }
        if (type === 'fixed') {
            return 'fa-dollar-sign';
        }
        if (type === 'hours') {
            return 'fa-clock';
        }
        return 'fa-briefcase';
    }

    function manageStatusClass(hoursRemaining) {
        if (hoursRemaining <= 0) {
            return 'blocked';
        }
        if (hoursRemaining <= 5) {
            return 'critical';
        }
        if (hoursRemaining <= 10) {
            return 'warning';
        }
        return 'success';
    }

    // The override "אפשר/בטל חריגה" block (hours services with hoursRemaining <= 0).
    function buildOverride(card) {
        if (num(card.hoursRemaining) > 0) {
            return '';
        }
        const dataName = esc(card.name || '');
        if (card.overrideActive) {
            const t = card.overrideApprovedAt;
            const overrideDate = t && t.seconds ? new Date(t.seconds * 1000).toLocaleDateString('he-IL') : '';
            return `
                            <div style="margin-top:8px;padding:8px 12px;background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;">
                                <span style="background:#f59e0b;color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">⚡ חריגה מאושרת</span>
                                <small style="color:#6b7280;display:block;margin-top:4px;">אושר ע"י: ${esc(card.overrideApprovedBy || '')} | ${esc(overrideDate)}</small>
                                ${card.overrideNote ? `<small style="color:#6b7280;display:block;">הערה: ${esc(card.overrideNote)}</small>` : ''}
                                <button class="override-btn" data-service-id="${esc(card.serviceId)}" data-active="false" data-name="${dataName}" style="padding:4px 10px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;margin-top:4px;">בטל חריגה</button>
                            </div>`;
        }
        return `
                            <div style="margin-top:8px;">
                                <button class="override-btn" data-service-id="${esc(card.serviceId)}" data-active="true" data-name="${dataName}" style="padding:4px 10px;background:#f59e0b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px;">אפשר חריגה</button>
                            </div>`;
    }

    function buildPackagesBreakdown(card) {
        const packages = Array.isArray(card.packages) ? card.packages : [];
        if (packages.length === 0) {
            return '';
        }
        const rows = packages.map(function (pkg) {
            const date = pkg.purchaseDate
                ? new Date(pkg.purchaseDate).toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' })
                : '-';
            const hours = num(pkg.hours).toFixed(1);
            const used = num(pkg.hoursUsed).toFixed(1);
            const remaining = num(pkg.hoursRemaining).toFixed(1);
            const desc = pkg.description ? esc(pkg.description) : '';
            return `
                    <tr>
                        <td style="padding:4px 8px;white-space:nowrap;">
                            ${esc(date)}
                            <button class="edit-pkg-date-btn" data-service-id="${esc(card.serviceId)}" data-package-id="${esc(pkg.id)}" data-current-date="${esc(pkg.purchaseDate || '')}" title="ערוך תאריך רכישה" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0 4px;">✏️</button>
                        </td>
                        <td style="padding:4px 8px;">${hours}</td>
                        <td style="padding:4px 8px;">${used}</td>
                        <td style="padding:4px 8px;">${remaining}</td>
                        <td style="padding:4px 8px;">${desc}</td>
                    </tr>`;
        }).join('');
        return `
                    <div style="margin-top:12px;">
                        <div style="font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;"><i class="fas fa-box-open"></i> חבילות (${packages.length})</div>
                        <table style="width:100%;border-collapse:collapse;font-size:12px;">
                            <thead><tr style="color:#6b7280;text-align:right;"><th style="padding:4px 8px;">תאריך רכישה</th><th style="padding:4px 8px;">שעות</th><th style="padding:4px 8px;">נוצלו</th><th style="padding:4px 8px;">נותרו</th><th style="padding:4px 8px;">תיאור</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>`;
    }

    // getServiceInfo — 3 branches (HOURS / LEGAL_PROCEDURE / FIXED).
    function buildServiceInfo(card) {
        const type = card.type || 'hours';
        const startRaw = card.startedAt || card.createdAt;
        let dateDisplay = '';
        if (startRaw) {
            const d = new Date(startRaw.seconds ? startRaw.seconds * 1000 : startRaw);
            dateDisplay = d.toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }

        if (type === 'hours') {
            const totalHours = num(card.totalHours);
            const hoursRemaining = num(card.hoursRemaining);
            const hoursUsed = num(card.hoursUsed);
            const percentage = totalHours > 0 ? ((hoursUsed / totalHours) * 100).toFixed(0) : 0;
            const statusClass = manageStatusClass(hoursRemaining);
            return `
                    <div class="management-service-info">
                        <div class="management-service-info-item">
                            <span class="management-service-info-label">תאריך פתיחה:</span>
                            <span class="management-service-info-value">${dateDisplay || 'לא זמין'}</span>
                        </div>
                    </div>

                    <div class="management-hours-progress">
                        <div class="management-hours-progress-title">
                            <i class="fas fa-clock"></i>
                            ניצול שעות
                        </div>
                        <!--
                          Gap #2 (PR-P2): a large hero is the focal metric — the used/total hours
                          + "נותרו X ש׳" as the visual anchor. נרכשו (=total) / נוצלו (=used) /
                          נותרו (=remaining) are ALL folded into the hero (no redundant dense
                          stats row); the % stays as a small caption under the bar. Same values as
                          before (card.hoursUsed / totalHours / hoursRemaining) — reformatted only.
                        -->
                        <div class="management-hours-hero">
                            <div class="management-hours-hero-figure">
                                <span class="management-hours-hero-used ${statusClass}">${hoursUsed.toFixed(1)}</span>
                                <span class="management-hours-hero-slash">/</span>
                                <span class="management-hours-hero-total">${totalHours.toFixed(1)}</span>
                                <span class="management-hours-hero-unit">ש׳</span>
                            </div>
                            <div class="management-hours-hero-remaining ${statusClass}">נותרו ${hoursRemaining.toFixed(1)} ש׳</div>
                        </div>
                        <div class="management-hours-progress-bar">
                            <div class="management-hours-progress-fill ${statusClass}" style="width: ${percentage}%">
                            </div>
                        </div>
                        <div class="management-hours-caption">${percentage}% נוצלו</div>
                    </div>
                    ${buildPackagesBreakdown(card)}
                    ${buildOverride(card)}
                `;
        }

        if (type === 'legal_procedure') {
            const stages = Array.isArray(card.stages) ? card.stages : [];
            const totalStages = stages.length;
            const completedStages = stages.filter((s) => s.status === 'completed').length;
            const activeStage = stages.find((s) => s.status === 'active');
            // pricingType (not a service-type) — routing string, mirrors getServiceInfo:685.
            // eslint-disable-next-line no-restricted-syntax
            const pricing = card.pricingType === 'hourly' ? 'שעתי' : 'קבוע';
            // NOTE: no wrapping `.management-service-info` here — the old getServiceInfo legal
            // branch returns bare items (renderServiceCard's single wrapper holds them).
            return `
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">התקדמות</span>
                        <span class="management-service-info-value">${completedStages}/${totalStages} שלבים</span>
                    </div>
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">שלב נוכחי</span>
                        <span class="management-service-info-value">${esc(activeStage ? activeStage.name : 'אין')}</span>
                    </div>
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">תמחור</span>
                        <span class="management-service-info-value">${pricing}</span>
                    </div>
                `;
        }

        // fixed — bare items (no wrapper), Hebrew status, no label colons (matches getServiceInfo:689).
        return `
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">מחיר</span>
                        <span class="management-service-info-value">₪${num(card.fixedPrice).toLocaleString()}</span>
                    </div>
                    <div class="management-service-info-item">
                        <span class="management-service-info-label">סטטוס</span>
                        <span class="management-service-info-value">${card.status === 'active' ? 'פעיל' : 'הושלם'}</span>
                    </div>
                `;
    }

    // renderStages — the .management-stage / .management-stage-name (===stage.name) contract.
    function buildStagesHtml(card) {
        const stages = Array.isArray(card.stages) ? card.stages : [];
        if (stages.length === 0) {
            return '';
        }
        const completedCount = stages.filter((s) => s.status === 'completed').length;
        const progressPercent = stages.length > 0 ? (completedCount / stages.length) * 100 : 0;

        const stagesHtml = stages.map((stage) => {
            let icon = 'fa-circle';
            let stageClass = 'pending';
            if (stage.status === 'completed') {
                icon = 'fa-check';
                stageClass = 'completed';
            } else if (stage.status === 'active') {
                icon = 'fa-circle-notch';
                stageClass = 'active';
            }
            const stageHours = pickHours(stage.hours, stage.totalHours, stage.allocatedHours, stage.estimatedHours);
            const stageUsed = num(stage.hoursUsed);
            const stageRemaining = Number.isFinite(stage.hoursRemaining)
                ? stage.hoursRemaining
                : (stageHours - stageUsed);
            let hoursInfo = '';
            if (stageHours > 0) {
                if (stage.status === 'active') {
                    hoursInfo = `${stageRemaining.toFixed(1)}/${stageHours.toFixed(1)}`;
                } else {
                    hoursInfo = `${stageHours.toFixed(1)}`;
                }
            }
            // .management-stage-name === stage.name EXACTLY (AddPackageToStage matches on it).
            const stageName = stage.name || stage.description || 'שלב';
            return `
                    <div class="management-stage ${stageClass}">
                        <div class="management-stage-icon">
                            <i class="fas ${icon}"></i>
                        </div>
                        <div class="management-stage-info">
                            <div class="management-stage-name">${esc(stageName)}</div>
                            ${hoursInfo ? `<div class="management-stage-hours">${hoursInfo} שע׳</div>` : ''}
                        </div>
                    </div>`;
        }).join('');

        return `
                <div class="management-stages">
                    <div class="management-stages-title"><i class="fas fa-layer-group"></i> שלבי ההליך</div>
                    <div class="management-stages-timeline">
                        <div class="management-stages-progress"><div class="management-stages-progress-fill" style="width: ${progressPercent}%"></div></div>
                        <div class="management-stages-list">${stagesHtml}</div>
                    </div>
                </div>`;
    }

    // getServiceActions — the 5 data-service-action buttons.
    function buildActions(card) {
        const type = card.type || 'hours';
        const id = esc(card.serviceId);
        const buttons = [];
        if (type === 'hours') {
            buttons.push(`<button class="management-service-action-btn primary" data-service-action="renew" data-service-id="${id}"><i class="fas fa-plus"></i> חדש שעות</button>`);
        }
        if (type === 'legal_procedure' && (Array.isArray(card.stages) ? card.stages : []).some((s) => s.status === 'active')) {
            buttons.push(`<button class="management-service-action-btn primary" data-service-action="next-stage" data-service-id="${id}"><i class="fas fa-forward"></i> עבור לשלב הבא</button>`);
        }
        buttons.push(`<button class="management-service-action-btn secondary" data-service-action="change-status" data-service-id="${id}"><i class="fas fa-exchange-alt"></i> שנה סטטוס</button>`);
        if (card.status === 'active') {
            buttons.push(`<button class="management-service-action-btn secondary" data-service-action="complete" data-service-id="${id}"><i class="fas fa-check"></i> סמן כהושלם</button>`);
        }
        buttons.push(`<button class="management-service-action-btn danger" data-service-action="delete" data-service-id="${id}"><i class="fas fa-trash"></i> מחק שירות</button>`);
        return buttons.join('');
    }

    /**
     * mode 'manage-detail' → the full management service card as a detached HTMLElement.
     * @returns {HTMLElement} `.management-service-card[data-service-id]`
     */
    function buildManageDetail(card) {
        const type = card.type || 'hours';
        const el = document.createElement('div');
        el.className = 'management-service-card';
        el.dataset.serviceId = card.serviceId || '';
        // Gap #4 (PR-P2): the big title IS the service NAME (was the literal "שירות" with the
        // name demoted to a small `.service-name` badge). The redundant badge is removed — the
        // name is shown ONCE, as the header title. `title=` keeps the full name on hover when
        // CSS truncates. Status + type badges are unchanged.
        const serviceName = card.name || 'ללא שם';
        el.innerHTML = `
                    <div class="management-service-header">
                        <div class="management-service-header-left">
                            <div class="management-service-title" title="${esc(serviceName)}">
                                <i class="fas ${manageServiceIcon(type)}"></i>
                                ${esc(serviceName)}
                            </div>
                            ${MANAGE_STATUS_BADGE[card.status] || MANAGE_STATUS_BADGE[card.status || 'active'] || ''}
                            ${MANAGE_TYPE_BADGE[type] || ''}
                        </div>
                        <i class="fas fa-chevron-down management-service-toggle"></i>
                    </div>

                    <div class="management-service-body">
                        <div class="management-service-content">
                            <div class="management-service-info">
                                ${buildServiceInfo(card)}
                            </div>

                            ${type === 'legal_procedure' ? buildStagesHtml(card) : ''}

                            <div class="management-service-actions">
                                ${buildActions(card)}
                            </div>
                        </div>
                    </div>`;
        return el;
    }

    // "Needs attention" = a blocked service OR an unresolved negative remainder (overdraft).
    // Drives the rail status dot so an overdrawn/blocked service is visible WITHOUT a click.
    // Number.isFinite-guarded so a missing/non-numeric remainder never trips the signal.
    function railNeedsAttention(card) {
        if (card.status === 'blocked') {
            return true;
        }
        const remaining = Number(card.hoursRemaining);
        if (Number.isFinite(remaining) && remaining < 0) {
            const resolved = !!(card.overdraftResolved && card.overdraftResolved.isResolved === true);
            return !resolved;
        }
        return false;
    }

    // Rail hours ratio "used/total". A service-level rollup wins (hours services); when it is
    // absent (0) but the service carries stages (a legal procedure keeps its hours on the
    // stages) the ratio falls back to the sum over stages. Type-agnostic on purpose — a
    // priceless service (0 total, no stages) simply shows nothing.
    function railRatioHtml(card) {
        let total = num(card.totalHours);
        let used = num(card.hoursUsed);
        if (!(total > 0)) {
            const stages = Array.isArray(card.stages) ? card.stages : [];
            if (stages.length > 0) {
                total = stages.reduce((sum, s) => sum + num(s.totalHours), 0);
                used = stages.reduce((sum, s) => sum + num(s.hoursUsed), 0);
            }
        }
        if (!(total > 0)) {
            return '';
        }
        return '<span class="cm-rail-row-ratio">' + used.toFixed(1) + '/' + total.toFixed(1) + '</span>';
    }

    /**
     * mode 'rail-row' → a THIN navigation row (no `.management-*` classes — DA-3, so the
     * add-package/overdraft injectors never match a rail row). Selecting it shows the
     * matching detail panel.
     *
     * opts (PR-R1) — the SAME rail row is reused by BOTH tabs; only the ARIA wiring differs:
     *   - manage (default): role="tab"        → aria-selected, aria-controls="managementServicesList"
     *   - report:           opts.role="radio" → aria-checked,  opts.ariaControls=<report detail id>
     * The manage default output stays BYTE-IDENTICAL to pre-PR-R1 (ADMIN SAFETY — this row drives
     * which management service-card is shown).
     * @returns {HTMLElement}
     */
    function buildRailRow(card, opts) {
        const o = opts || {};
        const role = o.role || 'tab';
        const selectedAttr = role === 'radio' ? 'aria-checked' : 'aria-selected';
        const ariaControls = o.ariaControls || 'managementServicesList';
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'cm-rail-row';
        el.setAttribute('role', role);
        el.setAttribute(selectedAttr, 'false');
        // FIX 4: the builder OWNS the rail selection key (single source of truth).
        el.dataset.rail = card.serviceId || '';
        // FIX 5: a service row controls its detail area (the manage services-list by default).
        el.setAttribute('aria-controls', ariaControls);

        // FIX 2: surface "needs attention" (overdraft/blocked) on the rail so an admin does not
        // have to open every service. NOT color-only (WCAG) — the row `title` + a visually-hidden
        // label carry the signal too. SEC-1: every interpolated value stays escaped via esc().
        // FIX 2 (P1): every service row carries a status dot — green (--ok) = healthy,
        // orange (--attention) = needs attention (overdraft/blocked). NOT color-only (WCAG): an
        // attention row also sets the row `title` + a visually-hidden label. The type icon is
        // dropped from the rail (the detail panel's type badge carries type) to match the mockup.
        const attention = railNeedsAttention(card);
        if (attention) {
            el.setAttribute('title', 'דורש טיפול');
        }
        const statusDot = attention
            ? '<span class="cm-rail-row-status cm-rail-row-status--attention" aria-hidden="true"></span>'
            : '<span class="cm-rail-row-status cm-rail-row-status--ok" aria-hidden="true"></span>';
        const srLabel = attention
            ? '<span class="cm-rail-row-sr">דורש טיפול</span>'
            : '';
        el.innerHTML =
            statusDot +
            '<span class="cm-rail-row-name">' + esc(truncate(card.name || 'ללא שם')) + '</span>' +
            railRatioHtml(card) +
            srLabel;
        return el;
    }

    const api = {
        buildReportSelectCards: buildReportSelectCards,
        buildManageDetail: buildManageDetail,
        buildRailRow: buildRailRow
    };

    if (typeof window !== 'undefined') {
        window.UnifiedServiceCard = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
