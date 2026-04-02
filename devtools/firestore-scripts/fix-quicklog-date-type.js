/**
 * FIX QUICK LOG DATE TYPE
 *
 * PURPOSE: Convert `date` field from Firestore Timestamp to "YYYY-MM-DD" string
 * for all Quick Log entries (isQuickLog === true).
 *
 * BACKGROUND: createQuickLogEntry stored date as Firestore Timestamp,
 * while all queries and createTimesheetEntry_v2 use "YYYY-MM-DD" strings.
 * This mismatch made Quick Log entries invisible in Admin Panel, Workload Analytics, etc.
 *
 * USAGE:
 *   node devtools/firestore-scripts/fix-quicklog-date-type.js              → DRY RUN
 *   node devtools/firestore-scripts/fix-quicklog-date-type.js --execute    → EXECUTE
 */

const admin = require('firebase-admin');
const sa = require('../../service-account-key.json');
const app = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'fix_quicklog_date_' + Date.now());
const db = app.firestore();

const EXECUTE = process.argv.includes('--execute');
const BATCH_LIMIT = 450; // Firestore max is 500, leave margin

async function fixQuickLogDates() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`FIX QUICK LOG DATE TYPE - ${EXECUTE ? '🔴 EXECUTE MODE' : '🟡 DRY RUN'}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!EXECUTE) {
    console.log('DRY RUN MODE - No changes will be made');
    console.log('Run with --execute to apply changes\n');
  }

  // Query all Quick Log entries
  const snapshot = await db.collection('timesheet_entries')
    .where('isQuickLog', '==', true)
    .get();

  console.log(`Found ${snapshot.size} Quick Log entries total\n`);

  let timestampCount = 0;
  let stringCount = 0;
  let unknownCount = 0;
  const fixes = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const dateField = data.date;

    // Check if date is a Firestore Timestamp
    if (dateField && typeof dateField.toDate === 'function') {
      const jsDate = dateField.toDate();
      const dateStr = jsDate.toISOString().substring(0, 10);

      timestampCount++;
      fixes.push({
        id: doc.id,
        ref: doc.ref,
        employee: data.employee,
        clientName: data.clientName,
        oldDate: jsDate.toISOString(),
        newDate: dateStr
      });

      console.log(`  WILL FIX: ${doc.id}`);
      console.log(`    employee: ${data.employee}`);
      console.log(`    client: ${data.clientName}`);
      console.log(`    old date (Timestamp): ${jsDate.toISOString()}`);
      console.log(`    new date (String):    ${dateStr}`);
      console.log('');

    } else if (typeof dateField === 'string') {
      stringCount++;
      // Already a string — no fix needed

    } else {
      unknownCount++;
      console.log(`  ⚠️ UNKNOWN TYPE: ${doc.id} — typeof=${typeof dateField}, value=${JSON.stringify(dateField)}`);
    }
  });

  console.log(`${'='.repeat(60)}`);
  console.log(`SUMMARY:`);
  console.log(`  Total Quick Log entries:    ${snapshot.size}`);
  console.log(`  Already strings (OK):       ${stringCount}`);
  console.log(`  Timestamps (need fix):      ${timestampCount}`);
  console.log(`  Unknown type:               ${unknownCount}`);
  console.log(`${'='.repeat(60)}\n`);

  if (EXECUTE && fixes.length > 0) {
    // Batch writes in chunks of BATCH_LIMIT
    for (let i = 0; i < fixes.length; i += BATCH_LIMIT) {
      const chunk = fixes.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();

      for (const fix of chunk) {
        batch.update(fix.ref, { date: fix.newDate });
      }

      console.log(`Committing batch ${Math.floor(i / BATCH_LIMIT) + 1} (${chunk.length} entries)...`);
      await batch.commit();
      console.log(`  ✅ Done`);
    }

    console.log(`\n✅ All ${fixes.length} Timestamp dates converted to strings.\n`);
  } else if (!EXECUTE && fixes.length > 0) {
    console.log(`🟡 ${fixes.length} entries would be fixed. Run with --execute to apply.\n`);
  } else {
    console.log(`✅ No entries need fixing.\n`);
  }
}

fixQuickLogDates().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
}).finally(() => process.exit(0));
