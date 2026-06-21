/** Scheduled Functions — פונקציות מתוזמנות יומיות */

const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const { SYSTEM_CONSTANTS } = require('../shared/constants');
const ST = SYSTEM_CONSTANTS.SERVICE_TYPES;
const PT = SYSTEM_CONSTANTS.PRICING_TYPES;

// PR-C.1 (2026-05-18): nightly companion to PR-D's on-demand audit.
const { calcClientAggregates, round2, NON_AGGREGATING_STATUSES } = require('../shared/aggregates');
const { _recomputeTotalHours } = require('../shared/client-writer');

const db = admin.firestore();

// PR-C.1: aggregate-drift tolerance for client-level invariants.
// Matches `dailyInvariantCheck`'s internal TOLERANCE and PR-D's audit.
const AGG_DRIFT_TOLERANCE = 0.02;

/**
 * Pure helper — detect drift between stored client aggregates and the
 * canonical computation. Used by `dailyInvariantCheck` (Check 6) and
 * exposed via `_test` for unit testing.
 *
 * Returns an array of { field, current, canonical, diff? } entries.
 * Empty array means the client is canonical (no drift).
 *
 * Empty-services clients return [] regardless of stored values — those
 * are flagged by other checks (or by Haim manually) since they may
 * represent a different bug class (e.g. data loss).
 */
function detectAggregateDrift(clientData) {
  const services = Array.isArray(clientData && clientData.services)
    ? clientData.services.filter(Boolean)
    : [];
  if (services.length === 0) {
    return [];
  }

  const canonicalTotalHours = _recomputeTotalHours(services);
  const canonical = calcClientAggregates(services, canonicalTotalHours);

  const drifts = [];
  const numericFields = [
    { key: 'totalHours', expected: canonicalTotalHours },
    { key: 'hoursUsed', expected: canonical.hoursUsed },
    { key: 'hoursRemaining', expected: canonical.hoursRemaining },
    { key: 'minutesUsed', expected: canonical.minutesUsed },
    { key: 'minutesRemaining', expected: canonical.minutesRemaining }
  ];

  for (const { key, expected } of numericFields) {
    const stored = typeof clientData[key] === 'number' ? clientData[key] : 0;
    const diff = Math.abs(stored - expected);
    if (diff > AGG_DRIFT_TOLERANCE) {
      drifts.push({
        field: key,
        current: parseFloat(stored.toFixed(2)),
        canonical: parseFloat(expected.toFixed(2)),
        diff: parseFloat(diff.toFixed(2))
      });
    }
  }

  const booleanFields = [
    { key: 'isBlocked', expected: canonical.isBlocked },
    { key: 'isCritical', expected: canonical.isCritical }
  ];
  for (const { key, expected } of booleanFields) {
    const stored = clientData[key] === true;
    if (stored !== (expected === true)) {
      drifts.push({
        field: key,
        current: stored,
        canonical: expected === true
      });
    }
  }

  return drifts;
}

/**
 * formatDate - פורמט תאריך לתצוגה בעברית
 */
