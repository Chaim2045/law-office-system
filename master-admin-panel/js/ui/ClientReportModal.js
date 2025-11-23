/**
 * Client Report Modal
 * מודל הפקת דוח ללקוח
 *
 * נוצר: 23/11/2025
 * גרסה: 1.0.0
 * Phase: 5 - Clients Management
 *
 * תפקיד: טיפול בממשק הפקת דוחות ללקוח
 */

(function() {
    'use strict';

    /**
     * ClientReportModal Class
     * מודל דוח לקוח
     */
    class ClientReportModal {
        constructor() {
            this.dataManager = null;
            this.currentClient = null;

            // DOM Elements
            this.modal = null;
            this.reportClientName = null;
            this.reportClientDetails = null;
            this.reportForm = null;
            this.startDateInput = null;
            this.endDateInput = null;
            this.serviceFilter = null;
            this.quickDateButtons = null;

            this.isInitialized = false;
        }

        /**
         * Initialize Modal
         * אתחול המודל
         */
        init() {
            try {
                console.log('🎨 ClientReportModal: Initializing...');

                // Wait for Data Manager
                if (!window.ClientsDataManager) {
                    console.error('❌ ClientsDataManager not found');
                    return false;
                }

                this.dataManager = window.ClientsDataManager;

                // Get DOM elements
                this.getDOMElements();

                // Setup event listeners
                this.setupEventListeners();

                this.isInitialized = true;

                console.log('✅ ClientReportModal: Initialized successfully');

                return true;

            } catch (error) {
                console.error('❌ ClientReportModal: Initialization error:', error);
                return false;
            }
        }

        /**
         * Get DOM elements
         * קבלת אלמנטים מה-DOM
         */
        getDOMElements() {
            this.modal = document.getElementById('clientReportModal');
            this.reportClientName = document.getElementById('reportClientName');
            this.reportClientDetails = document.getElementById('reportClientDetails');
            this.reportForm = document.getElementById('reportForm');
            this.startDateInput = document.getElementById('reportStartDate');
            this.endDateInput = document.getElementById('reportEndDate');
            this.serviceFilter = document.getElementById('reportServiceFilter');
        }

        /**
         * Setup event listeners
         * הגדרת מאזיני אירועים
         */
        setupEventListeners() {
            // Close button
            const closeBtn = document.getElementById('closeReportModal');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.close());
            }

            // Cancel button
            const cancelBtn = document.getElementById('cancelReportBtn');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => this.close());
            }

            // Generate report button
            const generateBtn = document.getElementById('generateReportBtn');
            if (generateBtn) {
                generateBtn.addEventListener('click', () => this.generateReport());
            }

            // Email report button
            const emailBtn = document.getElementById('emailReportBtn');
            if (emailBtn) {
                emailBtn.addEventListener('click', () => this.generateAndEmailReport());
            }

            // Quick date buttons
            const quickButtons = document.querySelectorAll('.btn-quick-date');
            quickButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const range = e.target.getAttribute('data-range');
                    this.setQuickDateRange(range);
                });
            });

            // Close on background click
            if (this.modal) {
                this.modal.addEventListener('click', (e) => {
                    if (e.target === this.modal) {
                        this.close();
                    }
                });
            }

            // Prevent form submission
            if (this.reportForm) {
                this.reportForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                });
            }
        }

        /**
         * Open modal
         * פתיחת המודל
         */
        open(clientId) {
            if (!clientId) {
                console.error('❌ No client ID provided');
                return;
            }

            const client = this.dataManager.getClientById(clientId);
            if (!client) {
                console.error('❌ Client not found:', clientId);
                return;
            }

            this.currentClient = client;

            // Update client info
            this.updateClientInfo(client);

            // Populate services dropdown
            this.populateServicesDropdown(client);

            // Set default date range (this month)
            this.setQuickDateRange('thisMonth');

            // Show modal
            if (this.modal) {
                this.modal.style.display = 'flex';
            }

            console.log('📄 Opened report modal for:', client.fullName);
        }

        /**
         * Close modal
         * סגירת המודל
         */
        close() {
            if (this.modal) {
                this.modal.style.display = 'none';
            }

            this.currentClient = null;

            // Reset form
            if (this.reportForm) {
                this.reportForm.reset();
            }

            console.log('✖️ Closed report modal');
        }

        /**
         * Update client info
         * עדכון מידע לקוח
         */
        updateClientInfo(client) {
            if (this.reportClientName) {
                this.reportClientName.textContent = client.fullName;
            }

            if (this.reportClientDetails) {
                let details = `מספר תיק: ${client.caseNumber || '-'}`;

                if (client.type === 'hours') {
                    details += ` | שעות נותרות: ${client.hoursRemaining || 0} מתוך ${client.totalHours || 0}`;
                }

                this.reportClientDetails.textContent = details;
            }
        }

        /**
         * Populate services dropdown
         * מילוי רשימת שירותים
         */
        populateServicesDropdown(client) {
            if (!this.serviceFilter) return;

            // Clear existing options (except "all")
            this.serviceFilter.innerHTML = '<option value="all">כל השירותים</option>';

            if (!client.services || client.services.length === 0) {
                return;
            }

            // Add services
            client.services.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id || service.serviceName;
                option.textContent = service.serviceName;
                this.serviceFilter.appendChild(option);
            });
        }

        /**
         * Set quick date range
         * הגדרת טווח תאריכים מהיר
         */
        setQuickDateRange(range) {
            const now = new Date();
            let startDate, endDate;

            switch (range) {
                case 'thisMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = now;
                    break;

                case 'lastMonth':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                    break;

                case 'last3Months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                    endDate = now;
                    break;

                case 'thisYear':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = now;
                    break;

                case 'all':
                    // Set to client creation date or 1 year ago
                    const clientCreated = this.currentClient?.createdAt?.toDate?.() || new Date(now.getFullYear() - 1, 0, 1);
                    startDate = clientCreated;
                    endDate = now;
                    break;

                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = now;
            }

            // Set input values
            if (this.startDateInput) {
                this.startDateInput.value = this.formatDateForInput(startDate);
            }

            if (this.endDateInput) {
                this.endDateInput.value = this.formatDateForInput(endDate);
            }
        }

        /**
         * Format date for input
         * עיצוב תאריך לשדה קלט
         */
        formatDateForInput(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        /**
         * Get form data
         * קבלת נתוני הטופס
         */
        getFormData() {
            const reportType = document.querySelector('input[name="reportType"]:checked')?.value || 'full';
            const reportFormat = document.querySelector('input[name="reportFormat"]:checked')?.value || 'pdf';

            return {
                clientId: this.currentClient.id,
                clientName: this.currentClient.fullName,
                startDate: this.startDateInput?.value,
                endDate: this.endDateInput?.value,
                service: this.serviceFilter?.value || 'all',
                reportType,
                reportFormat
            };
        }

        /**
         * Validate form
         * אימות טופס
         */
        validateForm(formData) {
            if (!formData.startDate || !formData.endDate) {
                if (window.notify) {
                    window.notify.error('נא לבחור תקופה', 'שגיאה');
                } else {
                    alert('נא לבחור תקופה');
                }
                return false;
            }

            const start = new Date(formData.startDate);
            const end = new Date(formData.endDate);

            if (start > end) {
                if (window.notify) {
                    window.notify.error('תאריך התחלה חייב להיות לפני תאריך סיום', 'שגיאה');
                } else {
                    alert('תאריך התחלה חייב להיות לפני תאריך סיום');
                }
                return false;
            }

            return true;
        }

        /**
         * Generate report
         * הפקת דוח
         */
        async generateReport() {
            console.log('📄 Generating report...');

            const formData = this.getFormData();

            if (!this.validateForm(formData)) {
                return;
            }

            // Check if ReportGenerator exists
            if (!window.ReportGenerator) {
                console.error('❌ ReportGenerator not loaded');
                if (window.notify) {
                    window.notify.error('מערכת הדוחות לא נטענה', 'שגיאה');
                } else {
                    alert('מערכת הדוחות לא נטענה');
                }
                return;
            }

            try {
                // Show loading
                this.showLoading();

                // Generate report
                await window.ReportGenerator.generate(formData);

                // Close modal
                this.close();

                // Hide loading
                this.hideLoading();

                if (window.notify) {
                    window.notify.success('הדוח הופק בהצלחה', 'הצלחה');
                }

            } catch (error) {
                console.error('❌ Error generating report:', error);

                this.hideLoading();

                if (window.notify) {
                    window.notify.error('שגיאה בהפקת הדוח: ' + error.message, 'שגיאה');
                } else {
                    alert('שגיאה בהפקת הדוח');
                }
            }
        }

        /**
         * Generate and email report
         * הפקה ושליחת דוח במייל
         */
        async generateAndEmailReport() {
            console.log('📧 Generating and emailing report...');

            const formData = this.getFormData();

            if (!this.validateForm(formData)) {
                return;
            }

            // Check if ReportGenerator exists
            if (!window.ReportGenerator) {
                console.error('❌ ReportGenerator not loaded');
                if (window.notify) {
                    window.notify.error('מערכת הדוחות לא נטענה', 'שגיאה');
                } else {
                    alert('מערכת הדוחות לא נטענה');
                }
                return;
            }

            try {
                // Show loading
                this.showLoading();

                // Generate and email report
                await window.ReportGenerator.generateAndEmail(formData);

                // Close modal
                this.close();

                // Hide loading
                this.hideLoading();

                if (window.notify) {
                    window.notify.success('הדוח נשלח בהצלחה ללקוח', 'הצלחה');
                }

            } catch (error) {
                console.error('❌ Error emailing report:', error);

                this.hideLoading();

                if (window.notify) {
                    window.notify.error('שגיאה בשליחת הדוח: ' + error.message, 'שגיאה');
                } else {
                    alert('שגיאה בשליחת הדוח');
                }
            }
        }

        /**
         * Show loading
         * הצגת טעינה
         */
        showLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
            }
        }

        /**
         * Hide loading
         * הסתרת טעינה
         */
        hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
        }
    }

    // Create global instance
    const clientReportModal = new ClientReportModal();

    // Make available globally
    window.ClientReportModal = clientReportModal;

    // Export for ES6 modules (if needed)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = clientReportModal;
    }

})();
