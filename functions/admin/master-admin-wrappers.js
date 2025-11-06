/**
 * Master Admin Panel - Cloud Functions Wrappers
 * Phase 4: Backend Integration
 *
 * פונקציות אלו מקשרות בין ה-UI של Master Admin Panel (Phase 3)
 * לבין המערכת הקיימת של משרד עורכי הדין.
 *
 * כל פונקציה כוללת:
 * - בדיקת הרשאות אדמין
 * - Validation מלא
 * - Audit logging
 * - טיפול בשגיאות
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// שימוש ב-Admin SDK הקיים (מאותחל ב-index.js)
const db = admin.firestore();
const auth = admin.auth();

// ===============================
// Helper Functions
// ===============================

/**
 * בדיקת הרשאות אדמין
 * וידוא שהמשתמש מחובר והוא אדמין
 */
async function checkAdminAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'נדרשת התחברות למערכת'
    );
  }

  const uid = context.auth.uid;

  // שליפת פרטי העובד
  const employeeSnapshot = await db.collection('employees')
    .where('authUID', '==', uid)
    .limit(1)
    .get();

  if (employeeSnapshot.empty) {
    throw new functions.https.HttpsError(
      'not-found',
      'עובד לא נמצא במערכת'
    );
  }

  const employeeDoc = employeeSnapshot.docs[0];
  const employee = employeeDoc.data();

  // בדיקת הרשאות אדמין
  if (employee.role !== 'admin') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'גישה מוגבלת למנהלי מערכת בלבד'
    );
  }

  // בדיקה שהעובד פעיל
  if (!employee.isActive) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'חשבון המשתמש לא פעיל'
    );
  }

  return {
    uid,
    email: employeeDoc.id,
    username: employee.username,
    employee: employee,
    role: employee.role
  };
}

/**
 * רישום לוג ביקורת
 */
async function logAction(action, userId, username, details = {}) {
  try {
    await db.collection('audit_log').add({
      action,
      userId,
      username,
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userAgent: details.userAgent || null,
      ipAddress: details.ipAddress || null
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * ניקוי HTML (מניעת XSS)
 */
function sanitizeString(str) {
  if (!str) return '';
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validation של אימייל
 */
function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validation של סיסמה
 */
function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 6) {
    errors.push('סיסמה חייבת להכיל לפחות 6 תווים');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('סיסמה חייבת להכיל לפחות אות גדולה אחת באנגלית');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('סיסמה חייבת להכיל לפחות אות קטנה אחת באנגלית');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('סיסמה חייבת להכיל לפחות ספרה אחת');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validation של תפקיד
 */
function validateRole(role) {
  const validRoles = ['admin', 'lawyer', 'employee'];
  return validRoles.includes(role);
}

// ===============================
// Cloud Functions
// ===============================

/**
 * 1️⃣ יצירת משתמש חדש
 * נקרא מ-Master Admin Panel כאשר לוחצים "הוסף משתמש"
 */
exports.createUser = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔵 createUser called with data:', { email: data.email, role: data.role });

    // בדיקת הרשאות אדמין
    const adminUser = await checkAdminAuth(context);

    // Validation
    if (!data.email || !validateEmail(data.email)) {
      throw new functions.https.HttpsError('invalid-argument', 'כתובת מייל לא תקינה');
    }

    if (!data.password) {
      throw new functions.https.HttpsError('invalid-argument', 'סיסמה נדרשת');
    }

    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      throw new functions.https.HttpsError('invalid-argument', passwordValidation.errors.join(', '));
    }

    if (!data.displayName || data.displayName.trim().length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'שם מלא נדרש');
    }

    if (!data.role || !validateRole(data.role)) {
      throw new functions.https.HttpsError('invalid-argument', 'תפקיד לא תקין');
    }

    // בדיקה שהמייל לא קיים
    try {
      const existingUser = await auth.getUserByEmail(data.email);
      if (existingUser) {
        throw new functions.https.HttpsError('already-exists', 'משתמש עם מייל זה כבר קיים במערכת');
      }
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // יצירת המשתמש ב-Firebase Auth
    const userRecord = await auth.createUser({
      email: data.email,
      password: data.password,
      displayName: sanitizeString(data.displayName),
      emailVerified: false,
      disabled: false
    });

    // הגדרת Custom Claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: data.role
    });

    // יצירת username מה-email
    const username = data.username || data.email.split('@')[0];

    // יצירת מסמך ב-Firestore (EMAIL = Document ID)
    await db.collection('employees').doc(data.email).set({
      authUID: userRecord.uid,
      username: username,
      displayName: sanitizeString(data.displayName),
      name: sanitizeString(data.displayName),
      email: data.email,
      phone: data.phone || '',
      role: data.role,
      isActive: true,
      mustChangePassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: adminUser.username,
      lastLogin: null,
      loginCount: 0,
      migratedToAuth: true
    });

    // Audit log
    await logAction('CREATE_USER', adminUser.uid, adminUser.username, {
      targetEmail: data.email,
      targetRole: data.role,
      targetName: data.displayName
    });

    console.log('✅ User created successfully:', data.email);

    return {
      success: true,
      userId: userRecord.uid,
      email: userRecord.email,
      message: 'משתמש נוצר בהצלחה'
    };

  } catch (error) {
    console.error('❌ Error in createUser:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת משתמש: ${error.message}`
    );
  }
});