function formatDate(date) {
  return new Intl.DateTimeFormat('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

/**
 * dailyTaskReminders - תזכורות משימות יומיות
 * רץ כל יום בשעה 09:00 בבוקר
 * בודק:
 * 1. משימות שעומדות לפוג בתוך 3 ימים
 * 2. משימות שכבר עבר תאריך היעד שלהן (overdue)
 * שולח התראה אוטומטית לעובדים (לא למנהלים - הם רואים בדשבורד)
 */
const dailyTaskReminders = onSchedule({
  schedule: '0 9 * * *',  // כל יום בשעה 09:00
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async (event) => {
    try {
      console.log('🔔 Running dailyTaskReminders at', new Date().toISOString());

      const now = admin.firestore.Timestamp.now();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
      const threeDaysTimestamp = admin.firestore.Timestamp.fromDate(threeDaysFromNow);

      // מצא משימות פעילות עם deadline בתוך 3 ימים או שעבר
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'פעיל')
        .where('deadline', '!=', null)
        .get();

      let remindersCount = 0;
      let overdueCount = 0;

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data();
        const taskId = taskDoc.id;
        const deadline = task.deadline;

        // דלג על משימות ללא deadline
        if (!deadline) continue;

        const isOverdue = deadline.toDate() < now.toDate();
        const isUpcoming = !isOverdue && deadline.toDate() <= threeDaysTimestamp.toDate();

        if (isOverdue) {
          // משימה שעבר הזמן
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `⚠️ משימה באיחור: ${task.clientName}`,
            message: `המשימה "${task.description}" עברה את תאריך היעד (${formatDate(deadline.toDate())})`,
            type: 'error',
            taskId: taskId,
            reminder: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-exclamation-triangle'
          });
          overdueCount++;

        } else if (isUpcoming) {
          // משימה שמתקרבת לתאריך יעד
          const daysLeft = Math.ceil((deadline.toDate() - now.toDate()) / (1000 * 60 * 60 * 24));
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `⏰ תזכורת: ${task.clientName}`,
            message: `המשימה "${task.description}" מתקרבת לתאריך יעד (${daysLeft} ימים)`,
            type: 'warning',
            taskId: taskId,
            reminder: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-clock'
          });
          remindersCount++;
        }
      }

      console.log(`✅ Sent ${overdueCount} overdue alerts and ${remindersCount} upcoming reminders`);
      return { overdueCount, remindersCount };

    } catch (error) {
      console.error('❌ Error in dailyTaskReminders:', error);
      throw error;
    }
  });

/**
 * dailyBudgetWarnings - אזהרות תקציב יומיות
 * רץ כל יום בשעה 17:00 אחה"צ
 * בודק:
 * 1. משימות שחרגו מ-80% מתקציב הזמן (warning)
 * 2. משימות שחרגו 100% מתקציב הזמן (danger)
 * שולח התראה אוטומטית לעובדים
 */
const dailyBudgetWarnings = onSchedule({
  schedule: '0 17 * * *',  // כל יום בשעה 17:00
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async (event) => {
    try {
      console.log('💰 Running dailyBudgetWarnings at', new Date().toISOString());

      // מצא משימות פעילות
      const tasksSnapshot = await db.collection('budget_tasks')
        .where('status', '==', 'פעיל')
        .get();

      let warningsCount = 0;
      let criticalCount = 0;

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data();
        const taskId = taskDoc.id;

        // חישוב תקציב ושעות בפועל
        const estimatedMinutes = (task.estimatedHours || 0) * 60 + (task.estimatedMinutes || 0);
        const actualMinutes = (task.actualHours || 0) * 60 + (task.actualMinutes || 0);

        // דלג על משימות ללא תקציב
        if (estimatedMinutes === 0) continue;

        const percentageUsed = (actualMinutes / estimatedMinutes) * 100;

        // בדוק אם כבר שלחנו התראה היום (למנוע spam)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existingNotification = await db.collection('notifications')
          .where('taskId', '==', taskId)
          .where('automated', '==', true)
          .where('type', 'in', ['warning', 'error'])
          .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(today))
          .limit(1)
          .get();

        if (!existingNotification.empty) {
          console.log(`⏭️  Skipping task ${taskId} - already notified today`);
          continue;
        }

        if (percentageUsed >= 100) {
          // חריגה מלאה מהתקציב
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `🚨 חריגה מתקציב: ${task.clientName}`,
            message: `המשימה "${task.description}" חרגה מתקציב הזמן (${Math.round(percentageUsed)}%)`,
            type: 'error',
            taskId: taskId,
            budgetWarning: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-exclamation-circle'
          });
          criticalCount++;

        } else if (percentageUsed >= 80) {
          // אזהרה - מתקרב לתקציב
          await db.collection('notifications').add({
            userId: task.lawyer || task.createdBy,
            userEmail: task.employee,
            title: `⚠️ התקרבות לתקציב: ${task.clientName}`,
            message: `המשימה "${task.description}" מתקרבת לתקציב הזמן (${Math.round(percentageUsed)}%)`,
            type: 'warning',
            taskId: taskId,
            budgetWarning: true,
            automated: true,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            icon: 'fa-exclamation-triangle'
          });
          warningsCount++;
        }
      }

      console.log(`✅ Sent ${criticalCount} critical budget alerts and ${warningsCount} budget warnings`);
      return { criticalCount, warningsCount };

    } catch (error) {
      console.error('❌ Error in dailyBudgetWarnings:', error);
      throw error;
    }
  });

