/**
 * Seed `system_holidays/{year}` collection with current year + 5 forward years
 * (PR-G.1).
 *
 * Useful for the first deploy of PR-G.1 — instead of waiting 24h for the
 * `holidaysCalendarSync` cron to fire, run this script with admin
 * credentials to populate the collection immediately.
 *
 * Usage:
 *   cd functions
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node scripts/seedHolidays.js
 *
 * Idempotent — if `contentHash` matches existing doc, write is skipped.
 */

const admin = require('firebase-admin');
const crypto = require('crypto');

// Initialize admin SDK (relies on GOOGLE_APPLICATION_CREDENTIALS env var).
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const calendarLib = require('../shared/calendar');

const FORWARD_YEARS = 5;

function hashHolidays(holidays) {
  return crypto.createHash('sha1').update(JSON.stringify(holidays)).digest('hex');
}

async function seed() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i <= FORWARD_YEARS; i++) {
    years.push(currentYear + i);
  }

  console.log(`Seeding system_holidays for years: ${years.join(', ')}`);
  console.log(`Source: @hebcal/core@${calendarLib.HEBCAL_VERSION}`);

  for (const year of years) {
    const holidays = calendarLib.getHolidaysForYear(year);
    const contentHash = hashHolidays(holidays);
    const docRef = db.collection('system_holidays').doc(String(year));

    const existing = await docRef.get();
    if (existing.exists && existing.data().contentHash === contentHash) {
      console.log(`  ${year}: hash matches (${holidays.length} holidays) — skipping`);
      continue;
    }

    await docRef.set({
      year,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: `@hebcal/core@${calendarLib.HEBCAL_VERSION}`,
      holidays,
      contentHash
    });
    console.log(`  ${year}: ${existing.exists ? 'updated' : 'created'} (${holidays.length} holidays)`);
  }

  console.log('Done.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
