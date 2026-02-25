/**
 * Fix encoding issues in budget tasks
 * Converts HTML entities back to normal characters
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

/**
 * Decode HTML entities
 */
function decodeHTMLEntities(text) {
  if (!text || typeof text !== 'string') {
return text;
}

  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fixQuotesEncoding() {
  console.log('🔧 FIXING QUOTES ENCODING IN BUDGET TASKS\n');
  console.log('═══════════════════════════════════════════════════\n');

  const db = admin.firestore();

  // Get ALL budget tasks (not just Marva's)
  const tasksSnapshot = await db.collection('budget_tasks').get();

  console.log(`📊 Checking ${tasksSnapshot.size} tasks\n`);

  let fixed = 0;
  const batch = db.batch();

  tasksSnapshot.forEach((doc) => {
    const task = doc.data();
    const description = task.description || '';

    // Check for encoding issues
    const hasIssues = description.includes('&quot;') ||
                     description.includes('&apos;') ||
                     description.includes('&#39;') ||
                     description.includes('&amp;') ||
                     description.includes('&lt;') ||
                     description.includes('&gt;');

    if (hasIssues) {
      const fixedDescription = decodeHTMLEntities(description);

      console.log(`\n🔧 Fixing Task ID: ${doc.id}`);
      console.log(`   Client: ${task.clientName}`);
      console.log(`   BEFORE: ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}`);
      console.log(`   AFTER:  ${fixedDescription.substring(0, 80)}${fixedDescription.length > 80 ? '...' : ''}`);

      batch.update(doc.ref, {
        description: fixedDescription,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      fixed++;
    }
  });

  if (fixed === 0) {
    console.log('\n✅ No tasks need fixing!');
  } else {
    console.log(`\n\n💾 Committing ${fixed} fixes to Firestore...`);
    await batch.commit();
    console.log(`✅ Successfully fixed ${fixed} tasks!`);
  }

  process.exit(0);
}

fixQuotesEncoding().catch(console.error);
