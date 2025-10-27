// useAuth Hook
// ==============
// Custom hook for accessing authentication context

import { useContext } from 'react';
import { AuthContext } from '@context/AuthContext';

/**
 * Custom hook to access AuthContext
 * @throws Error if used outside AuthProvider
 * @returns AuthContext value
 *
 * @example
 * const { user, login, logout, isAuthenticated } = useAuth();
 *
 * // Login
 * await login('user@example.com', 'password');
 *
 * // Logout
 * await logout();
 *
 * // Check if authenticated
 * if (isAuthenticated) {
 *   // User is logged in
 * }
 *
 * // Access user data
 * console.log(user?.displayName);
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
