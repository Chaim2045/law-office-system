// Reports Service
// ================
// שירות לדוחות וסטטיסטיקות

import * as clientsService from './clientsService';
import * as budgetTasksService from './budgetTasksService';
import * as timesheetService from './timesheetService';
import * as legalProceduresService from './legalProceduresService';

/**
 * סטטיסטיקות כלליות של המערכת
 */
export interface SystemStats {
  totalClients: number;
  activeClients: number;
  totalCases: number;
  activeCases: number;
  totalProcedures: number;
  activeProcedures: number;
  totalTasks: number;
  activeTasks: number;
  completedTasks: number;
  totalHoursLogged: number;
  totalEntriesThisMonth: number;
}

/**
 * סטטיסטיקות לפי סוג תיק
 */
export interface CaseTypeStats {
  hours: number;
  fixed: number;
  legal_procedure: number;
}

/**
 * סטטיסטיקות לפי חודש
 */
export interface MonthlyStats {
  month: string;
  year: number;
  totalHours: number;
  totalTasks: number;
  totalRevenue: number;
  newClients: number;
}

/**
 * סטטיסטיקות לפי עו"ד
 */
export interface LawyerStats {
  lawyerName: string;
  totalCases: number;
  activeCases: number;
  totalHours: number;
  totalTasks: number;
  completedTasks: number;
}

/**
 * דוח סיכום
 */
export interface SummaryReport {
  dateFrom: string;
  dateTo: string;
  systemStats: SystemStats;
  caseTypeStats: CaseTypeStats;
  topLawyers: LawyerStats[];
  monthlyTrend: MonthlyStats[];
}

/**
 * קבלת סטטיסטיקות כלליות
 */
export const getSystemStats = async (): Promise<SystemStats> => {
  try {
    const [clients, tasks, entries, procedures] = await Promise.all([
      clientsService.getClients(),
      budgetTasksService.getBudgetTasks(),
      timesheetService.getTimesheetEntries(),
      legalProceduresService.getLegalProcedures(),
    ]);

    // חישוב סה"כ שעות מהשעתון
    const totalHoursLogged = entries.reduce((sum, entry) => {
      const hours = (entry.hours || 0) + (entry.minutes || 0) / 60;
      return sum + hours;
    }, 0);

    // סינון רשומות מהחודש הנוכחי
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const entriesThisMonth = entries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
    });

    return {
      totalClients: clients.length,
      activeClients: clients.filter(c => c.status === 'active').length,
      totalCases: clients.length,
      activeCases: clients.filter(c => c.status === 'active').length,
      totalProcedures: procedures.length,
      activeProcedures: procedures.filter(p => p.status === 'active').length,
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'active').length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      totalHoursLogged: Math.round(totalHoursLogged * 10) / 10,
      totalEntriesThisMonth: entriesThisMonth.length,
    };
  } catch (error: unknown) {
    console.error('Error fetching system stats:', error);
    throw new Error('שגיאה בטעינת סטטיסטיקות');
  }
};

/**
 * קבלת סטטיסטיקות לפי סוג תיק
 */
export const getCaseTypeStats = async (): Promise<CaseTypeStats> => {
  try {
    const clients = await clientsService.getClients();

    return {
      hours: clients.filter(c => c.procedureType === 'hours').length,
      fixed: clients.filter(c => c.procedureType === 'fixed').length,
      legal_procedure: clients.filter(c => c.procedureType === 'legal_procedure').length,
    };
  } catch (error: unknown) {
    console.error('Error fetching case type stats:', error);
    throw new Error('שגיאה בטעינת סטטיסטיקות לפי סוג');
  }
};

/**
 * קבלת סטטיסטיקות לפי עו"ד
 */
