/**
 * Function Monitor Dashboard - Visual UI
 * דשבורד ויזואלי למעקב אחר ביצועי המערכת
 *
 * @author Claude + Chaim
 * @version 1.0.0 - POC
 */

class FunctionMonitorDashboard {
  constructor(monitor) {
    this.monitor = monitor;
    this.isVisible = false;
    this.autoRefresh = null;
    this.refreshInterval = 2000; // 2 שניות
  }

  /**
   * יצירת ממשק הדשבורד
   */
  create() {
    // אם כבר קיים - לא ליצור שוב
    if (document.getElementById('function-monitor-dashboard')) {
      return;
    }

    const dashboard = document.createElement('div');
    dashboard.id = 'function-monitor-dashboard';
    dashboard.className = 'function-monitor-dashboard hidden';
    dashboard.innerHTML = this._getTemplate();

    document.body.appendChild(dashboard);

    // הוספת סגנון
    this._injectStyles();

    // אירועים
    this._attachEvents();

    console.log('📊 Dashboard created');
  }

  /**
   * תבנית HTML של הדשבורד
   */
  _getTemplate() {
    return `
      <div class="fm-container">
        <!-- Header -->
        <div class="fm-header">
          <div class="fm-title">
            <span class="fm-icon">🔍</span>
            <h2>Function Monitor</h2>
            <span class="fm-status" id="fm-status">●</span>
          </div>
          <div class="fm-actions">
            <button class="fm-btn fm-btn-refresh" id="fm-refresh" title="Refresh">
              🔄
            </button>
            <button class="fm-btn fm-btn-save" id="fm-save" title="Save to Firebase">
              💾
            </button>
            <button class="fm-btn fm-btn-clear" id="fm-clear" title="Clear Data">
              🧹
            </button>
            <button class="fm-btn fm-btn-close" id="fm-close" title="Close">
              ✕
            </button>
          </div>
        </div>

        <!-- Stats Summary -->
        <div class="fm-stats-grid" id="fm-stats-grid">
          <div class="fm-stat-card">
            <div class="fm-stat-icon">📞</div>
            <div class="fm-stat-value" id="fm-total-calls">0</div>
            <div class="fm-stat-label">Total Calls</div>
          </div>

          <div class="fm-stat-card fm-stat-error">
            <div class="fm-stat-icon">❌</div>
            <div class="fm-stat-value" id="fm-total-errors">0</div>
            <div class="fm-stat-label">Errors</div>
          </div>

          <div class="fm-stat-card">
            <div class="fm-stat-icon">⏱️</div>
            <div class="fm-stat-value" id="fm-avg-time">0ms</div>
            <div class="fm-stat-label">Avg Time</div>
          </div>

          <div class="fm-stat-card">
            <div class="fm-stat-icon">✅</div>
            <div class="fm-stat-value" id="fm-success-rate">100%</div>
            <div class="fm-stat-label">Success Rate</div>
          </div>
        </div>

        <!-- Alerts -->
        <div class="fm-alerts" id="fm-alerts"></div>

        <!-- Function Table -->
        <div class="fm-table-container">
          <h3>📋 Function Statistics</h3>
          <table class="fm-table" id="fm-table">
            <thead>
              <tr>
                <th>Function</th>
                <th>Calls</th>
                <th>Errors</th>
                <th>Avg Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="fm-table-body">
              <tr>
                <td colspan="5" class="fm-no-data">No data yet...</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Recent Errors -->
        <div class="fm-errors-container" id="fm-errors-container">
          <h3>🚨 Recent Errors</h3>
          <div class="fm-errors-list" id="fm-errors-list">
            <div class="fm-no-data">No errors yet</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * הוספת CSS
   */
  _injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .function-monitor-dashboard {
        position: fixed;
        top: 60px;
        right: 20px;
        width: 600px;
        max-height: 80vh;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        overflow: hidden;
        transition: all 0.3s ease;
      }

      .function-monitor-dashboard.hidden {
        transform: translateX(650px);
        opacity: 0;
        pointer-events: none;
      }

      .fm-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 80vh;
      }

      .fm-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .fm-title {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .fm-title h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }

      .fm-icon {
        font-size: 24px;
      }

      .fm-status {
        font-size: 20px;
        color: #4ade80;
        animation: pulse 2s infinite;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .fm-actions {
        display: flex;
        gap: 8px;
      }

      .fm-btn {
        background: rgba(255,255,255,0.2);
        border: none;
        border-radius: 6px;
        padding: 8px 12px;
        color: white;
        cursor: pointer;
        font-size: 16px;
        transition: background 0.2s;
      }

      .fm-btn:hover {
        background: rgba(255,255,255,0.3);
      }

      .fm-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        padding: 20px;
        background: #f8fafc;
      }

      .fm-stat-card {
        background: white;
        border-radius: 8px;
        padding: 16px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      }

      .fm-stat-error {
        background: #fef2f2;
      }

      .fm-stat-icon {
        font-size: 24px;
        margin-bottom: 8px;
      }

      .fm-stat-value {
        font-size: 24px;
        font-weight: 700;
        color: #1e293b;
        margin-bottom: 4px;
      }

      .fm-stat-label {
        font-size: 12px;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .fm-alerts {
        padding: 0 20px;
        max-height: 100px;
        overflow-y: auto;
      }

      .fm-alert {
        background: #fef3c7;
        border-left: 4px solid #f59e0b;
        padding: 12px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 13px;
      }

      .fm-alert-error {
        background: #fee2e2;
        border-left-color: #ef4444;
      }

      .fm-table-container {
        padding: 20px;
        overflow-y: auto;
        flex: 1;
      }

      .fm-table-container h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        color: #1e293b;
      }

      .fm-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      .fm-table th {
        background: #f1f5f9;
        padding: 10px;
        text-align: right;
        font-weight: 600;
        color: #475569;
        border-bottom: 2px solid #e2e8f0;
      }

      .fm-table td {
        padding: 10px;
        border-bottom: 1px solid #f1f5f9;
        text-align: right;
      }

      .fm-table tbody tr:hover {
        background: #f8fafc;
      }

      .fm-status-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
      }

      .fm-status-ok {
        background: #d1fae5;
        color: #065f46;
      }

      .fm-status-warning {
        background: #fef3c7;
        color: #92400e;
      }

      .fm-status-error {
        background: #fee2e2;
        color: #991b1b;
      }

      .fm-no-data {
        text-align: center;
        padding: 40px;
        color: #94a3b8;
        font-style: italic;
      }

      .fm-errors-container {
        padding: 0 20px 20px 20px;
        max-height: 200px;
      }

      .fm-errors-container h3 {
        margin: 0 0 12px 0;
        font-size: 16px;
        color: #1e293b;
      }

      .fm-errors-list {
        max-height: 150px;
        overflow-y: auto;
      }

      .fm-error-item {
        background: #fee2e2;
        border-left: 4px solid #ef4444;
        padding: 10px;
        margin-bottom: 8px;
        border-radius: 4px;
        font-size: 12px;
      }

      .fm-error-title {
        font-weight: 600;
        margin-bottom: 4px;
        color: #991b1b;
      }

      .fm-error-details {
        color: #7f1d1d;
        font-family: 'Courier New', monospace;
      }

      /* RTL Support */
      .function-monitor-dashboard {
        direction: rtl;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * חיבור אירועים
   */
  _attachEvents() {
    // כפתורים
    document.getElementById('fm-close')?.addEventListener('click', () => this.hide());
    document.getElementById('fm-refresh')?.addEventListener('click', () => this.refresh());
    document.getElementById('fm-save')?.addEventListener('click', () => this.saveToFirebase());
    document.getElementById('fm-clear')?.addEventListener('click', () => this.clearData());
  }

  /**
   * הצגת הדשבורד
   */
  show() {
    this.create();
    const dashboard = document.getElementById('function-monitor-dashboard');
    dashboard?.classList.remove('hidden');
    this.isVisible = true;

    // התחל רענון אוטומטי
    this.startAutoRefresh();

    // רענן מיד
    this.refresh();
  }

  /**
   * הסתרת הדשבורד
   */
  hide() {
    const dashboard = document.getElementById('function-monitor-dashboard');
    dashboard?.classList.add('hidden');
    this.isVisible = false;

    // עצור רענון אוטומטי
    this.stopAutoRefresh();
  }

  /**
   * החלפת מצב
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * רענון נתונים
   */
  refresh() {
    this._updateStats();
    this._updateTable();
    this._updateAlerts();
    this._updateErrors();
  }

  /**
   * עדכון סטטיסטיקות
   */
  _updateStats() {
    const stats = this.monitor.stats;
    const totalCalls = stats.totalCalls || 0;
    const totalErrors = stats.totalErrors || 0;
    const successRate = totalCalls > 0
      ? ((totalCalls - totalErrors) / totalCalls * 100).toFixed(1)
      : 100;

    document.getElementById('fm-total-calls').textContent = totalCalls;
    document.getElementById('fm-total-errors').textContent = totalErrors;
    document.getElementById('fm-avg-time').textContent = (stats.avgResponseTime || 0) + 'ms';
    document.getElementById('fm-success-rate').textContent = successRate + '%';
  }

  /**
   * עדכון טבלה
   */
  _updateTable() {
    const summary = this.monitor.getSummary();
    const tbody = document.getElementById('fm-table-body');

    if (!tbody) return;

    if (Object.keys(summary).length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="fm-no-data">אין נתונים עדיין...</td></tr>';
      return;
    }

    const rows = Object.entries(summary).map(([name, stats]) => {
      const errorRate = parseFloat(stats.errorRate);
      let statusClass = 'fm-status-ok';
      let statusText = 'OK';

      if (errorRate > 10) {
        statusClass = 'fm-status-error';
        statusText = 'ERROR';
      } else if (errorRate > 0) {
        statusClass = 'fm-status-warning';
        statusText = 'WARNING';
      }

      return `
        <tr>
          <td><strong>${name}</strong></td>
          <td>${stats.calls}</td>
          <td>${stats.errors}</td>
          <td>${stats.avgTime}</td>
          <td><span class="fm-status-badge ${statusClass}">${statusText}</span></td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows;
  }

