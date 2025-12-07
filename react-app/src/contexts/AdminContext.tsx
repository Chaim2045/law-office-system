/**
 * Admin Context
 * Manages admin authentication and authorization
 * Clean architecture - no patches or workarounds
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { ADMIN_CONFIG } from '../config/adminConfig';
import { User } from 'firebase/auth';

interface AdminContextType {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isLoadingAdmin: boolean;
  adminUser: AdminUser | null;
  checkAdminStatus: () => Promise<void>;
  refreshAdminClaims: () => Promise<void>;
  canAccessFeature: (feature: string) => boolean;
}

interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  customClaims: any;
  permissions: string[];
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};

export const AdminProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(true);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  /**
   * Check if current user has admin privileges
   * Uses Custom Claims as primary method (no email fallbacks!)
   */
  const checkAdminStatus = async () => {
    try {
      setIsLoadingAdmin(true);
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminUser(null);
        return;
      }

      // Get fresh ID token with custom claims
      const tokenResult = await currentUser.getIdTokenResult(true);
      const claims = tokenResult.claims;

      // Check admin status from custom claims ONLY
      const hasAdminClaim = claims.admin === true || claims.role === 'admin';
      const hasSuperAdminClaim = claims.role === 'super_admin';

      // Also verify in Firestore for additional user data
      const employeeDoc = await db
        .collection('employees')
        .doc(currentUser.email!)
        .get();

      if (employeeDoc.exists) {
        const employeeData = employeeDoc.data();

        // Admin must have BOTH custom claim AND be in admin list
        const isInAdminList = ADMIN_CONFIG.adminEmails.includes(currentUser.email!);
        const isValidAdmin = hasAdminClaim && isInAdminList;

        setIsAdmin(isValidAdmin);
        setIsSuperAdmin(hasSuperAdminClaim && isInAdminList);

        if (isValidAdmin) {
          setAdminUser({
            uid: currentUser.uid,
            email: currentUser.email!,
            displayName: employeeData?.displayName || employeeData?.username || currentUser.displayName || '',
            role: employeeData?.role || 'admin',
            customClaims: claims,
            permissions: employeeData?.permissions || []
          });

          // Log admin access for audit
          await logAdminAccess(currentUser);
        } else {
          setAdminUser(null);
        }
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminUser(null);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setAdminUser(null);
    } finally {
      setIsLoadingAdmin(false);
    }
  };

  /**
   * Force refresh of admin claims from server
   */
  const refreshAdminClaims = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.getIdToken(true);
      await checkAdminStatus();
    }
  };

  /**
   * Check if admin can access specific feature
   */
  const canAccessFeature = (feature: string): boolean => {
    if (!isAdmin) return false;

    // Super admin can access everything
    if (isSuperAdmin) return true;

    // Check feature flags
    const featureKey = feature as keyof typeof ADMIN_CONFIG.features;
    return ADMIN_CONFIG.features[featureKey] === true;
  };

  /**
   * Log admin access for audit trail
   */
  const logAdminAccess = async (user: User) => {
    try {
      await db.collection('audit_logs').add({
        timestamp: new Date(),
        userId: user.uid,
        userEmail: user.email,
        action: 'ADMIN_ACCESS',
        category: 'auth',
        details: {
          message: 'Admin panel accessed',
          ip: window.location.hostname,
          userAgent: navigator.userAgent
        }
      });
    } catch (error) {
      console.error('Failed to log admin access:', error);
    }
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        await checkAdminStatus();
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminUser(null);
        setIsLoadingAdmin(false);
      }
    });

    return unsubscribe;
  }, []);

  // ✅ REMOVED: Periodic re-check interval (was polling every 5 minutes)
  // Firebase Auth automatically handles token refresh
  // No need for manual polling - saves unnecessary Firestore reads

  const value = {
    isAdmin,
    isSuperAdmin,
    isLoadingAdmin,
    adminUser,
    checkAdminStatus,
    refreshAdminClaims,
    canAccessFeature
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};