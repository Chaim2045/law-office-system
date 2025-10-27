// Reports Page
// =============
// עמוד דוחות וסטטיסטיקות

import React, { useEffect, useState } from 'react';
import { useReports } from '@hooks/useReports';
import { StatCard } from '@components/reports';
import { Card } from '@components/common';
import './Reports.css';

export const Reports: React.FC = () => {
  const {
    systemStats,
    caseTypeStats,
    lawyerStats,
    monthlyStats,
    loading,
    error,
    loadAllStats,
  } = useReports();

  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'custom'>('all');

  useEffect(() => {
    loadAllStats();
  }, [loadAllStats]);

  if (loading && !systemStats) {
    return (
      <div className="reports-page">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>טוען דוחות...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reports-page">
        <div className="error-state">
          <i className="fas fa-exclamation-triangle"></i>
          <p>{error}</p>
          <button onClick={loadAllStats} className="btn btn-primary">
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-page">
      {/* Header */}
      <div className="reports-header">
        <div className="reports-title">
          <h1>
            <i className="fas fa-chart-bar"></i>
            דוחות וסטטיסטיקות
          </h1>
          <p className="reports-subtitle">מבט כולל על ביצועי המשרד</p>
        </div>

        <div className="reports-actions">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as 'all' | 'month' | 'custom')}
            className="date-filter"
          >
            <option value="all">כל התקופה</option>
            <option value="month">חודש אחרון</option>
            <option value="custom">טווח מותאם</option>
          </select>

          <button onClick={loadAllStats} className="btn btn-secondary" disabled={loading}>
            <i className="fas fa-sync-alt"></i>
            רענן נתונים
          </button>

          <button className="btn btn-primary">
            <i className="fas fa-download"></i>
            ייצא לאקסל
          </button>
        </div>
      </div>

      {/* System Stats Grid */}
      {systemStats && (
        <div className="stats-section">
          <h2 className="section-title">סטטיסטיקות כלליות</h2>
          <div className="stats-grid">
            <StatCard
              title="סה״כ לקוחות"
              value={systemStats.totalClients}
              icon={<i className="fas fa-users"></i>}
              color="primary"
              subtitle={`${systemStats.activeClients} פעילים`}
            />

            <StatCard
              title="תיקים פעילים"
              value={systemStats.activeClients}
              icon={<i className="fas fa-briefcase"></i>}
              color="success"
              subtitle={`מתוך ${systemStats.totalCases} סה״כ`}
            />

            <StatCard
              title="הליכים משפטיים"
              value={systemStats.totalProcedures}
              icon={<i className="fas fa-gavel"></i>}
              color="info"
            />

            <StatCard
              title="משימות תקציב"
              value={systemStats.totalTasks}
              icon={<i className="fas fa-tasks"></i>}
              color="warning"
            />

            <StatCard
              title="שעות מתועדות"
              value={systemStats.totalHoursLogged.toFixed(1)}
              icon={<i className="fas fa-clock"></i>}
              color="primary"
              subtitle={`${systemStats.totalEntriesThisMonth} רישומים החודש`}
            />

            <StatCard
              title="ממוצע שעות ליום"
              value={(systemStats.totalHoursLogged / 30).toFixed(1)}
              icon={<i className="fas fa-chart-line"></i>}
              color="success"
              subtitle="30 ימים אחרונים"
            />
          </div>
        </div>
      )}

      {/* Case Type Breakdown */}
      {caseTypeStats && (
        <div className="stats-section">
          <h2 className="section-title">פילוח לפי סוג תיק</h2>
          <div className="stats-grid stats-grid-3">
            <StatCard
              title="חבילות שעות"
              value={caseTypeStats.hours}
              icon={<i className="fas fa-hourglass-half"></i>}
              color="primary"
            />

            <StatCard
              title="מחיר פיקס"
              value={caseTypeStats.fixed}
              icon={<i className="fas fa-dollar-sign"></i>}
              color="success"
            />

            <StatCard
              title="הליכים משפטיים"
              value={caseTypeStats.legal_procedure}
              icon={<i className="fas fa-balance-scale"></i>}
              color="info"
            />
          </div>
        </div>
      )}

      {/* Monthly Trend */}
      {monthlyStats && monthlyStats.length > 0 && (
        <div className="stats-section">
          <h2 className="section-title">מגמה חודשית (6 חודשים אחרונים)</h2>
          <Card>
            <div className="monthly-stats-table">
              <table>
                <thead>
                  <tr>
                    <th>חודש</th>
                    <th>שעות מתועדות</th>
                    <th>משימות</th>
                    <th>לקוחות חדשים</th>
                    <th>הכנסות</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyStats.map((stat, index) => (
                    <tr key={index}>
                      <td>
                        {stat.month}/{stat.year}
                      </td>
                      <td>
                        <strong>{stat.totalHours.toFixed(1)}</strong> שעות
                      </td>
                      <td>{stat.totalTasks} משימות</td>
                      <td>
                        {stat.newClients > 0 && (
                          <span className="badge badge-success">+{stat.newClients}</span>
                        )}
                        {stat.newClients === 0 && <span>-</span>}
                      </td>
                      <td>₪{stat.totalRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Lawyer Stats */}
      {lawyerStats && lawyerStats.length > 0 && (
        <div className="stats-section">
          <h2 className="section-title">סטטיסטיקות לפי עו״ד</h2>
          <Card>
            <div className="lawyer-stats-grid">
              {lawyerStats.map((lawyer, index) => (
                <div key={index} className="lawyer-stat-card">
                  <div className="lawyer-header">
                    <div className="lawyer-avatar">
                      <i className="fas fa-user-tie"></i>
                    </div>
                    <div className="lawyer-info">
                      <h3>{lawyer.lawyerName}</h3>
                      <p className="lawyer-role">עורך דין</p>
                    </div>
                  </div>

                  <div className="lawyer-metrics">
                    <div className="metric">
                      <span className="metric-label">תיקים פעילים</span>
                      <span className="metric-value">{lawyer.activeCases}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">סה״כ תיקים</span>
                      <span className="metric-value">{lawyer.totalCases}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">שעות מתועדות</span>
                      <span className="metric-value">{lawyer.totalHours.toFixed(1)}</span>
                    </div>
                    <div className="metric">
                      <span className="metric-label">משימות הושלמו</span>
                      <span className="metric-value">
                        {lawyer.completedTasks}/{lawyer.totalTasks}
                      </span>
                    </div>
                  </div>

                  <div className="lawyer-completion">
                    <div className="completion-bar">
                      <div
                        className="completion-fill"
                        style={{
                          width: `${(lawyer.completedTasks / lawyer.totalTasks) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <span className="completion-text">
                      {((lawyer.completedTasks / lawyer.totalTasks) * 100).toFixed(0)}% השלמה
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
