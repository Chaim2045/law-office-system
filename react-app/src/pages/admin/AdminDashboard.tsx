/**
 * Admin Dashboard Page
 * Main dashboard with system overview and statistics
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  People,
  Business,
  Assignment,
  AccessTime,
  TrendingUp,
  Warning,
  CheckCircle,
  Refresh,
  Person,
  Schedule,
  AttachMoney,
  Error as ErrorIcon
} from '@mui/icons-material';
import { db } from '../../config/firebase';
import { useAdmin } from '../../contexts/AdminContext';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalClients: number;
  activeTasks: number;
  completedTasks: number;
  todayHours: number;
  monthlyHours: number;
  pendingBudget: number;
  systemHealth: 'good' | 'warning' | 'error';
  lastBackup?: Date;
}

interface RecentActivity {
  id: string;
  type: 'login' | 'task' | 'client' | 'error';
  user: string;
  action: string;
  timestamp: Date;
}

export const AdminDashboard: React.FC = () => {
  const { adminUser } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setError(null);

      // Fetch users
      const employeesSnapshot = await db.collection('employees').get();
      const totalUsers = employeesSnapshot.size;

      // Fetch active sessions
      const sessionsSnapshot = await db
        .collection('sessions')
        .where('isActive', '==', true)
        .get();
      const activeUsers = sessionsSnapshot.size;

      // Fetch clients
      const clientsSnapshot = await db.collection('clients').get();
      const totalClients = clientsSnapshot.size;

      // Fetch tasks
      const tasksSnapshot = await db.collection('budget_tasks').get();
      let activeTasks = 0;
      let completedTasks = 0;
      let pendingBudget = 0;

      tasksSnapshot.forEach(doc => {
        const task = doc.data();
        if (task.status === 'completed') {
          completedTasks++;
        } else if (task.status === 'active' || task.status === 'in_progress') {
          activeTasks++;
          pendingBudget += (task.estimatedHours || 0) * (task.hourlyRate || 0);
        }
      });

      // Fetch timesheet data
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const timesheetSnapshot = await db
        .collection('timesheet_entries')
        .where('date', '>=', today)
        .get();

      let todayHours = 0;
      timesheetSnapshot.forEach(doc => {
        const entry = doc.data();
        todayHours += entry.duration || 0;
      });

      // Calculate monthly hours
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthlySnapshot = await db
        .collection('timesheet_entries')
        .where('date', '>=', monthStart)
        .get();

      let monthlyHours = 0;
      monthlySnapshot.forEach(doc => {
        const entry = doc.data();
        monthlyHours += entry.duration || 0;
      });

      // Fetch recent activities from audit logs
      const auditSnapshot = await db
        .collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

      const recentActivities: RecentActivity[] = [];
      auditSnapshot.forEach(doc => {
        const log = doc.data();
        recentActivities.push({
          id: doc.id,
          type: log.category === 'auth' ? 'login' :
                log.category === 'data' ? 'task' :
                log.category === 'error' ? 'error' : 'client',
          user: log.userEmail || 'מערכת',
          action: log.details?.message || log.action,
          timestamp: log.timestamp?.toDate() || new Date()
        });
      });

      // Check system health
      const systemHealth = errorCount > 5 ? 'error' :
                          errorCount > 0 ? 'warning' : 'good';

      setStats({
        totalUsers,
        activeUsers,
        totalClients,
        activeTasks,
        completedTasks,
        todayHours: todayHours / 60, // Convert to hours
        monthlyHours: monthlyHours / 60,
        pendingBudget,
        systemHealth,
        lastBackup: new Date() // You can fetch real backup data if available
      });

      setActivities(recentActivities);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('שגיאה בטעינת נתוני הדשבורד');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={50} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
  }> = ({ title, value, icon, color, subtitle }) => (
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              bgcolor: `${color}20`,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mr: 2
            }}
          >
            {React.cloneElement(icon as React.ReactElement, {
              sx: { color, fontSize: 30 }
            })}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography color="text.secondary" variant="caption" display="block">
              {title}
            </Typography>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold' }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            לוח בקרה
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ברוך הבא, {adminUser?.displayName || adminUser?.email}
          </Typography>
        </Box>
        <Tooltip title="רענן נתונים">
          <IconButton onClick={handleRefresh} disabled={refreshing}>
            <Refresh className={refreshing ? 'rotating' : ''} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* System Health Alert */}
      {stats?.systemHealth === 'warning' && (
        <Alert severity="warning" sx={{ mb: 3 }} icon={<Warning />}>
          יש מספר שגיאות במערכת שדורשות תשומת לב
        </Alert>
      )}
      {stats?.systemHealth === 'error' && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<ErrorIcon />}>
          זוהו בעיות קריטיות במערכת - נדרשת התערבות מיידית
        </Alert>
      )}

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="משתמשים פעילים"
            value={`${stats?.activeUsers || 0}/${stats?.totalUsers || 0}`}
            icon={<People />}
            color="#2196f3"
            subtitle="מחוברים כרגע"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="לקוחות"
            value={stats?.totalClients || 0}
            icon={<Business />}
            color="#4caf50"
            subtitle="סה״כ במערכת"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="משימות פעילות"
            value={stats?.activeTasks || 0}
            icon={<Assignment />}
            color="#ff9800"
            subtitle={`${stats?.completedTasks || 0} הושלמו החודש`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="שעות היום"
            value={stats?.todayHours?.toFixed(1) || '0'}
            icon={<AccessTime />}
            color="#9c27b0"
            subtitle={`${stats?.monthlyHours?.toFixed(0) || '0'} שעות החודש`}
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Activities */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              פעילות אחרונה
            </Typography>
            {activities.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                אין פעילות אחרונה להצגה
              </Typography>
            ) : (
              <List>
                {activities.map((activity) => (
                  <ListItem key={activity.id} divider>
                    <ListItemAvatar>
                      <Avatar sx={{
                        bgcolor: activity.type === 'error' ? '#f44336' :
                                activity.type === 'login' ? '#2196f3' :
                                activity.type === 'task' ? '#4caf50' : '#ff9800'
                      }}>
                        {activity.type === 'error' ? <ErrorIcon /> :
                         activity.type === 'login' ? <Person /> :
                         activity.type === 'task' ? <Assignment /> : <Business />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={activity.action}
                      secondary={
                        <>
                          {activity.user} • {' '}
                          {format(activity.timestamp, 'dd/MM HH:mm', { locale: he })}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              מצב המערכת
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircle sx={{ color: '#4caf50', mr: 1 }} />
                <Typography variant="body2">שרת Firebase: פעיל</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CheckCircle sx={{ color: '#4caf50', mr: 1 }} />
                <Typography variant="body2">מסד נתונים: תקין</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {stats?.systemHealth === 'good' ? (
                  <CheckCircle sx={{ color: '#4caf50', mr: 1 }} />
                ) : (
                  <Warning sx={{ color: '#ff9800', mr: 1 }} />
                )}
                <Typography variant="body2">
                  בריאות המערכת: {
                    stats?.systemHealth === 'good' ? 'תקינה' :
                    stats?.systemHealth === 'warning' ? 'אזהרה' : 'תקלה'
                  }
                </Typography>
              </Box>
            </Box>
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              סטטיסטיקות תקציב
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                תקציב ממתין לאישור
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#ff9800' }}>
                ₪{stats?.pendingBudget?.toLocaleString() || '0'}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={75}
                sx={{ mt: 2, height: 8, borderRadius: 1 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                75% מהתקציב החודשי
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <style jsx global>{`
        @keyframes rotate {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .rotating {
          animation: rotate 1s linear infinite;
        }
      `}</style>
    </Box>
  );
};