// ═══════════════════════════════════════════════════════════════
// 🔍 Daily Invariant Check - Data Integrity Monitor
// ═══════════════════════════════════════════════════════════════

// TODO: כשישודרג Twilio — להוסיף שליחת SMS בפער
// מספר יעד: +972549539238

// PR-DRIFT-1 (2026-06-21): package-level CONSUMPTION tolerance. Matches Check 5's
// PKG_DRIFT_TOLERANCE (0.05h / 3min) — the package grain accumulates round2 noise
// per deduction, so the 0.02 service-grain tolerance would false-fire here.
const PKG_HOURSUSED_TOLERANCE = 0.05;

/**
 * Pure helper — Check 0 "card" hours-used for a service, by type.
 * PR-DRIFT-1: a top-level `fixed` service stores logged hours in
 * `work.totalMinutesWorked` (its `service.hoursUsed` is always 0 — fixed services
 * are excluded from billing aggregation). Without the ST.FIXED branch, Check 0
 * compared 0 against Σ(entries) and false-flagged every fixed service with logged
 * time. `legal_procedure`-fixed (pricingType===FIXED) keeps its stages-sum branch.
 * Exposed via `_test`.
 */
function computeCardHoursUsed(service) {
  if (service.type === ST.FIXED) {
    const m = service.work && typeof service.work.totalMinutesWorked === 'number'
      ? service.work.totalMinutesWorked : 0;
    return m / 60;
  }
  if (service.pricingType === PT.FIXED) {
    return (service.stages || []).reduce((sum, st) => sum + (st.totalHoursWorked || 0), 0);
  }
  return service.hoursUsed || 0;
}

/**
 * Pure helper — Check 7 (PR-DRIFT-1): package-level CONSUMPTION drift + internal
 * consistency for HOURS services. Read-only; returns an array of discrepancy
 * objects (the caller stamps clientId/clientName). Empty array = clean.
 *
 * Closes the unmonitored rung in the invariant ladder: `package.hoursUsed` had no
 * check against Σ(entries by packageId). Complements Check 5 (CAPACITY:
 * service.totalHours vs Σpkg.hours), which never covered CONSUMPTION.
 *
 * SCOPE (PR-DRIFT-1): HOURS services only. `legal_procedure` STAGE packages are
 * deferred to PR-DRIFT-3 — their ids ARE catalogued here (so stage entries are not
 * mis-flagged as dangling) but their hoursUsed is NOT drift-checked.
 *
 * Archived services are SKIPPED for the drift/consistency checks — consistent with
 * NON_AGGREGATING_STATUSES (their frozen hoursUsed is intentionally outside billing
 * aggregation; archived drift is covered by the PR-DRIFT-2 repair full-scan).
 *
 * @param {Object} clientData             - the client document data
 * @param {Object} packageMinutes         - { [packageId]: minutes } from the client's entries
 * @param {Object} orphanMinutesByService - { [effectiveServiceId]: minutes } for entries with NO packageId
 * @returns {Array<Object>} discrepancies (possibly empty)
 */
