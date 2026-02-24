/** WhatsApp Module — וואטסאפ: שליחה, בוט, webhook, התראות */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { checkUserPermissions } = require('../shared/auth');
const { logAction } = require('../shared/audit');

const db = admin.firestore();

// Twilio environment variables for v1 functions compatibility
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC9e5e9e3c953a5bbb878622b6e70201b6';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'fed2170530e4ed34d3b1b3407e0f0f5f';
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

/**
 * ✅ OPTIMIZATION: Firestore Trigger for WhatsApp notifications
 * Automatically sends WhatsApp when a new approval request is created
 * This removes the 8-second blocking call from the frontend
 */
const onApprovalCreated = onDocumentWritten(
  'pending_task_approvals/{approvalId}',
  async (event) => {
    try {
      const newData = event.data.after.data();
      const oldData = event.data.before.data();

      // Only trigger on new documents (create), not updates
      if (oldData) {
        console.log('⏭️ Skipping - document updated, not created');
        return null;
      }

      // Only send WhatsApp for pending approvals
      if (!newData || newData.status !== 'pending') {
        console.log('⏭️ Skipping - status is not pending');
        return null;
      }

      console.log(`📱 Sending WhatsApp for approval ${event.params.approvalId}`);

      // Get all admins with WhatsApp enabled
      const adminsSnapshot = await db.collection('employees')
        .where('role', '==', 'admin')
        .where('whatsappEnabled', '==', true)
        .get();

      if (adminsSnapshot.empty) {
        console.log('⚠️ No admins with WhatsApp enabled');
        return null;
      }

      // Initialize Twilio
      // ✅ Use environment variables (v2 compatible) instead of functions.config()
      const accountSid = process.env.TWILIO_ACCOUNT_SID || TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN || TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || TWILIO_WHATSAPP_NUMBER;

      if (!accountSid || !authToken) {
        console.error('❌ Twilio not configured');
        return null;
      }

      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);

      let sentCount = 0;

      // Send to each admin
      for (const adminDoc of adminsSnapshot.docs) {
        const adminData = adminDoc.data();

        // Format phone number
        let phone = (adminData.phone || '').replace(/\D/g, '');
        if (phone.startsWith('05')) {
          phone = '972' + phone.substring(1);
        } else if (!phone.startsWith('972')) {
          phone = '972' + phone;
        }
        const toNumber = `whatsapp:+${phone}`;

        // Calculate time display
        const minutes = parseInt(newData.requestedMinutes) || parseInt(newData.taskData?.estimatedMinutes) || 0;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const timeStr = hours > 0
          ? `${hours} שעות${mins > 0 ? ` ו-${mins} דקות` : ''}`
          : `${mins} דקות`;

        // Create message
        const message = `🔔 משימה חדשה נוספה

👤 ${newData.requestedByName || newData.requestedBy} הוסיף משימה:

📋 לקוח: ${newData.taskData?.clientName || 'לא צוין'}
📝 תיאור: ${newData.taskData?.description || 'לא צוין'}
⏱️ תקציב: ${timeStr} (${minutes} דקות)

━━━━━━━━━━━━━━━━━━━━

ℹ️ לידיעה בלבד
המשימה כבר פעילה והמשתמש יכול להתחיל לעבוד

🤖 הודעה אוטומטית ממערכת ניהול`;

        try {
          await client.messages.create({
            from: fromNumber,
            to: toNumber,
            body: message
          });
          sentCount++;
          console.log(`✅ WhatsApp sent to ${adminData.username || adminData.name}`);
        } catch (smsError) {
          console.error(`❌ Failed to send WhatsApp to ${adminData.username}:`, smsError.message);
        }
      }

      console.log(`✅ Trigger completed: ${sentCount} WhatsApp messages sent`);
      return { success: true, sent: sentCount };

    } catch (error) {
      console.error('❌ Error in onApprovalCreated trigger:', error);
      // Don't throw - we don't want to fail the approval creation
      return null;
    }
  }
);

// ===============================
// WhatsApp Broadcast with Twilio
// ===============================

/**
 * Send WhatsApp broadcast messages to selected employees
 * Uses Twilio WhatsApp Business API
 */
