const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');

async function getEarliestEntryDate(clientId) {
  const snap = await db.collection('timesheet_entries')
    .where('clientId', '==', clientId)
    .get();

  if (snap.empty) {
return null;
}

  let earliest = null;
  snap.forEach(doc => {
    const d = doc.data();
    let entryDate;
    if (d.date && d.date.toDate) {
      entryDate = d.date.toDate();
    } else if (typeof d.date === 'string') {
      entryDate = new Date(d.date);
    } else if (typeof d.date === 'number') {
      entryDate = new Date(d.date * 1000);
    } else {
return;
}

    if (!earliest || entryDate < earliest) {
earliest = entryDate;
}
  });

  return earliest;
}

async function run() {
  console.log(DRY_RUN ? '🔍 DRY RUN — לא כותב' : '✍️ LIVE — כותב ל-Firestore');
  console.log('---');

  const clientsSnap = await db.collection('clients').get();

  let updated = 0;
  let skipped = 0;
  let noEntries = 0;
  let alreadyHas = 0;
  let errors = 0;

  for (const doc of clientsSnap.docs) {
    const d = doc.data();
    const name = d.clientName || d.name || doc.id;

    // idempotent — לא מחליף קיים
    if (d.caseOpenDate) {
      alreadyHas++;
      continue;
    }

    if (doc.id.startsWith('internal_')) {
      skipped++;
      continue;
    }

    try {
      const earliest = await getEarliestEntryDate(doc.id);

      if (!earliest) {
        noEntries++;
        continue;
      }

      const clientCreatedAt = d.createdAt?.toDate ? d.createdAt.toDate() : null;

      if (clientCreatedAt && earliest >= clientCreatedAt) {
        skipped++;
        continue;
      }

      console.log(`📅 ${doc.id} | ${name} | createdAt: ${clientCreatedAt?.toISOString().split('T')[0]} | earliest: ${earliest.toISOString().split('T')[0]}`);

      if (!DRY_RUN) {
        await doc.ref.update({
          caseOpenDate: admin.firestore.Timestamp.fromDate(earliest),
          updatedAt: new Date().toISOString()
        });
      }

      updated++;
    } catch (e) {
      console.error(`❌ ${doc.id} | ${name} | ${e.message}`);
      errors++;
    }
  }

  console.log('---');
  console.log(`✅ יעודכנו: ${updated}`);
  console.log(`⏭️  createdAt <= earliest (לא צריך): ${skipped}`);
  console.log(`📭 ללא entries: ${noEntries}`);
  console.log(`🔄 כבר יש caseOpenDate: ${alreadyHas}`);
  console.log(`❌ שגיאות: ${errors}`);
}

run().then(() => process.exit(0)).catch(e => {
 console.error(e.message); process.exit(1);
});
