/** Auth Module — אימות, הרשאות, ניהול משתמשים */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');
const { sanitizeString, isValidEmail } = require('../shared/validators');

const db = admin.firestore();
const auth = admin.auth();

// ===============================
// Authentication Functions
// ===============================

/**
 * יצירת משתמש חדש ב-Firebase Authentication
 * רק למנהלים (admin)
 */
exports.createAuthUser = functions.https.onCall(async (data, context) => {
  try {
    // בדיקת הרשאות
    const caller = await checkUserPermissions(context);

    if (caller.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים ליצור משתמשים חדשים'
      );
    }

    // Validation
    if (!data.email || !data.password || !data.displayName) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים שדות חובה: email, password, displayName'
      );
    }

    if (!isValidEmail(data.email)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'כתובת אימייל לא תקינה'
      );
    }

    if (data.password.length < 6) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סיסמה חייבת להיות לפחות 6 תווים'
      );
    }

    // בדיקה אם המשתמש כבר קיים
    try {
      await auth.getUserByEmail(data.email);
      throw new functions.https.HttpsError(
        'already-exists',
        `משתמש עם האימייל ${data.email} כבר קיים`
      );
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // יצירת המשתמש
    const userRecord = await auth.createUser({
      email: data.email,
      password: data.password,
      displayName: sanitizeString(data.displayName),
      emailVerified: false,
      disabled: !data.isActive
    });

    // הגדרת Custom Claims
    await auth.setCustomUserClaims(userRecord.uid, {
      role: data.role || 'employee',
      oldUsername: data.oldUsername || null
    });

    // יצירת מסמך ב-Firestore (use EMAIL as document ID - industry standard)
    await db.collection('employees').doc(data.email).set({
      authUID: userRecord.uid,
      username: data.oldUsername || data.email.split('@')[0],  // username for display
      displayName: sanitizeString(data.displayName),
      name: sanitizeString(data.displayName),
      email: data.email,
      role: data.role || 'employee',
      isActive: data.isActive !== false,
      mustChangePassword: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: caller.username,
      lastLogin: null,
      loginCount: 0,
      migratedToAuth: true
    });

    // Audit log
    await logAction('CREATE_USER', caller.uid, caller.username, {
      newUserId: userRecord.uid,
      newUserEmail: data.email,
      role: data.role
    });

    return {
      success: true,
      uid: userRecord.uid,
      email: userRecord.email
    };

  } catch (error) {
    console.error('Error in createAuthUser:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה ביצירת משתמש: ${error.message}`
    );
  }
});

exports.linkAuthToEmployee = functions.https.onCall(async (data, context) => {
  try {
    const user = await checkUserPermissions(context);

    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים לקשר Auth UID לעובדים'
      );
    }

    // Note: Now using EMAIL as document ID (industry standard)
    if (!data.email || !data.authUID) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסרים שדות: email, authUID'
      );
    }

    // עדכון העובד (use EMAIL as document ID)
    await db.collection('employees').doc(data.email).update({
      authUID: data.authUID,
      migratedToAuth: true,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedBy: user.username
    });

    // Audit log
    await logAction('LINK_AUTH_TO_EMPLOYEE', user.uid, user.username, {
      employeeEmail: data.email,
      authUID: data.authUID
    });

    return {
      success: true,
      username: data.username
    };

  } catch (error) {
    console.error('Error in linkAuthToEmployee:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בקישור Auth: ${error.message}`
    );
  }
});

/**
 * setAdminClaim - מגדיר Custom Claim של admin למשתמש
 * מאפשר הרשאות מתקדמות ב-Security Rules
 */
exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔐 Starting setAdminClaim...');

    // בדיקת הרשאות - רק מי שכבר admin יכול להריץ
    const employee = await checkUserPermissions(context);
    if (!employee.isAdmin) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להגדיר הרשאות admin'
      );
    }

    const { email, isAdmin } = data;

    if (!email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חובה לספק email'
      );
    }

    // מצא את המשתמש לפי email
    const userRecord = await auth.getUserByEmail(email);

    // הגדר את ה-custom claim
    await auth.setCustomUserClaims(userRecord.uid, {
      admin: isAdmin === true
    });

    console.log(`✅ Custom claim set for ${email}: admin=${isAdmin}`);

    // רישום פעילות
    await logActivity({
      actionType: 'ADMIN_CLAIM_SET',
      targetType: 'user',
      targetId: userRecord.uid,
      performedBy: employee.name,
      performedByUID: context.auth.uid,
      details: {
        email: email,
        isAdmin: isAdmin
      },
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: `הרשאת admin עודכנה בהצלחה עבור ${email}`,
      email: email,
      isAdmin: isAdmin
    };

  } catch (error) {
    console.error('Error in setAdminClaim:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהגדרת הרשאות: ${error.message}`
    );
  }
});

/**
 * initializeAdminClaims - מאתחל custom claims לכל המנהלים
 * פועל פעם אחת להגדרת ההרשאות הראשונית
 * אין בדיקת הרשאות כי זו הפעם הראשונה
 */
