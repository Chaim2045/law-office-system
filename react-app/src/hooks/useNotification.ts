// useNotification Hook
// ======================
// Custom hook for accessing notification context

import { useContext } from 'react';
import { NotificationContext } from '@context/NotificationContext';

/**
 * Custom hook to access NotificationContext
 * @throws Error if used outside NotificationProvider
 * @returns NotificationContext value
 *
 * @example
 * const { success, error, warning, info, showNotification } = useNotification();
 *
 * // Show success notification
 * success('פעולה בוצעה בהצלחה!');
 *
 * // Show error notification
 * error('אירעה שגיאה!');
 *
 * // Show warning notification
 * warning('שים לב!');
 *
 * // Show info notification
 * info('מידע חשוב');
 *
 * // Show custom notification
 * showNotification('הודעה מותאמת', 'success', { autoClose: 3000 });
 */
export const useNotification = () => {
  const context = useContext(NotificationContext);

  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }

  return context;
};