const sendBroadcastMessage = functions.https.onCall(async (data, context) => {
  try {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'נדרשת התחברות למערכת'
      );
    }

    // Check if user is admin
    const userEmail = context.auth.token.email;
    const employeeDoc = await db.collection('employees').doc(userEmail).get();

    if (!employeeDoc.exists || employeeDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'רק מנהלים יכולים לשלוח הודעות broadcast'
      );
    }

    // Validate input
    const { employeeEmails, templateType, customMessage } = data;

    if (!employeeEmails || !Array.isArray(employeeEmails) || employeeEmails.length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חייב לספק רשימת עובדים'
      );
    }

    if (!templateType) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'חייב לבחור תבנית הודעה'
      );
    }

    // Initialize Twilio (get credentials from Firebase Config)
    const twilioConfig = functions.config().twilio;

    if (!twilioConfig || !twilioConfig.account_sid || !twilioConfig.auth_token) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Twilio לא מוגדר. הרץ: firebase functions:config:set twilio.account_sid="YOUR_SID" twilio.auth_token="YOUR_TOKEN" twilio.whatsapp_number="whatsapp:+14155238886"'
      );
    }

    const twilio = require('twilio');
    const client = twilio(twilioConfig.account_sid, twilioConfig.auth_token);
    const fromNumber = twilioConfig.whatsapp_number || 'whatsapp:+14155238886'; // Twilio Sandbox default

    // Message templates
    const templates = {
      DAILY_REMINDER: (name) => `שלום ${name}! ⏰\n\nתזכורת לרישום שעות היום במערכת.\n\nכניסה למערכת:\nhttps://gh-law-office-system.netlify.app`,

      WEEKLY_SUMMARY: (name) => `שלום ${name}! 📅\n\nבקשה לעדכן את סיכום שעות השבוע במערכת.\n\nכניסה למערכת:\nhttps://gh-law-office-system.netlify.app`,

      SYSTEM_ANNOUNCEMENT: (name, message) => `שלום ${name}! 📢\n\nהודעת מערכת:\n${message}\n\nכניסה למערכת:\nhttps://gh-law-office-system.netlify.app`,

      CUSTOM: (name, message) => `שלום ${name}!\n\n${message}\n\nכניסה למערכת:\nhttps://gh-law-office-system.netlify.app`
    };

    // Results tracking
    const results = {
      success: [],
      failed: []
    };

    // Send messages to each employee
    for (const email of employeeEmails) {
      try {
        // Get employee data
        const empDoc = await db.collection('employees').doc(email).get();

        if (!empDoc.exists) {
          results.failed.push({
            email,
            name: email,
            error: 'עובד לא נמצא במערכת'
          });
          continue;
        }

        const employee = empDoc.data();
        const name = employee.name || employee.username || email;

        // Check if employee has WhatsApp enabled and phone number
        if (!employee.whatsappEnabled || !employee.phone) {
          results.failed.push({
            email,
            name,
            error: 'WhatsApp לא מופעל או אין מספר טלפון'
          });
          continue;
        }

        // Format phone number for WhatsApp
        let phone = employee.phone.replace(/\D/g, ''); // Remove non-digits

        // Israeli phone format: 05X-XXXXXXX -> +9725XXXXXXXX
        if (phone.startsWith('05')) {
          phone = '972' + phone.substring(1);
        } else if (!phone.startsWith('972')) {
          phone = '972' + phone;
        }

        const toNumber = `whatsapp:+${phone}`;

        // Generate message
        let messageBody;
        if (templateType === 'SYSTEM_ANNOUNCEMENT' || templateType === 'CUSTOM') {
          messageBody = templates[templateType](name, customMessage);
        } else {
          messageBody = templates[templateType](name);
        }

        // Send via Twilio
        const message = await client.messages.create({
          from: fromNumber,
          to: toNumber,
          body: messageBody
        });

        results.success.push({
          email,
          name,
          phone: toNumber,
          messageSid: message.sid
        });

        console.log(`✅ WhatsApp sent to ${name} (${email}): ${message.sid}`);

      } catch (error) {
        console.error(`❌ Failed to send to ${email}:`, error);
        results.failed.push({
          email,
          name: email,
          error: error.message || 'שגיאה בשליחה'
        });
      }
    }

    // Log to audit
    await logAction('whatsapp_broadcast', context.auth.uid, userEmail, {
      templateType,
      totalSent: results.success.length,
      totalFailed: results.failed.length,
      recipients: employeeEmails
    });

    return {
      totalSent: results.success.length,
      totalFailed: results.failed.length,
      results
    };

  } catch (error) {
    console.error('❌ sendBroadcastMessage error:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'שגיאה בשליחת הודעות'
    );
  }
});

