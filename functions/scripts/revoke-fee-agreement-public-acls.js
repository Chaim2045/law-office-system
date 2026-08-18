/**
 * revoke-fee-agreement-public-acls.js — PR-SEC-2 one-time migration
 * ─────────────────────────────────────────────────────────────────────────────
 * Closes the world-readable fee-agreement leak for EXISTING objects. The upload
 * paths used `file.makePublic()` (an object-level allUsers:READER ACL that bypasses
 * storage.rules) + stored a permanent public `downloadUrl`. PR-SEC-2 removed the
 * makePublic from the upload paths; this script revokes the ACL on already-uploaded
 * objects AND nulls the stale stored `downloadUrl` (which would otherwise be a dead
 * 403 pointer that also leaks the storage layout to every authenticated reader of
 * the world-readable `clients` doc).
 *
 * Three phases (backup-FIRST — the F2 PROD-migration invariant):
 *   SCAN (read-only): iterate `clients` + `cases`; build the doc-update plan (which
 *     feeAgreements arrays carry a `downloadUrl` to strip) and the storage-object
 *     plan (every object under clients|cases /agreements/). NO mutations.
 *   BACKUP: write the durable local JSON (OLD feeAgreements arrays + object paths —
 *     the rollback key) to disk BEFORE any mutation runs.
 *   EXECUTE (only with `--apply`): PASS 1 rewrites each planned doc's feeAgreements
 *     WITHOUT downloadUrl (storagePath preserved); PASS 2 `makePrivate()`s every
 *     planned object (idempotent — already-private is a no-op; catches orphans too).
 *
 * Safety (mirrors functions/scripts/backfill-cost-per-hour.js; NON-interactive §8.4):
 *   • DRY-RUN by default. `--apply` to mutate. No interactive prompt.
 *   • Durable local JSON backup written BEFORE any mutation (read-only scan first).
 *   • Per-record try/catch (one bad doc/object never aborts the run).
 *   • Batched Firestore writes (≤450/commit), each commit wrapped (a failed batch
 *     is logged + counted, never aborts the rest).
 *   • NO PII in console output (only counts + business ids / storagePaths).
 *
 * Rollback: from the backup JSON, re-set each doc's feeAgreements to `oldAgreements`
 *   and `file.makePublic()` each path (ONLY if a regression forces it — the whole
 *   point is that these should NOT be public).
 *
 * Usage (from functions/, AFTER PR-SEC-2 deploys + getFeeAgreementUrl is live+smoked):
 *   node scripts/revoke-fee-agreement-public-acls.js            # dry-run (default)
 *   node scripts/revoke-fee-agreement-public-acls.js --apply    # mutate
 */
'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const COLLECTIONS = ['clients', 'cases'];
const COMMIT = 450;

/** The folder shape every legitimate uploader writes. */
function expectedPrefix(collection, entityId) {
  return `${collection}/${entityId}/agreements/`;
}

/**
 * PURE core (exported for unit tests): given a doc's feeAgreements array, compute
 * the rewrite that strips `downloadUrl` and the list of objects to revoke.
 *
 * @returns {{ changed: boolean, newAgreements: object[], items: Array<{agreementId, storagePath, hadDownloadUrl, prefixOk}> }}
 */
function planDocRevocation(feeAgreements, collection, entityId) {
  const list = Array.isArray(feeAgreements) ? feeAgreements : [];
  const prefix = expectedPrefix(collection, entityId);
  let changed = false;
  const items = [];
  const newAgreements = list.map((a) => {
    const rec = a && typeof a === 'object' ? a : {};
    const storagePath = typeof rec.storagePath === 'string' ? rec.storagePath : '';
    const hadDownloadUrl = typeof rec.downloadUrl === 'string' && rec.downloadUrl.length > 0;
    items.push({
      agreementId: typeof rec.id === 'string' ? rec.id : null,
      storagePath,
      hadDownloadUrl,
      prefixOk: storagePath.startsWith(prefix)
    });
    if (hadDownloadUrl) {
      changed = true;
      // strip the dead public URL; preserve everything else (storagePath included)
      const rest = { ...rec };
      delete rest.downloadUrl;
      return rest;
    }
    return rec;
  });
  return { changed, newAgreements, items };
}