function detectPackageInvariants(clientData, packageMinutes, orphanMinutesByService) {
  const out = [];
  const services = Array.isArray(clientData && clientData.services)
    ? clientData.services.filter(Boolean)
    : [];
  const pkgMin = packageMinutes || {};
  const orphanMin = orphanMinutesByService || {};

  // Pass 1: catalogue EVERY package id anywhere on the client (HOURS packages +
  // legal_procedure stage packages, ALL statuses) so the dangling-id check below
  // does not mis-flag a legal-stage or archived package as "no such package".
  // Count occurrences too — `pkg_<ts>` ids are not globally unique (millisecond
  // timestamp), so a same-client collision makes the packageMinutes bucket
  // ambiguous and the value compare must be skipped.
  const occurrences = {};
  for (const svc of services) {
    for (const pkg of (Array.isArray(svc.packages) ? svc.packages : [])) {
      if (pkg && pkg.id) occurrences[pkg.id] = (occurrences[pkg.id] || 0) + 1;
    }
    for (const stage of (Array.isArray(svc.stages) ? svc.stages : [])) {
      for (const pkg of (stage && Array.isArray(stage.packages) ? stage.packages : [])) {
        if (pkg && pkg.id) occurrences[pkg.id] = (occurrences[pkg.id] || 0) + 1;
      }
    }
  }
  const knownPkgIds = new Set(Object.keys(occurrences));

  // Pass 2: per-service + per-package checks — HOURS + non-archived only.
  for (const svc of services) {
    if (NON_AGGREGATING_STATUSES.includes(svc.status || 'active')) continue; // skip archived
    const isHours = svc.type === ST.HOURS || svc.serviceType === ST.HOURS;
    if (!isHours) continue;
    const serviceId = svc.id;
    const packages = Array.isArray(svc.packages) ? svc.packages : [];

    // (B) orphan signal — entries with NO packageId on a service that HAS packages
    if (packages.length > 0) {
      const om = orphanMin[serviceId] || 0;
      if (om > 0) {
        out.push({
          type: 'orphan_entries_on_packaged_service',
          serviceId,
          orphanMinutes: om,
          orphanHours: round2(om / 60)
        });
      }
    }

    for (const pkg of packages) {
      if (!pkg || !pkg.id) continue;
      const packageId = pkg.id;

      // non-unique id on this client → ambiguous bucket; signal + skip value compares
      if ((occurrences[packageId] || 0) > 1) {
        out.push({ type: 'duplicate_package_id', serviceId, packageId });
        continue;
      }

      const cardUsed = pkg.hoursUsed || 0;
      const entriesUsed = (pkgMin[packageId] || 0) / 60;

      // (A) CONSUMPTION drift: package.hoursUsed vs Σ(entries by packageId)/60.
      // Signed: + = card over-counts logged entries (the dominant phantom case).
      const usedDrift = round2(cardUsed - entriesUsed);
      if (Math.abs(usedDrift) > PKG_HOURSUSED_TOLERANCE) {
        out.push({
          type: 'package_hoursUsed_drift',
          serviceId,
          packageId,
          card: round2(cardUsed),
          entries: round2(entriesUsed),
          drift: usedDrift
        });
      }

      // (consistency) hoursRemaining == hours - hoursUsed (pure arithmetic)
      if (typeof pkg.hoursRemaining === 'number') {
        const expectedRemaining = round2((pkg.hours || 0) - cardUsed);
        const remDrift = round2(pkg.hoursRemaining - expectedRemaining);
        if (Math.abs(remDrift) > PKG_HOURSUSED_TOLERANCE) {
          out.push({
            type: 'package_hoursRemaining_arithmetic',
            serviceId,
            packageId,
            stored: round2(pkg.hoursRemaining),
            expected: expectedRemaining,
            drift: remDrift
          });
        }
      }

      // (consistency) status <-> hoursRemaining coherence. Conservative to avoid
      // noise: `depleted` must have remaining <= 0; `active`/`pending` flagged only
      // BELOW the -10h controlled-overdraft floor (a package inside the window may
      // legitimately stay active/pending).
      const rem = typeof pkg.hoursRemaining === 'number'
        ? pkg.hoursRemaining
        : round2((pkg.hours || 0) - cardUsed);
      const status = pkg.status || 'active';
      let statusIncoherent = false;
      if (status === 'depleted' && rem > PKG_HOURSUSED_TOLERANCE) statusIncoherent = true;
      if ((status === 'active' || status === 'pending') && rem <= -10) statusIncoherent = true;
      if (statusIncoherent) {
        out.push({
          type: 'package_status_incoherent',
          serviceId,
          packageId,
          status,
          hoursRemaining: round2(rem)
        });
      }
    }
  }

  // Pass 3: dangling packageId — an entry references a package id that exists
  // NOWHERE on the client (deleted/renamed package, or a write bug). The inverse
  // of the orphan signal (entry HAS a packageId, but it points to nothing).
  for (const packageId of Object.keys(pkgMin)) {
    if (!knownPkgIds.has(packageId)) {
      out.push({
        type: 'dangling_packageId',
        packageId,
        entries: round2((pkgMin[packageId] || 0) / 60)
      });
    }
  }

  return out;
}

