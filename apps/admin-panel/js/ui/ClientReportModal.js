/**
 * ClientReportModal — U7 COMPATIBILITY SHIM
 * מודל הפקת דוח ללקוח — שכבת-תאימות (U7, delete-last)
 *
 * נוצר: 23/11/2025 · הומר ל-shim: 02/08/2026 (PR-U7)
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U7 (:361-374) + §6.6.
 *
 * ─── מה קרה כאן ─────────────────────────────────────────────────────────────
 * מודל הפקת-הדוח העצמאי פורש. U6 הפנה את כפתור "הפק דוח" החי אל לשונית-הדוח של
 * הכרטיס המאוחד (ClientManagementModal → ReportTab → ReportPreview), ו-U7 הסיר את
 * בלוק ה-DOM ‎#clientReportModal מ-clients.html. מה שנשאר כאן הוא shim דק שנשמר חי
 * אך ורק כי:
 *   • עמוד ה-Fluent הקפוא (clients-fluent.html, §6.6) עדיין טוען את הקובץ הזה
 *     וקורא ל-init()/open() — הוא אינו נמחק לעולם.
 *   • שני צרכנים חיים עדיין מגיעים אל window.ClientReportModal:
 *       – ReportGenerator.editTimesheetEntry → openEditTimesheetModal (delegate ל-ReportPreview)
 *       – ReportPreview.host() → showLoading/hideLoading/dataManager על לשונית-הדוח של U4.
 *
 * ─── מה נמחק (D1/D2 — נקודת-האל-חזור) ───────────────────────────────────────
 * כל הרנדרר המת שכתב-מחדש (recompute) נמחק סופית: בונה כרטיסי-השירות, אוסף נתוני-הטופס,
 * מפתוח ה-Map לפי מזהה-השלב המקומי (התנגשות D2), בלוק ה-timesheet-fallback שהמציא כרטיס-רפאים
 * חסר-שם (D1), ומסנן השלב-הפעיל. מסלול-הדוח האמיתי והתקין הוא לשונית-הדוח של הכרטיס המאוחד
 * (U4/ReportTab), שהרנדרר שלה הוא ServiceCardModel/UnifiedServiceCard — הוא אינו נושא את באגי D1/D2.
 *
 * window.ClientReportModal חייב להישאר ה-handle הגלובלי (ReportPreview.js:37 קורא אותו
 * חזרה דרך host()). אין לשנות-שם/למחוק את הגלובל.
 */
(function () {
    'use strict';

    class ClientReportModal {
        constructor() {
            // Shared data-manager that ReportPreview reads via host().dataManager on the
            // U4 report tab (editEntryFromPreview → dataManager.getEmployeeName). Resolved in init().
            this.dataManager = null;
            // The shim owns no modal, so currentClient stays null; renderTimesheetPreviewModal
            // reads host()?.currentClient defensively (optional-chained) as a name fallback.
            this.currentClient = null;
            // ReportPreview.openEditModal pushes its edit-modal cleanup handlers here (guarded
            // on its side); close() tears them down.
            this.eventListeners = [];
        }

        /**
         * No-op-safe init. MUST NOT throw even when #clientReportModal is absent — it was
         * removed from clients.html in U7 and never existed on the Fluent page. The shim wires
         * NO DOM (it owns no modal); it only resolves the shared dataManager that ReportPreview
         * reads via host() on the U4 report tab. Every lookup is guarded.
         */
        init() {
            try {
                this.dataManager = (typeof window !== 'undefined' && window.ClientsDataManager) || null;
                return true;
            } catch (error) {
                console.error('❌ ClientReportModal (shim) init error:', error);
                return false;
            }
        }

        /**
         * Route-or-notify (plan :364-366). On a page that has the unified modal (clients.html)
         * resolve the client and open its report tab; on the FROZEN Fluent page (no
         * ClientManagementModal) show a professional Hebrew notice instead — "לא גרוע מהיום":
         * the Fluent report modal was already an empty stub (§6.6). NEVER throws, NO English,
         * NO stack trace.
         */
        open(clientId) {
            const dm = (typeof window !== 'undefined'
                && ((window.ClientsTable && window.ClientsTable.dataManager) || window.ClientsDataManager))
                || this.dataManager;

            if (typeof window !== 'undefined' && window.ClientManagementModal
                && dm && typeof dm.getClientById === 'function') {
                const client = dm.getClientById(clientId);
                if (!client) {
                    this._notify('הלקוח לא נמצא', 'error');
                    return;
                }
                window.ClientManagementModal.open(client, dm, { initialTab: 'report' });
                return;
            }

            // Fluent page (no unified modal) — an orderly Hebrew message, not a dead stub.
            this._notify('הפקת דוח זמינה במסך ניהול הלקוחות', 'info');
        }

        /**
         * Delegate the edit-entry modal to ReportPreview (extracted in PR-U3). ReportGenerator
         * .editTimesheetEntry calls this on window.ClientReportModal on BOTH pages — keeping the
         * delegate preserves the edit-timesheet flow. Guarded if ReportPreview is missing.
         */
        openEditTimesheetModal(entryData) {
            if (typeof window !== 'undefined' && window.ReportPreview
                && typeof window.ReportPreview.openEditModal === 'function') {
                return window.ReportPreview.openEditModal(entryData);
            }
            console.error('❌ ReportPreview not loaded — cannot open edit modal');
            return undefined;
        }

        /**
         * Loading-overlay helpers. NOT part of the deleted renderer — they are still called by
         * ReportPreview via host() on the LIVE U4 report tab (showForFormData /
         * proceedToGenerateReport). Guarded #loadingOverlay lookup → no-op if the overlay is
         * absent (e.g. the Fluent page). The message argument is accepted for call-site
         * compatibility and intentionally ignored (parity with the pre-shim behavior).
         */
        showLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
            }
        }

        hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }

        /**
         * Tear-down. ReportPreview.proceedToGenerateReport calls host().close() (typeof-guarded)
         * after a successful generate on the U4 report tab, to release the edit-modal listeners
         * it registered on this.eventListeners. No modal DOM to hide (the block is gone) — this
         * only cleans listeners + resets state.
         */
        close() {
            this.currentClient = null;
            this.eventListeners.forEach(({ element, event, handler }) => {
                if (element && typeof element.removeEventListener === 'function') {
                    element.removeEventListener(event, handler);
                }
            });
            this.eventListeners = [];
        }

        /**
         * notify wrapper — prefers window.notify.{info|error}, falls back to .show, then alert.
         * Keeps every user-facing string Hebrew even when the notify manager is not loaded.
         */
        _notify(message, type) {
            const n = (typeof window !== 'undefined') ? window.notify : null;
            if (n && typeof n[type] === 'function') {
                n[type](message);
                return;
            }
            if (n && typeof n.show === 'function') {
                n.show({ type: type === 'error' ? 'error' : 'info', message: message });
                return;
            }
            if (typeof alert === 'function') {
                alert(message);
            }
        }
    }

    // Global handle — ReportPreview.js:37 reads window.ClientReportModal back via host().
    const clientReportModal = new ClientReportModal();
    if (typeof window !== 'undefined') {
        window.ClientReportModal = clientReportModal;
    }

    // Export for ES6 modules (if needed)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = clientReportModal;
    }
})();