exports.initializeAdminClaims = functions.https.onCall(async (data, context) => {
  try {
    console.log('🔐 Starting initializeAdminClaims...');

    // בדיקה שהמשתמש מחובר (אבל לא בודקים אם הוא admin כי זו הפעם הראשונה)
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'נדרשת התחברות למערכת'
      );
    }

    // מצא את כל העובדים שמסומנים כ-admin
    const adminsSnapshot = await db.collection('employees')
      .where('isAdmin', '==', true)
      .get();

    const results = [];

    for (const doc of adminsSnapshot.docs) {
      const employeeData = doc.data();
      const email = employeeData.email;

      try {
        const userRecord = await auth.getUserByEmail(email);

        await auth.setCustomUserClaims(userRecord.uid, {
          admin: true
        });

        console.log(`✅ Set admin claim for: ${email}`);
        results.push({
          email: email,
          success: true
        });

      } catch (error) {
        console.error(`❌ Failed to set claim for ${email}:`, error);
        results.push({
          email: email,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`✅ Initialized admin claims for ${results.filter(r => r.success).length}/${results.length} users`);

    return {
      success: true,
      message: `אותחלו הרשאות admin`,
      results: results,
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

  } catch (error) {
    console.error('Error in initializeAdminClaims:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה באתחול הרשאות: ${error.message}`
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 🔐 SET ADMIN CLAIMS - One-Time Setup Function
// ═══════════════════════════════════════════════════════════════════════
exports.setAdminClaims = functions.https.onRequest(async (req, res) => {
  const adminEmails = [
    'haim@ghlawoffice.co.il',
    'guy@ghlawoffice.co.il'
  ];

  const results = [];

  for (const email of adminEmails) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(user.uid, { role: 'admin' });
      results.push(`✅ Set admin claims for: ${email}`);
      console.log(`✅ Set admin claims for: ${email}`);
    } catch (error) {
      results.push(`❌ Error setting claims for ${email}: ${error.message}`);
      console.error(`❌ Error setting claims for ${email}:`, error);
    }
  }

  res.json({
    success: true,
    results: results
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 🔍 VERIFY CLAIMS — Read-Only Diagnostic (PR-H.0.0.A)
// ═══════════════════════════════════════════════════════════════════════
//
// Purpose: Inspect the actual state of Firebase Auth custom claims vs the
// employees collection role field. NO WRITES. Pure observability.
//
// Why this exists (planning context):
//   The AI Management Layer plan (Pre-H.0.0) depends on a custom claim
//   `role: 'partner'` for Guy and Haim. Earlier investigation suggested
//   that drift exists between employees.role (Firestore field) and
//   auth.token.role (custom claim). Devils-advocate then flagged that:
//     1. `firestore.rules:239` matches `request.auth.token.role in
//        resource.data.toRoles` — so setting a 'partner' claim is NOT
//        infrastructure-only, it could grant immediate read access to any
//        messages document whose toRoles array contains 'partner'.
//     2. Two claim shapes coexist in this codebase:
//        - {admin: true}     — written by initializeAdminClaims (legacy)
//        - {role: 'admin'}   — written by setAdminClaims
//        apps/admin-panel/js/core/auth.js accepts both. Overwriting one
//        with the other would silently demote that user.
//     3. The employees document might not be the absolute source of truth.
//        Someone may have been granted a claim manually via Firebase Console.
//   Before any partner-claim write, we MUST inspect the actual production
//   state. This function provides that inspection without any side effects.
//
// Auth: caller MUST be an admin (accepts BOTH claim shapes during the
// transition, since this is the function diagnosing the transition).
exports.verifyClaims = functions.https.onCall(async (data, context) => {
  // ─── Auth gate — accepts BOTH legacy and current claim shapes ───
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'נדרשת התחברות למערכת'
    );
  }
  const claims = context.auth.token || {};
  const isAdmin = (claims.role === 'admin') || (claims.admin === true);
  if (!isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'גישה לדיאגנוסטיקה זו מותרת רק למנהל מערכת'
    );
  }

  const startedAt = Date.now();
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    triggeredBy: {
      uid: context.auth.uid,
      email: claims.email || null
    },
    employees: [],
    claimShapeBreakdown: {
      role_string_only: 0,
      admin_boolean_only: 0,
      both_shapes: 0,
      no_claim: 0,
      auth_user_missing: 0
    },
    mismatches: [],
    messagesWithPartnerToRoles: { scanned: false, count: 0, samples: [], error: null },
    summary: {},
    notes: []
  };

  // ─── (1) Read all employees from Firestore ───
  let employeesSnapshot;
  try {
    employeesSnapshot = await db.collection('employees').get();
  } catch (err) {
    console.error('[verifyClaims] Failed to read employees collection', {
      error: err.message,
      triggeredBy: report.triggeredBy.email
    });
    throw new functions.https.HttpsError(
      'internal',
      'שגיאה בקריאת רשימת העובדים. נסה שוב או פנה למפתח.'
    );
  }

  // ─── (2) For each employee, fetch their auth user record + custom claims ───
  for (const empDoc of employeesSnapshot.docs) {
    const empEmail = empDoc.id;
    const empData = empDoc.data() || {};
    const firestoreRole = empData.role || null;
    const isActive = empData.isActive !== false; // default true unless explicitly false

    const entry = {
      email: empEmail,
      isActive: isActive,
      firestoreRole: firestoreRole,
      authUid: null,
      authError: null,
      customClaims: null,
      claimShape: 'no_claim',
      tokenRole: null,
      adminBoolean: false,
      mismatch: null
    };

    try {
      const authUser = await auth.getUserByEmail(empEmail);
      entry.authUid = authUser.uid;
      const cc = authUser.customClaims || {};
      entry.customClaims = cc;
      entry.tokenRole = cc.role || null;
      entry.adminBoolean = cc.admin === true;

      // Determine claim shape
      if (entry.tokenRole && entry.adminBoolean) {
        entry.claimShape = 'both_shapes';
        report.claimShapeBreakdown.both_shapes++;
      } else if (entry.tokenRole) {
        entry.claimShape = 'role_string_only';
        report.claimShapeBreakdown.role_string_only++;
      } else if (entry.adminBoolean) {
        entry.claimShape = 'admin_boolean_only';
        report.claimShapeBreakdown.admin_boolean_only++;
      } else {
        entry.claimShape = 'no_claim';
        report.claimShapeBreakdown.no_claim++;
      }
    } catch (err) {
      // Auth user does not exist for this employee email
      entry.authError = err.code || err.message || 'unknown';
      report.claimShapeBreakdown.auth_user_missing++;
    }

    // ─── (3) Detect mismatches (Firestore vs claim) ───
    // Rules:
    //   - Firestore says admin → expect claim is admin (either shape)
    //   - Firestore says partner → expect tokenRole === 'partner'
    //   - Firestore says employee/null → expect NO elevated claim
    if (entry.authError) {
      entry.mismatch = null; // can't compare without auth user
    } else if (firestoreRole === 'admin') {
      const hasAdminClaim = entry.tokenRole === 'admin' || entry.adminBoolean;
      if (!hasAdminClaim) {
        entry.mismatch = 'firestore_admin_no_claim';
      }
    } else if (firestoreRole === 'partner') {
      if (entry.tokenRole !== 'partner') {
        entry.mismatch = 'firestore_partner_no_claim';
      }
    } else {
      // employee or null — should have NO elevated claim
      if (entry.tokenRole || entry.adminBoolean) {
        entry.mismatch = 'firestore_employee_has_elevated_claim';
      }
    }

    if (entry.mismatch) {
      report.mismatches.push({
        email: entry.email,
        firestoreRole: entry.firestoreRole,
        tokenRole: entry.tokenRole,
        adminBoolean: entry.adminBoolean,
        kind: entry.mismatch
      });
    }

    report.employees.push(entry);
  }

  // ─── (4) Scan messages collection for any doc with 'partner' in toRoles ───
  // This is the Devils-Advocate concern: setting a partner claim could grant
  // immediate read access to any such document via firestore.rules:239.
  try {
    const messagesSnap = await db.collection('messages')
      .where('toRoles', 'array-contains', 'partner')
      .limit(100)
      .get();

    report.messagesWithPartnerToRoles.scanned = true;
    report.messagesWithPartnerToRoles.count = messagesSnap.size;
    report.messagesWithPartnerToRoles.samples = messagesSnap.docs.slice(0, 10).map(d => {
      const md = d.data() || {};
      return {
        id: d.id,
        toRoles: md.toRoles || null,
        createdAt: md.createdAt || md.timestamp || null
      };
    });
    if (messagesSnap.size === 100) {
      report.notes.push('messages_with_partner_role: hit 100-doc limit; actual count may be higher');
    }
  } catch (err) {
    report.messagesWithPartnerToRoles.scanned = false;
    report.messagesWithPartnerToRoles.error = err.message || 'unknown';
    report.notes.push(
      'messages scan failed — may indicate collection does not exist or index is missing. Not necessarily critical.'
    );
  }

  // ─── (5) Summary ───
  report.summary = {
    totalEmployees: report.employees.length,
    matchedCount: report.employees.filter(e => !e.mismatch && !e.authError).length,
    mismatchCount: report.mismatches.length,
    authMissingCount: report.claimShapeBreakdown.auth_user_missing,
    legacyAdminBooleanCount: report.claimShapeBreakdown.admin_boolean_only + report.claimShapeBreakdown.both_shapes,
    messagesWithPartnerToRoles: report.messagesWithPartnerToRoles.count,
    elapsedMs: Date.now() - startedAt
  };

  // ─── (6) Structured log for observability (G3) — no PII beyond aggregate counts ───
  console.log('[verifyClaims] Diagnostic completed', {
    triggeredBy: report.triggeredBy.email,
    schemaVersion: report.schemaVersion,
    summary: report.summary
  });

  return report;
});
