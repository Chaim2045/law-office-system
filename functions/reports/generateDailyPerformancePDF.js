/**
 * Generate Daily Performance PDF Report
 * יצירת דוח ביצועים יומי ב-PDF
 *
 * @description Cloud Function that generates a professional PDF report
 *              for daily employee performance using Puppeteer
 *
 * @version 1.0.0
 * @created 2025-12-15
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const puppeteer = require('puppeteer');

/**
 * Generate Daily Performance PDF
 *
 * @param {Object} data - Request data
 * @param {string} data.email - Employee email
 * @param {string} data.date - Date in YYYY-MM-DD format
 * @param {Object} context - Function context with auth
 * @returns {Object} - PDF as base64 string
 */
exports.generateDailyPerformancePDF = functions.https.onCall(async (data, context) => {
    // ==================== AUTHENTICATION ====================
    if (!context.auth) {
    throw new functions.https.HttpsError(
        'unauthenticated',
        'חובה להתחבר כדי לייצא דוח'
    );
    }

    // Check if user is master admin
    const callerEmail = context.auth.token.email;
    const callerDoc = await admin.firestore()
    .collection('employees')
    .doc(callerEmail)
    .get();

    const callerData = callerDoc.data();
    if (!callerData || callerData.role !== 'master-admin') {
    throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהל ראשי יכול לייצא דוחות'
    );
    }

    // ==================== VALIDATION ====================
    if (!data.email || !data.date) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'חובה לספק אימייל ותאריך'
        );
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.date)) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'פורמט תאריך לא תקין (נדרש: YYYY-MM-DD)'
        );
    }

    console.log('📊 Generating PDF report:', { email: data.email, date: data.date });

    // ==================== FETCH DATA ====================
    const db = admin.firestore();

    // Get employee data
    const employeeDoc = await db.collection('employees').doc(data.email).get();
    if (!employeeDoc.exists) {
        throw new functions.https.HttpsError(
            'not-found',
            'עובד לא נמצא'
        );
    }
    const employee = employeeDoc.data();

    // Get employee hours and tasks
    const hoursSnapshot = await db.collection('timesheet')
        .where('email', '==', data.email)
        .get();

    const tasksSnapshot = await db.collection('tasks')
        .where('assignedTo', '==', data.email)
        .get();

    const allHours = hoursSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const allTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter for selected date
    const selectedDate = new Date(data.date);
    const dateString = selectedDate.toISOString().split('T')[0];

    const dailyHours = allHours.filter(entry => {
        let entryDate = entry.date;
        if (entryDate?.toDate && typeof entryDate.toDate === 'function') {
            entryDate = entryDate.toDate();
        }
        const entryDateString = new Date(entryDate).toISOString().split('T')[0];
        return entryDateString === dateString;
    });

    const completedTasks = allTasks.filter(task => {
        if (task.status !== 'completed') return false;
        const completedDate = task.completedAt || task.updatedAt;
        if (!completedDate) return false;
        let taskDate = completedDate;
        if (taskDate?.toDate && typeof taskDate.toDate === 'function') {
            taskDate = taskDate.toDate();
        }
        const taskDateString = new Date(taskDate).toISOString().split('T')[0];
        return taskDateString === dateString;
    });

    // Calculate statistics
    const totalHours = dailyHours.reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
    const clientHours = dailyHours
        .filter(e => !e.isInternal)
        .reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
    const internalHours = dailyHours
        .filter(e => e.isInternal)
        .reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);
    const billableHours = dailyHours
        .filter(e => e.billable)
        .reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0);

    const dailyTarget = employee.dailyHoursTarget || 8.45;
    const quotaProgress = dailyTarget > 0 ? Math.round((totalHours / dailyTarget) * 100) : 0;

    // Client breakdown
    const clientBreakdown = {};
    dailyHours
        .filter(e => !e.isInternal)
        .forEach(entry => {
            const client = entry.clientName || 'לא ידוע';
            clientBreakdown[client] = (clientBreakdown[client] || 0) + (parseFloat(entry.hours) || 0);
        });

    // ==================== GENERATE HTML ====================
    const html = generateHTML({
        employee,
        date: data.date,
        dateFormatted: selectedDate.toLocaleDateString('he-IL', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        }),
        totalHours: Math.round(totalHours * 10) / 10,
        clientHours: Math.round(clientHours * 10) / 10,
        internalHours: Math.round(internalHours * 10) / 10,
        billableHours: Math.round(billableHours * 10) / 10,
        dailyTarget,
        quotaProgress,
        entriesCount: dailyHours.length,
        completedTasksCount: completedTasks.length,
        dailyHours,
        completedTasks,
        clientBreakdown
    });

    // ==================== GENERATE PDF ====================
    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            }
        });

        console.log('✅ PDF generated successfully');

        // Convert to base64
        const pdfBase64 = pdf.toString('base64');

        return {
            success: true,
            pdf: pdfBase64,
            filename: `דוח-ביצועים-${employee.displayName || employee.email}-${data.date}.pdf`
        };

    } catch (error) {
        console.error('❌ PDF generation failed:', error);
        throw new functions.https.HttpsError(
            'internal',
            `שגיאה ביצירת PDF: ${error.message}`
        );
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

/**
 * Generate HTML template for PDF
 * @param {Object} data - Report data
 * @returns {string} HTML string
 */
function generateHTML(data) {
    const {
    employee,
    dateFormatted,
    totalHours,
    clientHours,
    internalHours,
    billableHours,
    dailyTarget,
    quotaProgress,
    entriesCount,
    completedTasksCount,
    dailyHours,
    completedTasks,
    clientBreakdown
    } = data;

    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>דוח ביצועים יומי - ${employee.displayName || employee.email}</title>
    <style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        direction: rtl;
        background: #ffffff;
        color: #1a1a1a;
        line-height: 1.6;
    }

    .header {
        text-align: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 3px solid #2563eb;
    }

    .logo {
        width: 150px;
        height: auto;
        margin-bottom: 15px;
    }

    .office-name {
        font-size: 24px;
        font-weight: bold;
        color: #1e40af;
        margin-bottom: 5px;
    }

    .report-title {
        font-size: 28px;
        font-weight: bold;
        color: #1a1a1a;
        margin: 15px 0 10px 0;
    }

    .report-meta {
        font-size: 14px;
        color: #666;
    }

    .summary-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 15px;
        margin-bottom: 30px;
    }

    .summary-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
    }

    .summary-card.main-card {
        grid-column: 1 / -1;
        background: #eff6ff;
        border: 2px solid #2563eb;
    }

    .card-label {
        font-size: 11px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
        font-weight: 600;
    }

    .card-value {
        font-size: 36px;
        font-weight: bold;
        color: #1a1a1a;
        line-height: 1;
        margin-bottom: 10px;
    }

    .card-subtitle {
        font-size: 13px;
        color: #64748b;
    }

    .progress-bar {
        height: 8px;
        background: #e2e8f0;
        border-radius: 4px;
        overflow: hidden;
        margin: 10px 0;
    }

    .progress-fill {
        height: 100%;
        background: #2563eb;
        border-radius: 4px;
    }

    .section {
        margin-bottom: 30px;
    }

    .section-title {
        font-size: 16px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 15px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e2e8f0;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .hours-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
    }

    .hours-table th {
        background: #f1f5f9;
        padding: 12px 10px;
        text-align: right;
        font-size: 12px;
        font-weight: 600;
        color: #475569;
        border-bottom: 2px solid #cbd5e1;
    }

    .hours-table td {
        padding: 10px;
        border-bottom: 1px solid #e2e8f0;
        font-size: 13px;
        color: #334155;
    }

    .hours-table tr:hover {
        background: #f8fafc;
    }

    .client-badge {
        background: #dbeafe;
        color: #1e40af;
        padding: 3px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
    }

    .internal-badge {
        background: #f1f5f9;
        color: #475569;
        padding: 3px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
    }

    .task-item {
        padding: 12px;
        background: #f8fafc;
        border-right: 3px solid #22c55e;
        margin-bottom: 10px;
        border-radius: 4px;
    }

    .task-title {
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 5px;
    }

    .task-meta {
        font-size: 12px;
        color: #64748b;
    }

    .client-breakdown {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        margin-bottom: 20px;
    }

    .breakdown-item {
        background: #f8fafc;
        padding: 12px;
        border-radius: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .breakdown-client {
        font-weight: 600;
        color: #334155;
    }

    .breakdown-hours {
        font-size: 18px;
        font-weight: bold;
        color: #2563eb;
    }

    .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 2px solid #e2e8f0;
        text-align: center;
        font-size: 12px;
        color: #94a3b8;
    }

    .no-data {
        text-align: center;
        padding: 30px;
        color: #94a3b8;
        font-style: italic;
    }
    </style>
