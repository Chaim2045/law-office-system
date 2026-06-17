/**
 * SMS Management Component
 * ==========================
 * קומפוננטת ניהול הגדרות SMS
 *
 * @version 1.0.0
 * @created 2025-11-26
 * @author Law Office System
 */

(function() {
    'use strict';

    /**
     * SMSManagement Class
     * מנהל את ממשק ניהול ה-SMS
     */
    class SMSManagement {
        constructor() {
            this.employees = [];
            this.smsEnabled = false;
            this.modalId = null;
        }

        /**
         * פתיחת חלון ניהול SMS
         */
        open() {
            this.modalId = window.ModalManager.create({
                title: '📱 ניהול הגדרות SMS',
                content: this.renderContent(),
                footer: this.renderFooter(),
                size: 'large',
                onOpen: () => {
                    this.loadEmployeeData();
                    this.setupEventListeners();
                }
            });

            console.log('✅ SMS Management opened');
        }

        /**
         * רינדור תוכן החלון
         */
        renderContent() {
            return `
                <div class="sms-management-container">
                    <!-- סטטוס כללי -->
                    <div class="sms-status-card">
                        <div class="status-header">
                            <div class="status-icon">
                                <i class="fas fa-mobile-alt"></i>
                            </div>
                            <div class="status-info">
                                <h3>מערכת התחברות SMS</h3>
                                <p>ניהול מספרי טלפון ואימות SMS לעובדים</p>
                            </div>
                            <div class="status-toggle">
                                <label class="switch">
                                    <input type="checkbox" id="smsSystemToggle" ${this.smsEnabled ? 'checked' : ''}>
                                    <span class="slider round"></span>
                                </label>
                                <span class="toggle-label">${this.smsEnabled ? 'פעיל' : 'מושבת'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- סטטיסטיקות -->
                    <div class="sms-stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon blue">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-number" id="totalEmployees">0</div>
                                <div class="stat-label">סה"כ עובדים</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon green">
                                <i class="fas fa-phone-alt"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-number" id="withPhone">0</div>
                                <div class="stat-label">עם מספר טלפון</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon orange">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-number" id="withoutPhone">0</div>
                                <div class="stat-label">ללא מספר טלפון</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon purple">
                                <i class="fas fa-check-circle"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-number" id="verifiedPhone">0</div>
                                <div class="stat-label">מאומתים</div>
                            </div>
                        </div>
                    </div>

                    <!-- כלי עבודה -->
                    <div class="sms-tools-section">
                        <div class="section-header">
                            <h4><i class="fas fa-tools"></i> כלי עבודה</h4>
                        </div>
                        <div class="tools-grid">
                            <button class="tool-button" id="addPhoneNumbersBtn">
                                <i class="fas fa-plus-circle"></i>
                                <span>הוסף מספרים חסרים</span>
                            </button>
                            <button class="tool-button" id="testSMSBtn">
                                <i class="fas fa-vial"></i>
                                <span>בדיקת שליחת SMS</span>
                            </button>
                            <button class="tool-button" id="exportPhonesBtn">
                                <i class="fas fa-download"></i>
                                <span>ייצוא רשימת טלפונים</span>
                            </button>
                            <button class="tool-button" id="viewLogsBtn">
                                <i class="fas fa-history"></i>
                                <span>היסטוריית SMS</span>
                            </button>
                        </div>
                    </div>

                    <!-- טבלת עובדים -->
                    <div class="employees-phone-section">
                        <div class="section-header">
                            <h4><i class="fas fa-list"></i> רשימת עובדים ומספרי טלפון</h4>
                            <div class="search-box">
                                <i class="fas fa-search"></i>
                                <input type="text" id="phoneSearchInput" placeholder="חיפוש לפי שם או טלפון...">
                            </div>
                        </div>
                        <div class="table-wrapper">
                            <table class="employees-phone-table">
                                <thead>
                                    <tr>
                                        <th>שם</th>
                                        <th>אימייל</th>
                                        <th>מספר טלפון</th>
                                        <th>סטטוס</th>
                                        <th>פעולות</th>
                                    </tr>
                                </thead>
                                <tbody id="employeesPhoneList">
                                    <tr>
                                        <td colspan="5" class="loading-cell">
                                            <div class="spinner"></div>
                                            טוען נתונים...
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * רינדור כפתורי תחתית
         */
        renderFooter() {
            return `
                <button type="button" class="btn btn-secondary" id="smsManagementClose">
                    <i class="fas fa-times"></i>
                    <span>סגור</span>
                </button>
                <button type="button" class="btn btn-primary" id="savePhoneChanges">
                    <i class="fas fa-save"></i>
                    <span>שמור שינויים</span>
                </button>
            `;
        }

        /**
         * טעינת נתוני עובדים
         */
        async loadEmployeeData() {
            try {
                // בדוק אם Firebase זמין
                if (!window.firebase || !window.firebase.firestore) {
                    console.error('Firebase not available');
                    // נסה להשתמש ב-DataManager אם קיים
                    if (window.DataManager && window.DataManager.getUsers) {
                        const users = window.DataManager.getUsers();
                        this.employees = users.map(user => ({
                            id: user.email,
                            email: user.email,
                            name: user.displayName || user.username,
                            phone: user.phone,
                            phoneVerified: user.phoneVerified,
                            role: user.role
                        }));

                        this.updateStatistics();
                        this.renderEmployeesList();
                        console.log(`✅ Loaded ${this.employees.length} employees from DataManager`);
                        return;
                    }
                    throw new Error('Firebase not initialized');
                }

                const db = window.firebase.firestore();
                const snapshot = await db.collection('employees').get();

                this.employees = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    this.employees.push({
                        id: doc.id,
                        email: doc.id,
                        name: data.name || data.displayName || data.username,
                        phone: data.phone,
                        phoneVerified: data.phoneVerified,
                        role: data.role,
                        ...data
                    });
                });

                this.updateStatistics();
                this.renderEmployeesList();

                console.log(`✅ Loaded ${this.employees.length} employees from Firestore`);
            } catch (error) {
                console.error('❌ Error loading employees:', error);

                // נסיון אחרון - טען נתוני דמה לבדיקה
                this.employees = [];
                this.updateStatistics();
                this.renderEmployeesList();

                window.notify?.error?.('שגיאה בטעינת נתוני עובדים') ||
                    alert('שגיאה בטעינת נתוני עובדים');
            }
        }

        /**
         * עדכון סטטיסטיקות
         */
        updateStatistics() {
            const totalEmployees = this.employees.length;
            const withPhone = this.employees.filter(e => e.phone).length;
            const withoutPhone = totalEmployees - withPhone;
            const verifiedPhone = this.employees.filter(e => e.phone && e.phoneVerified).length;

            document.getElementById('totalEmployees').textContent = totalEmployees;
            document.getElementById('withPhone').textContent = withPhone;
            document.getElementById('withoutPhone').textContent = withoutPhone;
            document.getElementById('verifiedPhone').textContent = verifiedPhone;
        }

        /**
         * רינדור רשימת עובדים
         */
        renderEmployeesList() {
            const tbody = document.getElementById('employeesPhoneList');
            if (!tbody) {
return;
}

            if (this.employees.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="5" class="empty-cell">אין עובדים במערכת</td>
                    </tr>
                `;
                return;
            }

            tbody.innerHTML = this.employees.map(employee => {
                const hasPhone = !!employee.phone;
                const isVerified = employee.phoneVerified;

                return `
                    <tr data-employee-id="${employee.id}">
                        <td>
                            <div class="employee-name">
                                <i class="fas fa-user-circle"></i>
                                ${employee.name || employee.displayName || employee.username}
                            </div>
                        </td>
                        <td>
                            <div class="employee-email">${employee.email || employee.id}</div>
                        </td>
                        <td>
                            <input
                                type="tel"
                                class="phone-input-inline"
                                value="${employee.phone || ''}"
                                placeholder="הזן מספר טלפון"
                                data-employee-id="${employee.id}"
                            >
                        </td>
                        <td>
                            <div class="phone-status">
                                ${hasPhone ?
                                    (isVerified ?
                                        '<span class="badge badge-success"><i class="fas fa-check"></i> מאומת</span>' :
                                        '<span class="badge badge-warning"><i class="fas fa-clock"></i> ממתין לאימות</span>'
                                    ) :
                                    '<span class="badge badge-danger"><i class="fas fa-times"></i> חסר מספר</span>'
                                }
                            </div>
                        </td>
                        <td>
                            <div class="action-buttons">
                                ${hasPhone ? `
                                    <button class="btn-icon" title="שלח SMS בדיקה" onclick="window.SMSManagement.sendTestSMS('${employee.id}')">
                                        <i class="fas fa-paper-plane"></i>
                                    </button>
                                    ${!isVerified ? `
                                        <button class="btn-icon" title="אמת מספר" onclick="window.SMSManagement.verifyPhone('${employee.id}')">
                                            <i class="fas fa-check-circle"></i>
                                        </button>
                                    ` : ''}
                                ` : ''}
                                <button class="btn-icon" title="עריכת פרטים" onclick="window.UserForm.open(window.DataManager.getUserByEmail('${employee.id}'))">
                                    <i class="fas fa-edit"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        /**
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            const modal = window.ModalManager.getElement(this.modalId);
            if (!modal) {
return;
}

            // כפתור סגירה
            modal.querySelector('#smsManagementClose')?.addEventListener('click', () => {
                window.ModalManager.close(this.modalId);
            });

            // כפתור שמירה
            modal.querySelector('#savePhoneChanges')?.addEventListener('click', () => {
                this.savePhoneChanges();
            });

            // חיפוש
            modal.querySelector('#phoneSearchInput')?.addEventListener('input', (e) => {
                this.filterEmployees(e.target.value);
            });

            // כפתור הוספת מספרים
            modal.querySelector('#addPhoneNumbersBtn')?.addEventListener('click', () => {
                this.showAddPhonesDialog();
            });

            // כפתור בדיקת SMS
            modal.querySelector('#testSMSBtn')?.addEventListener('click', () => {
                this.showTestSMSDialog();
            });

            // כפתור ייצוא
            modal.querySelector('#exportPhonesBtn')?.addEventListener('click', () => {
                this.exportPhoneList();
            });

            // מתג הפעלה
            modal.querySelector('#smsSystemToggle')?.addEventListener('change', (e) => {
                this.toggleSMSSystem(e.target.checked);
            });
        }

        /**
         * שמירת שינויים במספרי טלפון
         */
        async savePhoneChanges() {
            const phoneInputs = document.querySelectorAll('.phone-input-inline');
            const updates = [];

            phoneInputs.forEach(input => {
                const employeeId = input.dataset.employeeId;
                const phoneValue = input.value.trim();
                const employee = this.employees.find(e => e.id === employeeId);

                if (employee && employee.phone !== phoneValue) {
                    updates.push({
                        id: employeeId,
                        phone: phoneValue ? this.formatPhoneNumber(phoneValue) : null
                    });
                }
            });

            if (updates.length === 0) {
                window.notify.info('אין שינויים לשמירה');
                return;
            }

            const loadingId = window.notify.loading(`שומר ${updates.length} שינויים...`);

            try {
                const db = firebase.firestore();
                const batch = db.batch();

                updates.forEach(update => {
                    const docRef = db.collection('employees').doc(update.id);
                    if (update.phone) {
                        batch.update(docRef, {
                            phone: update.phone,
                            phoneUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                            phoneVerified: false
                        });
                    } else {
                        batch.update(docRef, {
                            phone: firebase.firestore.FieldValue.delete(),
                            phoneVerified: firebase.firestore.FieldValue.delete()
                        });
                    }
                });

                await batch.commit();
                window.notify.hide(loadingId);
                window.notify.success('השינויים נשמרו בהצלחה');

                // רענון נתונים
                this.loadEmployeeData();

            } catch (error) {
                window.notify.hide(loadingId);
                console.error('❌ Error saving changes:', error);
                window.notify.error('שגיאה בשמירת השינויים');
            }
        }

        /**
         * פורמט מספר טלפון
         */
        formatPhoneNumber(phone) {
            let cleaned = phone.replace(/\D/g, '');

            if (cleaned.startsWith('0')) {
                cleaned = '972' + cleaned.substring(1);
            }

            if (!cleaned.startsWith('+')) {
                cleaned = '+' + cleaned;
            }

            return cleaned;
        }

        /**
         * סינון עובדים
         */
        filterEmployees(searchTerm) {
            const term = searchTerm.toLowerCase();
            const rows = document.querySelectorAll('#employeesPhoneList tr');

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(term) ? '' : 'none';
            });
        }

        /**
         * ייצוא רשימת טלפונים
         */
        exportPhoneList() {
            const data = this.employees.map(e => ({
                'שם': e.name || e.displayName || e.username,
                'אימייל': e.email || e.id,
                'טלפון': e.phone || '',
                'מאומת': e.phoneVerified ? 'כן' : 'לא'
            }));

            const csv = this.convertToCSV(data);
            this.downloadCSV(csv, 'employees_phones.csv');

            window.notify.success('הרשימה יוצאה בהצלחה');
        }

        /**
         * המרה ל-CSV
         */
        convertToCSV(data) {
            if (data.length === 0) {
return '';
}

            // OWASP CSV/Formula-Injection — every VALUE cell is neutralized via the
            // shared SSOT encoder window.CsvSafe.cell (prefixes a leading formula
            // trigger [= + - @ TAB CR LF] with ' then RFC-4180 quote-doubles; the
            // caller still wraps in "..."). The headers below are hardcoded Hebrew
            // literals from exportPhoneList (not user data) so they are left as-is.
            // Fail-closed: if js/core/csv-safe.js did not load, abort the export
            // rather than emit un-neutralized cells.
            if (!window.CsvSafe || typeof window.CsvSafe.cell !== 'function') {
                throw new Error('CsvSafe encoder not loaded — CSV export aborted (js/core/csv-safe.js must load first)');
            }

            const headers = Object.keys(data[0]);
            const csvHeaders = headers.join(',');

            const csvRows = data.map(row => {
                return headers.map(header => {
                    const value = row[header] || '';
                    return `"${window.CsvSafe.cell(value)}"`;
                }).join(',');
            });

            return '\ufeff' + csvHeaders + '\n' + csvRows.join('\n');
        }

        /**
         * הורדת קובץ CSV
         */
        downloadCSV(csv, filename) {
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
        }

        /**
         * שליחת SMS בדיקה
         */
        async sendTestSMS(employeeId) {
            const employee = this.employees.find(e => e.id === employeeId);
            if (!employee || !employee.phone) {
                window.notify.error('אין מספר טלפון לעובד זה');
                return;
            }

            const confirmed = await window.ModalHelpers.confirm({
                title: 'שליחת SMS בדיקה',
                message: `לשלוח SMS בדיקה ל-${employee.name}?<br>מספר: ${employee.phone}`,
                icon: 'mobile-alt',
                confirmText: 'שלח',
                confirmClass: 'btn-primary'
            });

            if (!confirmed) {
return;
}

            window.notify.info('שליחת SMS בדיקה תהיה זמינה בקרוב');
            // TODO: Implement SMS sending via Firebase Functions
        }

        /**
         * אימות מספר טלפון
         */
        async verifyPhone(employeeId) {
            const employee = this.employees.find(e => e.id === employeeId);
            if (!employee || !employee.phone) {
return;
}

            window.notify.info('אימות מספרי טלפון יהיה זמין בקרוב');
            // TODO: Implement phone verification
        }

        /**
         * הפעלה/כיבוי מערכת SMS
         */
        toggleSMSSystem(enabled) {
            this.smsEnabled = enabled;
            document.querySelector('.toggle-label').textContent = enabled ? 'פעיל' : 'מושבת';

            // TODO: Save to configuration
            window.notify.success(`מערכת SMS ${enabled ? 'הופעלה' : 'הושבתה'}`);
        }
    }

    // חשיפה גלובלית
    window.SMSManagement = new SMSManagement();

    console.log('✅ SMS Management component loaded');
})();