export const getLawyerStats = async (): Promise<LawyerStats[]> => {
  try {
    const [clients, tasks, entries] = await Promise.all([
      clientsService.getClients(),
      budgetTasksService.getBudgetTasks(),
      timesheetService.getTimesheetEntries(),
    ]);

    // קבלת רשימת עו"ד ייחודית
    const lawyersSet = new Set<string>();
    clients.forEach(client => {
      if (client.mainAttorney) lawyersSet.add(client.mainAttorney);
      client.assignedTo?.forEach(lawyer => lawyersSet.add(lawyer));
    });

    const lawyerStatsArray: LawyerStats[] = [];

    lawyersSet.forEach(lawyerName => {
      const lawyerCases = clients.filter(c =>
        c.mainAttorney === lawyerName || c.assignedTo?.includes(lawyerName)
      );

      const lawyerTasks = tasks.filter(t => t.createdBy === lawyerName);

      const lawyerEntries = entries.filter(e => e.createdBy === lawyerName);
      const totalHours = lawyerEntries.reduce((sum, entry) => {
        return sum + (entry.hours || 0) + (entry.minutes || 0) / 60;
      }, 0);

      lawyerStatsArray.push({
        lawyerName,
        totalCases: lawyerCases.length,
        activeCases: lawyerCases.filter(c => c.status === 'active').length,
        totalHours: Math.round(totalHours * 10) / 10,
        totalTasks: lawyerTasks.length,
        completedTasks: lawyerTasks.filter(t => t.status === 'completed').length,
      });
    });

    // מיון לפי מספר תיקים פעילים
    return lawyerStatsArray.sort((a, b) => b.activeCases - a.activeCases);
  } catch (error: unknown) {
    console.error('Error fetching lawyer stats:', error);
    throw new Error('שגיאה בטעינת סטטיסטיקות עו"ד');
  }
};

/**
 * קבלת סטטיסטיקות חודשיות (6 חודשים אחרונים)
 */
export const getMonthlyStats = async (): Promise<MonthlyStats[]> => {
  try {
    const [clients, tasks, entries] = await Promise.all([
      clientsService.getClients(),
      budgetTasksService.getBudgetTasks(),
      timesheetService.getTimesheetEntries(),
    ]);

    const monthlyData: Map<string, MonthlyStats> = new Map();

    // חישוב עבור 6 חודשים אחרונים
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      monthlyData.set(monthKey, {
        month: date.toLocaleDateString('he-IL', { month: 'long' }),
        year: date.getFullYear(),
        totalHours: 0,
        totalTasks: 0,
        totalRevenue: 0,
        newClients: 0,
      });
    }

    // חישוב שעות לפי חודש
    entries.forEach(entry => {
      const entryDate = new Date(entry.date);
      const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyData.has(monthKey)) {
        const data = monthlyData.get(monthKey)!;
        data.totalHours += (entry.hours || 0) + (entry.minutes || 0) / 60;
      }
    });

    // חישוב משימות לפי חודש
    tasks.forEach(task => {
      const taskDate = typeof task.createdAt === 'string'
        ? new Date(task.createdAt)
        : new Date(task.createdAt.seconds * 1000);
      const monthKey = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyData.has(monthKey)) {
        const data = monthlyData.get(monthKey)!;
        data.totalTasks += 1;
      }
    });

    // חישוב לקוחות חדשים לפי חודש
    clients.forEach(client => {
      const clientDate = typeof client.createdAt === 'string'
        ? new Date(client.createdAt)
        : new Date(client.createdAt.seconds * 1000);
      const monthKey = `${clientDate.getFullYear()}-${String(clientDate.getMonth() + 1).padStart(2, '0')}`;

      if (monthlyData.has(monthKey)) {
        const data = monthlyData.get(monthKey)!;
        data.newClients += 1;
      }
    });

    // עיגול שעות
    monthlyData.forEach(data => {
      data.totalHours = Math.round(data.totalHours * 10) / 10;
    });

    return Array.from(monthlyData.values());
  } catch (error: unknown) {
    console.error('Error fetching monthly stats:', error);
    throw new Error('שגיאה בטעינת סטטיסטיקות חודשיות');
  }
};

/**
 * קבלת דוח סיכום מלא
 */
export const getSummaryReport = async (
  dateFrom?: string,
  dateTo?: string
): Promise<SummaryReport> => {
  try {
    const [systemStats, caseTypeStats, topLawyers, monthlyTrend] = await Promise.all([
      getSystemStats(),
      getCaseTypeStats(),
      getLawyerStats(),
      getMonthlyStats(),
    ]);

    return {
      dateFrom: dateFrom || new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      dateTo: dateTo || new Date().toISOString().split('T')[0],
      systemStats,
      caseTypeStats,
      topLawyers: topLawyers.slice(0, 5), // Top 5 lawyers
      monthlyTrend,
    };
  } catch (error: unknown) {
    console.error('Error fetching summary report:', error);
    throw new Error('שגיאה בטעינת דוח סיכום');
  }
};