/**
 * 2️⃣ עדכון משתמש קיים
 * נקרא מ-Master Admin Panel כאשר לוחצים "ערוך משתמש"
 */
exports.updateUser = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔵 updateUser called with data:', { email: data.email });

    // בדיקת הרשאות אדמין
    const adminUser = await checkAdminAuth(context);

    // Validation
    if (!data.email || !validateEmail(data.email)) {
      throw new functions.https.HttpsError('invalid-argument', 'כתובת מייל לא תקינה');
    }

    // שליפת המשתמש הקיים
    const employeeDoc = await db.collection('employees').doc(data.email).get();

    if (!employeeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'משתמש לא נמצא');
    }

    const employeeData = employeeDoc.data();

    // הכנת עדכונים
    const updates = {};

    if (data.displayName) {
      updates.displayName = sanitizeString(data.displayName);
      updates.name = sanitizeString(data.displayName);
    }

    if (data.username) {
      updates.username = data.username;
    }

    if (data.phone !== undefined) {
      updates.phone = data.phone;
    }

    if (data.role && validateRole(data.role)) {
      updates.role = data.role;

      // עדכון Custom Claims
      if (employeeData.authUID) {
        await auth.setCustomUserClaims(employeeData.authUID, {
          role: data.role
        });
      }
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    updates.updatedBy = adminUser.username;

    // עדכון ב-Firestore
    await db.collection('employees').doc(data.email).update(updates);

    // עדכון displayName ב-Auth אם השתנה
    if (data.displayName && employeeData.authUID) {
      try {
        await auth.updateUser(employeeData.authUID, {
          displayName: sanitizeString(data.displayName)
        });
      } catch (authError) {
        console.warn('Could not update Auth displayName:', authError);
      }
    }

    // Audit log
    await logAction('UPDATE_USER', adminUser.uid, adminUser.username, {
      targetEmail: data.email,
      updates: updates
    });

    console.log('✅ User updated successfully:', data.email);

    return {
      success: true,
      email: data.email,
      message: 'משתמש עודכן בהצלחה'
    };

  } catch (error) {
    console.error('❌ Error in updateUser:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בעדכון משתמש: ${error.message}`
    );
  }
});

/**
 * 3️⃣ חסימה/ביטול חסימה של משתמש
 * נקרא מ-Master Admin Panel כאשר לוחצים "חסום משתמש"
 */
