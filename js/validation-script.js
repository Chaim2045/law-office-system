/**
 * 🔍 Validation Script - Client=Case Migration
 *
 * בדיקה מקיפה של המערכת אחרי המיגרציה ל-Client=Case
 */

(function() {
  'use strict';

  window.ValidationScript = {
    results: {},

    /**
     * הרץ את כל הבדיקות
     */
    async runAll() {
      console.log('%c🔍 Starting Migration Validation', 'font-size: 18px; font-weight: bold; color: #3498db;');
      console.log('='.repeat(60));

      this.results = {
        timestamp: new Date().toISOString(),
        tests: []
      };

      // Test 1: Database Status
      await this.testDatabaseStatus();

      // Test 2: Data Integrity
      await this.testDataIntegrity();

      // Test 3: Create New Client (Live Test)
      await this.testCreateNewClient();

      console.log('='.repeat(60));
      console.log('%c✅ Validation Complete', 'font-size: 18px; font-weight: bold; color: #27ae60;');
      this.printSummary();

      return this.results;
    },

    /**
     * Test 1: בדיקת מצב Database
     */
    async testDatabaseStatus() {
      console.log('\n%c📊 Test 1: Database Status', 'font-size: 14px; font-weight: bold; color: #f39c12;');

      try {
        const db = window.firebaseDB;

        // טען clients
        const clientsSnapshot = await db.collection('clients').get();
        const clientsCount = clientsSnapshot.size;

        // טען cases (legacy)
        const casesSnapshot = await db.collection('cases').get();
        const casesCount = casesSnapshot.size;

        // ספור clients עם caseNumber
        let withCaseNumber = 0;
        let withoutCaseNumber = 0;
        const clientsList = [];

        clientsSnapshot.forEach(doc => {
          const data = doc.data();
          clientsList.push({
            id: doc.id,
            clientName: data.clientName || data.fullName,
            caseNumber: data.caseNumber,
            hasCaseNumber: !!data.caseNumber
          });

          if (data.caseNumber) {
            withCaseNumber++;
          } else {
            withoutCaseNumber++;
          }
        });

        console.log(`  📁 Clients collection: ${clientsCount} documents`);
        console.log(`    ✅ With caseNumber (NEW): ${withCaseNumber}`);
        console.log(`    ⚠️  Without caseNumber (OLD): ${withoutCaseNumber}`);
        console.log(`  📁 Cases collection (LEGACY): ${casesCount} documents`);

        this.results.tests.push({
          name: 'Database Status',
          status: 'PASS',
          data: {
            clients: clientsCount,
            cases: casesCount,
            newArchitecture: withCaseNumber,
            oldArchitecture: withoutCaseNumber,
            clientsList
          }
        });

        return { clientsCount, casesCount, withCaseNumber, withoutCaseNumber };

      } catch (error) {
        console.error('  ❌ Error:', error);
        this.results.tests.push({
          name: 'Database Status',
          status: 'FAIL',
          error: error.message
        });
        throw error;
      }
    },

    /**
     * Test 2: בדיקת תקינות נתונים
     */
    async testDataIntegrity() {
      console.log('\n%c🔍 Test 2: Data Integrity', 'font-size: 14px; font-weight: bold; color: #9b59b6;');

      try {
        const db = window.firebaseDB;
        const issues = [];

        // בדוק clients
        const clientsSnapshot = await db.collection('clients').get();

        clientsSnapshot.forEach(doc => {
          const data = doc.data();

          // בדיקה: clients עם caseNumber - ה-ID צריך להיות = caseNumber
          if (data.caseNumber && doc.id !== data.caseNumber) {
            issues.push({
              type: 'ID_MISMATCH',
              docId: doc.id,
              caseNumber: data.caseNumber,
              message: `Document ID (${doc.id}) ≠ caseNumber (${data.caseNumber})`
            });
          }

          // בדיקה: clients ללא caseNumber - צריכים שדות בסיסיים
          if (!data.caseNumber) {
            if (!data.clientName && !data.fullName) {
              issues.push({
                type: 'MISSING_NAME',
                docId: doc.id,
                message: 'Client without name'
              });
            }
          }
        });

        if (issues.length === 0) {
          console.log('  ✅ No data integrity issues found');
          this.results.tests.push({
            name: 'Data Integrity',
            status: 'PASS'
          });
        } else {
          console.warn(`  ⚠️ Found ${issues.length} issues:`);
          issues.forEach(issue => {
            console.warn(`    - ${issue.type}: ${issue.message}`);
          });
          this.results.tests.push({
            name: 'Data Integrity',
            status: 'WARN',
            issues
          });
        }

        return { issues };

      } catch (error) {
        console.error('  ❌ Error:', error);
        this.results.tests.push({
          name: 'Data Integrity',
          status: 'FAIL',
          error: error.message
        });
        throw error;
      }
    },

    /**
     * Test 3: יצירת Client חדש (בדיקה חיה!)
     */
    async testCreateNewClient() {
      console.log('\n%c🧪 Test 3: Create New Client (Live Test)', 'font-size: 14px; font-weight: bold; color: #e74c3c;');
      console.log('  ℹ️  This will create a REAL test client in your database');

      try {
        const createClient = firebase.functions().httpsCallable('createClient');

        const testData = {
          clientName: 'בדיקת מערכת - TEST',
          idType: 'passport',
          idNumber: 'TEST-' + Date.now(),
          phone: '050-0000000',
          email: 'test@validation.test',
          address: 'כתובת בדיקה',
          procedureType: 'hours',
          totalHours: 10,
          hourlyRate: 500,
          mainAttorney: 'מערכת',
          assignedTo: ['מערכת']
        };

        console.log('  📤 Calling createClient function...');
        const result = await createClient(testData);

        console.log('  ✅ Client created successfully!');
        console.log('    Document ID:', result.data.id);
        console.log('    Case Number:', result.data.caseNumber);
        console.log('    Client Name:', result.data.clientName);

        // אימות: בדוק שה-client נשמר בפועל
        const db = window.firebaseDB;
        const clientDoc = await db.collection('clients').doc(result.data.id).get();

        if (!clientDoc.exists) {
          throw new Error('Client was created but not found in database!');
        }

        const clientData = clientDoc.data();
        console.log('  ✅ Verified: Client exists in database');
        console.log('    ID = caseNumber:', clientDoc.id === clientData.caseNumber);

        this.results.tests.push({
          name: 'Create New Client',
          status: 'PASS',
          data: {
            id: result.data.id,
            caseNumber: result.data.caseNumber,
            verified: true
          }
        });

        return { success: true, clientId: result.data.id, caseNumber: result.data.caseNumber };

      } catch (error) {
        console.error('  ❌ Error creating client:', error);
        this.results.tests.push({
          name: 'Create New Client',
          status: 'FAIL',
          error: error.message
        });
        throw error;
      }
    },

    /**
     * הדפס סיכום
     */
    printSummary() {
      console.log('\n📋 Summary:');

      const passed = this.results.tests.filter(t => t.status === 'PASS').length;
      const warned = this.results.tests.filter(t => t.status === 'WARN').length;
      const failed = this.results.tests.filter(t => t.status === 'FAIL').length;

      console.log(`  ✅ Passed: ${passed}`);
      if (warned > 0) console.log(`  ⚠️  Warnings: ${warned}`);
      if (failed > 0) console.log(`  ❌ Failed: ${failed}`);

      if (failed === 0) {
        console.log('\n%c🎉 All critical tests passed!', 'font-size: 16px; font-weight: bold; color: #27ae60;');
      } else {
        console.log('\n%c⚠️ Some tests failed - review errors above', 'font-size: 16px; font-weight: bold; color: #e74c3c;');
      }
    }
  };

  // הוראות שימוש (dev mode only)
  if (!window.PRODUCTION_MODE) {
    console.log(`
🔧 Validation Script Loaded!

Usage:
  ValidationScript.runAll()          - Run all validation tests
  ValidationScript.testDatabaseStatus()     - Check database status
  ValidationScript.testDataIntegrity()      - Check data integrity
  ValidationScript.testCreateNewClient()    - Create test client

Example:
  await ValidationScript.runAll();
    `);
  }

})();