</head>
<body>
    <!-- Header -->
    <div class="header">
    <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjYwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iNjAiIGZpbGw9IiMyNTYzZWIiLz48dGV4dCB4PSI3NSIgeT0iMzUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyMCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtd2VpZ2h0PSJib2xkIj5MQVCKPC90ZXh0Pjwvc3ZnPg=="
         alt="לוגו משרד עו״ד" class="logo">
    <div class="office-name">משרד עו״ד גיא הרשקוביץ</div>
    <h1 class="report-title">דוח ביצועים יומי</h1>
    <div class="report-meta">
        עובד: <strong>${employee.displayName || employee.email}</strong><br>
        תאריך: <strong>${dateFormatted}</strong><br>
        נוצר: <strong>${new Date().toLocaleString('he-IL')}</strong>
    </div>
    </div>

    <!-- Summary Cards -->
    <div class="summary-grid">
    <div class="summary-card main-card">
        <div class="card-label">סה״כ שעות ביום</div>
        <div class="card-value">${totalHours}</div>
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(quotaProgress, 100)}%"></div>
        </div>
        <div class="card-subtitle">תקן יומי: ${dailyTarget} שעות (${quotaProgress}%)</div>
    </div>

    <div class="summary-card">
        <div class="card-label">שעות לקוחות</div>
        <div class="card-value">${clientHours}</div>
        <div class="card-subtitle">${entriesCount > 0 ? Math.round((clientHours / totalHours) * 100) : 0}% מסך השעות</div>
    </div>

    <div class="summary-card">
        <div class="card-label">שעות פנימיות</div>
        <div class="card-value">${internalHours}</div>
        <div class="card-subtitle">${entriesCount > 0 ? Math.round((internalHours / totalHours) * 100) : 0}% מסך השעות</div>
    </div>

    <div class="summary-card">
        <div class="card-label">שעות לחיוב</div>
        <div class="card-value">${billableHours}</div>
        <div class="card-subtitle">${completedTasksCount} משימות הושלמו</div>
    </div>
    </div>

    <!-- Client Breakdown -->
    ${Object.keys(clientBreakdown).length > 0 ? `
    <div class="section">
    <h2 class="section-title">פילוח לפי לקוחות</h2>
    <div class="client-breakdown">
        ${Object.entries(clientBreakdown).map(([client, hours]) => `
            <div class="breakdown-item">
                <span class="breakdown-client">${client}</span>
                <span class="breakdown-hours">${Math.round(hours * 10) / 10}</span>
            </div>
        `).join('')}
    </div>
    </div>
    ` : ''}

    <!-- Hours Breakdown -->
    ${dailyHours.length > 0 ? `
    <div class="section">
    <h2 class="section-title">פירוט שעות (${dailyHours.length} רשומות)</h2>
    <table class="hours-table">
        <thead>
            <tr>
                <th>שעה</th>
                <th>סוג</th>
                <th>לקוח/פרויקט</th>
                <th>תיאור</th>
                <th>שעות</th>
            </tr>
        </thead>
        <tbody>
            ${dailyHours.map(entry => {
                let entryDate = entry.date;
                if (entryDate?.toDate) entryDate = entryDate.toDate();
                const time = new Date(entryDate).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return `
                    <tr>
                        <td>${time}</td>
                        <td>
                            ${entry.isInternal
                                ? '<span class="internal-badge">פנימי</span>'
                                : '<span class="client-badge">לקוח</span>'}
                        </td>
                        <td><strong>${entry.clientName || entry.taskDescription || 'לא צוין'}</strong></td>
                        <td>${entry.taskDescription || entry.notes || '-'}</td>
                        <td><strong>${entry.hours}</strong></td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    </table>
    </div>
    ` : '<div class="no-data">לא נמצאו רשומות שעות ליום זה</div>'}

    <!-- Completed Tasks -->
    ${completedTasks.length > 0 ? `
    <div class="section">
    <h2 class="section-title">משימות שהושלמו (${completedTasks.length})</h2>
    ${completedTasks.map(task => `
        <div class="task-item">
            <div class="task-title">${task.title || 'ללא כותרת'}</div>
            <div class="task-meta">
                ${task.clientName ? `לקוח: ${task.clientName}` : ''}
                ${task.taskType ? ` • סוג: ${task.taskType}` : ''}
            </div>
        </div>
    `).join('')}
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
    <p>דוח זה נוצר באופן אוטומטי על ידי מערכת ניהול משרד עו״ד גיא הרשקוביץ</p>
    <p>© ${new Date().getFullYear()} כל הזכויות שמורות</p>
    </div>
</body>
</html>
    `;
}
