/**
 * ReportTab — the "הפקת דוח" tab inside the unified ClientManagementModal.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-R2 (report master-detail).
 *
 * The tab is a MASTER-DETAIL surface: a right-hand rail of services (the SAME
 * `UnifiedServiceCard.buildRailRow` the management tab uses, parameterized to role="radio"
 * by PR-R1) + a left detail pane (date bar + per-service detail + format footer). It holds the
 * selection state and emits a formData object BIT-IDENTICAL to ClientReportModal.getFormData
 * so the report engine (ReportGenerator / ReportPreview) can't tell which surface produced it.
 *
 * DA-1 (radio-name collision): the format radios use `name="mgmtReportFormat"` and are read
 * SCOPED to this tab's root — never the global `input[name="reportFormat"]` the old modal owns.
 * DA-2 (empty-stage legal): a legal_procedure is only selectable via a specific active/completed
 * stage. When a legal service has no such stage the selection carries stage:'' and this
 * controller refuses to generate it (belt-and-suspenders in _validateSelection). A stage picker
 * never sets a stageless legal selection while a selectable stage exists.
 *
 * Injector safety (DA-3): the report tab emits NONE of the injector-scanned `.management` prefix
 * classes — the rail rows are `.cm-rail-row` and the detail uses `.report-*`, so the
 * add-package/overdraft injectors that scan the management panel never match anything here.
 *
 * Reachable only from within the unified modal (the report tab-bar) — no existing button changes.
 */
