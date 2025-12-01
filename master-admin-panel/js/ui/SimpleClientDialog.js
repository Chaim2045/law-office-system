/**
 * Simple Client Creation Dialog - Admin Panel
 * דיאלוג פשוט ליצירת לקוח - אדמין פאנל
 *
 * גרסה: 1.0.0
 * תכונות: טופס פשוט וישיר ללא תלויות
 */

(function() {
    'use strict';

    class SimpleClientDialog {
        constructor() {
            this.dialog = null;
            this.overlay = null;
        }

        /**
         * פתיחת הדיאלוג
         */
        open() {
            this.createDialog();
            this.show();
        }

        /**
         * יצירת הדיאלוג
         */
        createDialog() {
            // יצירת overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'simple-dialog-overlay';

            // יצירת dialog
            this.dialog = document.createElement('div');
            this.dialog.className = 'simple-dialog';
            this.dialog.innerHTML = `
                <div class="simple-dialog-header">
                    <h2>הוספת לקוח חדש</h2>
                    <button type="button" class="simple-dialog-close" id="simpleDialogClose">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="simple-dialog-body">
                    <form id="simpleClientForm">
                        <!-- שם מלא -->
                        <div class="form-group">
                            <label for="clientFullName">שם מלא <span class="required">*</span></label>
                            <input
                                type="text"
                                id="clientFullName"
                                name="fullName"
                                class="form-input"
                                required
                                placeholder="לדוגמה: ישראל ישראלי"
                            />
                        </div>

                        <!-- טלפון -->
                        <div class="form-group">
                            <label for="clientPhone">טלפון <span class="required">*</span></label>
                            <input
                                type="tel"
                                id="clientPhone"
                                name="phone"
                                class="form-input"
                                required
                                placeholder="לדוגמה: 050-1234567"
                            />
                        </div>

                        <!-- אימייל -->
                        <div class="form-group">
                            <label for="clientEmail">אימייל</label>
                            <input
                                type="email"
                                id="clientEmail"
                                name="email"
                                class="form-input"
                                placeholder="לדוגמה: client@example.com"
                            />
                        </div>

                        <!-- תעודת זהות -->
                        <div class="form-group">
                            <label for="clientIdNumber">תעודת זהות</label>
                            <input
                                type="text"
                                id="clientIdNumber"
                                name="idNumber"
                                class="form-input"
                                placeholder="לדוגמה: 123456789"
                            />
                        </div>

                        <!-- כתובת -->
                        <div class="form-group">
                            <label for="clientAddress">כתובת</label>
                            <input
                                type="text"
                                id="clientAddress"
                                name="address"
                                class="form-input"
                                placeholder="לדוגמה: רחוב הרצל 1, תל אביב"
                            />
                        </div>

                        <!-- הערות -->
                        <div class="form-group">
                            <label for="clientNotes">הערות</label>
                            <textarea
                                id="clientNotes"
                                name="notes"
                                class="form-input"
                                rows="3"
                                placeholder="הערות נוספות על הלקוח..."
                            ></textarea>
                        </div>

                        <!-- שגיאות -->
                        <div id="simpleDialogErrors" class="dialog-errors" style="display: none;"></div>
                    </form>
                </div>

                <div class="simple-dialog-footer">
                    <button type="button" class="btn btn-secondary" id="simpleDialogCancel">
                        ביטול
                    </button>
                    <button type="button" class="btn btn-primary" id="simpleDialogSubmit">
                        <i class="fas fa-save"></i>
                        שמור לקוח
                    </button>
                </div>
            `;

            // הוספה לדף
            document.body.appendChild(this.overlay);
            document.body.appendChild(this.dialog);

            // הוספת CSS
            this.injectStyles();

            // הוספת event listeners
            this.attachEventListeners();
        }

        /**
         * הצגת הדיאלוג
         */
        show() {
            setTimeout(() => {
                this.overlay.classList.add('active');
                this.dialog.classList.add('active');
            }, 10);
        }

        /**
         * סגירת הדיאלוג
         */
        close() {
            this.overlay.classList.remove('active');
            this.dialog.classList.remove('active');

            setTimeout(() => {
                if (this.overlay) this.overlay.remove();
                if (this.dialog) this.dialog.remove();
            }, 300);
        }

        /**
         * הוספת event listeners
         */
        attachEventListeners() {
            // כפתור סגירה
            document.getElementById('simpleDialogClose')?.addEventListener('click', () => {
                this.close();
            });

            // כפתור ביטול
            document.getElementById('simpleDialogCancel')?.addEventListener('click', () => {
                this.close();
            });

            // כפתור שמירה
            document.getElementById('simpleDialogSubmit')?.addEventListener('click', () => {
                this.handleSubmit();
            });

            // סגירה בלחיצה על overlay
            this.overlay?.addEventListener('click', () => {
                this.close();
            });

            // מניעת סגירה בלחיצה על הדיאלוג עצמו
            this.dialog?.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Enter בשדות = submit
            const form = document.getElementById('simpleClientForm');
            form?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.handleSubmit();
                }
            });
        }

        /**
         * ולידציה של הטופס
         */
        validate() {
            const fullName = document.getElementById('clientFullName').value.trim();
            const phone = document.getElementById('clientPhone').value.trim();
            const errors = [];

            if (!fullName) {
                errors.push('שם מלא הוא שדה חובה');
            }

            if (!phone) {
                errors.push('טלפון הוא שדה חובה');
            }

            return {
                isValid: errors.length === 0,
                errors: errors
            };
        }

        /**
         * הצגת שגיאות
         */
        showErrors(errors) {
            const errorsDiv = document.getElementById('simpleDialogErrors');
            if (!errorsDiv) return;

            errorsDiv.innerHTML = errors.map(error => `
                <div class="error-item">
                    <i class="fas fa-exclamation-circle"></i>
                    ${error}
                </div>
            `).join('');
            errorsDiv.style.display = 'block';
        }

        /**
         * הסתרת שגיאות
         */
        hideErrors() {
            const errorsDiv = document.getElementById('simpleDialogErrors');
            if (errorsDiv) {
                errorsDiv.style.display = 'none';
            }
        }

        /**
         * שמירת לקוח
         */
        async handleSubmit() {
            console.log('📝 Saving new client...');

            // הסתרת שגיאות קודמות
            this.hideErrors();

            // ולידציה
            const validation = this.validate();
            if (!validation.isValid) {
                this.showErrors(validation.errors);
                return;
            }

            // איסוף נתונים מהטופס
            const clientData = {
                fullName: document.getElementById('clientFullName').value.trim(),
                phone: document.getElementById('clientPhone').value.trim(),
                email: document.getElementById('clientEmail').value.trim() || '',
                idNumber: document.getElementById('clientIdNumber').value.trim() || '',
                address: document.getElementById('clientAddress').value.trim() || '',
                notes: document.getElementById('clientNotes').value.trim() || '',
                status: 'active',
                createdAt: new Date().toISOString(),
                createdBy: window.firebaseAuth?.currentUser?.email || 'admin'
            };

            // הצגת loading על הכפתור
            const submitBtn = document.getElementById('simpleDialogSubmit');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> שומר...';

            try {
                // יצירת מספר תיק אוטומטי
                const caseNumber = await this.generateCaseNumber();
                clientData.caseNumber = caseNumber;

                // שמירה ל-Firestore
                await window.firebaseDB.collection('clients').doc(caseNumber).set(clientData);

                console.log('✅ Client saved successfully:', caseNumber);

                // הצגת הודעת הצלחה
                if (window.NotificationSystem) {
                    window.NotificationSystem.success(`לקוח "${clientData.fullName}" נוסף בהצלחה!`);
                } else {
                    alert(`✅ לקוח "${clientData.fullName}" נוסף בהצלחה!`);
                }

                // סגירת הדיאלוג
                this.close();

                // רענון הטבלה (אם קיים)
                if (window.location.pathname.includes('clients.html')) {
                    setTimeout(() => {
                        window.location.reload();
                    }, 500);
                }

            } catch (error) {
                console.error('❌ Error saving client:', error);
                this.showErrors(['שגיאה בשמירת הלקוח: ' + error.message]);

                // החזרת הכפתור למצב רגיל
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        }

        /**
         * יצירת מספר תיק אוטומטי
         */
        async generateCaseNumber() {
            const year = new Date().getFullYear();

            // קבלת המספר האחרון
            const snapshot = await window.firebaseDB
                .collection('clients')
                .orderBy('createdAt', 'desc')
                .limit(1)
                .get();

            let nextNumber = 1;
            if (!snapshot.empty) {
                const lastCase = snapshot.docs[0].data();
                const lastNumber = parseInt(lastCase.caseNumber?.replace(/\D/g, '') || '0');
                nextNumber = lastNumber + 1;
            }

            return `${year}${String(nextNumber).padStart(4, '0')}`;
        }

        /**
         * הזרקת CSS
         */
        injectStyles() {
            if (document.getElementById('simpleDialogStyles')) return;

            const style = document.createElement('style');
            style.id = 'simpleDialogStyles';
            style.textContent = `
                .simple-dialog-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 9998;
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }

                .simple-dialog-overlay.active {
                    opacity: 1;
                }

                .simple-dialog {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) scale(0.9);
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    z-index: 9999;
                    width: 90%;
                    max-width: 600px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    opacity: 0;
                    transition: all 0.3s ease;
                }

                .simple-dialog.active {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }

                .simple-dialog-header {
                    padding: 24px;
                    border-bottom: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .simple-dialog-header h2 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1f2937;
                }

                .simple-dialog-close {
                    background: none;
                    border: none;
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #6b7280;
                    transition: all 0.2s;
                }

                .simple-dialog-close:hover {
                    background: #f3f4f6;
                    color: #1f2937;
                }

                .simple-dialog-body {
                    padding: 24px;
                    overflow-y: auto;
                    flex: 1;
                }

                .form-group {
                    margin-bottom: 20px;
                }

                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #374151;
                    font-size: 0.875rem;
                }

                .required {
                    color: #ef4444;
                }

                .form-input {
                    width: 100%;
                    padding: 12px 16px;
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    font-size: 1rem;
                    transition: all 0.2s;
                    font-family: inherit;
                }

                .form-input:focus {
                    outline: none;
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                }

                .dialog-errors {
                    background: #fef2f2;
                    border: 2px solid #ef4444;
                    border-radius: 8px;
                    padding: 16px;
                    margin-top: 20px;
                }

                .error-item {
                    color: #991b1b;
                    font-size: 0.875rem;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .error-item:last-child {
                    margin-bottom: 0;
                }

                .simple-dialog-footer {
                    padding: 20px 24px;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }

                .btn {
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 0.938rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .btn-secondary {
                    background: #f3f4f6;
                    color: #374151;
                }

                .btn-secondary:hover:not(:disabled) {
                    background: #e5e7eb;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                }

                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                }

                @media (max-width: 768px) {
                    .simple-dialog {
                        width: 95%;
                        max-height: 95vh;
                    }

                    .simple-dialog-header {
                        padding: 16px;
                    }

                    .simple-dialog-body {
                        padding: 16px;
                    }

                    .simple-dialog-footer {
                        padding: 16px;
                        flex-direction: column;
                    }

                    .btn {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `;

            document.head.appendChild(style);
        }
    }

    // Make available globally
    window.SimpleClientDialog = SimpleClientDialog;

    console.log('✅ SimpleClientDialog loaded');

})();
