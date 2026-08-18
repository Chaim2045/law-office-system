/**
 * ReportPreview — the timesheet preview + record-edit surface, extracted from
 * ClientReportModal (PR-U3 of the admin modal-unification).
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U3.
 *
 * The preview/edit cluster moved here (logic 1:1 — a few verbose console.logs were
 * trimmed; the updateTimesheetEntry payload is byte-identical) so U4's report tab can
 * reuse it without dragging the whole ClientReportModal along. State that was cluster-private
 * (`previewData`) now lives here; the shared bits that also serve the report modal's
 * OTHER flows (getFormData / validateForm / showLoading / hideLoading / currentClient /
 * dataManager / eventListeners) stay on the host and are reached via `host()`.
 * `window.ClientReportModal` keeps thin delegates (showTimesheetPreview /
 * openEditTimesheetModal / closePreview / proceedToGenerateReport) so the button
 * wiring, the ReportGenerator caller, and the in-preview onclicks keep resolving.
 *
 * Three declared changes fold into the move (Haim-approved "full package", 2026-08-02):
 *   1. z-index: the overlays move 10001/10002/10003 → 10600/10610/10620, above the
 *      unified modal (10200) + the status dialog (10500), so the preview renders in
 *      FRONT of the unified modal in U4.
 *   2. no close-then-reopen: showing the preview no longer calls host.close(), and
 *      closePreview only removes its overlay (revealing the still-open host modal). This
 *      also retires the ClientReportModal.js:1322 bug (reopen with currentClient=null).
 *   3. SEC-1 escape-at-sink: the two innerHTML sinks that were unescaped — the preview
 *      header clientName and the toast message (which carries a server error.message) —
 *      are now routed through the SSOT window.escapeHtml.
 *
 * The updateTimesheetEntry payload in saveTimesheetEdit is byte-identical to the pre-move
 * code (pinned by the U0 source-guard, now reading this file).
 */
