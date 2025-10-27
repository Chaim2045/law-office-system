// Dashboard Page
// ===============
// דף הבית - דשבורד ראשי

import React, { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { Card } from '@components/common';
import { StatCard } from '@components/reports';
import { useAuth } from '@hooks/useAuth';
import { useClients } from '@hooks/useClients';
import { useBudgetTasks } from '@hooks/useBudgetTasks';
import { useTimesheet } from '@hooks/useTimesheet';
import { useLegalProcedures } from '@hooks/useLegalProcedures';
import { useReports } from '@hooks/useReports';
import './Dashboard.css';

// Helper function to convert Timestamp/string to Date
const toDate = (date: string | Timestamp): Date => {
  if (typeof date === 'string') {
    return new Date(date);
  }
  if (date && typeof date === 'object' && 'seconds' in date) {
    return new Date(date.seconds * 1000);
  }
  return new Date();
};

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { clients, loadClients } = useClients();
  const { tasks, loadTasks } = useBudgetTasks();
  const { entries, loadEntries } = useTimesheet();
  const { procedures, loadProcedures } = useLegalProcedures();
  const { systemStats, loadSystemStats } = useReports();

  // Load all data on mount
  useEffect(() => {
    loadClients();
    loadTasks();
    loadEntries();
    loadProcedures();
    loadSystemStats();
  }, [loadClients, loadTasks, loadEntries, loadProcedures, loadSystemStats]);

  // Calculate active clients
  const activeClients = useMemo(() => {
    return clients.filter((c) => c.status === 'active').length;
  }, [clients]);

  // Calculate pending tasks
  const pendingTasks = useMemo(() => {
    return tasks.filter((t) => t.status === 'active').length;
  }, [tasks]);

  // Calculate this month's hours
  const monthHours = useMemo(() => {
    const now = new Date();
    const thisMonth = entries.filter((e) => {
      const entryDate = toDate(e.createdAt);
      return (
        entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear()
      );
    });
    const totalMinutes = thisMonth.reduce((sum, e) => sum + e.minutes, 0);
    return (totalMinutes / 60).toFixed(1);
  }, [entries]);

  // Active procedures
  const activeProcedures = useMemo(() => {
    return procedures.filter((p) => p.status === 'active').length;
  }, [procedures]);

  // Recent activity - last 10 items (tasks + timesheet)
  const recentActivity = useMemo(() => {
    const taskActivity = tasks.slice(0, 5).map((t) => ({
      type: 'task' as const,
      id: t.id,
      title: t.description,
      date: t.createdAt,
      status: t.status,
    }));

    const timesheetActivity = entries.slice(0, 5).map((e) => ({
      type: 'timesheet' as const,
      id: e.id,
      title: `${e.clientName} - ${(e.minutes / 60).toFixed(1)} שעות`,
      date: e.createdAt,
      description: e.taskDescription,
    }));

    return [...taskActivity, ...timesheetActivity]
      .sort((a, b) => toDate(b.date).getTime() - toDate(a.date).getTime())
      .slice(0, 10);
  }, [tasks, entries]);

  // Upcoming deadlines
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14); // Next 2 weeks

    return tasks
      .filter((t) => {
        if (!t.deadline || t.status === 'completed') return false;
        const deadline = toDate(t.deadline);
        return deadline >= now && deadline <= futureDate;
      })
      .sort((a, b) => toDate(a.deadline!).getTime() - toDate(b.deadline!).getTime())
      .slice(0, 5);
  }, [tasks]);

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h2>
            <i className="fas fa-home"></i>
            שלום, {user?.displayName}!
          </h2>
          <p>סקירה כללית של המערכת</p>
        </div>

        <div className="quick-actions">
          <Link to="/clients" className="btn btn-primary">
            <i className="fas fa-plus"></i>
            תיק חדש
          </Link>
          <Link to="/budget" className="btn btn-secondary">
            <i className="fas fa-tasks"></i>
            משימה חדשה
          </Link>
          <Link to="/timesheet" className="btn btn-secondary">
            <i className="fas fa-clock"></i>
            תיעוד שעות
          </Link>
        </div>
      </div>

      {/* Main Stats */}
      <div className="dashboard-stats">
        <StatCard
          title="תיקים פעילים"
          value={activeClients}
          icon={<i className="fas fa-folder-open"></i>}
          color="primary"
          subtitle={`מתוך ${clients.length} סה"כ`}
        />

        <StatCard
          title="משימות פתוחות"
          value={pendingTasks}
          icon={<i className="fas fa-tasks"></i>}
          color="warning"
          subtitle={`מתוך ${tasks.length} סה"כ`}
        />

        <StatCard
          title="שעות החודש"
          value={monthHours}
          icon={<i className="fas fa-clock"></i>}
          color="success"
          subtitle={`${entries.length} רישומים`}
        />

        <StatCard
          title="הליכים משפטיים"
          value={activeProcedures}
          icon={<i className="fas fa-gavel"></i>}
          color="info"
          subtitle={`מתוך ${procedures.length} סה"כ`}
        />
      </div>

      {/* Content Grid */}
      <div className="dashboard-content">
        {/* Recent Activity */}
        <Card className="recent-activity-card">
          <div className="card-header">
            <h3>
              <i className="fas fa-history"></i>
              פעילות אחרונה
            </h3>
            <Link to="/reports" className="view-all-link">
              צפה בהכל
            </Link>
          </div>

          <div className="activity-list">
            {recentActivity.length === 0 ? (
              <p className="empty-state">אין פעילות אחרונה</p>
            ) : (
              recentActivity.map((activity, index) => (
                <div key={`${activity.type}-${activity.id || index}`} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'task' ? (
                      <i className="fas fa-tasks"></i>
                    ) : (
                      <i className="fas fa-clock"></i>
                    )}
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">{activity.title}</div>
                    {'description' in activity && activity.description && (
                      <div className="activity-description">{activity.description}</div>
                    )}
                    <div className="activity-date">
                      {toDate(activity.date).toLocaleDateString('he-IL')}
                    </div>
                  </div>
                  {'status' in activity && (
                    <div className={`activity-status status-${activity.status}`}>
                      {activity.status === 'active' ? 'פעיל' : 'הושלם'}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="deadlines-card">
          <div className="card-header">
            <h3>
              <i className="fas fa-calendar-alt"></i>
              דדליינים קרובים
            </h3>
            <Link to="/budget" className="view-all-link">
              צפה בהכל
            </Link>
          </div>

          <div className="deadlines-list">
            {upcomingDeadlines.length === 0 ? (
              <p className="empty-state">אין דדליינים קרובים</p>
            ) : (
              upcomingDeadlines.map((task) => {
                const deadline = toDate(task.deadline!);
                const daysUntil = Math.ceil(
                  (deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                );
                const isUrgent = daysUntil <= 3;

                return (
                  <div key={task.id} className={`deadline-item ${isUrgent ? 'urgent' : ''}`}>
                    <div className="deadline-icon">
                      {isUrgent ? (
                        <i className="fas fa-exclamation-triangle"></i>
                      ) : (
                        <i className="fas fa-calendar-day"></i>
                      )}
                    </div>
                    <div className="deadline-content">
                      <div className="deadline-title">{task.description}</div>
                      <div className="deadline-date">
                        {deadline.toLocaleDateString('he-IL')}
                        <span className="days-until">
                          ({daysUntil} {daysUntil === 1 ? 'יום' : 'ימים'})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* System Overview */}
        {systemStats && (
          <Card className="system-overview-card">
            <div className="card-header">
              <h3>
                <i className="fas fa-chart-pie"></i>
                סקירת מערכת
              </h3>
              <Link to="/reports" className="view-all-link">
                דוחות מלאים
              </Link>
            </div>

            <div className="overview-stats">
              <div className="overview-stat">
                <div className="overview-label">סה"כ לקוחות</div>
                <div className="overview-value">{systemStats.totalClients}</div>
              </div>
              <div className="overview-stat">
                <div className="overview-label">שעות מתועדות</div>
                <div className="overview-value">{systemStats.totalHoursLogged.toFixed(1)}</div>
              </div>
              <div className="overview-stat">
                <div className="overview-label">משימות בתקציב</div>
                <div className="overview-value">{systemStats.totalTasks}</div>
              </div>
              <div className="overview-stat">
                <div className="overview-label">רישומים החודש</div>
                <div className="overview-value">{systemStats.totalEntriesThisMonth}</div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