(function () {
    'use strict';

    // Mirrors ClientReportModal.getStageName (:619) — legacy-id map → SystemConstantsHelpers.
    function getStageName(stageId) {
        const legacyMap = {
            stageA: 'stage_a', stageB: 'stage_b', stageC: 'stage_c',
            a: 'stage_a', b: 'stage_b', c: 'stage_c'
        };
        const canonicalId = legacyMap[stageId] || stageId;
        const helper = (typeof window !== 'undefined') ? window.SystemConstantsHelpers : null;
        const baseName = helper && typeof helper.getStageName === 'function' ? helper.getStageName(canonicalId) : null;
        if (baseName && baseName !== canonicalId) {
            return 'הליך משפטי - ' + baseName;
        }
        return stageId || 'הליך משפטי';
    }

    function fmtDateForInput(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Parse a yyyy-mm-dd input value into a LOCAL Date — midnight (start) or end-of-day (isEnd),
    // MATCHING ReportGenerator._parseLocalDate. A bare new Date("yyyy-mm-dd") is UTC midnight, so
    // the "unassigned hours" note would use a narrower window than the report (dropping entries
    // logged today) — this keeps the note's window byte-identical to the report's.
    function parseLocalDate(value, isEnd) {
        if (!value) {
            return null;
        }
        const parts = String(value).split('-');
        if (parts.length !== 3) {
            return null;
        }
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        const d = Number(parts[2]);
        if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
            return null;
        }
        return isEnd
            ? new Date(y, m - 1, d, 23, 59, 59, 999)
            : new Date(y, m - 1, d, 0, 0, 0, 0);
    }

    // Local sinks/coercers (ReportTab has no esc/num of its own; escapeHtml is the SSOT).
    function esc(s) {
        const f = (typeof window !== 'undefined') ? window.escapeHtml : null;
        if (typeof f === 'function') {
            return f(s);
        }
        return (s === null || s === undefined) ? '' : String(s);
    }

    function num(v) {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    function mins(entry) {
        const n = Number(entry && entry.minutes);
        return Number.isFinite(n) ? n : 0;
    }

    // Meter threshold — STRICT over: < 0 remaining = over (red), ≤10 = high (orange), else good
    // (green). rem === 0 (exactly on budget) routes to 'high', NEVER red — a fully-used but not
    // overdrawn quota is a warning, not a debt. NaN-safe: NaN < 0 is false → NaN <= 10 is false → 'good'
    // is unreachable for a real overdraft since callers gate on total > 0 before painting the meter.
    function meterStatus(hoursRemaining) {
        return (hoursRemaining < 0) ? 'over' : (hoursRemaining <= 10 ? 'high' : 'good');
    }

    // Per-service identity band — icon + name + type badge, plus (hours only) an inline-end
    // used/total · remaining stat and a 4px status meter. Numbers are toFixed()'d (no XSS
    // surface); the name is the only user string → esc().
    function identityBandHtml(card) {
        // Layout-only classification (icon/badge/meter routing), mirrors _renderServiceDetail's fork.
        // eslint-disable-next-line no-restricted-syntax
        const isLegal = card.type === 'legal_procedure';
        const isFixed = !!card.isFixed;

        let icon;
        let badge;
        if (isLegal) {
            icon = 'fa-gavel';
            badge = 'הליך משפטי';
        } else if (isFixed) {
            icon = 'fa-dollar-sign';
            badge = 'מחיר קבוע';
        } else {
            icon = 'fa-clock';
            badge = 'שעות';
        }

        let stat = '';
        let meter = '';
        // Meter/stat ONLY for an hours service WITH a real quota (total > 0). A 0-budget hours
        // service renders the band alone; the caller (_renderServiceDetail) adds a neutral note —
        // never a red "debt" bar for a service that has no defined quota (FIX 3).
        if (!isLegal && !isFixed && num(card.totalHours) > 0) {
            const used = num(card.hoursUsed);
            const total = num(card.totalHours);
            // The card model exposes card.hoursRemaining (ServiceCardModel.buildCard) — use it.
            const rem = num(card.hoursRemaining);
            const status = meterStatus(rem);
            const remText = rem < 0
                ? 'חריגה ' + Math.abs(rem).toFixed(1)
                : 'נותרו ' + rem.toFixed(1);
            stat =
                '<span class="report-identity-stat"><b>' + used.toFixed(1) + '</b> / ' +
                total.toFixed(1) + ' ש׳ · ' +
                '<span class="report-identity-rem report-identity-rem--' + status + '">' + remText + '</span></span>';
            const pct = Math.min(100, Math.max(0, (used / total) * 100));
            meter =
                '<div class="report-identity-meter"><span class="report-identity-meter-fill report-identity-meter-fill--' +
                status + '" style="width:' + pct + '%"></span></div>';
        }

        return '<div class="report-identity"><div class="report-identity-top">' +
            '<span class="report-identity-icon"><i class="fas ' + icon + '" aria-hidden="true"></i></span>' +
            '<span class="report-identity-name">' + esc(card.name || 'ללא שם') + '</span>' +
            '<span class="report-identity-badge">' + badge + '</span>' +
            stat +
            '</div>' + meter + '</div>';
    }

    // yyyy-mm-dd → "D בMonth YYYY" (Hebrew), or "—" when empty/malformed. Parsed via split() —
    // never via the Date constructor (a source-guard test forbids parsing the raw input value).
    function fmtDateHebrew(value) {
        if (!value) {
            return '—';
        }
        const parts = String(value).split('-');
        if (parts.length !== 3) {
            return '—';
        }
        const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי',
            'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
        const mIdx = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!(mIdx >= 0 && mIdx <= 11) || !Number.isFinite(d)) {
            return '—';
        }
        return d + ' ב' + months[mIdx] + ' ' + parts[0];
    }

    class ReportTab {
        constructor() {
            this._root = null;
            this._client = null;
            this._selection = null; // { service, serviceId, stage, type }
            this._dataManager = null;
            this._cards = [];
            this._resizeBound = false; // window resize listener attaches once (singleton)
        }

        /**
         * (Re)render the report tab into `root` for `client`. Idempotent — called on open
         * (and on first switch to the tab). Resets the selection + card state.
         */
        render(client, root, dataManager) {
            if (!root) {
                return;
            }
            this._root = root;
            this._client = client || null;
            this._selection = null;
            this._dataManager = dataManager || null;
            this._cards = [];

            root.innerHTML = this._shellHtml();
            this._populateRail();
            this._wireQuickDates();
            this._wireDateInputs();
            this._wireCustomToggle();
            this._wireActions();
            this._bindResizeOnce();
            this._setQuickDateRange('all'); // default = full client history (caseOpenDate anchor)
        }

        _shellHtml() {
            return `
                <div class="cm-split">
                    <div id="mgmtReportRail" class="cm-rail report-rail" role="radiogroup" aria-label="בחר שירות לדוח">
                        <div class="report-rail-label">בחר שירות לדוח <span class="report-req">*</span></div>
                    </div>
                    <div class="cm-detail report-detail">
                        <div id="mgmtReportServiceDetail" class="report-service-detail">
                            <div class="report-detail-empty"><i class="fas fa-hand-pointer"></i> בחר שירות מהרשימה כדי להפיק דוח</div>
                        </div>

                        <div class="report-period">
                            <div class="report-period-label">תקופת הדוח</div>
                            <div class="report-preset-seg" id="mgmtReportPresetSeg" role="radiogroup" aria-label="טווח תאריכים לדוח">
                                <span class="report-preset-thumb" aria-hidden="true"></span>
                                <button type="button" class="btn-quick-date" data-range="thisMonth" role="radio" aria-checked="false">החודש</button>
                                <button type="button" class="btn-quick-date" data-range="lastMonth" role="radio" aria-checked="false">חודש שעבר</button>
                                <button type="button" class="btn-quick-date" data-range="last3Months" role="radio" aria-checked="false">3 חודשים</button>
                                <button type="button" class="btn-quick-date" data-range="thisYear" role="radio" aria-checked="false">השנה</button>
                                <button type="button" class="btn-quick-date" data-range="all" role="radio" aria-checked="false">מההתחלה</button>
                            </div>
                            <div class="report-dateline">
                                <i class="fas fa-calendar-alt" aria-hidden="true"></i>
                                <span id="mgmtReportResolvedRange" class="report-dateline-range" aria-live="polite" aria-atomic="true"></span>
                                <span class="report-dateline-dot" aria-hidden="true">·</span>
                                <button type="button" class="report-custom-toggle" id="mgmtReportCustomToggle" aria-expanded="false" aria-controls="mgmtReportCustomDates"><i class="fas fa-pen" aria-hidden="true"></i> מותאם</button>
                            </div>
                            <div class="report-custom-dates" id="mgmtReportCustomDates">
                                <div class="report-field">
                                    <label for="mgmtReportStartDate">מתאריך</label>
                                    <input type="date" id="mgmtReportStartDate" class="form-input">
                                </div>
                                <div class="report-field">
                                    <label for="mgmtReportEndDate">עד תאריך</label>
                                    <input type="date" id="mgmtReportEndDate" class="form-input">
                                </div>
                            </div>
                        </div>

                        <div id="mgmtReportUnassignedNote" class="report-unassigned-note" hidden></div>

                        <div class="report-footer">
                            <div class="report-format-seg" role="radiogroup" aria-label="פורמט הדוח">
                                <label class="report-seg-option">
                                    <input type="radio" name="mgmtReportFormat" value="pdf" checked>
                                    <span>PDF</span>
                                </label>
                                <label class="report-seg-option">
                                    <input type="radio" name="mgmtReportFormat" value="excel">
                                    <span>Excel</span>
                                </label>
                            </div>
                            <div class="report-footer-actions">
                                <button type="button" class="btn-secondary" id="mgmtEmailReportBtn">
                                    <i class="fas fa-envelope"></i> הפק ושלח במייל
                                </button>
                                <button type="button" class="btn-primary" id="mgmtGenerateReportBtn">
                                    <i class="fas fa-clock"></i> הפק דוח
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
        }

        _populateRail() {
            const rail = this._root.querySelector('#mgmtReportRail');
            if (!rail) {
                return;
            }

            const model = (typeof window !== 'undefined') ? window.ServiceCardModel : null;
            const usc = (typeof window !== 'undefined') ? window.UnifiedServiceCard : null;
            if (!model || typeof model.build !== 'function' || !usc || typeof usc.buildRailRow !== 'function') {
                rail.insertAdjacentHTML('beforeend', '<div class="report-rail-empty">טעינת מנוע הכרטיסים נכשלה</div>');
                return;
            }

            const built = model.build(this._client, { getStageName });
            this._cards = (built && Array.isArray(built.cards)) ? built.cards : [];
            if (this._cards.length === 0) {
                rail.insertAdjacentHTML('beforeend', '<div class="report-rail-empty">אין שירותים להצגה</div>');
                return;
            }

            this._cards.forEach((card) => {
                const row = usc.buildRailRow(card, { role: 'radio', ariaControls: 'mgmtReportServiceDetail' });
                const onPick = () => this._selectService(card, row);
                row.addEventListener('click', onPick);
                row.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPick();
                    }
                });
                rail.appendChild(row);
            });
        }

        _selectService(card, row) {
            this._root.querySelectorAll('#mgmtReportRail .cm-rail-row').forEach((r) => {
                r.classList.remove('cm-rail-row--active');
                r.setAttribute('aria-checked', 'false');
            });
            row.classList.add('cm-rail-row--active');
            row.setAttribute('aria-checked', 'true');
            this._renderServiceDetail(card);
        }

        _renderServiceDetail(card) {
            const host = this._root.querySelector('#mgmtReportServiceDetail');
            if (!host) {
                return;
            }

            // Routing on the card's stored service-type. The card is the pure ServiceCardModel
            // view-model (not a raw service), and this branch drives layout only — the SSOT
            // service-type predicate is for classification, not this render fork.
            // eslint-disable-next-line no-restricted-syntax
            const isLegal = card.type === 'legal_procedure';

            if (isLegal) {
                const stages = Array.isArray(card.stages) ? card.stages : [];
                const selectable = stages.filter((s) => s.status === 'active' || s.status === 'completed');

                if (selectable.length === 0) {
                    // DA-2: no active/completed stage → carry stage:'' (validate-blocked), show a note.
                    this._selection = {
                        service: card.name || 'ללא שם',
                        serviceId: card.serviceId,
                        stage: '',
                        type: 'legal_procedure'
                    };
                    host.innerHTML =
                        identityBandHtml(card) +
                        '<div class="report-detail-note">אין שלב פעיל לבחירה בהליך זה.</div>';
                    return;
                }

                const preferred = selectable.find((s) => s.status === 'active') || selectable[0];
                this._setStageSelection(card, preferred);

                const rowsHtml = stages
                    .map((stage) => this._stageRowHtml(card, stage, stage.id === preferred.id))
                    .join('');
                host.innerHTML =
                    identityBandHtml(card) +
                    '<div class="report-detail-sub">בחר שלב לדוח</div>' +
                    '<div class="report-stage-list">' + rowsHtml + '</div>';

                host.querySelectorAll('.report-stage[data-stage-id]').forEach((el) => {
                    const stageId = el.getAttribute('data-stage-id');
                    const stage = stages.find((s) => s.id === stageId);
                    if (!stage) {
                        return;
                    }
                    const onPick = () => {
                        host.querySelectorAll('.report-stage').forEach((n) => {
                            n.classList.remove('report-stage--on');
                            if (n.getAttribute('role') === 'radio') {
                                n.setAttribute('aria-checked', 'false');
                            }
                        });
                        el.classList.add('report-stage--on');
                        el.setAttribute('aria-checked', 'true');
                        this._setStageSelection(card, stage);
                    };
                    el.addEventListener('click', onPick);
                    el.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onPick();
                        }
                    });
                });
                return;
            }

            // hours / fixed — one selectable unit, no stage.
            this._selection = {
                // byte-match the old buildReportSelectCards payload (service: card.name, no fallback):
                // ReportGenerator branches on `if (formData.service)`, so keep the value identical
                // (devils-advocate Attack-2). Display below uses a 'ללא שם' fallback; the payload does not.
                service: card.name,
                serviceId: card.serviceId,
                stage: '',
                type: card.type || 'hours'
            };
            if (card.isFixed) {
                host.innerHTML =
                    identityBandHtml(card) +
                    '<div class="report-detail-note">שירות במחיר קבוע — הדוח יכלול את כל השעות שנרשמו בטווח שנבחר.</div>';
            } else if (num(card.totalHours) > 0) {
                // hours with a real quota — the identity-band meter + stat replace the old verbose note.
                host.innerHTML = identityBandHtml(card);
            } else {
                // hours with no defined quota — no red "debt" bar; a neutral note instead (FIX 3).
                host.innerHTML =
                    identityBandHtml(card) +
                    '<div class="report-detail-note">ללא מכסת שעות מוגדרת.</div>';
            }
        }

        /**
         * CRUCIAL: `service` MUST be getStageName(stage.id) and `stage` the stage id — this is
         * what makes getFormData BYTE-MATCH the old flow (buildReportSelectCards set
         * selection.service = getStageName(stage.id)).
         */
        _setStageSelection(card, stage) {
            this._selection = {
                service: getStageName(stage.id),
                serviceId: card.serviceId,
                stage: stage.id,
                type: 'legal_procedure'
            };
        }

        _stageRowHtml(card, stage, isOn) {
            const locked = !(stage.status === 'active' || stage.status === 'completed');
            const classes = ['report-stage'];
            if (isOn && !locked) {
                classes.push('report-stage--on');
            }
            if (locked) {
                classes.push('report-stage--locked');
            }

            let statusHtml;
            if (stage.status === 'active') {
                statusHtml = '<span class="report-stage-status">פעיל</span>';
            } else if (stage.status === 'completed') {
                statusHtml = '<span class="report-stage-status">הושלם</span>';
            } else {
                statusHtml = '<span class="report-stage-status report-stage-status--locked">' +
                    '<i class="fas fa-lock report-stage-lock" aria-hidden="true"></i> ממתין</span>';
            }

            const attrs = locked
                ? ' aria-disabled="true"'
                : ' role="radio" tabindex="0" aria-checked="' + (isOn ? 'true' : 'false') + '" data-stage-id="' + esc(stage.id) + '"';

            return '<div class="' + classes.join(' ') + '"' + attrs + '>' +
                '<span class="report-stage-radio" aria-hidden="true"></span>' +
                '<span class="report-stage-name">' + esc(getStageName(stage.id)) + '</span>' +
                statusHtml +
                '<span class="report-stage-hours">' + num(stage.hoursUsed).toFixed(1) + ' / ' + num(stage.totalHours).toFixed(1) + '</span>' +
                '</div>';
        }

        _wireQuickDates() {
            const buttons = this._root.querySelectorAll('.btn-quick-date');
            buttons.forEach((btn) => {
                btn.addEventListener('click', () => this._setQuickDateRange(btn.getAttribute('data-range')));
            });
        }

        _wireDateInputs() {
            const start = this._root.querySelector('#mgmtReportStartDate');
            const end = this._root.querySelector('#mgmtReportEndDate');
            // A manual date edit = a custom range: drop the preset thumb + active chip, then
            // recompute the note (a window test depends on this) + the resolved caption.
            const onChange = () => {
                this._markCustomRange();
                this._renderUnassignedNote();
                this._updateResolvedCaption();
            };
            if (start) {
                start.addEventListener('change', onChange);
            }
            if (end) {
                end.addEventListener('change', onChange);
            }
        }

        // "מותאם" disclosure — reveals the (always-in-DOM) native date inputs.
        _wireCustomToggle() {
            const toggle = this._root ? this._root.querySelector('#mgmtReportCustomToggle') : null;
            const dates = this._root ? this._root.querySelector('#mgmtReportCustomDates') : null;
            if (!toggle || !dates) {
                return;
            }
            toggle.addEventListener('click', () => {
                const open = dates.classList.toggle('report-custom-dates--open');
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        }

        // A manual date edit is no longer a preset — hide the sliding thumb + clear the active chip
        // (and its aria-checked, so the radiogroup announces "no preset selected").
        _markCustomRange() {
            if (!this._root) {
                return;
            }
            const seg = this._root.querySelector('#mgmtReportPresetSeg');
            if (seg) {
                seg.classList.add('report-preset-seg--custom');
            }
            this._root.querySelectorAll('.btn-quick-date').forEach((btn) => {
                btn.classList.remove('active');
                if (btn.getAttribute('role') === 'radio') {
                    btn.setAttribute('aria-checked', 'false');
                }
            });
        }

        // Slide the thumb over the active preset using PHYSICAL offsets (offsetLeft is RTL-correct;
        // we set the physical `left`, never a logical inset). Retries via rAF ONLY while the seg is
        // laid-out + connected, capped at 5 attempts — so a closed/hidden modal (offsetWidth 0 forever,
        // or a disconnected panel after resize) can never busy-spin the rAF loop (FIX 1).
        _placePresetThumb(attempt) {
            const seg = this._root && this._root.querySelector('#mgmtReportPresetSeg');
            if (!seg || !seg.isConnected) {
                return;
            }
            const thumb = seg.querySelector('.report-preset-thumb');
            const active = seg.querySelector('.btn-quick-date.active');
            if (!thumb || !active) {
                return;
            }
            if (active.offsetWidth === 0) {
                const next = (attempt || 0) + 1;
                if (next <= 5 && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(() => this._placePresetThumb(next));
                }
                return;
            }
            thumb.style.left = active.offsetLeft + 'px';
            thumb.style.width = active.offsetWidth + 'px';
            seg.classList.remove('report-preset-seg--custom');
        }

        // Live caption of the resolved range (digits + constant month names only → no XSS surface).
        _updateResolvedCaption() {
            const el = this._root ? this._root.querySelector('#mgmtReportResolvedRange') : null;
            if (!el) {
                return;
            }
            const startInput = this._root.querySelector('#mgmtReportStartDate');
            const endInput = this._root.querySelector('#mgmtReportEndDate');
            const startVal = startInput ? startInput.value : '';
            const endVal = endInput ? endInput.value : '';
            el.innerHTML = 'מ־<b>' + fmtDateHebrew(startVal) + '</b> עד <b>' + fmtDateHebrew(endVal) + '</b>';
        }

        // ReportTab is a singleton — attach the resize listener once (re-place the thumb on resize).
        // The handler is a no-op while the tab isn't mounted/connected (modal closed), so a resize
        // never kicks off a thumb-reposition (and its rAF retry) against a detached panel (FIX 1).
        _bindResizeOnce() {
            if (this._resizeBound) {
                return;
            }
            if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
                window.addEventListener('resize', () => {
                    if (!this._root || !this._root.isConnected) {
                        return;
                    }
                    this._placePresetThumb();
                });
                this._resizeBound = true;
            }
        }

        _setQuickDateRange(range) {
            const now = new Date();
            let startDate;
            let endDate = now;

            switch (range) {
                case 'thisMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'lastMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    break;
                case 'last3Months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                    break;
                case 'thisYear':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                case 'all':
                default: {
                    const c = this._client || {};
                    startDate = (c.caseOpenDate && c.caseOpenDate.toDate && c.caseOpenDate.toDate())
                        || (c.createdAt && c.createdAt.toDate && c.createdAt.toDate())
                        || new Date(now.getFullYear() - 1, 0, 1);
                    endDate = now;
                    break;
                }
            }

            const startInput = this._root.querySelector('#mgmtReportStartDate');
            const endInput = this._root.querySelector('#mgmtReportEndDate');
            if (startInput) {
                startInput.value = fmtDateForInput(startDate);
            }
            if (endInput) {
                endInput.value = fmtDateForInput(endDate);
            }
            this._root.querySelectorAll('.btn-quick-date').forEach((btn) => {
                const on = btn.getAttribute('data-range') === range;
                btn.classList.toggle('active', on);
                // Mirror the stage-picker radio pattern — announce the selected preset to AT (FIX 5).
                if (btn.getAttribute('role') === 'radio') {
                    btn.setAttribute('aria-checked', on ? 'true' : 'false');
                }
            });
            this._renderUnassignedNote();
            this._placePresetThumb();
            this._updateResolvedCaption();
        }

        /**
         * Emit the report formData — BIT-IDENTICAL to ClientReportModal.getFormData():
         * { clientId, clientName, startDate, endDate, service, serviceId, stage, reportType, reportFormat }.
         * Reads are SCOPED to this tab's root (DA-1) and reportType is always 'hours' (matching the
         * old hidden input) to avoid a second name collision.
         */
        getFormData() {
            const root = this._root;
            const client = this._client || {};
            const sel = this._selection || { service: '', serviceId: '', stage: '', type: '' };
            const fmt = root ? root.querySelector('input[name="mgmtReportFormat"]:checked') : null;
            const startInput = root ? root.querySelector('#mgmtReportStartDate') : null;
            const endInput = root ? root.querySelector('#mgmtReportEndDate') : null;
            return {
                clientId: client.id,
                clientName: client.fullName,
                startDate: startInput ? startInput.value : undefined,
                endDate: endInput ? endInput.value : undefined,
                service: sel.service || '',
                serviceId: sel.serviceId || '',
                stage: sel.stage || '',
                reportType: 'hours',
                reportFormat: fmt ? fmt.value : 'pdf'
            };
        }

        _validateSelection() {
            const sel = this._selection;
            if (!sel || !sel.serviceId) {
                alert('נא לבחור שירות להפקת הדוח');
                return false;
            }
            // DA-2 belt: a legal_procedure must carry a concrete stage. This is a routing check
            // on the internal selection object (not a raw service), so the SSOT service-type
            // predicate does not apply here.
            // eslint-disable-next-line no-restricted-syntax
            if (sel.type === 'legal_procedure' && !sel.stage) {
                alert('נא לבחור שלב בהליך המשפטי');
                return false;
            }
            const start = this._root.querySelector('#mgmtReportStartDate');
            const end = this._root.querySelector('#mgmtReportEndDate');
            if (!start || !start.value || !end || !end.value) {
                alert('נא לבחור תקופת דיווח');
                return false;
            }
            return true;
        }

        _wireActions() {
            const genBtn = this._root.querySelector('#mgmtGenerateReportBtn');
            const emailBtn = this._root.querySelector('#mgmtEmailReportBtn');
            if (genBtn) {
                genBtn.addEventListener('click', () => this._generate());
            }
            if (emailBtn) {
                emailBtn.addEventListener('click', () => this._email());
            }
        }

        _generate() {
            if (!this._validateSelection()) {
                return;
            }
            if (!window.ReportPreview || typeof window.ReportPreview.showForFormData !== 'function') {
                alert('מערכת הדוחות לא נטענה');
                return;
            }
            window.ReportPreview.showForFormData(this.getFormData());
        }

        _email() {
            if (!this._validateSelection()) {
                return;
            }
            if (!window.ReportGenerator || typeof window.ReportGenerator.generateAndEmail !== 'function') {
                alert('מערכת הדוחות לא נטענה');
                return;
            }
            window.ReportGenerator.generateAndEmail(this.getFormData());
        }

        /**
         * "שעות ללא שיוך" — sum of timesheet minutes (in the current date range) whose entries
         * match NO service on the client. Returns hours (Number ≥ 0) or null when uncomputable
         * (no dataManager, no reader, throw, or non-array result) — NEVER a fake 0.
         */
        _computeUnassignedHours() {
            const dm = this._dataManager;
            const client = this._client;
            if (!dm || typeof dm.getClientTimesheetEntries !== 'function' || !client) {
                return null;
            }
            const startInput = this._root ? this._root.querySelector('#mgmtReportStartDate') : null;
            const endInput = this._root ? this._root.querySelector('#mgmtReportEndDate') : null;
            // LOCAL-midnight / LOCAL-end-of-day — byte-match the report's window so the note never
            // silently drops today's orphan hours (devils-advocate Attack-1).
            const start = parseLocalDate(startInput && startInput.value, false);
            const end = parseLocalDate(endInput && endInput.value, true);

            let entries;
            try {
                entries = dm.getClientTimesheetEntries(client.fullName, start, end) || [];
            } catch {
                return null;
            }
            if (!Array.isArray(entries)) {
                return null;
            }

            const services = Array.isArray(client.services) ? client.services : [];
            let sumMinutes = 0;
            entries.forEach((entry) => {
                if (!this._entryMatchesAnyService(entry, services)) {
                    sumMinutes += mins(entry);
                }
            });
            return sumMinutes / 60;
        }

        /**
         * An entry is ASSIGNED (true) if it matches ANY service (any status). "Unassigned" =
         * orphan hours matching no service. Mirrors ReportGenerator.collectReportData's
         * matchService (trimmed): serviceId / service-as-id / service-as-name / serviceName /
         * (legal) any stage id === entry.serviceId or entry.stage.
         */
        _entryMatchesAnyService(entry, services) {
            if (!entry) {
                return false;
            }
            const eServiceId = entry.serviceId;
            const eService = (entry.service || '').trim();
            const eServiceName = (entry.serviceName || '').trim();
            const eStage = entry.stage;

            for (let i = 0; i < services.length; i++) {
                const s = services[i] || {};
                const sName = (s.name || '').trim();
                if (eServiceId && eServiceId === s.id) {
                    return true;
                }
                if (eService && eService === s.id) {
                    return true;
                }
                if (eService && sName && eService === sName) {
                    return true;
                }
                if (eServiceName && sName && eServiceName === sName) {
                    return true;
                }
                if (Array.isArray(s.stages)) {
                    for (let j = 0; j < s.stages.length; j++) {
                        const st = s.stages[j] || {};
                        if (eServiceId && st.id === eServiceId) {
                            return true;
                        }
                        if (eStage && st.id === eStage) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        _renderUnassignedNote() {
            const note = this._root ? this._root.querySelector('#mgmtReportUnassignedNote') : null;
            if (!note) {
                return;
            }
            const hours = this._computeUnassignedHours();
            if (hours === null || !(hours > 0)) {
                note.hidden = true;
                note.innerHTML = '';
                return;
            }
            note.hidden = false;
            note.innerHTML = '<i class="fas fa-info-circle"></i> שעות ללא שיוך לשירות: <b>' +
                hours.toFixed(1) + '</b> — נרשמו בשעתון אך אינן משויכות לשירות.';
        }
    }

    if (typeof window !== 'undefined') {
        window.ReportTab = new ReportTab();
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ReportTab;
    }
})();