// ===============================
// WhatsApp Task Approval Automation
// ===============================

/**
 * Send WhatsApp notification to admin when new task approval is requested
 * Called automatically when approval is created
 */
const sendWhatsAppApprovalNotification = functions.https.onCall(async (data, context) => {
  try {
    // Check authentication
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'נדרשת התחברות');
    }

    const { approvalId, taskData, requestedBy, requestedByName } = data;

    if (!approvalId || !taskData) {
      throw new functions.https.HttpsError('invalid-argument', 'חסרים פרמטרים');
    }

    // Get all admins with WhatsApp enabled
    const adminsSnapshot = await db.collection('employees')
      .where('role', '==', 'admin')
      .where('whatsappEnabled', '==', true)
      .get();

    if (adminsSnapshot.empty) {
      console.log('⚠️ No admins with WhatsApp enabled');
      return { success: true, sent: 0, message: 'אין מנהלים עם WhatsApp מופעל' };
    }

    // Initialize Twilio
    const twilioConfig = functions.config().twilio;
    if (!twilioConfig?.account_sid || !twilioConfig?.auth_token) {
      throw new functions.https.HttpsError('failed-precondition', 'Twilio לא מוגדר');
    }

    const twilio = require('twilio');
    const client = twilio(twilioConfig.account_sid, twilioConfig.auth_token);
    const fromNumber = twilioConfig.whatsapp_number || 'whatsapp:+14155238886';

    const results = [];

    // Send to each admin
    for (const adminDoc of adminsSnapshot.docs) {
      const adminData = adminDoc.data();
      const adminName = adminData.name || adminData.username || adminDoc.id;

      // Format phone number
      let phone = (adminData.phone || '').replace(/\D/g, '');
      if (phone.startsWith('05')) {
        phone = '972' + phone.substring(1);
      } else if (!phone.startsWith('972')) {
        phone = '972' + phone;
      }
      const toNumber = `whatsapp:+${phone}`;

      // Calculate hours
      const minutes = parseInt(taskData.estimatedMinutes) || 0;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const timeStr = hours > 0
        ? `${hours} שעות${mins > 0 ? ` ו-${mins} דקות` : ''}`
        : `${mins} דקות`;

      // Create message
      const message = `🔔 משימה חדשה לאישור

👤 ${requestedByName || requestedBy} מבקש אישור תקציב:

📋 לקוח: ${taskData.clientName || 'לא צוין'}
📝 תיאור: ${taskData.description}
⏱️ תקציב: ${timeStr} (${minutes} דקות)

━━━━━━━━━━━━━━━━━━━━

📲 לאישור - כתוב:
✅ "אישור" - לאשר כמו שביקש
✅ "אישור 90" - לאשר עם 90 דקות

📲 לדחייה - כתוב:
❌ "דחייה" + סיבה
דוגמה: "דחייה תקציב גבוה"

💡 כתוב "משימות" לראות הכל

🤖 הודעה אוטומטית ממערכת ניהול`;

      try {
        const twilioMessage = await client.messages.create({
          from: fromNumber,
          to: toNumber,
          body: message
        });

        results.push({
          admin: adminName,
          phone: toNumber,
          success: true,
          messageSid: twilioMessage.sid
        });

        console.log(`✅ Approval notification sent to ${adminName}: ${twilioMessage.sid}`);

      } catch (error) {
        console.error(`❌ Failed to send to ${adminName}:`, error);
        results.push({
          admin: adminName,
          phone: toNumber,
          success: false,
          error: error.message
        });
      }
    }

    // Save notification log
    await db.collection('whatsapp_approval_notifications').add({
      approvalId,
      taskId: taskData.taskId || null,
      requestedBy,
      sentTo: results.map(r => r.admin),
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      results
    });

    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      sent: successCount,
      total: results.length,
      results
    };

  } catch (error) {
    console.error('❌ sendWhatsAppApprovalNotification error:', error);
    throw new functions.https.HttpsError('internal', error.message || 'שגיאה בשליחת התראה');
  }
});