const dailyInvariantCheck = onSchedule({
  schedule: '0 6 * * *',
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async () => {
  const SKIP_CLIENTS = ['2025003'];
  const TOLERANCE = 0.02;
  const discrepancies = [];

  try {
    console.log('🔍 Starting daily invariant check...');

    const clientsSnapshot = await db.collection('clients').get();
    console.log(`📊 Checking ${clientsSnapshot.size} clients`);

    for (const clientDoc of clientsSnapshot.docs) {
      const clientId = clientDoc.id;

      if (SKIP_CLIENTS.includes(clientId)) {
        continue;
      }

      try {
        const clientData = clientDoc.data();
        const clientName = clientData.clientName || clientData.name || clientId;
        const services = clientData.services || [];

        if (services.length === 0) {
          continue;
        }

        // Read all timesheet entries for this client
        const timesheetSnapshot = await db.collection('timesheet_entries')
          .where('clientId', '==', clientId)
          .get();

        // Group minutes by effective serviceId (parentServiceId for legal_procedure stages).
        // PR-DRIFT-1: from the SAME single read, also group by packageId (Check 7) and
        // accumulate orphan (no-packageId) minutes per effective service.
        const serviceMinutes = {};
        const packageMinutes = {};
        const orphanMinutesByService = {};
        timesheetSnapshot.forEach(doc => {
          const entry = doc.data();
          const effectiveServiceId = entry.parentServiceId || entry.serviceId;
          if (effectiveServiceId) {
            serviceMinutes[effectiveServiceId] = (serviceMinutes[effectiveServiceId] || 0) + (entry.minutes || 0);
          }
          if (entry.packageId) {
            packageMinutes[entry.packageId] = (packageMinutes[entry.packageId] || 0) + (entry.minutes || 0);
          } else if (effectiveServiceId) {
            orphanMinutesByService[effectiveServiceId] = (orphanMinutesByService[effectiveServiceId] || 0) + (entry.minutes || 0);
          }
        });

        // Check each service
        for (const service of services) {
          const serviceId = service.id;
          if (!serviceId) continue;

          const cardHoursUsed = computeCardHoursUsed(service);
          const timesheetMinutes = serviceMinutes[serviceId] || 0;
          const timesheetHoursUsed = timesheetMinutes / 60;
          const gap = Math.abs(cardHoursUsed - timesheetHoursUsed);

          if (gap > TOLERANCE) {
            discrepancies.push({
              clientId,
              clientName,
              serviceId,
              serviceName: service.name || service.type || serviceId,
              cardHoursUsed: parseFloat(cardHoursUsed.toFixed(2)),
              timesheetHoursUsed: parseFloat(timesheetHoursUsed.toFixed(2)),
              gap: parseFloat(gap.toFixed(2))
            });
          }
        }

        // ── Check 7 (PR-DRIFT-1): package-level consumption + consistency drift ──
        // Reuses the per-client entries already read above (packageMinutes /
        // orphanMinutesByService). Read-only — only pushes to `discrepancies`.
        const pkgDiscrepancies = detectPackageInvariants(clientData, packageMinutes, orphanMinutesByService);
        for (const d of pkgDiscrepancies) {
          discrepancies.push({ ...d, clientId, clientName });
        }
      } catch (clientError) {
        console.error(`⚠️ Error checking client ${clientId}:`, clientError.message);
        // Continue to next client
      }
    }

    // Check 1: tasks without serviceId
    const tasksSnapshot = await db.collection('budget_tasks')
      .where('status', 'in', ['פעיל', 'הושלם'])
      .get();
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      if (!task.serviceId) {
        discrepancies.push({
          type: 'task_missing_serviceId',
          taskId: doc.id,
          clientId: task.clientId,
          employee: task.employee,
          description: task.description
        });
      }
    });

    // Check 2: stages missing required fields
    const REQUIRED_STAGE_FIELDS = ['id', 'pricingType', 'status', 'order'];
    clientsSnapshot.docs.forEach(clientDoc => {
      const data = clientDoc.data();
      const clientName = data.clientName || data.name || clientDoc.id;
      (data.services || []).forEach(svc => {
        if (svc.type === ST.LEGAL_PROCEDURE) {
          (svc.stages || []).forEach(stage => {
            const missingFields = REQUIRED_STAGE_FIELDS.filter(f => stage[f] === undefined || stage[f] === null);
            if (missingFields.length > 0) {
              discrepancies.push({
                type: 'stage_missing_required_field',
                clientId: clientDoc.id,
                clientName,
                serviceId: svc.id,
                serviceName: svc.name || svc.id,
                stageId: stage.id,
                missingFields
              });
            }
          });
        }
      });
    });

    // Check 3: task.actualMinutes vs SUM entries
    const taskMinutes = {};
    const allEntriesSnapshot = await db.collection('timesheet_entries')
      .where('taskId', '!=', null)
      .get();
    allEntriesSnapshot.forEach(doc => {
      const entry = doc.data();
      if (entry.taskId) {
        taskMinutes[entry.taskId] = (taskMinutes[entry.taskId] || 0) + (entry.minutes || 0);
      }
    });
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      const sumEntries = taskMinutes[doc.id] || 0;
      const actualMinutes = task.actualMinutes || 0;
      if (Math.abs(actualMinutes - sumEntries) > 1) {
        discrepancies.push({
          type: 'task_actualMinutes_gap',
          taskId: doc.id,
          clientId: task.clientId,
          actualMinutes,
          sumEntries,
          gap: sumEntries - actualMinutes
        });
      }
    });

    // Check 4: task.actualHours vs task.actualMinutes (drift between aggregates)
    // Tolerance: 1 minute (0.0167h). Catches:
    //   - Pre-trigger edits (entries edited before 2026-03-01)
    //   - round2 rounding accumulation in trigger
    //   - Any future flow that updates one field without the other
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      const actualMinutes = task.actualMinutes || 0;
      const actualHours = task.actualHours || 0;
      const hoursAsMinutes = actualHours * 60;
      const driftMinutes = Math.abs(hoursAsMinutes - actualMinutes);
      if (driftMinutes > 1) {
        discrepancies.push({
          type: 'task_actualHours_actualMinutes_drift',
          taskId: doc.id,
          clientId: task.clientId,
          actualMinutes,
          actualHours,
          driftMinutes
        });
      }
    });

    // Check 5: package drift — service.totalHours vs Σ(packages.hours)
    // Catches the regression pattern fixed in commit 974152d (renewServiceHours
    // updated totalHours but skipped pushing the new package).
    // Tolerance: 0.05h (3min) to allow rounding noise.
    const PKG_DRIFT_TOLERANCE = 0.05;
    clientsSnapshot.docs.forEach(clientDoc => {
      const data = clientDoc.data();
      const clientName = data.clientName || data.name || clientDoc.id;
      (data.services || []).forEach(svc => {
        const isHours = svc.type === ST.HOURS || svc.serviceType === ST.HOURS;
        if (!isHours) return;
        const packages = Array.isArray(svc.packages) ? svc.packages : [];
        if (packages.length === 0) {
          // Service with no packages — skip (separate concern)
          return;
        }
        const sumPkgHours = packages.reduce((sum, p) => sum + (p.hours || 0), 0);
        const totalHours = svc.totalHours || 0;
        const drift = Math.abs(totalHours - sumPkgHours);
        if (drift > PKG_DRIFT_TOLERANCE) {
          discrepancies.push({
            type: 'package_drift',
            clientId: clientDoc.id,
            clientName,
            serviceId: svc.id,
            serviceName: svc.name || svc.serviceName || svc.id,
            totalHours: parseFloat(totalHours.toFixed(2)),
            sumPkgHours: parseFloat(sumPkgHours.toFixed(2)),
            drift: parseFloat(drift.toFixed(2)),
            packageCount: packages.length,
            renewalHistoryCount: (svc.renewalHistory || []).length
          });
        }
      });
    });

    // Check 6: client-aggregate drift (PR-C.1 — I1-I4 invariants).
    // Companion to PR-D's on-demand audit (admin/repair-aggregates.js).
    // Same comparison logic, same tolerance — nightly automation so any
    // drift introduced before the PR-B migrations (or by a future
    // architectural regression) surfaces in `system_health_checks`
    // without requiring Haim to trigger an audit manually.
    clientsSnapshot.docs.forEach(clientDoc => {
      const clientId = clientDoc.id;
      if (SKIP_CLIENTS.includes(clientId)) return;
      const data = clientDoc.data();
      const driftFields = detectAggregateDrift(data);
      if (driftFields.length > 0) {
        discrepancies.push({
          type: 'aggregate_drift',
          clientId,
          clientName: data.fullName || data.clientName || data.name || clientId,
          driftFields
        });
      }
    });

    // Save result to system_health_checks
    if (discrepancies.length > 0) {
      await db.collection('system_health_checks').add({
        type: 'invariant_check',
        status: 'FAIL',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discrepanciesCount: discrepancies.length,
        discrepancies,
        message: `נמצאו ${discrepancies.length} פערים בנתוני שעות`
      });
      console.log(`❌ Invariant check FAILED — ${discrepancies.length} discrepancies found`);
    } else {
      await db.collection('system_health_checks').add({
        type: 'invariant_check',
        status: 'PASS',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discrepanciesCount: 0,
        discrepancies: [],
        message: 'כל הנתונים תקינים'
      });
      console.log('✅ Invariant check PASSED — no discrepancies');
    }

  } catch (error) {
    console.error('❌ Invariant check ERROR:', error);
    try {
      await db.collection('system_health_checks').add({
        type: 'invariant_check',
        status: 'ERROR',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        discrepanciesCount: 0,
        discrepancies: [],
        message: `שגיאה בבדיקת תקינות: ${error.message}`
      });
    } catch (saveError) {
      console.error('❌ Failed to save error status:', saveError);
    }
  }
});

