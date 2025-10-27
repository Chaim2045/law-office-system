// Authentication Context
// =======================
// מערכת ניהול משתמשים והתחברות

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@services/firebase/config';
import type { User } from '../types';
import { toast } from 'react-toastify';

// ===================================
// Context Types
// ===================================

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

// ===================================
// Create Context
// ===================================

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===================================
// Auth Provider Component
// ===================================

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch user details from Firestore employees collection
   * @param uid Firebase Auth UID
   * @returns User object or null
   */
  const fetchUserDetails = async (uid: string): Promise<User | null> => {
    try {
      // Query employees collection by authUID
      const employeesRef = collection(db, 'employees');
      const q = query(employeesRef, where('authUID', '==', uid), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.error('❌ User not found in employees collection');
        throw new Error('משתמש לא נמצא במערכת');
      }

      const employeeDoc = snapshot.docs[0];
      const employeeData = employeeDoc.data();

      // Construct User object
      const userDetails: User = {
        uid: uid,
        email: employeeData.email || '',
        displayName: employeeData.name || employeeData.username || 'משתמש',
        username: employeeData.username || employeeData.name || 'משתמש',
        role: employeeData.role || 'assistant',
        isActive: employeeData.isActive !== false,
        createdAt: employeeData.createdAt || new Date().toISOString(),
        lastLogin: employeeData.lastLogin,
      };

      // Update lastLogin in Firestore
      try {
        const userDocRef = doc(db, 'employees', employeeData.email);
        await updateDoc(userDocRef, {
          lastLogin: serverTimestamp(),
          loginCount: increment(1),
        });
        console.log('✅ lastLogin updated successfully');
      } catch (updateError) {
        console.warn('⚠️ Failed to update lastLogin:', updateError);
      }

      return userDetails;
    } catch (err) {
      console.error('❌ Error fetching user details:', err);
      throw err;
    }
  };

  /**
   * Login with email and password
   * @param email User email
   * @param password User password
   */
  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Fetch user details from Firestore
      const userDetails = await fetchUserDetails(uid);

      if (!userDetails) {
        throw new Error('לא ניתן לטעון את פרטי המשתמש');
      }

      // Check if user is active
      if (!userDetails.isActive) {
        await signOut(auth);
        throw new Error('חשבון זה הושבת. צור קשר עם המנהל');
      }

      setUser(userDetails);
      toast.success(`ברוך הבא, ${userDetails.displayName}!`);
      console.log('✅ User logged in successfully:', userDetails.email);
    } catch (err: unknown) {
      console.error('❌ Login error:', err);

      let errorMessage = 'אימייל או סיסמה שגויים';

      if (err && typeof err === 'object' && 'code' in err) {
        const errorCode = (err as { code: string }).code;

        switch (errorCode) {
          case 'auth/user-not-found':
            errorMessage = 'משתמש לא נמצא';
            break;
          case 'auth/wrong-password':
            errorMessage = 'סיסמה שגויה';
            break;
          case 'auth/invalid-email':
            errorMessage = 'כתובת אימייל לא תקינה';
            break;
          case 'auth/user-disabled':
            errorMessage = 'חשבון זה הושבת. צור קשר עם המנהל';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'פרטי התחברות שגויים';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'יותר מדי ניסיונות התחברות. נסה שוב מאוחר יותר';
            break;
        }
      }

      if (err && typeof err === 'object' && 'message' in err) {
        const message = (err as { message: string }).message;
        if (message.includes('משתמש לא נמצא במערכת')) {
          errorMessage = 'משתמש לא קיים במערכת';
        }
      }

      setError(errorMessage);
      toast.error(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logout current user
   */
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
      setError(null);
      toast.info('התנתקת בהצלחה');
      console.log('✅ User logged out successfully');
    } catch (err) {
      console.error('❌ Logout error:', err);
      toast.error('שגיאה בהתנתקות');
      throw err;
    }
  };

  /**
   * Listen to auth state changes
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);

      if (firebaseUser) {
        try {
          // User is signed in - fetch their details
          const userDetails = await fetchUserDetails(firebaseUser.uid);
          setUser(userDetails);
        } catch (err) {
          console.error('❌ Error in auth state change:', err);
          setUser(null);
          await signOut(auth);
        }
      } else {
        // User is signed out
        setUser(null);
      }

      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // ===================================
  // Context Value
  // ===================================

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
