/**
 * Admin Panel Configuration
 * Central configuration for admin functionality
 * NO PATCHES, NO WORKAROUNDS - Clean architecture
 */

export const ADMIN_CONFIG = {
  // Admin users - single source of truth
  adminEmails: [
    'haim@ghlawoffice.co.il',
    'guy@ghlawoffice.co.il'
  ],

  // Feature flags
  features: {
    userManagement: true,
    systemMonitoring: true,
    dataExport: true,
    auditLogs: true,
    taskManagement: true,
    clientManagement: true,
    timesheetReview: true,
    budgetControl: true,
    smsManagement: true,
    securitySettings: true
  },

  // Navigation items for admin panel
  navigation: [
    {
      title: 'לוח בקרה',
      path: '/admin',
      icon: 'Dashboard',
      permission: 'admin'
    },
    {
      title: 'ניהול משתמשים',
      path: '/admin/users',
      icon: 'People',
      permission: 'admin'
    },
    {
      title: 'ניהול לקוחות',
      path: '/admin/clients',
      icon: 'Business',
      permission: 'admin'
    },
    {
      title: 'משימות ותקציב',
      path: '/admin/tasks',
      icon: 'Assignment',
      permission: 'admin'
    },
    {
      title: 'דוחות שעות',
      path: '/admin/timesheet',
      icon: 'AccessTime',
      permission: 'admin'
    },
    {
      title: 'ניטור מערכת',
      path: '/admin/monitoring',
      icon: 'Monitor',
      permission: 'admin'
    },
    {
      title: 'יומן פעילות',
      path: '/admin/audit',
      icon: 'History',
      permission: 'admin'
    },
    {
      title: 'הגדרות מערכת',
      path: '/admin/settings',
      icon: 'Settings',
      permission: 'admin'
    }
  ],

  // Data refresh intervals (in milliseconds)
  refreshIntervals: {
    dashboard: 30000, // 30 seconds
    monitoring: 10000, // 10 seconds
    users: 60000, // 1 minute
    audit: 120000 // 2 minutes
  },

  // Pagination settings
  pagination: {
    defaultPageSize: 25,
    pageSizeOptions: [10, 25, 50, 100]
  },

  // Export settings
  export: {
    formats: ['CSV', 'Excel', 'PDF'],
    maxRecords: 10000
  },

  // Security settings
  security: {
    sessionTimeout: 3600000, // 1 hour
    requireMFA: false, // Can be enabled later
    auditAllActions: true,
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000 // 1 minute
    }
  }
};

// Type definitions for TypeScript
export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'super_admin';
  permissions: string[];
  lastLogin?: Date;
  customClaims?: {
    admin: boolean;
    [key: string]: any;
  };
}

export interface AdminNavigationItem {
  title: string;
  path: string;
  icon: string;
  permission: string;
  badge?: number;
  children?: AdminNavigationItem[];
}

export interface AdminAuditLog {
  id: string;
  timestamp: Date;
  userId: string;
  userEmail: string;
  action: string;
  category: 'auth' | 'data' | 'system' | 'security';
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
}