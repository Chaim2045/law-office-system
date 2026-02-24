/**
 * Sidebar Configuration
 * GH Law Office System
 *
 * כל הגדרות הסיידבר במקום אחד.
 * אין hardcoded data — הכל configurable.
 */

export const SIDEBAR_CONFIG = {
  // Brand
  brand: {
    name: 'משרד ע"ד',
    logoUrl: 'images/logo.png',
    fallbackIcon: 'fa-balance-scale'
  },

  // Dimensions
  width: 72,
  flyoutWidth: 200,

  // Root element ID — authentication.js depends on this!
  rootId: 'minimalSidebar',

  // Break button ID — BreakManager depends on this!
  breakButtonId: 'sidebarBreakBtn',

  // Navigation groups
  nav: [
    {
      id: 'work',
      label: 'עבודה שלי',
      icon: 'fa-briefcase',
      defaultPage: 'budget',
      flyout: [
        { id: 'budget', label: 'תקצוב משימות', icon: 'fa-tasks', tabName: 'budget' },
        { id: 'timesheet', label: 'שעתון', icon: 'fa-clock', tabName: 'timesheet' }
      ]
    },
    {
      id: 'beit-midrash',
      label: 'בית מדרש',
      icon: 'fa-book-open',
      tabName: 'beit-midrash',
      badge: 'new'
    },
    {
      id: 'new-case',
      label: 'תיק חדש',
      icon: 'fa-folder-plus',
      flyout: [
        { id: 'new-client', label: 'לקוח חדש', icon: 'fa-user-plus', actionType: 'new-client' },
        { id: 'existing-client', label: 'לקוח קיים', icon: 'fa-user-check', actionType: 'existing-client' }
      ]
    }
  ],

  // Action buttons
  actions: [
    { id: 'refresh', label: 'רענן', icon: 'fa-sync-alt', actionType: 'refresh' }
  ],

  // Footer
  footer: {
    breakButton: { label: 'הפסקה', icon: 'fa-mug-hot' },
    logout: { label: 'יציאה', icon: 'fa-power-off', actionType: 'logout' }
  }
};
