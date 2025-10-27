// Build User Context for AI
// ==========================
// בונה הקשר מלא של המשתמש מנתוני המערכת

import type { BudgetTask, TimesheetEntry, Client, User } from '../types';

interface UserContextData {
  user: User;
  tasks: BudgetTask[];
  timesheetEntries: TimesheetEntry[];
  clients: Client[];
}

interface UserStats {
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  totalHoursLogged: number;
  activeClients: number;
  tasksNearDeadline: number;
}

/**
 * Calculate user statistics
 */
function calculateStats(data: UserContextData): UserStats {
  const { tasks, timesheetEntries, clients } = data;

  // Tasks stats
  const activeTasks = tasks.filter((t) => t.status === 'active');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  // Deadline warnings (within 3 days)
  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const tasksNearDeadline = tasks.filter((t) => {
    if (!t.deadline || t.status !== 'active') return false;
    const deadline =
      typeof t.deadline === 'string' ? new Date(t.deadline) : new Date(t.deadline.seconds * 1000);
    return deadline <= threeDaysFromNow && deadline >= new Date();
  }).length;

  // Timesheet stats
  const totalMinutes = timesheetEntries.reduce((sum, entry) => sum + entry.minutes, 0);
  const totalHours = totalMinutes / 60;

  // Clients stats
  const activeClients = clients.filter((c) => c.status === 'active').length;

  return {
    totalTasks: tasks.length,
    activeTasks: activeTasks.length,
    completedTasks: completedTasks.length,
    totalHoursLogged: Math.round(totalHours * 10) / 10,
    activeClients,
    tasksNearDeadline,
  };
}

/**
 * Format date for display
 */
function formatDate(date: any): string {
  if (!date) return 'לא צוין';

  try {
    let dateObj: Date;
    if (typeof date === 'string') {
      dateObj = new Date(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else if (date.seconds) {
      dateObj = new Date(date.seconds * 1000);
    } else {
      return 'לא צוין';
    }

    return dateObj.toLocaleDateString('he-IL');
  } catch {
    return 'לא צוין';
  }
}

/**
 * Build user context string for AI
 */
export function buildUserContext(data: UserContextData): string {
  const { user, tasks, timesheetEntries, clients } = data;
  const stats = calculateStats(data);

  let context = '';

  // === User Info ===
  context += '👤 **פרטי המשתמש**\n';
  context += `- שם: ${user.displayName}\n`;
  context += `- תפקיד: ${user.role === 'admin' ? 'מנהל' : user.role === 'lawyer' ? 'עורך דין' : 'עוזר'}\n`;
  context += '\n';

  // === Statistics ===
  context += '📊 **סטטיסטיקות**\n';
  context += `- משימות פעילות: ${stats.activeTasks}/${stats.totalTasks}\n`;
  context += `- משימות הושלמו: ${stats.completedTasks}\n`;
  context += `- שעות מתועדות: ${stats.totalHoursLogged}\n`;
  context += `- תיקים פעילים: ${stats.activeClients}\n`;

  if (stats.tasksNearDeadline > 0) {
    context += `- ⚠️ משימות עם דדליין קרוב: ${stats.tasksNearDeadline}\n`;
  }
  context += '\n';

  // === Active Tasks (limit to 10 most urgent) ===
  const activeTasks = tasks
    .filter((t) => t.status === 'active')
    .sort((a, b) => {
      // Sort by deadline (earliest first)
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      const dateA =
        typeof a.deadline === 'string' ? new Date(a.deadline) : new Date(a.deadline.seconds * 1000);
      const dateB =
        typeof b.deadline === 'string' ? new Date(b.deadline) : new Date(b.deadline.seconds * 1000);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(0, 10);

  if (activeTasks.length > 0) {
    context += '📋 **משימות פעילות** (10 הכי דחופות)\n';
    activeTasks.forEach((task, index) => {
      context += `${index + 1}. ${task.description}\n`;
      context += `   - לקוח: ${task.clientName}\n`;
      if (task.deadline) {
        context += `   - דדליין: ${formatDate(task.deadline)}\n`;
      }
      if (task.estimatedHours || task.estimatedMinutes) {
        const estHours = (task.estimatedHours || 0) + (task.estimatedMinutes || 0) / 60;
        context += `   - זמן משוער: ${estHours.toFixed(1)} שעות\n`;
      }
    });
    context += '\n';
  }

  // === Recent Timesheet Entries (limit to 5) ===
  const recentEntries = [...timesheetEntries]
    .sort((a, b) => {
      const dateA = typeof a.createdAt === 'string' ? new Date(a.createdAt) : new Date(a.createdAt.seconds * 1000);
      const dateB = typeof b.createdAt === 'string' ? new Date(b.createdAt) : new Date(b.createdAt.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  if (recentEntries.length > 0) {
    context += '⏰ **רישומי שעות אחרונים** (5 אחרונים)\n';
    recentEntries.forEach((entry, index) => {
      const hours = (entry.minutes / 60).toFixed(1);
      context += `${index + 1}. ${entry.clientName} - ${hours} שעות\n`;
      context += `   - תיאור: ${entry.taskDescription}\n`;
      context += `   - תאריך: ${formatDate(entry.createdAt)}\n`;
    });
    context += '\n';
  }

  // === Active Clients (limit to 10) ===
  const activeClients = clients
    .filter((c) => c.status === 'active')
    .sort((a, b) => {
      const dateA = typeof a.lastModifiedAt === 'string' ? new Date(a.lastModifiedAt) : new Date(a.lastModifiedAt.seconds * 1000);
      const dateB = typeof b.lastModifiedAt === 'string' ? new Date(b.lastModifiedAt) : new Date(b.lastModifiedAt.seconds * 1000);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 10);

  if (activeClients.length > 0) {
    context += '👥 **תיקים פעילים** (10 אחרונים)\n';
    activeClients.forEach((client, index) => {
      context += `${index + 1}. ${client.clientName} (${client.caseNumber})\n`;
      context += `   - סוג: ${
        client.procedureType === 'hours'
          ? 'חבילת שעות'
          : client.procedureType === 'fixed'
          ? 'מחיר פיקס'
          : 'הליך משפטי'
      }\n`;
      if (client.description) {
        context += `   - תיאור: ${client.description.substring(0, 100)}${
          client.description.length > 100 ? '...' : ''
        }\n`;
      }
    });
    context += '\n';
  }

  // === Summary ===
  context += '💡 **הערות**\n';
  context += '- הנתונים לעיל הם snapshot של המצב הנוכחי\n';
  context += '- השתמש במידע זה כדי לענות על שאלות המשתמש\n';
  context += '- אם חסר מידע, שאל שאלות הבהרה\n';

  return context;
}

/**
 * Build minimal context (for shorter queries)
 */
export function buildMinimalContext(data: UserContextData): string {
  const stats = calculateStats(data);

  return `
📊 סטטיסטיקות מהירות:
- משימות פעילות: ${stats.activeTasks}
- תיקים פעילים: ${stats.activeClients}
- שעות מתועדות: ${stats.totalHoursLogged}
${stats.tasksNearDeadline > 0 ? `- ⚠️ משימות דחופות: ${stats.tasksNearDeadline}` : ''}
  `.trim();
}
