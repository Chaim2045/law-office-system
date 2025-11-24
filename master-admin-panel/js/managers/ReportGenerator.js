/**
 * Report Generator
 * מנגנון יצירת דוחות ללקוחות
 *
 * נוצר: 23/11/2025
 * גרסה: 1.0.0
 * Phase: 5 - Clients Management
 *
 * תפקיד: יצירת דוחות מפורטים ללקוחות בפורמטים שונים
 */

(function() {
    'use strict';

    /**
     * ReportGenerator Class
     * מחולל דוחות
     */
    class ReportGenerator {
        constructor() {
            this.dataManager = null;
        }

        /**
         * Generate report
         * הפקת דוח
         */
        async generate(formData) {
            console.log('📄 Generating report with data:', formData);

            if (!window.ClientsDataManager) {
                throw new Error('ClientsDataManager not found');
            }

            this.dataManager = window.ClientsDataManager;

            // Get client
            const client = this.dataManager.getClientById(formData.clientId);
            if (!client) {
                throw new Error('Client not found');
            }

            // Collect data for report
            const reportData = await this.collectReportData(client, formData);

            // Generate based on format
            switch (formData.reportFormat) {
                case 'html':
                    this.generateHTML(reportData);
                    break;

                case 'pdf':
                    await this.generatePDF(reportData);
                    break;

                case 'excel':
                    this.generateExcel(reportData);
                    break;

                default:
                    throw new Error('Unknown report format: ' + formData.reportFormat);
            }
        }

        /**
         * Collect report data
         * איסוף נתוני הדוח
         */
        async collectReportData(client, formData) {
            const startDate = new Date(formData.startDate);
            const endDate = new Date(formData.endDate);

            // Get timesheet entries
            let timesheetEntries = this.dataManager.getClientTimesheetEntries(
                client.fullName,
                startDate,
                endDate
            );

            // Get budget tasks
            let budgetTasks = this.dataManager.getClientBudgetTasks(
                client.fullName,
                startDate,
                endDate
            );

            // Filter by service if selected
            if (formData.service !== 'all') {
                timesheetEntries = timesheetEntries.filter(entry =>
                    entry.service === formData.service || entry.serviceName === formData.service
                );

                budgetTasks = budgetTasks.filter(task =>
                    task.service === formData.service || task.serviceName === formData.service
                );
            }

            // Calculate statistics
            const stats = this.calculateStatistics(client, timesheetEntries, budgetTasks);

            return {
                client,
                formData,
                timesheetEntries,
                budgetTasks,
                stats,
                generatedAt: new Date()
            };
        }

        /**
         * Calculate statistics
         * חישוב סטטיסטיקות
         */
        calculateStatistics(client, timesheetEntries, budgetTasks) {
            // Total minutes/hours
            const totalMinutes = timesheetEntries.reduce((sum, entry) => sum + (entry.minutes || 0), 0);
            const totalHours = totalMinutes / 60;

            // Group by employee
            const byEmployee = {};
            timesheetEntries.forEach(entry => {
                const employee = entry.employee || 'לא ידוע';
                if (!byEmployee[employee]) {
                    byEmployee[employee] = {
                        employee,
                        employeeName: this.dataManager.getEmployeeName(employee),
                        minutes: 0,
                        hours: 0,
                        entries: 0
                    };
                }
                byEmployee[employee].minutes += entry.minutes || 0;
                byEmployee[employee].hours = byEmployee[employee].minutes / 60;
                byEmployee[employee].entries++;
            });

            // Group by service
            const byService = {};
            timesheetEntries.forEach(entry => {
                const service = entry.serviceName || entry.service || 'לא מוגדר';
                if (!byService[service]) {
                    byService[service] = {
                        service,
                        minutes: 0,
                        hours: 0,
                        entries: 0
                    };
                }
                byService[service].minutes += entry.minutes || 0;
                byService[service].hours = byService[service].minutes / 60;
                byService[service].entries++;
            });

            // Tasks statistics
            const tasksStats = {
                total: budgetTasks.length,
                completed: budgetTasks.filter(t => t.status === 'completed').length,
                inProgress: budgetTasks.filter(t => t.status === 'in-progress').length,
                pending: budgetTasks.filter(t => t.status === 'pending').length,
            };

            return {
                totalMinutes,
                totalHours: parseFloat(totalHours.toFixed(2)),
                entriesCount: timesheetEntries.length,
                byEmployee: Object.values(byEmployee),
                byService: Object.values(byService),
                tasksStats
            };
        }

        /**
         * Generate HTML report
         * יצירת דוח HTML
         */
        generateHTML(reportData) {
            console.log('📄 Generating HTML report...');

            const html = this.buildHTMLContent(reportData);

            // Open in new window
            const newWindow = window.open('', '_blank');
            newWindow.document.write(html);
            newWindow.document.close();

            // Focus and print dialog
            newWindow.focus();
            setTimeout(() => {
                newWindow.print();
            }, 500);
        }

        /**
         * Build HTML content
         * בניית תוכן HTML
         */
        buildHTMLContent(reportData) {
            const { client, formData, timesheetEntries, budgetTasks, stats, generatedAt } = reportData;

            return `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>דוח פעילות ללקוח - ${client.fullName}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            direction: rtl;
            padding: 40px;
            background: #f9fafb;
        }

        .report-container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .header {
            text-align: center;
            border-bottom: 3px solid #1877F2;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }

        .header h1 {
            font-size: 24px;
            color: #1877F2;
            margin-bottom: 5px;
        }

        .header h2 {
            font-size: 18px;
            color: #6b7280;
            font-weight: normal;
        }

        .section {
            margin-bottom: 30px;
        }

        .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #1f2937;
            border-right: 4px solid #1877F2;
            padding-right: 10px;
            margin-bottom: 15px;
        }

        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            background: #f9fafb;
            padding: 20px;
            border-radius: 8px;
        }

        .info-item {
            display: flex;
            flex-direction: column;
        }

        .info-label {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 5px;
        }

        .info-value {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background: linear-gradient(135deg, #1877F2 0%, #0A66C2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
        }

        .stat-label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 5px;
        }

        .stat-value {
            font-size: 28px;
            font-weight: bold;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }

        th, td {
            padding: 12px;
            text-align: right;
            border-bottom: 1px solid #e5e7eb;
        }

        th {
            background: #f9fafb;
            font-weight: 600;
            color: #1f2937;
            font-size: 14px;
        }

        td {
            font-size: 14px;
            color: #1f2937;
        }

        tr:hover {
            background: #f9fafb;
        }

        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
        }

        .highlight {
            color: #1877F2;
            font-weight: 600;
        }

        .critical {
            color: #f59e0b;
            font-weight: 600;
        }

        .success {
            color: #059669;
            font-weight: 600;
        }

        .danger {
            color: #dc2626;
            font-weight: 600;
        }

        @media print {
            body {
                background: white;
                padding: 0;
            }

            .report-container {
                box-shadow: none;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <!-- Header -->
        <div class="header">
            <h1>משרד עו"ד גיא הרשקוביץ</h1>
            <h2>דוח פעילות לקוח</h2>
        </div>

        <!-- Client Info -->
        <div class="section">
            <h3 class="section-title">📋 פרטי התיק</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">שם הלקוח</span>
                    <span class="info-value">${client.fullName}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">מספר תיק</span>
                    <span class="info-value">${client.caseNumber || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">תקופת הדוח</span>
                    <span class="info-value">${this.formatDate(formData.startDate)} - ${this.formatDate(formData.endDate)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">תאריך הפקה</span>
                    <span class="info-value">${this.formatDate(generatedAt)}</span>
                </div>
            </div>
        </div>

        <!-- Hours Info (if applicable) -->
        ${client.type === 'hours' ? `
        <div class="section">
            <h3 class="section-title">💰 מידע על חבילת השעות</h3>
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">שעות שנרכשו</span>
                    <span class="info-value">${client.totalHours || 0} שעות</span>
                </div>
                <div class="info-item">
                    <span class="info-label">תאריך רכישה</span>
                    <span class="info-value">${client.createdAt ? this.formatDate(client.createdAt.toDate()) : '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">שעות שנוצלו עד כה</span>
                    <span class="info-value">${((client.totalHours || 0) - (client.hoursRemaining || 0)).toFixed(1)} שעות</span>
                </div>
                <div class="info-item">
                    <span class="info-label">שעות נותרות</span>
                    <span class="info-value ${client.isCritical ? 'critical' : client.isBlocked ? 'danger' : 'success'}">
                        ${client.hoursRemaining || 0} שעות
                        ${client.isBlocked ? '⚠️ (חסום)' : client.isCritical ? '⚠️ (קריטי)' : ''}
                    </span>
                </div>
            </div>
        </div>
        ` : ''}

        <!-- Activity Summary -->
        <div class="section">
            <h3 class="section-title">📊 סיכום פעילות בתקופה זו</h3>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-label">סה"כ שעות</div>
                    <div class="stat-value">${stats.totalHours}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">מספר רשומות</div>
                    <div class="stat-value">${stats.entriesCount}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">משימות הושלמו</div>
                    <div class="stat-value">${stats.tasksStats.completed}</div>
                </div>
            </div>
        </div>

        <!-- By Employee -->
        ${stats.byEmployee.length > 0 ? `
        <div class="section">
            <h3 class="section-title">📑 פירוט שעות לפי חבר צוות</h3>
            <table>
                <thead>
                    <tr>
                        <th>חבר צוות</th>
                        <th>שעות</th>
                        <th>רשומות</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.byEmployee.map(emp => `
                        <tr>
                            <td>${emp.employeeName}</td>
                            <td class="highlight">${emp.hours.toFixed(2)} שעות</td>
                            <td>${emp.entries}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- Timesheet Entries -->
        ${formData.reportType === 'full' || formData.reportType === 'hours' ? `
        <div class="section">
            <h3 class="section-title">📋 פירוט מלא של הפעילות</h3>
            ${timesheetEntries.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>תאריך רישום</th>
                        <th>צוות משפטי</th>
                        <th>תיאור העבודה</th>
                        <th>זמן לקח</th>
                        ${client.type === 'hours' ? '<th>יתרה נותרת</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${this.renderTimesheetRows(timesheetEntries, client).join('')}
                </tbody>
            </table>
            ` : '<p>אין רשומות שעתון בתקופה זו</p>'}
        </div>
        ` : ''}

        <!-- Budget Tasks -->
        ${formData.reportType === 'full' || formData.reportType === 'tasks' ? `
        <div class="section">
            <h3 class="section-title">✅ משימות</h3>
            ${budgetTasks.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>שם המשימה</th>
                        <th>סטטוס</th>
                        <th>זמן מתוכנן</th>
                        <th>זמן בפועל</th>
                        <th>תאריך יעד</th>
                    </tr>
                </thead>
                <tbody>
                    ${budgetTasks.map(task => `
                        <tr>
                            <td>${task.taskName || task.title || '-'}</td>
                            <td>${this.getTaskStatusText(task.status)}</td>
                            <td>${task.estimatedHours || 0} שעות</td>
                            <td class="highlight">${this.formatMinutes(task.actualMinutes || 0)}</td>
                            <td>${task.deadline ? this.formatDate(task.deadline) : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            ` : '<p>אין משימות בתקופה זו</p>'}
        </div>
        ` : ''}

        <!-- By Service -->
        ${stats.byService.length > 0 ? `
        <div class="section">
            <h3 class="section-title">📦 פירוט לפי שירות/חבילה</h3>
            <table>
                <thead>
                    <tr>
                        <th>שירות</th>
                        <th>שעות</th>
                        <th>רשומות</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.byService.map(service => `
                        <tr>
                            <td>${service.service}</td>
                            <td class="highlight">${service.hours.toFixed(2)} שעות</td>
                            <td>${service.entries}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
            <p>דוח זה הופק אוטומטית במערכת ניהול משרד עו"ד גיא הרשקוביץ</p>
            <p>תאריך הפקה: ${this.formatDateTime(generatedAt)}</p>
        </div>
    </div>
</body>
</html>
            `;
        }

        /**
         * Render timesheet rows with running balance
         * רינדור שורות שעתון עם יתרה רצה
         */
        renderTimesheetRows(timesheetEntries, client) {
            // Sort entries by date (oldest first)
            const sortedEntries = [...timesheetEntries].sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                return dateA - dateB;
            });

            // Track running balance if it's an hours-based client
            let currentBalance = client.type === 'hours' ? (client.totalHours || 0) : 0;

            return sortedEntries.map(entry => {
                const hoursUsed = (entry.minutes || 0) / 60;

                // Calculate balance AFTER this entry
                if (client.type === 'hours') {
                    currentBalance -= hoursUsed;
                }

                let balanceClass = '';
                if (client.type === 'hours') {
                    if (currentBalance <= 0) {
                        balanceClass = 'danger';
                    } else if (currentBalance < (client.totalHours || 0) * 0.2) {
                        balanceClass = 'critical';
                    } else {
                        balanceClass = 'success';
                    }
                }

                return `
                    <tr>
                        <td>${this.formatDate(entry.date)}</td>
                        <td>${this.dataManager.getEmployeeName(entry.employee)}</td>
                        <td>${entry.description || '-'}</td>
                        <td class="highlight">${this.formatMinutes(entry.minutes)}</td>
                        ${client.type === 'hours' ? `<td class="${balanceClass}">${currentBalance.toFixed(2)} שעות</td>` : ''}
                    </tr>
                `;
            });
        }

        /**
         * Generate PDF report
         * יצירת דוח PDF
         */
        async generatePDF(reportData) {
            console.log('📄 Generating PDF report...');

            // For now, generate HTML and let the user print to PDF
            // In the future, we can use a library like jsPDF or call a server-side API
            this.generateHTML(reportData);

            if (window.notify) {
                window.notify.info('נא להדפיס את הדף כ-PDF מתפריט ההדפסה', 'PDF');
            }
        }

        /**
         * Generate Excel report
         * יצירת דוח Excel
         */
        generateExcel(reportData) {
            console.log('📄 Generating Excel report...');

            const { client, timesheetEntries, budgetTasks, stats } = reportData;

            // Build CSV content
            let csv = '\uFEFF'; // BOM for Hebrew support

            // Header
            csv += `דוח פעילות ללקוח - ${client.fullName}\n`;
            csv += `מספר תיק: ${client.caseNumber || '-'}\n`;
            csv += `תקופה: ${this.formatDate(reportData.formData.startDate)} - ${this.formatDate(reportData.formData.endDate)}\n`;
            csv += '\n';

            // Summary
            csv += 'סיכום:\n';
            csv += `סה"כ שעות,${stats.totalHours}\n`;
            csv += `סה"כ רשומות,${stats.entriesCount}\n`;
            csv += '\n';

            // Timesheet entries
            csv += 'פירוט שעות:\n';
            csv += 'תאריך,חבר צוות,שירות,זמן (דקות),תיאור\n';
            timesheetEntries.forEach(entry => {
                csv += `"${this.formatDate(entry.date)}","${this.dataManager.getEmployeeName(entry.employee)}","${entry.serviceName || entry.service || '-'}","${entry.minutes}","${entry.description || ''}"\n`;
            });
            csv += '\n';

            // Budget tasks
            csv += 'משימות:\n';
            csv += 'שם המשימה,סטטוס,זמן מתוכנן (שעות),זמן בפועל (דקות),תאריך יעד\n';
            budgetTasks.forEach(task => {
                csv += `"${task.taskName || task.title}","${this.getTaskStatusText(task.status)}","${task.estimatedHours || 0}","${task.actualMinutes || 0}","${task.deadline ? this.formatDate(task.deadline) : '-'}"\n`;
            });

            // Download
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `client_report_${client.fullName}_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();

            if (window.notify) {
                window.notify.success('הקובץ הורד בהצלחה', 'ייצוא הצליח');
            }
        }

        /**
         * Generate and email report
         * יצירה ושליחת דוח במייל
         */
        async generateAndEmail(formData) {
            console.log('📧 Generating and emailing report...');

            // For now, just generate the report
            // In the future, implement email sending via Cloud Function
            await this.generate(formData);

            if (window.notify) {
                window.notify.info('שליחת דוחות במייל תתווסף בגרסה הבאה', 'בקרוב');
            }

            // TODO: Implement email sending
            // await this.sendEmail(client.email, reportHTML);
        }

        /**
         * Helper: Format date
         */
        formatDate(date) {
            if (!date) return '-';

            let d;
            if (date.toDate) {
                d = date.toDate();
            } else if (date instanceof Date) {
                d = date;
            } else if (typeof date === 'string') {
                d = new Date(date);
            } else {
                return '-';
            }

            return d.toLocaleDateString('he-IL');
        }

        /**
         * Helper: Format date and time
         */
        formatDateTime(date) {
            if (!date) return '-';

            let d;
            if (date.toDate) {
                d = date.toDate();
            } else if (date instanceof Date) {
                d = date;
            } else {
                d = new Date(date);
            }

            return d.toLocaleString('he-IL');
        }

        /**
         * Helper: Format minutes to hours:minutes
         */
        formatMinutes(minutes) {
            if (!minutes) return '0:00';

            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;

            return `${hours}:${String(mins).padStart(2, '0')}`;
        }

        /**
         * Helper: Get task status text
         */
        getTaskStatusText(status) {
            const statusMap = {
                'completed': 'הושלם',
                'in-progress': 'בביצוע',
                'pending': 'בהמתנה',
                'cancelled': 'בוטל'
            };

            return statusMap[status] || status || '-';
        }
    }

    // Create global instance
    const reportGenerator = new ReportGenerator();

    // Make available globally
    window.ReportGenerator = reportGenerator;

    // Export for ES6 modules (if needed)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = reportGenerator;
    }

})();