// PR-G.1 (2026-05-19): nightly sync of Israeli holiday calendar
// (current year + 5 forward) into Firestore `system_holidays/{year}`.
// Uses @hebcal/core offline — no HTTP, deterministic.
const calendarLib = require('../shared/calendar');
const crypto = require('crypto');

const FORWARD_YEARS = 5;

function _hashHolidays(holidays) {
  return crypto.createHash('sha1').update(JSON.stringify(holidays)).digest('hex');
}

async function syncHolidaysForYear(year) {
  const docRef = db.collection('system_holidays').doc(String(year));
  const holidaysAuto = calendarLib.getHolidaysForYear(year);
  const contentHash = _hashHolidays(holidaysAuto);

  const existing = await docRef.get();
  if (existing.exists && existing.data().contentHash === contentHash) {
    console.log(`[holidaysCalendarSync] ${year} — hash matches, skip write`);
    return { year, status: 'unchanged', count: holidaysAuto.length };
  }

  // PR-G.3.3 (2026-05-20): write via `update` semantics (set with merge:true)
  // so we NEVER touch `holidaysOverrides` (admin-managed). Cron owns only
  // `holidaysAuto + contentHash + source + generatedAt + year`. Frontend
  // merges auto + overrides on read.
  // Important: do NOT write a `holidays` field — it's gone in the new schema.
  // Backward compat is handled by frontend (`data.holidaysAuto || data.holidays`).
  await docRef.set({
    year,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    source: `@hebcal/core@${calendarLib.HEBCAL_VERSION}`,
    holidaysAuto,
    contentHash
  }, { merge: true });
  console.log(`[holidaysCalendarSync] ${year} — wrote ${holidaysAuto.length} auto holidays (overrides preserved)`);
  return { year, status: existing.exists ? 'updated' : 'created', count: holidaysAuto.length };
}

const holidaysCalendarSync = onSchedule({
  schedule: '0 3 * * *',
  timeZone: 'Asia/Jerusalem',
  region: 'us-central1'
}, async () => {
  console.log('🕯️  Starting holidays calendar sync...');
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i <= FORWARD_YEARS; i++) {
    years.push(currentYear + i);
  }

  const results = [];
  for (const year of years) {
    try {
      const r = await syncHolidaysForYear(year);
      results.push(r);
    } catch (err) {
      console.error(`[holidaysCalendarSync] year ${year} failed:`, err.message);
      results.push({ year, status: 'error', error: err.message });
    }
  }

  console.log(`✅ Holidays sync complete: ${JSON.stringify(results)}`);
  return null;
});

module.exports = {
  dailyTaskReminders,
  dailyBudgetWarnings,
  dailyInvariantCheck,
  holidaysCalendarSync,
  // Exported for unit testing only (PR-C.1 + PR-G.1 + PR-DRIFT-1).
  _test: {
    detectAggregateDrift,
    detectPackageInvariants,
    computeCardHoursUsed,
    AGG_DRIFT_TOLERANCE,
    PKG_HOURSUSED_TOLERANCE,
    syncHolidaysForYear,
    _hashHolidays
  }
};
