// Notification Context
// ======================
// מערכת התראות ומסרים למשתמש

import React, { createContext, ReactNode, useCallback } from 'react';
import { toast, ToastOptions } from 'react-toastify';
import type { NotificationType } from '../types';

// ===================================
// Context Types
// ===================================

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  warning: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

// ===================================
// Create Context
// ===================================

export const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

// ===================================
// Notification Provider Component
// ===================================

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  /**
   * Default toast options (RTL support)
   */
  const defaultOptions: ToastOptions = {
    position: 'top-left',
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    rtl: true,
    theme: 'light',
  };

  /**
   * Show a notification with custom type
   * @param message Message to display
   * @param type Notification type (success, error, warning, info)
   * @param options Additional toast options
   */
  const showNotification = useCallback(
    (message: string, type: NotificationType = 'info', options?: ToastOptions) => {
      const mergedOptions = { ...defaultOptions, ...options };

      switch (type) {
        case 'success':
          toast.success(message, mergedOptions);
          break;
        case 'error':
          toast.error(message, mergedOptions);
          break;
        case 'warning':
          toast.warning(message, mergedOptions);
          break;
        case 'info':
        default:
          toast.info(message, mergedOptions);
          break;
      }
    },
    []
  );

  /**
   * Success notification shorthand
   */
  const success = useCallback((message: string, options?: ToastOptions) => {
    showNotification(message, 'success', options);
  }, [showNotification]);

  /**
   * Error notification shorthand
   */
  const error = useCallback((message: string, options?: ToastOptions) => {
    showNotification(message, 'error', options);
  }, [showNotification]);

  /**
   * Warning notification shorthand
   */
  const warning = useCallback((message: string, options?: ToastOptions) => {
    showNotification(message, 'warning', options);
  }, [showNotification]);

  /**
   * Info notification shorthand
   */
  const info = useCallback((message: string, options?: ToastOptions) => {
    showNotification(message, 'info', options);
  }, [showNotification]);

  // ===================================
  // Context Value
  // ===================================

  const value: NotificationContextType = {
    showNotification,
    success,
    error,
    warning,
    info,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};