  /**
   * עדכון התראות
   */
  _updateAlerts() {
    const alertsContainer = document.getElementById('fm-alerts');
    if (!alertsContainer) return;

    const recentAlerts = this.monitor.alerts.slice(-3);

    if (recentAlerts.length === 0) {
      alertsContainer.innerHTML = '';
      return;
    }

    const alertsHtml = recentAlerts.map(alert => {
      const isError = alert.type === 'HIGH_ERROR_RATE';
      return `
        <div class="fm-alert ${isError ? 'fm-alert-error' : ''}">
          <strong>${alert.type}:</strong> ${alert.function || alert.errorRate || ''}
        </div>
      `;
    }).join('');

    alertsContainer.innerHTML = alertsHtml;
  }

  /**
   * עדכון שגיאות אחרונות
   */
  _updateErrors() {
    const errorsList = document.getElementById('fm-errors-list');
    if (!errorsList) return;

    const recentErrors = this.monitor.errors.slice(-5);

    if (recentErrors.length === 0) {
      errorsList.innerHTML = '<div class="fm-no-data">אין שגיאות</div>';
      return;
    }

    const errorsHtml = recentErrors.map(error => `
      <div class="fm-error-item">
        <div class="fm-error-title">${error.function}</div>
        <div class="fm-error-details">${error.error}</div>
      </div>
    `).join('');

    errorsList.innerHTML = errorsHtml;
  }

