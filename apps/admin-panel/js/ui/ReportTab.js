/**
 * ReportTab — the "הפקת דוח" tab inside the unified ClientManagementModal.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U4 (additive; the old
 * ClientReportModal stays the primary path until the U6 cutover).
 *
 * The tab renders the report form (dates + quick-dates + format) and the selectable
 * service cards (ServiceCardModel → UnifiedServiceCard, mode 'report-select'), holds the
 * selection state, and emits a formData object BIT-IDENTICAL to ClientReportModal.getFormData
 * so the report engine (ReportGenerator / ReportPreview) can't tell which surface produced it.
 *
 * DA-1 (radio-name collision): the format radios use `name="mgmtReportFormat"` and are read
 * SCOPED to this tab's root — never the global `input[name="reportFormat"]` the old modal owns.
 * DA-2 (empty-stage legal): a legal_procedure is only selectable via a specific stage
 * (UnifiedServiceCard never emits stage:'' for a legal service); this controller also refuses
 * to generate a legal selection with an empty stage as a belt-and-suspenders guard.
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

    class ReportTab {
        constructor() {
            this._root = null;
            this._client = null;
            this._selection = null; // { service, serviceId, stage, type }
        }

        /**
         * (Re)render the report tab into `root` for `client`. Idempotent — called on open
         * (and on first switch to the tab). Resets the selection state.
         */
        render(client, root) {
            if (!root) {
                return;
            }
            this._root = root;
            this._client = client || null;
            this._selection = null;

            root.innerHTML = this._formHtml();
            this._populateCards();
            this._wireQuickDates();
            this._wireActions();
            this._setQuickDateRange('all'); // default = full client history (caseOpenDate anchor)
        }

        _formHtml() {
            return `
                <div class="report-form report-form--tab">
                    <div class="form-section">
                        <h4><i class="fas fa-calendar-alt"></i> בחר תקופה</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="mgmtReportStartDate">מתאריך</label>
                                <input type="date" id="mgmtReportStartDate" class="form-input">
                            </div>
                            <div class="form-group">
                                <label for="mgmtReportEndDate">עד תאריך</label>
                                <input type="date" id="mgmtReportEndDate" class="form-input">
                            </div>
                        </div>
                        <div class="quick-dates">
                            <button type="button" class="btn-quick-date" data-range="thisMonth">החודש</button>
                            <button type="button" class="btn-quick-date" data-range="lastMonth">חודש שעבר</button>
                            <button type="button" class="btn-quick-date" data-range="last3Months">3 חודשים</button>
                            <button type="button" class="btn-quick-date" data-range="thisYear">השנה</button>
                            <button type="button" class="btn-quick-date" data-range="all">מההתחלה</button>
                        </div>
                    </div>

                    <div class="form-section">
                        <h4><i class="fas fa-briefcase"></i> בחר שירות <span style="color: var(--danger, #ef4444);">*</span></h4>
                        <div id="mgmtReportServiceCards"></div>
                        <small class="report-tab-hint"><i class="fas fa-info-circle"></i> לחץ על השירות הרצוי כדי לבחור אותו</small>
                    </div>

                    <div class="form-section">
                        <h4><i class="fas fa-file-download"></i> פורמט הדוח</h4>
                        <div class="radio-group">
                            <label class="radio-label">
                                <input type="radio" name="mgmtReportFormat" value="pdf" checked>
                                <span class="radio-custom"></span>
                                <span class="radio-text">PDF להדפסה</span>
                            </label>
                            <label class="radio-label">
                                <input type="radio" name="mgmtReportFormat" value="excel">
                                <span class="radio-custom"></span>
                                <span class="radio-text">Excel לעריכה</span>
                            </label>
                        </div>
                    </div>

                    <div class="report-tab-actions">
                        <button type="button" class="btn-primary" id="mgmtGenerateReportBtn">
                            <i class="fas fa-clock"></i> הפק דוח שעות
                        </button>
                        <button type="button" class="btn-primary" id="mgmtEmailReportBtn">
                            <i class="fas fa-envelope"></i> הפק ושלח במייל
                        </button>
                    </div>
                </div>`;
        }

        _populateCards() {
            const container = this._root.querySelector('#mgmtReportServiceCards');
            if (!container) {
                return;
            }
            container.innerHTML = '';

            const model = (typeof window !== 'undefined') ? window.ServiceCardModel : null;
            if (!model || typeof model.build !== 'function' || !window.UnifiedServiceCard) {
                container.innerHTML = '<div class="report-tab-empty">טעינת מנוע הכרטיסים נכשלה</div>';
                return;
            }

            const built = model.build(this._client, { getStageName });
            const cards = built && Array.isArray(built.cards) ? built.cards : [];
            if (cards.length === 0) {
                container.innerHTML = '<div class="report-tab-empty">אין שירותים להצגה</div>';
                return;
            }

            let selectableCount = 0;
            cards.forEach((card) => {
                const units = window.UnifiedServiceCard.buildReportSelectCards(card, { getStageName });
                units.forEach((unit) => {
                    container.appendChild(unit.el);
                    if (unit.selection) {
                        selectableCount++;
                        const sel = unit.selection;
                        const onPick = () => this._select(sel, unit.el);
                        unit.el.addEventListener('click', onPick);
                        unit.el.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onPick();
                            }
                        });
                    }
                });
            });

            if (selectableCount === 0) {
                container.insertAdjacentHTML('beforeend', '<div class="report-tab-empty">אין שירות שניתן לבחור להפקת דוח</div>');
            }
        }

        _select(selection, cardEl) {
            this._selection = selection;
            const cards = this._root.querySelectorAll('#mgmtReportServiceCards .report-service-card');
            cards.forEach((c) => {
                c.classList.remove('selected');
                if (c.getAttribute('role') === 'button') {
                    c.setAttribute('aria-pressed', 'false');
                }
            });
            cardEl.classList.add('selected');
            cardEl.setAttribute('aria-pressed', 'true');
        }

        _wireQuickDates() {
            const buttons = this._root.querySelectorAll('.btn-quick-date');
            buttons.forEach((btn) => {
                btn.addEventListener('click', () => this._setQuickDateRange(btn.getAttribute('data-range')));
            });
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
                btn.classList.toggle('active', btn.getAttribute('data-range') === range);
            });
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
    }

    if (typeof window !== 'undefined') {
        window.ReportTab = new ReportTab();
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ReportTab;
    }
})();
