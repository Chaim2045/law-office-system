/**
 * Migration Script — 2026-03-18
 *
 * Fixes 39 stages missing pricingType on 13 services across 10 clients.
 * Also fixes task.actualMinutes for affected clients.
 *
 * Usage:
 *   node scripts/migrate-stage-pricingtype-2026-03-18.js           # DRY-RUN
 *   node scripts/migrate-stage-pricingtype-2026-03-18.js --execute  # WRITE
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account-key.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const EXECUTE = process.argv.includes('--execute');

// 10 clients with 13 services containing stages without pricingType
const TARGET_CLIENTS = [
  '2025006', '2025009', '2025153', '2025364', '2025549',
  '2025897', '2025994', '2025995', '2025997', '2026003'
];

// Tasks to skip — actualMinutes set via completion flow, not timesheet_entries
const SKIP_TASKS = ['7KaLpvoOaCeGJjdhQDPT'];

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  MIGRATION — stage.pricingType + task.actualMinutes');
  console.log(`  MODE: ${EXECUTE ? '🔴 EXECUTE' : '🟢 DRY-RUN'}`);
  console.log(`  CLIENTS: ${TARGET_CLIENTS.length}`);
  console.log(`${'='.repeat(60)}\n`);

  let totalStagesFixed = 0;
  let totalTasksFixed = 0;
  let totalErrors = 0;

  for (const clientId of TARGET_CLIENTS) {
    try {
      console.log(`\n--- Client ${clientId} ---`);

      const clientRef = db.collection('clients').doc(clientId);
      const clientDoc = await clientRef.get();
      if (!clientDoc.exists) {
        console.log('  ⚠️ Not found — skipping');
        continue;
      }

      const clientData = clientDoc.data();
      const clientName = clientData.clientName || clientData.name || clientId;
      const services = clientData.services || [];
      console.log(`  Name: ${clientName}`);

      // ========================================
      // STEP 1: Fix stage.pricingType
      // ========================================
      let stagesFixedThisClient = 0;
      const updatedServices = services.map(svc => {
        if (svc.type !== 'legal_procedure' || !svc.pricingType) {
return svc;
}
        if (!svc.stages || svc.stages.length === 0) {
return svc;
}

        const hasNullStages = svc.stages.some(st => !st.pricingType);
        if (!hasNullStages) {
return svc;
}

        const updatedStages = svc.stages.map(stage => {
          if (stage.pricingType) {
return stage;
}
          stagesFixedThisClient++;
          console.log(`  Stage ${stage.id} on ${svc.id}: pricingType NULL → ${svc.pricingType}`);
          return { ...stage, pricingType: svc.pricingType };
        });

        return { ...svc, stages: updatedStages };
      });

      if (stagesFixedThisClient > 0) {
        totalStagesFixed += stagesFixedThisClient;
        if (EXECUTE) {
          await clientRef.set({ services: updatedServices }, { merge: true });
          console.log(`  ✅ ${stagesFixedThisClient} stages fixed`);
        } else {
          console.log(`  📋 ${stagesFixedThisClient} stages would be fixed`);
        }
      }

      // ========================================
      // STEP 2: Fix task.actualMinutes
      // ========================================
      const entriesSnap = await db.collection('timesheet_entries')
        .where('clientId', '==', clientId)
        .get();

      const taskMinutes = {};
      entriesSnap.forEach(doc => {
        const entry = doc.data();
        if (entry.taskId) {
          taskMinutes[entry.taskId] = (taskMinutes[entry.taskId] || 0) + (entry.minutes || 0);
        }
      });

      const tasksSnap = await db.collection('budget_tasks')
        .where('clientId', '==', clientId)
        .where('status', 'in', ['פעיל', 'הושלם'])
        .get();

      const taskUpdates = [];
      tasksSnap.forEach(doc => {
        if (SKIP_TASKS.includes(doc.id)) {
return;
}
        const task = doc.data();
        const sumEntries = taskMinutes[doc.id] || 0;
        const oldActual = task.actualMinutes || 0;
        if (Math.abs(oldActual - sumEntries) > 0.5) {
          taskUpdates.push({
            ref: doc.ref,
            taskId: doc.id,
            oldActual,
            newActual: sumEntries,
            description: task.description || ''
          });
        }
      });

      for (const tu of taskUpdates) {
        totalTasksFixed++;
        console.log(`  Task ${tu.taskId}: actualMinutes ${tu.oldActual} → ${tu.newActual} (${tu.description})`);
        if (EXECUTE) {
          await tu.ref.update({ actualMinutes: tu.newActual });
          console.log(`  ✅ Task ${tu.taskId} updated`);
        }
      }

      if (stagesFixedThisClient === 0 && taskUpdates.length === 0) {
        console.log('  ✅ No changes needed');
      }

    } catch (err) {
      console.error(`  ❌ Error on client ${clientId}:`, err.message);
      totalErrors++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('  SUMMARY');
  console.log(`  Mode: ${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`  Stages fixed: ${totalStagesFixed}`);
  console.log(`  Tasks fixed: ${totalTasksFixed}`);
  console.log(`  Errors: ${totalErrors}`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
