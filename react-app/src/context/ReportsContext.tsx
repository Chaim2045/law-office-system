// Reports Context
// ================
// ניהול מצב גלובלי של דוחות וסטטיסטיקות

import React, { createContext, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import * as reportsService from '@services/api/reportsService';
import type {
  SystemStats,
  CaseTypeStats,
  LawyerStats,
  MonthlyStats,
  SummaryReport,
} from '@services/api/reportsService';

interface ReportsContextType {
  systemStats: SystemStats | null;
  caseTypeStats: CaseTypeStats | null;
  lawyerStats: LawyerStats[];
  monthlyStats: MonthlyStats[];
  summaryReport: SummaryReport | null;
  loading: boolean;
  error: string | null;
  loadSystemStats: () => Promise<void>;
  loadCaseTypeStats: () => Promise<void>;
  loadLawyerStats: () => Promise<void>;
  loadMonthlyStats: () => Promise<void>;
  loadSummaryReport: (dateFrom?: string, dateTo?: string) => Promise<void>;
  loadAllStats: () => Promise<void>;
}

export const ReportsContext = createContext<ReportsContextType | undefined>(undefined);

interface ReportsProviderProps {
  children: React.ReactNode;
}

export const ReportsProvider: React.FC<ReportsProviderProps> = ({ children }) => {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [caseTypeStats, setCaseTypeStats] = useState<CaseTypeStats | null>(null);
  const [lawyerStats, setLawyerStats] = useState<LawyerStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [summaryReport, setSummaryReport] = useState<SummaryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * טעינת סטטיסטיקות כלליות
   */
  const loadSystemStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stats = await reportsService.getSystemStats();
      setSystemStats(stats);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת סטטיסטיקות';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * טעינת סטטיסטיקות לפי סוג תיק
   */
  const loadCaseTypeStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stats = await reportsService.getCaseTypeStats();
      setCaseTypeStats(stats);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת סטטיסטיקות';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * טעינת סטטיסטיקות עו"ד
   */
  const loadLawyerStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stats = await reportsService.getLawyerStats();
      setLawyerStats(stats);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת סטטיסטיקות עו"ד';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * טעינת סטטיסטיקות חודשיות
   */
  const loadMonthlyStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stats = await reportsService.getMonthlyStats();
      setMonthlyStats(stats);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת סטטיסטיקות חודשיות';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * טעינת דוח סיכום
   */
  const loadSummaryReport = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setLoading(true);
    setError(null);

    try {
      const report = await reportsService.getSummaryReport(dateFrom, dateTo);
      setSummaryReport(report);

      // עדכון גם את הסטטיסטיקות הנפרדות
      setSystemStats(report.systemStats);
      setCaseTypeStats(report.caseTypeStats);
      setLawyerStats(report.topLawyers);
      setMonthlyStats(report.monthlyTrend);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת דוח סיכום';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * טעינת כל הסטטיסטיקות במקביל
   */
  const loadAllStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [system, caseType, lawyers, monthly] = await Promise.all([
        reportsService.getSystemStats(),
        reportsService.getCaseTypeStats(),
        reportsService.getLawyerStats(),
        reportsService.getMonthlyStats(),
      ]);

      setSystemStats(system);
      setCaseTypeStats(caseType);
      setLawyerStats(lawyers);
      setMonthlyStats(monthly);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'שגיאה בטעינת סטטיסטיקות';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const value: ReportsContextType = {
    systemStats,
    caseTypeStats,
    lawyerStats,
    monthlyStats,
    summaryReport,
    loading,
    error,
    loadSystemStats,
    loadCaseTypeStats,
    loadLawyerStats,
    loadMonthlyStats,
    loadSummaryReport,
    loadAllStats,
  };

  return <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>;
};
