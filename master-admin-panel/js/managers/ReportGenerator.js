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
                pending: budgetTasks.filter(t => t.status === 'pending').length
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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
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
            padding-bottom: 15px;
            margin-bottom: 25px;
            border-bottom: 1px solid #e5e7eb;
        }

        .header-logo {
            text-align: right;
            margin-bottom: 10px;
        }

        .law-office-logo {
            max-width: 100px;
            max-height: 60px;
            object-fit: contain;
        }

        .header-content {
            margin-top: 5px;
        }

        .header h1 {
            font-size: 22px;
            color: #1877F2;
            margin-bottom: 3px;
        }

        .header h2 {
            font-size: 16px;
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
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .section-title i {
            color: #1877F2;
            font-size: 16px;
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
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
            justify-content: center;
        }

        .stat-card {
            background: linear-gradient(145deg, #ffffff 0%, #f9fafb 100%);
            border: none;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
            color: #1f2937;
            padding: 16px 24px;
            border-radius: 12px;
            text-align: center;
            min-width: 140px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(24, 119, 242, 0.12);
        }

        .stat-label {
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 6px;
            font-weight: 500;
        }

        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: #1877F2;
            letter-spacing: -0.5px;
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

        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-align: center;
        }

        .badge-primary {
            background-color: #dbeafe;
            color: #1e40af;
        }

        .badge-warning {
            background-color: #fef3c7;
            color: #92400e;
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

            .law-office-logo {
                max-width: 100px;
                max-height: 60px;
            }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <!-- Header -->
        <div class="header">
            <div class="header-logo">
                <img src="assets/logo.png" alt="משרד עו&quot;ד גיא הרשקוביץ" class="law-office-logo" onerror="this.parentElement.style.display='none'">
            </div>
            <div class="header-content">
                <h1>משרד עו"ד גיא הרשקוביץ</h1>
                <h2>דוח פעילות לקוח</h2>
            </div>
        </div>

        <!-- Client Info -->
        <div class="section">
            <h3 class="section-title"><i class="fas fa-folder-open"></i> פרטי התיק</h3>
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
        ${client.type === 'hours' || client.type === 'legal_procedure' || client.procedureType === 'legal_procedure' || formData.service ? `
        <div class="section">
            <h3 class="section-title"><i class="fas fa-clock"></i> מידע על ${formData.service === 'all' ? 'כל השירותים' : formData.service}</h3>
            <div class="info-grid">
                ${this.renderServiceInfo(client, formData)}
            </div>
        </div>
        ` : ''}

        <!-- Packages Breakdown (if applicable) -->
        ${this.renderPackagesBreakdown(client, formData)}

        <!-- By Employee -->
        ${stats.byEmployee.length > 0 ? `
        <div class="section">
            <h3 class="section-title"><i class="fas fa-users"></i> פירוט שעות לפי צוות משפטי</h3>
            <table>
                <thead>
                    <tr>
                        <th>צוות משפטי</th>
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
            <h3 class="section-title"><i class="fas fa-list-alt"></i> פירוט מלא של הפעילות</h3>
            ${timesheetEntries.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>תאריך</th>
                        <th>תיאור פעולה</th>
                        <th>צוות משפטי</th>
                        <th>דקות</th>
                        ${client.type === 'hours' || client.type === 'legal_procedure' || client.procedureType === 'legal_procedure' ? '<th>דקות מצטבר</th>' : ''}
                        ${client.type === 'hours' || client.type === 'legal_procedure' || client.procedureType === 'legal_procedure' ? '<th>דקות נותרות</th>' : ''}
                        ${client.type === 'hours' || client.type === 'legal_procedure' || client.procedureType === 'legal_procedure' ? '<th>שעות נותרות</th>' : ''}
                        <th>הערות</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.renderTimesheetRows(timesheetEntries, client, formData).join('')}
                </tbody>
            </table>
            ` : '<p>אין רשומות שעתון בתקופה זו</p>'}
        </div>
        ` : ''}

        <!-- By Service -->
        ${stats.byService.length > 0 ? `
        <div class="section">
            <h3 class="section-title"><i class="fas fa-box"></i> פירוט לפי שירות</h3>
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

        <!-- Final Summary Section -->
        ${this.renderFinalSummary(client, formData, timesheetEntries)}

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
         * Render service info section
         * רינדור מידע על השירות
         *
         * ════════════════════════════════════════════════════════════════
         * 🐛 BUG FIX: Report showing "0.0 hours" instead of actual hours
         * ════════════════════════════════════════════════════════════════
         *
         * PROBLEM:
         * - Code was searching for service using only `s.serviceName`
         * - But services use different field names:
         *   • Legal procedures: `displayName` (e.g., "הליך משפטי - שלב א'")
         *   • Hour packages: `name` or `serviceName`
         *   • Some use `stage` field for matching
         * - When not found, fallback used `client.totalHours` (0 for new arch)
         * - Result: Report showed "0.0 hours" for valid services
         *
         * FIX:
         * - Enhanced matching to check multiple field combinations:
         *   1. serviceName (original)
         *   2. name (common alternative)
         *   3. displayName (legal procedures)
         *   4. stage matching (legal procedures)
         * - Calculate hours from timesheet entries if service found
         * - Better fallback with detailed logging
         *
         * TESTED WITH: Client "Ori" (אורי) - legal procedure client
         * ════════════════════════════════════════════════════════════════
         */
        renderServiceInfo(client, formData) {
            let serviceTotalHours = 0;
            let serviceUsedHours = 0;
            let serviceRemainingHours = 0;
            let purchaseDate = '-';

            // Handle "all services" option (hour packages only)
            if (formData.service === 'all' || formData.service === 'כל השירותים') {
                // Sum all services
                if (client.services && client.services.length > 0) {
                    serviceTotalHours = client.services.reduce((sum, s) => sum + (s.totalHours || s.hours || 0), 0);
                    serviceUsedHours = client.services.reduce((sum, s) => sum + ((s.totalHours || s.hours || 0) - (s.hoursRemaining || s.remainingHours || 0)), 0);
                    serviceRemainingHours = client.services.reduce((sum, s) => sum + (s.hoursRemaining || s.remainingHours || 0), 0);
                } else {
                    serviceTotalHours = client.totalHours || 0;
                    serviceUsedHours = (client.totalHours || 0) - (client.hoursRemaining || 0);
                    serviceRemainingHours = client.hoursRemaining || 0;
                }
                purchaseDate = client.createdAt ? this.formatDate(client.createdAt.toDate()) : '-';
            }

            if (formData.service !== 'all' && formData.service !== 'כל השירותים') {
                // ═══ ENHANCED SERVICE MATCHING ═══
                // Try multiple field combinations to find the service
                // 🔍 CRITICAL: Check 'name' FIRST as it's the PRIMARY field in services array!
                const selectedService = client.services?.find(s => {
                    // Check name FIRST (this is the primary field!)
                    if (s.name === formData.service) {
return true;
}

                    // Check serviceName (alternative)
                    if (s.serviceName === formData.service) {
return true;
}

                    // Check displayName (legal procedures use this)
                    if (s.displayName === formData.service) {
return true;
}

                    // Check stage matching (for legal procedures)
                    // formData.service might be "הליך משפטי - שלב א'" and s.stage might be "stage_a"
                    if (s.stage && formData.service.includes(s.stage)) {
return true;
}

                    // Check reverse: if service displayName contains the stage identifier
                    if (s.displayName && s.displayName.includes(formData.service)) {
return true;
}

                    return false;
                });

                if (selectedService) {
                    console.log('✅ Found selected service:', {
                        serviceName: selectedService.serviceName || selectedService.name || selectedService.displayName,
                        totalHours: selectedService.totalHours || selectedService.hours,
                        remainingHours: selectedService.hoursRemaining || selectedService.remainingHours,
                        stage: selectedService.stage
                    });

                    // Get total hours with multiple field fallbacks
                    serviceTotalHours = selectedService.totalHours ||
                                      selectedService.hours ||
                                      selectedService.allocatedHours ||
                                      selectedService.stageHours || 0;

                    // Get remaining hours
                    serviceRemainingHours = selectedService.hoursRemaining ||
                                          selectedService.remainingHours || 0;

                    // Calculate used hours from total - remaining
                    serviceUsedHours = serviceTotalHours - serviceRemainingHours;

                    // Get purchase date
                    purchaseDate = selectedService.purchasedAt ?
                                 this.formatDate(selectedService.purchasedAt.toDate()) :
                                 (client.createdAt ? this.formatDate(client.createdAt.toDate()) : '-');
                } else {
                    // ═══ IMPROVED FALLBACK ═══
                    console.warn(`⚠️ Service "${formData.service}" not found in client.services`);
                    console.log('Available services:', client.services?.map(s => ({
                        serviceName: s.serviceName,
                        name: s.name,
                        displayName: s.displayName,
                        stage: s.stage
                    })));

                    // Try to calculate from timesheet entries for this specific service
                    if (this.dataManager) {
                        const timesheetEntries = this.dataManager.getClientTimesheetEntries(client.fullName);
                        const serviceEntries = timesheetEntries.filter(entry => {
                            // Match by service name
                            if (entry.serviceName === formData.service) {
return true;
}
                            if (entry.service === formData.service) {
return true;
}

                            // Match by serviceId (for legal procedures: "stage_a", "stage_b", etc.)
                            if (entry.serviceId === formData.service) {
return true;
}

                            // Match by stage display name (for legal procedures: "שלב א", "שלב ב", etc.)
                            if (entry.serviceId && formData.service) {
                                const stageMapping = {
                                    'stage_a': 'שלב א',
                                    'stage_b': 'שלב ב',
                                    'stage_c': 'שלב ג'
                                };
                                if (stageMapping[entry.serviceId] === formData.service) {
return true;
}
                            }

                            return false;
                        });

                        if (serviceEntries.length > 0) {
                            const totalMinutes = serviceEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);
                            serviceUsedHours = totalMinutes / 60;
                            console.log(`📊 Calculated ${serviceUsedHours.toFixed(2)} hours from ${serviceEntries.length} timesheet entries`);
                        }
                    }

                    // If still no data, use client totals as last resort
                    if (serviceUsedHours === 0) {
                        serviceTotalHours = client.totalHours || 0;
                        serviceUsedHours = (client.totalHours || 0) - (client.hoursRemaining || 0);
                        serviceRemainingHours = client.hoursRemaining || 0;
                    }

                    purchaseDate = client.createdAt ? this.formatDate(client.createdAt.toDate()) : '-';
                }
            }

            const usagePercentage = serviceTotalHours > 0 ? ((serviceUsedHours / serviceTotalHours) * 100).toFixed(1) : 0;
            const isCritical = serviceRemainingHours < serviceTotalHours * 0.2;
            const isBlocked = serviceRemainingHours <= 0;

            return `
                <div class="info-item">
                    <span class="info-label">שעות שנרכשו</span>
                    <span class="info-value">${serviceTotalHours.toFixed(1)} שעות</span>
                </div>
                <div class="info-item">
                    <span class="info-label">תאריך רכישה</span>
                    <span class="info-value">${purchaseDate}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">שעות שנוצלו (${usagePercentage}%)</span>
                    <span class="info-value">${serviceUsedHours.toFixed(1)} שעות</span>
                </div>
                <div class="info-item">
                    <span class="info-label">שעות נותרות</span>
                    <span class="info-value ${isCritical ? 'critical' : isBlocked ? 'danger' : 'success'}">
                        ${isBlocked ? '<i class="fas fa-exclamation-circle"></i> ' : isCritical ? '<i class="fas fa-exclamation-triangle"></i> ' : ''}${serviceRemainingHours.toFixed(1)} שעות
                    </span>
                </div>
            `;
        }

        /**
         * Render timesheet rows with running balance
         * רינדור שורות שעתון עם יתרה רצה
         */
        renderTimesheetRows(timesheetEntries, client, formData) {
            // Sort entries by date (oldest first)
            const sortedEntries = [...timesheetEntries].sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date);
                const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                return dateA - dateB;
            });

            // Calculate initial balance based on selected service
            // ═══ ENHANCED SERVICE MATCHING (same as renderServiceInfo) ═══
            let serviceTotalMinutes = 0;

            if (client.type === 'hours' || client.type === 'legal_procedure' || client.procedureType === 'legal_procedure') {
                if (formData.service === 'all') {
                    // If "all services" selected, sum up all service hours
                    if (client.services && client.services.length > 0) {
                        const totalHours = client.services.reduce((sum, s) => sum + (s.totalHours || s.hours || 0), 0);
                        serviceTotalMinutes = totalHours * 60;
                    } else {
                        serviceTotalMinutes = (client.totalHours || 0) * 60;
                    }
                } else {
                    // Find the specific service with enhanced matching
                    const selectedService = client.services?.find(s => {
                        // Check serviceName (original)
                        if (s.serviceName === formData.service) {
return true;
}

                        // Check name (common alternative)
                        if (s.name === formData.service) {
return true;
}

                        // Check displayName (legal procedures use this)
                        if (s.displayName === formData.service) {
return true;
}

                        // Check stage matching (for legal procedures)
                        if (s.stage && formData.service.includes(s.stage)) {
return true;
}

                        // Check reverse: if service displayName contains the stage identifier
                        if (s.displayName && s.displayName.includes(formData.service)) {
return true;
}

                        return false;
                    });

                    if (selectedService) {
                        const totalHours = selectedService.totalHours ||
                                         selectedService.hours ||
                                         selectedService.allocatedHours ||
                                         selectedService.stageHours || 0;
                        serviceTotalMinutes = totalHours * 60;
                    } else {
                        // Fallback: if service not found, use client's total hours
                        console.warn(`⚠️ Service "${formData.service}" not found for balance calculation. Using fallback.`);
                        serviceTotalMinutes = (client.totalHours || 0) * 60;
                    }
                }
            }

            let accumulatedMinutes = 0;

            return sortedEntries.map(entry => {
                const minutes = entry.minutes || 0;

                // Calculate accumulated minutes
                accumulatedMinutes += minutes;

                // Calculate remaining minutes and hours
                const remainingMinutes = serviceTotalMinutes - accumulatedMinutes;
                const remainingHours = remainingMinutes / 60;

                let balanceClass = '';
                if (client.type === 'hours' || client.type === 'legal_procedure' || client.procedureType === 'legal_procedure') {
                    if (remainingMinutes <= 0) {
                        balanceClass = 'danger';
                    } else if (remainingMinutes < serviceTotalMinutes * 0.2) {
                        balanceClass = 'critical';
                    } else {
                        balanceClass = 'success';
                    }
                }

                return `
                    <tr>
                        <td>${this.formatDate(entry.date)}</td>
                        <td>${entry.taskDescription || entry.description || '-'}</td>
                        <td>${this.dataManager.getEmployeeName(entry.employee)}</td>
                        <td class="highlight">${minutes}</td>
                        ${client.type === 'hours' || client.type === 'legal_procedure' || client.procedureType === 'legal_procedure' ? `<td>${accumulatedMinutes}</td>` : ''}
                        ${client.type === 'hours' || client.type === 'legal_procedure' || client.procedureType === 'legal_procedure' ? `<td class="${balanceClass}">${remainingMinutes}</td>` : ''}
                        ${client.type === 'hours' || client.type === 'legal_procedure' || client.procedureType === 'legal_procedure' ? `<td class="${balanceClass}">${remainingHours.toFixed(2)}</td>` : ''}
                        <td>${entry.notes || '-'}</td>
                    </tr>
                `;
            });
        }

        /**
         * Render final summary section
         * רינדור סיכום סופי של הדוח
         */
        renderFinalSummary(client, formData, timesheetEntries) {
            // Only show summary for hour-based services
            if (client.type !== 'hours' && client.type !== 'legal_procedure' && client.procedureType !== 'legal_procedure') {
                return '';
            }

            // Calculate service totals (same logic as renderServiceInfo)
            let serviceTotalHours = 0;
            let serviceUsedHours = 0;
            let serviceRemainingHours = 0;

            if (formData.service === 'all' || formData.service === 'כל השירותים') {
                if (client.services && client.services.length > 0) {
                    serviceTotalHours = client.services.reduce((sum, s) => sum + (s.totalHours || s.hours || 0), 0);
                    serviceUsedHours = client.services.reduce((sum, s) => sum + ((s.totalHours || s.hours || 0) - (s.hoursRemaining || s.remainingHours || 0)), 0);
                    serviceRemainingHours = client.services.reduce((sum, s) => sum + (s.hoursRemaining || s.remainingHours || 0), 0);
                } else {
                    serviceTotalHours = client.totalHours || 0;
                    serviceUsedHours = (client.totalHours || 0) - (client.hoursRemaining || 0);
                    serviceRemainingHours = client.hoursRemaining || 0;
                }
            } else {
                const selectedService = client.services?.find(s => {
                    if (s.name === formData.service) {
return true;
}
                    if (s.serviceName === formData.service) {
return true;
}
                    if (s.displayName === formData.service) {
return true;
}
                    if (s.stage && formData.service.includes(s.stage)) {
return true;
}
                    if (s.displayName && s.displayName.includes(formData.service)) {
return true;
}
                    return false;
                });

                if (selectedService) {
                    serviceTotalHours = selectedService.totalHours || selectedService.hours || selectedService.allocatedHours || selectedService.stageHours || 0;
                    serviceRemainingHours = selectedService.hoursRemaining || selectedService.remainingHours || 0;
                    serviceUsedHours = serviceTotalHours - serviceRemainingHours;
                } else {
                    serviceTotalHours = client.totalHours || 0;
                    serviceUsedHours = (client.totalHours || 0) - (client.hoursRemaining || 0);
                    serviceRemainingHours = client.hoursRemaining || 0;
                }
            }

            const hasOverdraft = serviceRemainingHours < 0;
            const overdraftAmount = Math.abs(serviceRemainingHours);
            const usagePercent = serviceTotalHours > 0 ? ((serviceUsedHours / serviceTotalHours) * 100).toFixed(1) : 0;

            return `
        <div class="section summary-section" style="background: linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%); border: 2px solid #e5e7eb; margin-top: 2rem;">
            <h3 class="section-title" style="color: #1877F2; border-bottom: 2px solid #1877F2; padding-bottom: 0.5rem;">
                <i class="fas fa-chart-line"></i> סיכום מצב תקציב
            </h3>

            <div class="info-grid" style="margin-bottom: 1.5rem;">
                <div class="info-item">
                    <span class="info-label" style="font-weight: 600;">תקציב מקורי</span>
                    <span class="info-value" style="font-size: 1.1rem; color: #059669;">${serviceTotalHours.toFixed(1)} שעות</span>
                </div>
                <div class="info-item">
                    <span class="info-label" style="font-weight: 600;">שעות שבוצעו</span>
                    <span class="info-value" style="font-size: 1.1rem; color: #1877F2;">${serviceUsedHours.toFixed(1)} שעות</span>
                </div>
                <div class="info-item">
                    <span class="info-label" style="font-weight: 600;">שיעור ניצול</span>
                    <span class="info-value" style="font-size: 1.1rem; color: ${hasOverdraft ? '#dc2626' : '#059669'};">${usagePercent}%</span>
                </div>
                <div class="info-item">
                    <span class="info-label" style="font-weight: 600;">יתרה נוכחית</span>
                    <span class="info-value ${hasOverdraft ? 'danger' : 'success'}" style="font-size: 1.1rem;">
                        ${hasOverdraft ? '<i class="fas fa-exclamation-circle"></i> ' : ''}${serviceRemainingHours.toFixed(1)} שעות
                    </span>
                </div>
            </div>

            ${hasOverdraft ? `
            <div style="background: linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(220, 38, 38, 0.08) 100%);
                        border: 2px solid #dc2626;
                        border-radius: 8px;
                        padding: 1.25rem;
                        margin-top: 1.5rem;
                        box-shadow: 0 2px 8px rgba(220, 38, 38, 0.1);">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.75rem;">
                    <i class="fas fa-exclamation-triangle" style="color: #dc2626; font-size: 1.5rem;"></i>
                    <h4 style="color: #991b1b; margin: 0; font-size: 1.1rem; font-weight: 700;">התראת חריגה</h4>
                </div>
                <p style="margin: 0.5rem 0; color: #7f1d1d; font-size: 1rem; line-height: 1.6;">
                    <strong>בוצעו ${overdraftAmount.toFixed(1)} שעות נוספות</strong> מעבר לתקציב המקורי של ${serviceTotalHours.toFixed(1)} שעות.
                </p>
                <p style="margin: 0.5rem 0 0 0; color: #7f1d1d; font-size: 0.95rem;">
                    סה"כ שעות שבוצעו: <strong>${serviceUsedHours.toFixed(1)} שעות</strong> (${usagePercent}% מהתקציב)
                </p>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(220, 38, 38, 0.3);">
                    <p style="margin: 0; color: #7f1d1d; font-size: 0.9rem; font-style: italic;">
                        💡 לשאלות או הבהרות בנוגע לחריגה, אנא פנו למשרד.
                    </p>
                </div>
            </div>
            ` : `
            <div style="background: linear-gradient(135deg, rgba(5, 150, 105, 0.12) 0%, rgba(5, 150, 105, 0.05) 100%);
                        border: 2px solid #059669;
                        border-radius: 8px;
                        padding: 1.25rem;
                        margin-top: 1.5rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <i class="fas fa-check-circle" style="color: #059669; font-size: 1.5rem;"></i>
                    <div>
                        <h4 style="color: #047857; margin: 0 0 0.25rem 0; font-size: 1.1rem; font-weight: 700;">מצב תקין</h4>
                        <p style="margin: 0; color: #065f46; font-size: 0.95rem;">
                            נותרו <strong>${serviceRemainingHours.toFixed(1)} שעות</strong> מתוך התקציב המקורי של ${serviceTotalHours.toFixed(1)} שעות
                        </p>
                    </div>
                </div>
            </div>
            `}

            <div style="margin-top: 1.5rem; padding: 1rem; background: #f8fafc; border-radius: 6px; border-right: 4px solid #1877F2;">
                <p style="margin: 0; color: #475569; font-size: 0.9rem; line-height: 1.6;">
                    <i class="fas fa-info-circle" style="color: #1877F2; margin-left: 0.5rem;"></i>
                    <strong>הערה:</strong> דוח זה מציג את הפעילות והשעות שבוצעו בתקופה הנבחרת.
                    לשאלות נוספות או הבהרות, אנא פנו למשרד.
                </p>
            </div>
        </div>
            `;
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
            if (!date) {
return '-';
}

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
            if (!date) {
return '-';
}

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
            if (!minutes) {
return '0:00';
}

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

        /**
         * Render packages breakdown for a stage
         * פירוט חבילות שעות לשלב
         */
        renderPackagesBreakdown(client, formData) {
            // Only show for legal procedures or hour packages
            if (formData.service === 'all' || formData.service === 'כל השירותים') {
                return ''; // Don't show packages breakdown for "all services"
            }

            // Find the service
            const service = client.services?.find(s => {
                return s.name === formData.service ||
                       s.serviceName === formData.service ||
                       s.displayName === formData.service;
            });

            if (!service) {
                return '';
            }

            // Parse date range from formData
            const startDate = formData.startDate ? new Date(formData.startDate) : null;
            const endDate = formData.endDate ? new Date(formData.endDate) : null;

            // Check if it's a legal procedure
            if (service.type === 'legal_procedure') {
                // Find the specific stage
                const stage = service.stages?.find(s => {
                    const stageName = s.name || s.id;
                    return formData.service.includes(stageName) ||
                           formData.service.includes(s.id);
                });

                if (!stage || !stage.packages || stage.packages.length === 0) {
                    return '';
                }

                // Filter packages by date range
                const filteredPackages = this.filterPackagesByDateRange(stage.packages, startDate, endDate);

                if (filteredPackages.length === 0) {
                    return ''; // No packages in this date range
                }

                return this.renderPackagesTable(filteredPackages, formData.service, startDate, endDate);
            }

            // For hour packages (non-legal procedures)
            if (service.packages && service.packages.length > 0) {
                // Filter packages by date range
                const filteredPackages = this.filterPackagesByDateRange(service.packages, startDate, endDate);

                if (filteredPackages.length === 0) {
                    return ''; // No packages in this date range
                }

                return this.renderPackagesTable(filteredPackages, formData.service, startDate, endDate);
            }

            return '';
        }

        /**
         * Filter packages by date range
         * סינון חבילות לפי טווח תאריכים
         */
        filterPackagesByDateRange(packages, startDate, endDate) {
            if (!packages || packages.length === 0) {
                return [];
            }

            // If no date range specified, return all packages
            if (!startDate && !endDate) {
                return packages;
            }

            return packages.filter(pkg => {
                // Get package purchase date
                const pkgDate = pkg.purchaseDate || pkg.createdAt;
                if (!pkgDate) {
                    return true; // Include packages without date (shouldn't happen)
                }

                const packageDate = new Date(pkgDate);

                // Check if package is within date range
                if (startDate && packageDate < startDate) {
                    return false; // Package is before start date
                }

                if (endDate && packageDate > endDate) {
                    return false; // Package is after end date
                }

                return true; // Package is within range
            });
        }

        /**
         * Render packages table HTML
         * יצירת טבלת חבילות
         */
        renderPackagesTable(packages, serviceName, startDate, endDate) {
            if (!packages || packages.length === 0) {
                return '';
            }

            // Calculate totals
            const totalHours = packages.reduce((sum, pkg) => sum + (pkg.hours || 0), 0);
            const totalUsed = packages.reduce((sum, pkg) => sum + (pkg.hoursUsed || 0), 0);
            const totalRemaining = packages.reduce((sum, pkg) => sum + (pkg.hoursRemaining || pkg.hours - (pkg.hoursUsed || 0)), 0);

            // Create date range subtitle
            let dateRangeText = '';
            if (startDate && endDate) {
                dateRangeText = `<small style="color: #6b7280; font-weight: 400;"> (חבילות שנרכשו בין ${this.formatDate(startDate)} - ${this.formatDate(endDate)})</small>`;
            } else if (startDate) {
                dateRangeText = `<small style="color: #6b7280; font-weight: 400;"> (חבילות שנרכשו מ-${this.formatDate(startDate)})</small>`;
            } else if (endDate) {
                dateRangeText = `<small style="color: #6b7280; font-weight: 400;"> (חבילות שנרכשו עד ${this.formatDate(endDate)})</small>`;
            }

            return `
        <div class="section" style="margin-top: 2rem;">
            <h3 class="section-title">
                <i class="fas fa-boxes"></i>
                פירוט חבילות שעות - ${serviceName}${dateRangeText}
            </h3>
            <table>
                <thead>
                    <tr>
                        <th>תאריך רכישה</th>
                        <th>סוג חבילה</th>
                        <th>שעות בחבילה</th>
                        <th>שעות שנוצלו</th>
                        <th>שעות נותרות</th>
                        <th>הערה</th>
                    </tr>
                </thead>
                <tbody>
                    ${packages.map(pkg => {
                        const pkgType = pkg.type === 'initial' || pkg.type === 'חבילה ראשונית' ? 'ראשונית' : 'נוספת';
                        const pkgHours = pkg.hours || 0;
                        const pkgUsed = pkg.hoursUsed || 0;
                        const pkgRemaining = pkg.hoursRemaining !== undefined ? pkg.hoursRemaining : (pkgHours - pkgUsed);
                        const pkgDate = pkg.purchaseDate || pkg.createdAt || '-';
                        const pkgDescription = pkg.description || pkg.reason || '-';

                        return `
                        <tr>
                            <td>${this.formatDate(pkgDate)}</td>
                            <td><span class="badge ${pkgType === 'ראשונית' ? 'badge-primary' : 'badge-warning'}">${pkgType}</span></td>
                            <td class="highlight">${pkgHours.toFixed(1)}</td>
                            <td>${pkgUsed.toFixed(1)}</td>
                            <td>${pkgRemaining.toFixed(1)}</td>
                            <td style="max-width: 200px; word-wrap: break-word;">${pkgDescription}</td>
                        </tr>
                        `;
                    }).join('')}

                    <tr class="summary-row" style="font-weight: bold; background-color: #f8f9fa; border-top: 2px solid #dee2e6;">
                        <td>סה"כ</td>
                        <td>${packages.length} חבילות</td>
                        <td class="highlight">${totalHours.toFixed(1)}</td>
                        <td>${totalUsed.toFixed(1)}</td>
                        <td>${totalRemaining.toFixed(1)}</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 1rem; padding: 0.75rem; background-color: #e3f2fd; border-right: 4px solid #1877F2; border-radius: 4px;">
                <p style="margin: 0; font-size: 0.9rem; color: #1976d2;">
                    <i class="fas fa-info-circle"></i>
                    <strong>הערה:</strong> חבילות נוספות נוצרות כאשר יש צורך בשעות נוספות מעבר לחבילה הראשונית.
                    ההערות מפרטות את הסיבה להוספת השעות.
                </p>
            </div>
        </div>
            `;
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