/**
 * Webhook to receive WhatsApp messages from Twilio
 * Handles approval/rejection responses from admins
 */
const whatsappWebhook = onRequest({
  region: 'us-central1'
}, async (req, res) => {
  try {
    // Get message data
    const { From, Body, MessageSid, NumMedia, MediaUrl0, MediaContentType0 } = req.body;

    console.log(`📨 WhatsApp message received from ${From}: "${Body}"`);
    console.log(`📎 Media: NumMedia=${NumMedia}, Type=${MediaContentType0}`);

    if (!From) {
      res.status(400).send('Missing From parameter');
      return;
    }

    // Extract phone number
    const phoneNumber = From.replace('whatsapp:', '').replace('+', '');

    // Import the WhatsApp Bot
    const WhatsAppBot = require('../src/whatsapp-bot/WhatsAppBot');
    const bot = new WhatsAppBot();

    // Identify user
    const userInfo = await bot.identifyUser(phoneNumber);

    // Only allow admins to use the bot
    if (userInfo.role !== 'admin') {
      console.log(`⚠️ Message from non-admin: ${From} (${userInfo.name})`);
      res.status(200).send('OK');
      return;
    }

    console.log(`✅ Admin identified: ${userInfo.name || userInfo.email}`);

    // Check if this is a media message
    const hasMedia = NumMedia && parseInt(NumMedia) > 0;
    let response;

    if (hasMedia && MediaUrl0) {
      // Handle media message (PDF upload)
      console.log(`📎 Processing media message: ${MediaContentType0}`);
      response = await bot.handleMediaMessage(
        phoneNumber,
        MediaUrl0,
        MediaContentType0,
        Body || '',
        userInfo
      );
    } else if (Body) {
      // Handle regular text message
      response = await bot.handleMessage(phoneNumber, Body, userInfo);
    } else {
      res.status(400).send('Missing Body or Media');
      return;
    }

    // Send response via Twilio
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || 'AC9e5e9e3c953a5bbb878622b6e70201b6';
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || 'fed2170530e4ed34d3b1b3407e0f0f5f';
    const twilioWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

    if (twilioAccountSid && response) {
      const twilio = require('twilio');
      const client = twilio(twilioAccountSid, twilioAuthToken);

      // ═══ בדוק אם צריך לשלוח Template או טקסט רגיל ═══
      if (typeof response === 'object' && response.useTemplate) {
        // שלח Content Template עם כפתורים
        console.log(`📤 Sending template: ${response.templateSid}`);
        await client.messages.create({
          from: twilioWhatsappNumber,
          to: From,
          contentSid: response.templateSid,
          contentVariables: JSON.stringify(response.variables)
        });
        console.log(`✅ Template sent to ${userInfo.name}`);
      } else {
        // שלח הודעת טקסט רגילה
        await client.messages.create({
          from: twilioWhatsappNumber,
          to: From,
          body: typeof response === 'string' ? response : JSON.stringify(response)
        });
        console.log(`✅ Bot response sent to ${userInfo.name}`);
      }
    }

    // Log the interaction
    await db.collection('whatsapp_bot_interactions').add({
      from: From,
      userId: userInfo.email,
      userName: userInfo.name || userInfo.email,
      message: Body,
      response: typeof response === 'object' && response.useTemplate
        ? `[Template: ${response.templateSid}]`
        : response,
      messageSid: MessageSid,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).send('OK');

  } catch (error) {
    console.error('❌ whatsappWebhook error:', error);

    // Try to send error message to user
    try {
      const { From } = req.body;
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || 'AC9e5e9e3c953a5bbb878622b6e70201b6';
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || 'fed2170530e4ed34d3b1b3407e0f0f5f';
      const twilioWhatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

      if (twilioAccountSid && From) {
        const twilio = require('twilio');
        const client = twilio(twilioAccountSid, twilioAuthToken);
        await client.messages.create({
          from: twilioWhatsappNumber,
          to: From,
          body: '❌ מצטער, הייתה שגיאה במערכת. נסה שוב מאוחר יותר או כתוב "עזרה"'
        });
      }
    } catch (sendError) {
      console.error('❌ Failed to send error message:', sendError);
    }

    res.status(500).send('Error');
  }
});

module.exports = { sendBroadcastMessage, sendWhatsAppApprovalNotification, whatsappWebhook, onApprovalCreated };
