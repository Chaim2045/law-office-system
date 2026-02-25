/**
 * Migration v1→v2 Testing Script (Browser Console Version)
 *
 * Tests Gates 1, 2, 5 using Firebase client SDK in browser
 *
 * Usage:
 * 1. Open User App in browser
 * 2. Open DevTools Console (F12)
 * 3. Copy-paste this entire script
 * 4. Press Enter
 */

(async function testMigrationV1toV2() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Migration v1→v2 Testing - Gates 1, 2, 5              ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  // Check dependencies
  if (!window.firebase) {
    console.error('❌ Firebase not loaded. Make sure you are on the User App page.');
    return;
  }

  if (!window.FirebaseService) {
    console.error('❌ FirebaseService not loaded. Make sure the app is fully initialized.');
    return;
  }

  const db = firebase.firestore();

  // Test configuration
  const TEST_ENTRY = {
    date: new Date().toISOString().split('T')[0],
    minutes: 60,
    action: 'Gate Testing - v1→v2 Migration',
    notes: 'Browser console test for Gates 1, 2, 5',
    employee: firebase.auth().currentUser?.email || 'test@example.com',
    isInternal: true,
    clientName: null,
    clientId: null,
    createdAt: new Date()
  };

  /**
   * Generate idempotency key (same logic as adapter)
   */
  function generateIdempotencyKey(entryData) {
    const employee = entryData.employee || 'unknown';
    const date = entryData.date;
    const actionHash = simpleHash(entryData.action || '');
    const minutes = entryData.minutes;
    const timestamp = Date.now();

    return `timesheet_${employee}_${date}_${actionHash}_${minutes}_${timestamp}`;
  }

  function simpleHash(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(36).slice(0, 8);
  }

  /**
   * Call createTimesheetEntry_v2 via FirebaseService
   */
  async function callCreateTimesheetEntryV2(payload) {
    console.log('📞 Calling createTimesheetEntry_v2 via FirebaseService...');

    try {
      const result = await window.FirebaseService.call('createTimesheetEntry_v2', payload, {
        retries: 3,
        timeout: 15000
      });
      return result;
    } catch (error) {
      console.error('❌ FirebaseService call failed:', error.message);
      throw error;
    }
  }

  /**
   * Gate 1: Create Internal Activity
   */
  async function testGate1() {
    console.log('\n=== Gate 1: Create Internal Activity ===\n');

    const idempotencyKey = generateIdempotencyKey(TEST_ENTRY);

    const payload = {
      ...TEST_ENTRY,
      idempotencyKey
    };

    console.log('📝 Payload:', {
      date: payload.date,
      minutes: payload.minutes,
      action: payload.action,
      isInternal: payload.isInternal,
      idempotencyKey: payload.idempotencyKey.substring(0, 50) + '...'
    });

    console.log('\n⏳ Creating entry...');
    const result = await callCreateTimesheetEntryV2(payload);

    console.log('\n✅ Result:', {
      success: result.success,
      entryId: result.entryId,
      version: result.version  // null for isInternal=true (expected)
    });

    if (!result.success) {
      throw new Error('Entry creation failed: ' + (result.error || result.message));
    }

    // For internal activities, version should be null (by design)
    if (payload.isInternal === true && result.version !== null) {
      console.warn('⚠️ Expected version=null for internal activity, got:', result.version);
    }

    // Verify document in Firestore
    console.log('\n🔍 Verifying Firestore document...');
    const entryDoc = await db.collection('timesheet_entries').doc(result.entryId).get();

    if (!entryDoc.exists) {
      throw new Error('Entry document not found!');
    }

    const entryData = entryDoc.data();

    console.log('\n📄 Firestore Document:', {
      id: entryDoc.id,
      clientId: entryData.clientId,
      clientName: entryData.clientName,
      isInternal: entryData.isInternal,
      _processedByVersion: entryData._processedByVersion,
      _idempotencyKey: entryData._idempotencyKey ? entryData._idempotencyKey.substring(0, 50) + '...' : 'MISSING'
    });

    // Verify fields
    const checks = {
      'clientId = "internal_office"': entryData.clientId === 'internal_office',
      'clientName = "פעילות פנימית"': entryData.clientName === 'פעילות פנימית',
      'isInternal = true': entryData.isInternal === true,
      '_processedByVersion = "v2.0"': entryData._processedByVersion === 'v2.0',
      '_idempotencyKey exists': !!entryData._idempotencyKey,
      'version returned null (correct for internal)': result.version === null
    };

    console.log('\n✅ Field Verification:');
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`  ${passed ? '✅' : '❌'} ${check}`);
    }

    const allPassed = Object.values(checks).every(v => v);

    if (!allPassed) {
      throw new Error('Gate 1 field verification failed!');
    }

    console.log('\n✅ Gate 1 PASSED');

    return {
      entryId: result.entryId,
      idempotencyKey: payload.idempotencyKey
    };
  }

  /**
   * Gate 2: Duplicate Prevention
   */
  async function testGate2(gate1Result) {
    console.log('\n=== Gate 2: Duplicate Prevention ===\n');

    const { idempotencyKey } = gate1Result;

    const payload = {
      ...TEST_ENTRY,
      idempotencyKey // ⬅️ Same key as Gate 1
    };

    console.log('📝 Using SAME idempotencyKey:', idempotencyKey.substring(0, 50) + '...');
    console.log('\n⏳ Attempting duplicate submission...');

    const result = await callCreateTimesheetEntryV2(payload);

    console.log('\n✅ Result:', {
      success: result.success,
      entryId: result.entryId,
      version: result.version  // null for isInternal=true
    });

    // Verify it returns the SAME entryId (idempotency check)
    if (result.entryId !== gate1Result.entryId) {
      throw new Error(`Expected same entryId (${gate1Result.entryId}), got ${result.entryId}`);
    }

    console.log('\n✅ Returned same entryId - idempotency working!');

    // Verify only ONE document exists
    console.log('\n🔍 Verifying no duplicate documents...');
    const duplicates = await db.collection('timesheet_entries')
      .where('_idempotencyKey', '==', idempotencyKey)
      .get();

    console.log(`📊 Documents with this idempotencyKey: ${duplicates.size}`);

    if (duplicates.size !== 1) {
      throw new Error(`Expected 1 document, found ${duplicates.size}`);
    }

    console.log('\n✅ Gate 2 PASSED - No duplicates created');

    return {
      entryId: result.entryId,
      idempotencyKey
    };
  }

  /**
   * Gate 5: Idempotency Collection
   */
  async function testGate5(gate1Result) {
    console.log('\n=== Gate 5: Idempotency Collection ===\n');

    const { idempotencyKey } = gate1Result;

    console.log('🔍 Checking processed_operations collection...');
    console.log(`   Looking for key: ${idempotencyKey.substring(0, 50)}...`);

    // Query for processed_operations
    const opsQuery = await db.collection('processed_operations')
      .where('idempotencyKey', '==', idempotencyKey)
      .get();

    console.log(`\n📊 Found ${opsQuery.size} document(s) in processed_operations`);

    if (opsQuery.empty) {
      throw new Error('No document found in processed_operations!');
    }

    const opDoc = opsQuery.docs[0];
    const opData = opDoc.data();

    console.log('\n📄 processed_operations Document:', {
      id: opDoc.id,
      idempotencyKey: opData.idempotencyKey ? opData.idempotencyKey.substring(0, 50) + '...' : 'MISSING',
      timestamp: opData.timestamp,
      result_success: opData.result?.success,
      result_entryId: opData.result?.entryId
    });

    // Verify fields
    const checks = {
      'idempotencyKey matches': opData.idempotencyKey === idempotencyKey,
      'result.success = true': opData.result?.success === true,
      'result.entryId matches': opData.result?.entryId === gate1Result.entryId,
      'timestamp exists': !!opData.timestamp
    };

    console.log('\n✅ Field Verification:');
    for (const [check, passed] of Object.entries(checks)) {
      console.log(`  ${passed ? '✅' : '❌'} ${check}`);
    }

    const allPassed = Object.values(checks).every(v => v);

    if (!allPassed) {
      throw new Error('Gate 5 field verification failed!');
    }

    console.log('\n✅ Gate 5 PASSED');

    return {
      processedOpId: opDoc.id
    };
  }

  /**
   * Main test runner
   */
  const results = {
    gate1: null,
    gate2: null,
    gate5: null,
    evidence: {}
  };

  try {
    // Gate 1
    results.gate1 = await testGate1();
    results.evidence.timesheetEntryId = results.gate1.entryId;
    results.evidence.idempotencyKey = results.gate1.idempotencyKey;

    // Gate 2
    results.gate2 = await testGate2(results.gate1);

    // Gate 5
    results.gate5 = await testGate5(results.gate1);
    results.evidence.processedOpId = results.gate5.processedOpId;

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  ✅ ALL GATES PASSED                                   ║');
    console.log('╚════════════════════════════════════════════════════════╝');

    console.log('\n📋 Evidence Summary:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`timesheet_entries docId:      ${results.evidence.timesheetEntryId}`);
    console.log(`processed_operations docId:   ${results.evidence.processedOpId}`);
    console.log(`idempotencyKey:                ${results.evidence.idempotencyKey.substring(0, 60)}...`);
    console.log('═══════════════════════════════════════════════════════');

    console.log('\n📝 Next Steps:');
    console.log('1. Open Firestore Console: https://console.firebase.google.com');
    console.log('2. Navigate to timesheet_entries collection');
    console.log(`3. Find document: ${results.evidence.timesheetEntryId}`);
    console.log('4. Take screenshot showing _processedByVersion and _idempotencyKey');
    console.log('5. Navigate to processed_operations collection');
    console.log(`6. Find document: ${results.evidence.processedOpId}`);
    console.log('7. Take screenshot');
    console.log('8. Update .dev/MIGRATION-V1-TO-V2-EVIDENCE.md with docIds and screenshots');

    console.log('\n✅ Tests completed successfully');

    // Return results for further use
    return results;

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nStack:', error.stack);
    throw error;
  }
})();
