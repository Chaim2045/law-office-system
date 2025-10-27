// TypeScript Type Definitions
// =============================
// מערכת ניהול משרד עורכי דין - הגדרות טיפוסים

import { Timestamp } from 'firebase/firestore';

// ===================================
// User & Authentication Types
// ===================================

export interface User {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  role: 'admin' | 'lawyer' | 'assistant';
  isActive: boolean;
  createdAt: Timestamp | string;
  lastLogin?: Timestamp | string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

// ===================================
// Client & Case Types
// ===================================

export type ProcedureType = 'hours' | 'fixed' | 'legal_procedure';
export type CaseStatus = 'active' | 'inactive' | 'completed' | 'on_hold';
export type CasePriority = 'low' | 'medium' | 'high' | 'urgent';
export type PricingType = 'hourly' | 'fixed';
export type PackageStatus = 'active' | 'depleted' | 'closed';
export type ServiceStatus = 'active' | 'completed' | 'cancelled';
export type StageStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface Package {
  id: string;
  type: 'initial' | 'additional' | 'renewal';
  hours: number;
  hoursUsed: number;
  hoursRemaining: number;
  purchaseDate: string;
  status: PackageStatus;
  description: string;
  closedDate?: string;
}

export interface Service {
  id: string;
  type: 'hours' | 'fixed' | 'legal_procedure';
  name: string;
  description: string;
  status: ServiceStatus;
  createdAt: string;
  createdBy: string;
  packages?: Package[];
  totalHours?: number;
  hoursUsed?: number;
  hoursRemaining?: number;
  fixedPrice?: number;
}

export interface Stage {
  id: string;
  name: string;
  description: string;
  order: number;
  status: StageStatus;
  pricingType: PricingType;

  // For hourly pricing
  initialHours?: number;
  totalHours?: number;
  hoursUsed?: number;
  hoursRemaining?: number;
  packages?: Package[];

  // For fixed pricing
  fixedPrice?: number;
  paid?: boolean;
  paidAmount?: number;
  paymentDate?: string;

  // Dates
  startDate?: string;
  completionDate?: string;
}

export interface Client {
  // Identification
  id: string; // Document ID (same as caseNumber)
  caseNumber: string;
  clientName: string;
  phone: string;
  email: string;

  // Legal Information
  procedureType: ProcedureType;
  status: CaseStatus;
  priority: CasePriority;
  description: string;

  // Management
  assignedTo: string[];
  mainAttorney: string;
  createdBy: string;
  createdAt: Timestamp | string;
  lastModifiedBy: string;
  lastModifiedAt: Timestamp | string;

  // Services
  services: Service[];
  totalServices: number;
  activeServices: number;

  // For 'hours' type (backward compatibility)
  totalHours?: number;
  hoursRemaining?: number;
  minutesRemaining?: number;

  // For 'legal_procedure' type
  currentStage?: string;
  pricingType?: PricingType;
  stages?: Stage[];

  // Statistics
  totalCases?: number;
  activeCases?: number;
}

// ===================================
// Budget Task Types
// ===================================

export type TaskStatus = 'active' | 'completed' | 'cancelled';

export interface BudgetTask {
  id: string;
  clientId: string;
  clientName: string;
  caseNumber?: string;
  description: string;
  status: TaskStatus;
  hours?: number;
  minutes?: number;
  fixedPrice?: number;
  pricingType: 'hours' | 'fixed';
  serviceId?: string | null;
  serviceName?: string | null;
  deadline?: string | Timestamp;
  estimatedHours?: number;
  estimatedMinutes?: number;
  actualHours?: number;
  actualMinutes?: number;
  createdBy: string;
  createdAt: Timestamp | string;
  lastModifiedBy?: string;
  lastModifiedAt?: Timestamp | string;
  completedAt?: Timestamp | string;
  completedBy?: string;
  notes?: string;
}

// ===================================
// Timesheet Types
// ===================================

export type TimesheetStatus = 'pending' | 'approved' | 'rejected';

export interface TimesheetEntry {
  id: string;
  clientId: string;
  clientName: string;
  taskDescription: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
  date: string;
  status: TimesheetStatus;
  createdBy: string;
  createdAt: Timestamp | string;
  approvedBy?: string;
  approvedAt?: Timestamp | string;
  notes?: string;
  budgetTaskId?: string;
}

// ===================================
// Legal Procedure Types
// ===================================

export type ProcedureStatus = 'active' | 'completed' | 'cancelled' | 'on_hold';

export interface LegalProcedure {
  id: string;
  clientId: string;
  clientName: string;
  caseNumber: string;
  title: string;
  description: string;
  status: ProcedureStatus;
  currentStage: string;
  stages: Stage[];
  totalStages: number;
  completedStages: number;
  createdBy: string;
  createdAt: Timestamp | string;
  lastModifiedBy: string;
  lastModifiedAt: Timestamp | string;
  completedAt?: Timestamp | string;
  dueDate?: string;
  priority: CasePriority;
  assignedTo: string[];
}

// ===================================
// Notification Types
// ===================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  timestamp: number;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ===================================
// Filter & Sort Types
// ===================================

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: string;
  direction: SortDirection;
}

export interface FilterConfig {
  status?: string[];
  assignedTo?: string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface PaginationConfig {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ===================================
// Report Types
// ===================================

export interface ReportData {
  title: string;
  description: string;
  generatedAt: string;
  generatedBy: string;
  filters: FilterConfig;
  data: unknown[];
  summary: Record<string, unknown>;
}

// ===================================
// API Response Types
// ===================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface FirebaseFunctionResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  id?: string;
}

// ===================================
// Form Types
// ===================================

export interface ClientFormData {
  clientName: string;
  phone: string;
  email: string;
  procedureType: ProcedureType;
  description?: string;

  // For 'hours' type
  totalHours?: number;
  serviceName?: string;

  // For 'legal_procedure' type
  pricingType?: PricingType;
  stages?: {
    description: string;
    hours?: number;
    fixedPrice?: number;
  }[];
}

export interface BudgetTaskFormData {
  clientId: string;
  description: string;
  pricingType: 'hours' | 'fixed';
  hours?: number;
  minutes?: number;
  fixedPrice?: number;
  notes?: string;
}

export interface TimesheetFormData {
  clientId: string;
  taskDescription: string;
  hours: number;
  minutes: number;
  date: string;
  notes?: string;
  budgetTaskId?: string;
}