// ─── Side-effecting runner (skipped when required as a module for tests) ──────
async function main() {
  const APPLY = process.argv.includes('--apply');
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  console.log(`\n[revoke-acls] mode=${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  const counts = {
    docsScanned: 0, docsToUpdate: 0, docsUpdated: 0,
    objectsListed: 0, objectsToRevoke: 0, objectsRevoked: 0,
    prefixMismatches: 0, errors: 0
  };
  const backup = { mode: APPLY ? 'apply' : 'dry-run', docs: [], objects: [] };
  const docPlan = [];    // { ref, newAgreements } — built read-only, executed later
  const objectPlan = []; // File handles — built read-only, executed later

  // ─── SCAN PHASE (read-only) — Firestore docs needing a downloadUrl strip ───
  for (const collection of COLLECTIONS) {
    let cursor = null;
    for (;;) {
      let q = db.collection(collection).orderBy('__name__').limit(500);
      if (cursor) q = q.startAfter(cursor);
      const page = await q.get();
      if (page.empty) break;
      cursor = page.docs[page.docs.length - 1];

      for (const doc of page.docs) {
        counts.docsScanned += 1;
        try {
          const data = doc.data() || {};
          if (!Array.isArray(data.feeAgreements) || data.feeAgreements.length === 0) continue;
          const { changed, newAgreements, items } = planDocRevocation(
            data.feeAgreements, collection, doc.id
          );
          items.forEach((it) => {
            if (it.storagePath && !it.prefixOk) counts.prefixMismatches += 1;
          });
          if (!changed) continue;
          counts.docsToUpdate += 1;
          backup.docs.push({ collection, docId: doc.id, oldAgreements: data.feeAgreements });
          docPlan.push({ ref: doc.ref, newAgreements });
        } catch (err) {
          counts.errors += 1;
          console.error(`[revoke-acls] scan doc ${collection}/${doc.id} failed: ${err && err.code ? err.code : 'error'}`);
        }
      }
      console.log(`[revoke-acls] SCAN ${collection}: scanned ${counts.docsScanned}, toUpdate ${counts.docsToUpdate}`);
    }
  }

  // ─── SCAN PHASE (read-only) — Storage objects to makePrivate (incl. orphans) ──
  for (const collection of COLLECTIONS) {
    let pageToken;
    for (;;) {
      const [files, , apiResp] = await bucket.getFiles({
        prefix: `${collection}/`, autoPaginate: false, maxResults: 1000, pageToken
      });
      for (const file of files) {
        if (!file.name.includes('/agreements/')) continue;
        counts.objectsListed += 1;
        counts.objectsToRevoke += 1;
        backup.objects.push(file.name);
        objectPlan.push(file);
      }
      pageToken = apiResp && apiResp.nextPageToken;
      if (!pageToken) break;
    }
    console.log(`[revoke-acls] SCAN ${collection}: objectsToRevoke ${counts.objectsToRevoke}`);
  }

  // ─── BACKUP PHASE — durable JSON written BEFORE any mutation (F2 invariant) ──
  const backupDir = path.resolve(__dirname, '../security-migration-backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  // Unique per-run filename (timestamp) — a dry-run then --apply, or a partial-crash
  // re-run, must NEVER overwrite an earlier run's rollback key (devils-advocate #3).
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `revoke-acls-plan-${stamp}-${counts.docsScanned}docs.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ counts, ...backup }, null, 2));
  console.log(`[revoke-acls] backup written to ${backupFile} (BEFORE any mutation)`);
  if (counts.prefixMismatches > 0) {
    console.warn(`[revoke-acls] ⚠️ ${counts.prefixMismatches} agreement(s) had a storagePath OUTSIDE the expected entity folder — review the backup before --apply.`);
  }

  // ─── EXECUTE PHASE — mutate ONLY with --apply, from the persisted plan ───────
  if (APPLY) {
    // PASS 1 — Firestore: strip stale downloadUrl (batched; per-commit safe).
    let batch = db.batch();
    let pending = 0;
    for (const item of docPlan) {
      batch.update(item.ref, { feeAgreements: item.newAgreements });
      pending += 1;
      if (pending >= COMMIT) {
        try { await batch.commit(); counts.docsUpdated += pending; }
        catch (err) { counts.errors += pending; console.error(`[revoke-acls] batch commit failed (${pending} docs): ${err && err.code ? err.code : 'error'}`); }
        batch = db.batch(); pending = 0;
      }
    }
    if (pending > 0) {
      try { await batch.commit(); counts.docsUpdated += pending; }
      catch (err) { counts.errors += pending; console.error(`[revoke-acls] final batch commit failed (${pending} docs): ${err && err.code ? err.code : 'error'}`); }
    }

    // PASS 2 — Storage: makePrivate every planned object (idempotent; per-object safe).
    for (const file of objectPlan) {
      try {
        await file.makePrivate(); // idempotent: already-private = no-op
        counts.objectsRevoked += 1;
      } catch (err) {
        counts.errors += 1;
        console.error(`[revoke-acls] makePrivate ${file.name} failed: ${err && err.code ? err.code : 'error'}`);
      }
    }
  }

  console.log(`\n[revoke-acls] DONE — ${JSON.stringify(counts)}`);
  console.log(`[revoke-acls] plan written to ${backupFile}`);
  if (!APPLY) console.log('[revoke-acls] DRY-RUN — no mutations. Re-run with --apply to revoke.');
}

module.exports = { planDocRevocation, expectedPrefix };

if (require.main === module) {
  main().then(() => process.exit(0)).catch((err) => {
    console.error('[revoke-acls] FATAL:', err && err.message ? err.message : err);
    process.exit(1);
  });
}
