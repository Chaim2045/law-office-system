/** Fee Agreements Module — הסכמי שכר טרחה */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');

const db = admin.firestore();

/**
 * uploadFeeAgreement - העלאת הסכם שכר טרחה ללקוח
 * Admin only - מאובטח
 *
 * @param {Object} data
 * @param {string} data.clientId - מזהה הלקוח
 * @param {string} data.fileName - שם הקובץ המקורי
 * @param {string} data.fileData - תוכן הקובץ ב-base64
 * @param {string} data.fileType - סוג הקובץ (mime type)
 * @param {number} data.fileSize - גודל הקובץ בבייטים
 */
const uploadFeeAgreement = functions.https.onCall(async (data, context) => {
  try {
    console.log('📄 Starting uploadFeeAgreement...');

    // 1. Authorization - Admin only
    const user = await checkUserPermissions(context);

    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים להעלות הסכמי שכר טרחה'
      );
    }

    // 2. Input Validation
    if (!data.clientId || typeof data.clientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    if (!data.fileName || typeof data.fileName !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר שם קובץ'
      );
    }

    if (!data.fileData || typeof data.fileData !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר תוכן קובץ'
      );
    }

    if (!data.fileType || typeof data.fileType !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר סוג קובץ'
      );
    }

    // 3. File Type Validation
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(data.fileType)) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'סוג קובץ לא נתמך. יש להעלות PDF או תמונה (JPEG/PNG/WebP)'
      );
    }

    // 4. File Size Validation (max 6MB for base64)
    const maxSizeBytes = 6 * 1024 * 1024;
    const fileSize = data.fileSize || Buffer.from(data.fileData, 'base64').length;

    if (fileSize > maxSizeBytes) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'הקובץ גדול מדי. גודל מקסימלי: 6MB'
      );
    }

    // 5. Verify Client Exists
    const clientDoc = await db.collection('clients').doc(data.clientId).get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'לקוח לא נמצא'
      );
    }

    // 6. Generate unique ID and storage path
    const agreementId = `agreement_${Date.now()}`;
    const fileExtension = data.fileName.split('.').pop() || 'pdf';
    const sanitizedFileName = `${agreementId}.${fileExtension}`;
    const storagePath = `clients/${data.clientId}/agreements/${sanitizedFileName}`;

    // 7. Upload to Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);

    // Decode base64 and upload
    const fileBuffer = Buffer.from(data.fileData, 'base64');

    await file.save(fileBuffer, {
      metadata: {
        contentType: data.fileType,
        metadata: {
          uploadedBy: user.email,
          originalName: data.fileName,
          clientId: data.clientId
        }
      }
    });

    // 8. (Security — PR-SEC-2) Do NOT make the object public. Signed fee-agreement
    // PDFs (client name + ת"ז + signatures + fee terms) stay PRIVATE; the admin
    // views them on demand via the `getFeeAgreementUrl` callable, which mints a
    // short-lived V4 signed URL from `storagePath`. The legacy `file.makePublic()`
    // + permanent public downloadUrl was a world-readable leak that bypassed
    // storage.rules (חוק הגנת הפרטיות / חיסיון עו"ד-לקוח). No downloadUrl is stored.

    // 9. Create agreement metadata (storagePath only — the URL is resolved on demand)
    const agreementData = {
      id: agreementId,
      fileName: sanitizedFileName,
      originalName: data.fileName,
      storagePath: storagePath,
      fileType: data.fileType,
      fileSize: fileSize,
      uploadedAt: admin.firestore.Timestamp.now(),
      uploadedBy: user.email
    };

    // 10. Update client document with new agreement
    const clientData = clientDoc.data();
    const existingAgreements = clientData.feeAgreements || [];

    await db.collection('clients').doc(data.clientId).update({
      feeAgreements: [...existingAgreements, agreementData],
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 11. Audit Log
    await logAction('UPLOAD_FEE_AGREEMENT', user.uid, user.username, {
      clientId: data.clientId,
      clientName: clientData.fullName || clientData.clientName,
      agreementId: agreementId,
      fileName: data.fileName,
      fileType: data.fileType,
      fileSize: fileSize
    });

    console.log(`✅ Fee agreement uploaded successfully: ${agreementId} for client ${data.clientId}`);

    return {
      success: true,
      agreement: {
        ...agreementData,
        uploadedAt: new Date().toISOString()
      },
      message: 'הסכם שכר טרחה הועלה בהצלחה'
    };

  } catch (error) {
    console.error('Error in uploadFeeAgreement:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה בהעלאת הסכם: ${error.message}`
    );
  }
});

/**
 * deleteFeeAgreement - מחיקת הסכם שכר טרחה
 * Admin only - מאובטח
 *
 * @param {Object} data
 * @param {string} data.clientId - מזהה הלקוח
 * @param {string} data.agreementId - מזהה ההסכם למחיקה
 */
const deleteFeeAgreement = functions.https.onCall(async (data, context) => {
  try {
    console.log('🗑️ Starting deleteFeeAgreement...');

    // 1. Authorization - Admin only
    const user = await checkUserPermissions(context);

    if (user.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים למחוק הסכמי שכר טרחה'
      );
    }

    // 2. Input Validation
    if (!data.clientId || typeof data.clientId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה לקוח'
      );
    }

    if (!data.agreementId || typeof data.agreementId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חסר מזהה הסכם'
      );
    }

    // 3. Verify Client Exists
    const clientDoc = await db.collection('clients').doc(data.clientId).get();

    if (!clientDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'לקוח לא נמצא'
      );
    }

    const clientData = clientDoc.data();
    const existingAgreements = clientData.feeAgreements || [];

    // 4. Find the agreement to delete
    const agreementToDelete = existingAgreements.find(a => a.id === data.agreementId);

    if (!agreementToDelete) {
      throw new functions.https.HttpsError(
        'not-found',
        'הסכם לא נמצא'
      );
    }

    // 5. Delete from Firebase Storage
    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(agreementToDelete.storagePath);
      await file.delete();
      console.log(`✅ Deleted file from storage: ${agreementToDelete.storagePath}`);
    } catch (storageError) {
      // Log but don't fail if storage deletion fails (file might not exist)
      console.warn(`⚠️ Could not delete file from storage: ${storageError.message}`);
    }

    // 6. Remove from Firestore
    const updatedAgreements = existingAgreements.filter(a => a.id !== data.agreementId);

    await db.collection('clients').doc(data.clientId).update({
      feeAgreements: updatedAgreements,
      lastModifiedBy: user.username,
      lastModifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 7. Audit Log
    await logAction('DELETE_FEE_AGREEMENT', user.uid, user.username, {
      clientId: data.clientId,
      clientName: clientData.fullName || clientData.clientName,
      agreementId: data.agreementId,
      fileName: agreementToDelete.originalName || agreementToDelete.fileName
    });

    console.log(`✅ Fee agreement deleted successfully: ${data.agreementId} from client ${data.clientId}`);

    return {
      success: true,
      message: 'הסכם שכר טרחה נמחק בהצלחה'
    };

  } catch (error) {
    console.error('Error in deleteFeeAgreement:', error);

    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    throw new functions.https.HttpsError(
      'internal',
      `שגיאה במחיקת הסכם: ${error.message}`
    );
  }
});

module.exports = { uploadFeeAgreement, deleteFeeAgreement };