  /**
   * שמירה ל-Firebase
   */
  async saveToFirebase() {
    try {
      await this.monitor.saveToFirebase();
      this._showTempMessage('✅ Saved to Firebase');
    } catch (error) {
      this._showTempMessage('❌ Failed to save');
    }
  }

  /**
   * ניקוי נתונים
   */
  clearData() {
    if (confirm('האם אתה בטוח שברצונך לנקות את כל הנתונים?')) {
      this.monitor.clear();
      this.refresh();
      this._showTempMessage('🧹 Data cleared');
    }
  }

  /**
   * הודעה זמנית
   */
  _showTempMessage(message) {
    const alertsContainer = document.getElementById('fm-alerts');
    if (!alertsContainer) return;

    const msg = document.createElement('div');
    msg.className = 'fm-alert';
    msg.textContent = message;
    alertsContainer.prepend(msg);

    setTimeout(() => msg.remove(), 3000);
  }

  /**
   * התחל רענון אוטומטי
   */
  startAutoRefresh() {
    if (this.autoRefresh) return;

    this.autoRefresh = setInterval(() => {
      if (this.isVisible) {
        this.refresh();
      }
    }, this.refreshInterval);
  }

  /**
   * עצור רענון אוטומטי
   */
  stopAutoRefresh() {
    if (this.autoRefresh) {
      clearInterval(this.autoRefresh);
      this.autoRefresh = null;
    }
  }
}

// ייצוא
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FunctionMonitorDashboard;
}