exports.blockUser = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔵 blockUser called with data:', { email: data.email, block: data.block });

    // בדיקת הרשאות אדמין
    const adminUser = await checkAdminAuth(context);

    // Validation
    if (!data.email || !validateEmail(data.email)) {
      throw new functions.https.HttpsError('invalid-argument', 'כתובת מייל לא תקינה');
    }

    if (typeof data.block !== 'boolean') {
      throw new functions.https.HttpsError('invalid-argument', 'חסר פרמטר block');
    }

    // שליפת המשתמש
    const employeeDoc = await db.collection('employees').doc(data.email).get();

    if (!employeeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'משתמש לא נמצא');
    }

    const employeeData = employeeDoc.data();

    // מניעת חסימה עצמית
    if (data.email === adminUser.email) {
      throw new functions.https.HttpsError('invalid-argument', 'לא ניתן לחסום את עצמך');
    }

    // חסימה ב-Firebase Auth
    if (employeeData.authUID) {
      await auth.updateUser(employeeData.authUID, {
        disabled: data.block
      });
    }

    // עדכון ב-Firestore
    await db.collection('employees').doc(data.email).update({
      isActive: !data.block,
      blockedAt: data.block ? admin.firestore.FieldValue.serverTimestamp() : null,
      blockedBy: data.block ? adminUser.username : null,
      blockReason: data.block ? (data.reason || 'לא צוין') : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: adminUser.username
    });

    // Audit log
    await logAction(
      data.block ? 'BLOCK_USER' : 'UNBLOCK_USER',
      adminUser.uid,
      adminUser.username,
      {
        targetEmail: data.email,
        reason: data.reason || 'לא צוין'
      }
    );

    console.log(`✅ User ${data.block ? 'blocked' : 'unblocked'} successfully:`, data.email);

    return {
      success: true,
      email: data.email,
      message: data.block ? 'משתמש נחסם בהצלחה' : 'חסימת משתמש בוטלה בהצלחה'
    };

  } catch (error) {
    console.error('❌ Error in blockUser:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בחסימת משתמש: ${error.message}`
    );
  }
});

/**
 * 4️⃣ מחיקת משתמש
 * נקרא מ-Master Admin Panel כאשר לוחצים "מחק משתמש"
 * ⚠️ פעולה בלתי הפיכה - דורשת אישור כפול ב-UI
 */
exports.deleteUser = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔵 deleteUser called with data:', { email: data.email });

    // בדיקת הרשאות אדמין
    const adminUser = await checkAdminAuth(context);

    // Validation
    if (!data.email || !validateEmail(data.email)) {
      throw new functions.https.HttpsError('invalid-argument', 'כתובת מייל לא תקינה');
    }

    // מניעת מחיקה עצמית
    if (data.email === adminUser.email) {
      throw new functions.https.HttpsError('invalid-argument', 'לא ניתן למחוק את עצמך');
    }

    // שליפת המשתמש
    const employeeDoc = await db.collection('employees').doc(data.email).get();

    if (!employeeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'משתמש לא נמצא');
    }

    const employeeData = employeeDoc.data();

    // שמירת נתונים ל-Audit
    const deletedUserData = {
      email: data.email,
      username: employeeData.username,
      displayName: employeeData.displayName,
      role: employeeData.role
    };

    // מחיקה מ-Firebase Auth
    if (employeeData.authUID) {
      try {
        await auth.deleteUser(employeeData.authUID);
        console.log('  ✅ Deleted from Auth');
      } catch (authError) {
        console.warn('Could not delete from Auth:', authError);
      }
    }

    // מחיקה מ-Firestore
    await db.collection('employees').doc(data.email).delete();
    console.log('  ✅ Deleted from Firestore');

    // Audit log (חשוב במיוחד למחיקה!)
    await logAction('DELETE_USER', adminUser.uid, adminUser.username, {
      deletedUser: deletedUserData,
      reason: data.reason || 'לא צוין'
    });

    console.log('✅ User deleted successfully:', data.email);

    return {
      success: true,
      email: data.email,
      message: 'משתמש נמחק בהצלחה'
    };

  } catch (error) {
    console.error('❌ Error in deleteUser:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במחיקת משתמש: ${error.message}`
    );
  }
});