(function () {
    'use strict';

    // The host report modal owns the form + shared helpers + currentClient/dataManager +
    // the eventListeners cleanup array. Reached lazily (both are load-time singletons).
    function host() {
        return window.ClientReportModal;
    }

    class ReportPreview {
        constructor() {
            // Cluster-private state: { reportData, formData }. Set when a preview renders,
            // read on proceed + on the post-save re-render. Never touched by the host.
            this.previewData = null;
        }

        /**
         * Read + validate the report form (host-owned), then open the preview.
         * The #generateReportBtn handler on ClientReportModal delegates here.
         */
        async showTimesheetPreview() {
            const h = host();
            const formData = h.getFormData();
            console.log('👁️ Showing timesheet preview...', formData);

            if (!h.validateForm(formData)) {
                console.log('❌ Form validation failed');
                return;
            }
            return this.showForFormData(formData);
        }

        /**
         * Fetch the report data for a known formData and render the preview overlay.
         * @param {Object} formData
         */
        async showForFormData(formData) {
            const h = host();
            try {
                h.showLoading('טוען נתונים...');

                const reportData = await window.ReportGenerator.fetchReportData(formData);

                h.hideLoading();

                if (!reportData || !reportData.timesheetEntries || reportData.timesheetEntries.length === 0) {
                    alert('לא נמצאו רשומות שעתון לתקופה זו');
                    return;
                }

                this.renderTimesheetPreviewModal(reportData, formData);

            } catch (error) {
                console.error('❌ Error showing preview:', error);
                h.hideLoading();
                alert('שגיאה בטעינת הנתונים: ' + error.message);
            }
        }

        /**
         * Render the right-side preview panel + entry rows.
         */
        renderTimesheetPreviewModal(reportData, formData) {
            const { client, timesheetEntries } = reportData;

            // Client name — support both `name` and `fullName`, then the host's currentClient.
            const h = host();
            const clientName = client?.name || client?.fullName
                || h?.currentClient?.name || h?.currentClient?.fullName || 'לקוח';

            // Store data for proceed + post-save re-render.
            this.previewData = { reportData, formData };

            // U3 fix #2: do NOT close the host report modal — the preview overlays it
            // (z-index 10600) and closePreview reveals it again.
            // U3 SEC-1: clientName is escaped at the sink (it reaches innerHTML below).
            const tableHTML = `
                <div class="modal-overlay modal-show" id="timesheetPreviewOverlay" style="display: flex; z-index: 10600; background: rgba(0,0,0,0.5);">
                    <div style="position: fixed; right: 0; top: 0; height: 100%; width: 600px; max-width: 90%; background: white; box-shadow: -2px 0 10px rgba(0,0,0,0.1); display: flex; flex-direction: column;">
                        <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid #e5e7eb; flex-shrink: 0;">
                            <h2 style="margin: 0; font-size: 1.25rem;"><i class="fas fa-list-alt"></i> תצוגה מקדימה - ${window.escapeHtml(clientName)}</h2>
                            <button class="close-btn" onclick="window.ReportPreview.closePreview()" style="position: absolute; left: 1rem; top: 1.5rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666;">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 1.5rem;">
                            <p style="margin-bottom: 1rem; color: #666; padding: 0.75rem; background: #f0f7ff; border-radius: 4px; border-right: 3px solid #1877F2;">
                                <i class="fas fa-info-circle"></i>
                                ניתן לערוך כל רשומה לפני הפקת הדוח הסופי
                            </p>
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                                        <th style="padding: 10px 8px; text-align: right; font-size: 0.85rem;">תאריך</th>
                                        <th style="padding: 10px 8px; text-align: right; font-size: 0.85rem;">תיאור</th>
                                        <th style="padding: 10px 8px; text-align: right; font-size: 0.85rem;">דקות</th>
                                        <th style="padding: 10px 8px; text-align: center; font-size: 0.85rem; width: 70px;">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody id="preview-tbody">
                                </tbody>
                            </table>
                        </div>
                        <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; gap: 1rem; flex-shrink: 0;">
                            <button class="btn btn-secondary" onclick="window.ReportPreview.closePreview()">
                                ביטול
                            </button>
                            <button class="btn btn-primary" onclick="window.ReportPreview.proceedToGenerateReport()">
                                <i class="fas fa-file-pdf"></i> המשך להפקת דוח
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', tableHTML);

            // Rows added via textContent (no XSS) — safe as before the move.
            const tbody = document.getElementById('preview-tbody');
            timesheetEntries.forEach((entry) => {
                const action = entry.action || entry.taskDescription || entry.description || '-';
                const minutes = entry.minutes || 0;

                const row = document.createElement('tr');
                row.style.borderBottom = '1px solid #e5e7eb';

                const dateCell = document.createElement('td');
                dateCell.style.cssText = 'padding: 10px 8px; font-size: 0.85rem;';
                dateCell.textContent = this.formatDate(entry.date);

                const actionCell = document.createElement('td');
                actionCell.style.cssText = 'padding: 10px 8px; font-size: 0.85rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                actionCell.textContent = action;
                actionCell.title = action;

                const minutesCell = document.createElement('td');
                minutesCell.style.cssText = 'padding: 10px 8px; font-size: 0.85rem;';
                minutesCell.textContent = String(minutes);

                const actionsCell = document.createElement('td');
                actionsCell.style.cssText = 'padding: 10px 8px; text-align: center;';

                const editBtn = document.createElement('button');
                editBtn.className = 'btn-edit-entry';
                editBtn.style.cssText = 'background: #1877F2; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.85rem;';
                editBtn.innerHTML = '<i class="fas fa-edit"></i>';
                editBtn.addEventListener('click', () => {
                    this.editEntryFromPreview(
                        entry.id,
                        entry.employee,
                        formData.clientId,
                        action,
                        entry.date,
                        minutes
                    );
                });

                actionsCell.appendChild(editBtn);
                row.appendChild(dateCell);
                row.appendChild(actionCell);
                row.appendChild(minutesCell);
                row.appendChild(actionsCell);

                tbody.appendChild(row);
            });
        }

        /**
         * Close the preview overlay. U3 fix #2: overlay-only — the host modal was never
         * closed when the preview opened, so there is nothing to reopen (retires the
         * pre-move :1322 reopen-with-currentClient=null bug).
         */
        closePreview() {
            const overlay = document.getElementById('timesheetPreviewOverlay');
            if (overlay) {
                overlay.remove();
            }
        }

        /**
         * Open the edit modal for one preview row.
         */
        editEntryFromPreview(entryId, employeeId, clientId, action, date, minutes) {
            const employeeName = host().dataManager.getEmployeeName(employeeId);

            this.openEditModal({
                id: entryId,
                employee: employeeId,
                employeeName: employeeName,
                clientId: clientId,
                action: action,
                date: this.formatDate(date),
                minutes: minutes
            });
        }

        /**
         * Proceed to generate the report from the stored previewData.
         */
        async proceedToGenerateReport() {
            if (!this.previewData || !this.previewData.formData) {
                alert('שגיאה: נתוני תצוגה מקדימה לא נמצאו');
                return;
            }

            const formData = this.previewData.formData;

            const previewOverlay = document.getElementById('timesheetPreviewOverlay');
            if (previewOverlay) {
                previewOverlay.remove();
            }

            if (!window.ReportGenerator) {
                alert('מערכת הדוחות לא נטענה');
                return;
            }

            const h = host();
            try {
                h.showLoading('מפיק דוח...');

                await window.ReportGenerator.generate(formData);

                h.hideLoading();

                // U3: close the host modal on SUCCESSFUL generate — restores the clean
                // pre-move end-state (fix#2 keeps the host open only WHILE the preview
                // overlays it; completing the report is the natural close point). On error
                // we fall through and leave the modal open for retry.
                if (typeof h.close === 'function') {
                    h.close();
                }

                if (window.notify) {
                    window.notify.success('הדוח הופק בהצלחה', 'הצלחה');
                }

            } catch (error) {
                console.error('❌ Error generating report:', error);
                h.hideLoading();
                alert('שגיאה בהפקת הדוח: ' + error.message);
            }
        }

        /**
         * Show save spinner on the edit-modal save button.
         */
        showSaveSpinner() {
            const btn = document.getElementById('saveTimesheetBtn');
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.7';
                btn.style.cursor = 'not-allowed';
                btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-left: 6px;"></i> שומר...';
            }
        }

        showSuccessToast(message) {
            this.showToast(message, 'success');
        }

        showErrorToast(message) {
            this.showToast(message, 'error');
        }

        showWarningToast(message) {
            this.showToast(message, 'warning');
        }

        /**
         * Fixed toast. U3 SEC-1: message is escaped at the sink (an error path passes a
         * server error.message straight into innerHTML). U3: z-index 10003 → 10620.
         */
        showToast(message, type = 'success') {
            const existingToast = document.getElementById('successToast');
            if (existingToast) {
                existingToast.remove();
            }

            let gradient, icon, duration;
            switch (type) {
                case 'success':
                    gradient = 'linear-gradient(to right, #10b981, #059669)';
                    icon = 'fa-check';
                    duration = 3000;
                    break;
                case 'error':
                    gradient = 'linear-gradient(to right, #ef4444, #dc2626)';
                    icon = 'fa-exclamation-triangle';
                    duration = 4000;
                    break;
                case 'warning':
                    gradient = 'linear-gradient(to right, #f59e0b, #d97706)';
                    icon = 'fa-exclamation-circle';
                    duration = 3500;
                    break;
                default:
                    gradient = 'linear-gradient(to right, #3b82f6, #2563eb)';
                    icon = 'fa-info-circle';
                    duration = 3000;
            }

            const toastHTML = `
                <div id="successToast" style="
                    position: fixed;
                    top: 24px;
                    right: 24px;
                    background: ${gradient};
                    color: white;
                    padding: 16px 20px;
                    border-radius: 12px;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 10px rgba(0, 0, 0, 0.1);
                    z-index: 10620;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    min-width: 280px;
                    max-width: 400px;
                    animation: slideInRight 0.3s ease-out;
                ">
                    <div style="
                        width: 32px;
                        height: 32px;
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    ">
                        <i class="fas ${icon}" style="font-size: 16px;"></i>
                    </div>
                    <span style="flex: 1;">${window.escapeHtml(message)}</span>
                </div>
                <style>
                    @keyframes slideInRight {
                        from {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                        to {
                            transform: translateX(0);
                            opacity: 1;
                        }
                    }
                    @keyframes slideOutRight {
                        from {
                            transform: translateX(0);
                            opacity: 1;
                        }
                        to {
                            transform: translateX(400px);
                            opacity: 0;
                        }
                    }
                </style>
            `;

            document.body.insertAdjacentHTML('beforeend', toastHTML);

            setTimeout(() => {
                const toast = document.getElementById('successToast');
                if (toast) {
                    toast.style.animation = 'slideOutRight 0.3s ease-in';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }

        /**
         * Open the edit-entry modal. U3: z-index 10002 → 10610. The disabled date/employee
         * inputs are escaped as before (window.escapeHtml, the SSOT). Cleanup handlers are
         * still pushed to the HOST's eventListeners so host.close() tears them down.
         */
        openEditModal(entryData) {
            const existingModal = document.getElementById('editTimesheetOverlay');
            if (existingModal) {
                existingModal.remove();
            }

            const modalHTML = `
                <div class="modal-overlay modal-show" id="editTimesheetOverlay" style="display: flex; z-index: 10610;">
                    <div class="modal-content" style="max-width: 520px; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);">
                        <div class="modal-header" style="border-bottom: 1px solid #e5e7eb; padding: 16px 20px; background: linear-gradient(to bottom, #ffffff, #f9fafb);">
                            <h2 style="font-size: 17px; font-weight: 600; color: #1f2937; margin: 0; display: flex; align-items: center; gap: 8px;">
                                <i class="fas fa-edit" style="color: #3b82f6; font-size: 16px;"></i>
                                עריכת רשומת שעתון
                            </h2>
                            <button class="close-btn" id="closeEditModalBtn" style="width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: #f3f4f6; border: none; cursor: pointer; transition: all 0.2s;">
                                <i class="fas fa-times" style="color: #6b7280; font-size: 14px;"></i>
                            </button>
                        </div>
                        <div class="modal-body" style="padding: 18px 20px 16px 20px; background: #ffffff;">
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                                <div class="form-group" style="margin: 0;">
                                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                        <i class="fas fa-calendar" style="color: #6b7280; width: 14px; font-size: 12px;"></i>
                                        תאריך
                                    </label>
                                    <input type="text" id="editEntryDate" value="${window.escapeHtml(entryData.date)}" disabled class="form-control" style="background: #f9fafb; color: #6b7280; cursor: not-allowed; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; font-size: 13px; width: 100%;">
                                </div>
                                <div class="form-group" style="margin: 0;">
                                    <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                        <i class="fas fa-user" style="color: #6b7280; width: 14px; font-size: 12px;"></i>
                                        עובד
                                    </label>
                                    <input type="text" id="editEntryEmployee" value="${window.escapeHtml(entryData.employeeName)}" disabled class="form-control" style="background: #f9fafb; color: #6b7280; cursor: not-allowed; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; font-size: 13px; width: 100%;">
                                </div>
                            </div>

                            <div class="form-group" style="margin-bottom: 12px;">
                                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                    <i class="fas fa-clock" style="color: #3b82f6; width: 14px; font-size: 12px;"></i>
                                    דקות
                                </label>
                                <input type="number" id="editEntryMinutes" value="${entryData.minutes}" class="form-control" min="1" style="border: 2px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; font-size: 14px; transition: all 0.2s; font-weight: 500; width: 120px;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';">
                            </div>

                            <div class="form-group" style="margin-bottom: 0;">
                                <label style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 6px;">
                                    <i class="fas fa-file-alt" style="color: #3b82f6; width: 14px; font-size: 12px;"></i>
                                    תיאור הפעולה
                                </label>
                                <textarea id="editEntryAction" class="form-control" rows="3" placeholder="תיאור הפעולה..." style="border: 2px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; font-size: 13px; line-height: 1.4; resize: vertical; height: 70px; max-height: 200px; transition: all 0.2s; font-family: inherit; width: 100%;" onfocus="this.style.borderColor='#3b82f6'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)';" onblur="this.style.borderColor='#e5e7eb'; this.style.boxShadow='none';"></textarea>
                            </div>
                        </div>
                        <div class="modal-footer" style="border-top: 1px solid #e5e7eb; padding: 14px 20px; background: #f9fafb; display: flex; gap: 10px; justify-content: flex-end;">
                            <button class="btn btn-secondary" id="cancelEditTimesheetBtn" style="padding: 8px 18px; border-radius: 6px; font-size: 13px; font-weight: 500; border: 1px solid #d1d5db; background: white; color: #374151; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#f3f4f6';" onmouseout="this.style.background='white';">
                                <i class="fas fa-times" style="margin-left: 6px; font-size: 12px;"></i>
                                ביטול
                            </button>
                            <button class="btn btn-primary" id="saveTimesheetBtn" style="padding: 8px 20px; border-radius: 6px; font-size: 13px; font-weight: 500; border: none; background: linear-gradient(to bottom, #3b82f6, #2563eb); color: white; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 8px rgba(59, 130, 246, 0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(59, 130, 246, 0.2)';">
                                <i class="fas fa-save" style="margin-left: 6px; font-size: 12px;"></i>
                                שמור שינויים
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHTML);

            const textarea = document.getElementById('editEntryAction');
            if (textarea) {
                textarea.value = entryData.action || '';
            }

            const closeModalBtn = document.getElementById('closeEditModalBtn');
            const cancelBtn = document.getElementById('cancelEditTimesheetBtn');
            const saveBtn = document.getElementById('saveTimesheetBtn');

            const closeHandler = () => {
                const modal = document.getElementById('editTimesheetOverlay');
                if (modal) {
                    modal.remove();
                }
            };

            const saveHandler = () => {
                this.saveTimesheetEdit(entryData.id, entryData.employee, entryData.clientId);
            };

            if (closeModalBtn) {
                closeModalBtn.addEventListener('click', closeHandler);
            }
            if (cancelBtn) {
                cancelBtn.addEventListener('click', closeHandler);
            }
            if (saveBtn) {
                saveBtn.addEventListener('click', saveHandler);
            }

            // Track for cleanup on the HOST's array (host.close() tears these down).
            const h = host();
            if (h && Array.isArray(h.eventListeners)) {
                h.eventListeners.push(
                    { element: closeModalBtn, event: 'click', handler: closeHandler },
                    { element: cancelBtn, event: 'click', handler: closeHandler },
                    { element: saveBtn, event: 'click', handler: saveHandler }
                );
            }
        }

        /**
         * Save the edited entry. The updateTimesheetEntry payload is byte-identical to the
         * pre-move code (pinned by the U0 source-guard, now reading this file).
         */
        async saveTimesheetEdit(entryId, employeeId, clientId) {
            try {
                const minutes = parseInt(document.getElementById('editEntryMinutes').value);
                const action = document.getElementById('editEntryAction').value.trim();

                if (!action || action.length < 3) {
                    this.showWarningToast('תיאור הפעולה חייב להכיל לפחות 3 תווים');
                    return;
                }

                if (!minutes || minutes < 1) {
                    this.showWarningToast('מספר דקות חייב להיות לפחות 1');
                    return;
                }

                this.showSaveSpinner();

                const entryDoc = await firebase.firestore()
                    .collection('timesheet_entries')
                    .doc(entryId)
                    .get();

                if (!entryDoc.exists) {
                    throw new Error('רשומת שעתון לא נמצאה');
                }

                const currentEntry = entryDoc.data();

                // Prepare edit history (without server timestamp - will be added by Cloud Function)
                const editHistory = currentEntry.editHistory || [];
                const newEdit = {
                    editedBy: firebase.auth().currentUser.uid,
                    editedAt: new Date().toISOString(), // Use ISO string instead of server timestamp
                    oldAction: currentEntry.action || currentEntry.taskDescription || currentEntry.description || '',
                    newAction: action,
                    oldMinutes: currentEntry.minutes,
                    newMinutes: minutes
                };
                editHistory.push(newEdit);

                // Call Cloud Function (server will calculate minutesDiff)
                const updateTimesheetEntry = firebase.functions().httpsCallable('updateTimesheetEntry');
                const result = await updateTimesheetEntry({
                    entryId: entryId,
                    date: currentEntry.date,
                    minutes: minutes,
                    // minutesDiff removed - server calculates it
                    action: action,
                    editHistory: editHistory,
                    taskId: currentEntry.taskId || null,
                    autoGenerated: currentEntry.autoGenerated || false,
                    clientId: currentEntry.clientId || clientId || null,
                    serviceId: currentEntry.serviceId || currentEntry.service || null
                });

                console.log('✅ Timesheet entry updated:', result.data);

                const editModal = document.getElementById('editTimesheetOverlay');
                if (editModal) {
                    editModal.remove();
                }

                this.showSuccessToast('השינויים נשמרו בהצלחה!');

                // Refresh preview if it's open.
                const previewOverlay = document.getElementById('timesheetPreviewOverlay');
                if (previewOverlay && this.previewData) {
                    setTimeout(async () => {
                        previewOverlay.remove();
                        try {
                            const reportData = await window.ReportGenerator.fetchReportData(this.previewData.formData);
                            this.renderTimesheetPreviewModal(reportData, this.previewData.formData);
                        } catch (error) {
                            console.error('❌ Error refreshing preview:', error);
                        }
                    }, 300);
                }

            } catch (error) {
                console.error('❌ Error saving timesheet edit:', error);

                const btn = document.getElementById('saveTimesheetBtn');
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                    btn.style.cursor = 'pointer';
                    btn.innerHTML = '<i class="fas fa-save" style="margin-left: 6px;"></i> שמור שינויים';
                }

                this.showErrorToast('שגיאה בשמירת השינויים: ' + error.message);
            }
        }

        /**
         * Format a Firestore Timestamp / string / Date → dd/mm/yyyy.
         */
        formatDate(date) {
            if (!date) {
                return '-';
            }

            if (date.toDate && typeof date.toDate === 'function') {
                date = date.toDate();
            }

            if (typeof date === 'string') {
                date = new Date(date);
            }

            if (date instanceof Date) {
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                return `${day}/${month}/${year}`;
            }

            return '-';
        }
    }

    if (typeof window !== 'undefined') {
        window.ReportPreview = new ReportPreview();
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = ReportPreview;
    }
})();
