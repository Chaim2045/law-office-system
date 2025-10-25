/**
 * 🔧 Fix Old Clients Tool
 *
 * כלי לטיפול ב-clients ישנים ללא caseNumber
 * מעניק להם caseNumber ומעביר אותם למבנה החדש
 */

(function() {
  'use strict';

  window.FixOldClients = {
    /**
     * בדוק כמה clients ללא caseNumber יש
     */
    async checkStatus() {
      console.log('🔍 בודק clients ישנים ללא caseNumber...\n');

      try {
        const db = firebase.firestore();
        const clientsSnapshot = await db.collection('clients').get();

        const withoutCaseNumber = [];
        const withCaseNumber = [];

        clientsSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.caseNumber) {
            withCaseNumber.push({ id: doc.id, ...data });
          } else {
            withoutCaseNumber.push({ id: doc.id, ...data });
          }
        });

        console.log(`📊 סטטיסטיקה:`);
        console.log(`  ✅ עם caseNumber (חדשים): ${withCaseNumber.length}`);
        console.log(`  ⚠️  ללא caseNumber (ישנים): ${withoutCaseNumber.length}\n`);

        if (withoutCaseNumber.length > 0) {
          console.log(`📋 רשימת clients ישנים:`);
          withoutCaseNumber.forEach((client, index) => {
            console.log(`  ${index + 1}. ${client.id} - ${client.clientName || client.fullName || 'ללא שם'}`);
          });
        }

        return {
          total: clientsSnapshot.size,
          withCaseNumber: withCaseNumber.length,
          withoutCaseNumber: withoutCaseNumber.length,
          oldClients: withoutCaseNumber
        };

      } catch (error) {
        console.error('❌ שגיאה:', error.message);
        throw error;
      }
    },

    /**
     * הוסף caseNumber אוטומטי לכל הclients הישנים
     *
     * @param {Object} options
     * @param {boolean} options.dryRun - אם true, רק מראה מה יקרה ללא שינויים
     * @param {string} options.prefix - קידומת למספרי תיק (ברירת מחדל: OLD)
     * @param {number} options.startFrom - התחל ממספר (ברירת מחדל: 1)
     */
    async fixAll(options = {}) {
      const { dryRun = false, prefix = 'OLD', startFrom = 1 } = options;

      console.log(`🔧 ${dryRun ? '[DRY RUN]' : ''} מתחיל תיקון clients ישנים...\n`);

      try {
        const db = firebase.firestore();

        // מצא clients ללא caseNumber
        const status = await this.checkStatus();
        const oldClients = status.oldClients;

        if (oldClients.length === 0) {
          console.log('✅ אין clients ישנים לתקן!');
          return { success: true, updated: 0 };
        }

        console.log(`\n📝 ${dryRun ? 'מדמה' : 'מעדכן'} ${oldClients.length} clients...\n`);

        let updated = 0;
        let errors = 0;
        const errorDetails = [];

        for (let i = 0; i < oldClients.length; i++) {
          const client = oldClients[i];
          const caseNumber = `${prefix}-${String(startFrom + i).padStart(3, '0')}`;

          try {
            console.log(`${i + 1}. ${client.id}:`);
            console.log(`   שם: ${client.clientName || client.fullName || 'ללא שם'}`);
            console.log(`   caseNumber חדש: ${caseNumber}`);

            if (!dryRun) {
              // עדכן את ה-document
              await db.collection('clients').doc(client.id).update({
                caseNumber: caseNumber,
                migratedToNewStructure: true,
                migrationDate: firebase.firestore.FieldValue.serverTimestamp(),
                migrationNote: 'Auto-assigned caseNumber for old client',
                lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastModifiedBy: 'system'
              });

              console.log(`   ✅ עודכן בהצלחה\n`);
            } else {
              console.log(`   🔍 [DRY RUN] לא עודכן בפועל\n`);
            }

            updated++;

          } catch (error) {
            console.error(`   ❌ שגיאה: ${error.message}\n`);
            errors++;
            errorDetails.push(`${client.id}: ${error.message}`);
          }
        }

        console.log('='.repeat(60));
        console.log(`\n✅ סיים ${dryRun ? 'סימולציה' : 'עדכון'}:`);
        console.log(`   ${updated} clients ${dryRun ? 'יעודכנו' : 'עודכנו'}`);
        if (errors > 0) {
          console.log(`   ❌ ${errors} שגיאות`);
        }

        return {
          success: errors === 0,
          updated,
          errors,
          errorDetails: errors > 0 ? errorDetails : undefined
        };

      } catch (error) {
        console.error('❌ שגיאה כללית:', error.message);
        throw error;
      }
    },

    /**
     * תקן client אחד ספציפי עם caseNumber מותאם אישית
     *
     * @param {string} clientId - ID של ה-client
     * @param {string} caseNumber - מספר התיק הרצוי
     */
    async fixOne(clientId, caseNumber) {
      console.log(`🔧 מתקן client: ${clientId}\n`);

      try {
        const db = firebase.firestore();

        // בדוק שה-client קיים
        const clientDoc = await db.collection('clients').doc(clientId).get();

        if (!clientDoc.exists) {
          throw new Error(`Client ${clientId} לא נמצא`);
        }

        const clientData = clientDoc.data();

        console.log(`📝 מידע נוכחי:`);
        console.log(`   שם: ${clientData.clientName || clientData.fullName || 'ללא שם'}`);
        console.log(`   caseNumber נוכחי: ${clientData.caseNumber || 'אין'}`);
        console.log(`   caseNumber חדש: ${caseNumber}\n`);

        // עדכן
        await db.collection('clients').doc(clientId).update({
          caseNumber: caseNumber,
          migratedToNewStructure: true,
          migrationDate: firebase.firestore.FieldValue.serverTimestamp(),
          migrationNote: 'Manually assigned caseNumber',
          lastModifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastModifiedBy: 'admin'
        });

        console.log('✅ עודכן בהצלחה!');

        return { success: true, clientId, caseNumber };

      } catch (error) {
        console.error('❌ שגיאה:', error.message);
        throw error;
      }
    },

    /**
     * מחק clients ישנים (שימוש זהיר!)
     *
     * @param {Array<string>} clientIds - רשימת IDs למחיקה
     * @param {boolean} confirm - אישור מחיקה (חובה true)
     */
    async deleteOldClients(clientIds, confirm = false) {
      if (!confirm) {
        console.warn('⚠️ חובה לאשר מחיקה: deleteOldClients([...], true)');
        return;
      }

      console.log(`🗑️ מוחק ${clientIds.length} clients...\n`);

      try {
        const db = firebase.firestore();
        let deleted = 0;
        let errors = 0;

        for (const clientId of clientIds) {
          try {
            await db.collection('clients').doc(clientId).delete();
            console.log(`✅ נמחק: ${clientId}`);
            deleted++;
          } catch (error) {
            console.error(`❌ שגיאה במחיקת ${clientId}:`, error.message);
            errors++;
          }
        }

        console.log(`\n✅ נמחקו ${deleted} clients`);
        if (errors > 0) {
          console.log(`❌ ${errors} שגיאות`);
        }

        return { success: errors === 0, deleted, errors };

      } catch (error) {
        console.error('❌ שגיאה:', error.message);
        throw error;
      }
    }
  };

  // הוראות שימוש (dev mode only)
  if (!window.PRODUCTION_MODE) {
    console.log(`
🔧 Fix Old Clients Tool Loaded!

Usage:
  FixOldClients.checkStatus()                     - Check how many old clients exist
  FixOldClients.fixAll({ dryRun: true })          - Simulate fixing all old clients
  FixOldClients.fixAll()                          - Fix all old clients (for real!)
  FixOldClients.fixAll({ prefix: 'LEGACY' })      - Custom prefix
  FixOldClients.fixOne('clientId', '2025-100')    - Fix one specific client
  FixOldClients.deleteOldClients([...ids], true)  - Delete specific clients

Example workflow:
  1. await FixOldClients.checkStatus();
  2. await FixOldClients.fixAll({ dryRun: true });  // Test first
  3. await FixOldClients.fixAll();                  // Do it for real
    `);
  }

})();