/**
 * 5️⃣ שליפת פרטים מלאים של משתמש
 * נקרא מ-Master Admin Panel כאשר לוחצים "צפה בפרטים"
 * מחזיר: פרטי משתמש, לקוחות, משימות, שעות, פעילות
 */
exports.getUserFullDetails = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔵 getUserFullDetails called with data:', { email: data.email });

    // בדיקת הרשאות אדמין
    const adminUser = await checkAdminAuth(context);

    // Validation
    if (!data.email || !validateEmail(data.email)) {
      throw new functions.https.HttpsError('invalid-argument', 'כתובת מייל לא תקינה');
    }

    // שליפת פרטי משתמש
    const employeeDoc = await db.collection('employees').doc(data.email).get();

    if (!employeeDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'משתמש לא נמצא');
    }

    const employeeData = employeeDoc.data();
    const username = employeeData.username || data.email.split('@')[0];

    // שליפה מקבילה של כל הנתונים (Performance Optimization)
    const [
      authUserData,
      clientsSnapshot,
      tasksSnapshot,
      timesheetSnapshot,
      activitySnapshot
    ] = await Promise.all([
      // שליפת נתוני Auth
      employeeData.authUID ? auth.getUser(employeeData.authUID).catch(() => null) : Promise.resolve(null),

      // שליפת לקוחות (תיקים)
      db.collection('clients')
        .where('assignedTo', 'array-contains', username)
        .limit(50)
        .get(),

      // שליפת משימות
      db.collection('budget_tasks')
        .where('employee', '==', data.email) // ✅ Use EMAIL (not username)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get(),

      // שליפת שעות (מתחילת החודש)
      db.collection('timesheet_entries')
        .where('employee', '==', username)
        .where('date', '>=', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
        .orderBy('date', 'desc')
        .get(),

      // שליפת פעילות אחרונה
      db.collection('audit_log')
        .where('userId', '==', employeeData.authUID || '')
        .orderBy('timestamp', 'desc')
        .limit(50)
        .get()
    ]);

    // עיבוד תיקים
    const clients = clientsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // עיבוד משימות
    const tasks = tasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // עיבוד שעות
    const timesheet = timesheetSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // חישוב סטטיסטיקות שעות
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];

    let hoursThisWeek = 0;
    let hoursThisMonth = 0;

    timesheet.forEach(entry => {
      const hours = (entry.minutes || 0) / 60;
      hoursThisMonth += hours;

      if (entry.date >= weekAgoStr) {
        hoursThisWeek += hours;
      }
    });

    // עיבוד פעילות
    const activity = activitySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        action: data.action,
        timestamp: data.timestamp,
        details: data.details
      };
    });

    // בניית תשובה
    const response = {
      success: true,
      user: {
        email: data.email,
        username: username,
        displayName: employeeData.displayName || employeeData.name,
        role: employeeData.role,
        phone: employeeData.phone || '',
        isActive: employeeData.isActive,
        createdAt: employeeData.createdAt,
        lastLogin: employeeData.lastLogin,
        loginCount: employeeData.loginCount || 0,
        photoURL: authUserData?.photoURL || null,
        emailVerified: authUserData?.emailVerified || false
      },
      clients: clients,
      tasks: tasks,
      timesheet: timesheet,
      activity: activity,
      stats: {
        totalClients: clients.length,
        activeTasks: tasks.filter(t => t.status === 'ממתין' || t.status === 'בטיפול').length,
        completedTasks: tasks.filter(t => t.status === 'הושלם').length,
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        hoursThisMonth: Math.round(hoursThisMonth * 10) / 10
      }
    };

    // Audit log
    await logAction('VIEW_USER_DETAILS', adminUser.uid, adminUser.username, {
      targetEmail: data.email
    });

    console.log('✅ User details retrieved successfully:', data.email);

    return response;

  } catch (error) {
    console.error('❌ Error in getUserFullDetails:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בשליפת פרטי משתמש: ${error.message}`
    );
  }
});
