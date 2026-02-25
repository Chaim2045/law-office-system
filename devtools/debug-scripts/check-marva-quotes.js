/**
 * Check Marva's budget tasks for encoding issues with quotes (גרשיים)
 */

const admin = require('firebase-admin');
const serviceAccount = require('../../firebase-admin-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function checkQuotesEncoding() {
  console.log('🔍 CHECKING QUOTES ENCODING IN MARVA\'S TASKS\n');
  console.log('═══════════════════════════════════════════════════\n');

  const db = admin.firestore();
  const marvaEmail = 'marva@ghlawoffice.co.il';

  // Get all Marva's tasks
  const tasksSnapshot = await db.collection('budget_tasks')
    .where('employee', '==', marvaEmail)
    .limit(10)
    .get();

  console.log(`📊 Found ${tasksSnapshot.size} tasks\n`);

  let issuesFound = 0;

  tasksSnapshot.forEach((doc) => {
    const task = doc.data();
    const description = task.description || '';

    // Check for various encoding issues
    const hasQuot = description.includes('&quot;');
    const hasApos = description.includes('&apos;');
    const hasAmp = description.includes('&amp;');
    const hasLt = description.includes('&lt;');
    const hasGt = description.includes('&gt;');
    const hasWeirdChars = description.includes('�');

    if (hasQuot || hasApos || hasAmp || hasLt || hasGt || hasWeirdChars) {
      issuesFound++;
      console.log(`\n🔍 Task ID: ${doc.id}`);
      console.log(`   Client: ${task.clientName}`);
      console.log(`   Description: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`);
      console.log('   Issues:');
      if (hasQuot) {
console.log('     ❌ Contains &quot;');
}
      if (hasApos) {
console.log('     ❌ Contains &apos;');
}
      if (hasAmp) {
console.log('     ❌ Contains &amp;');
}
      if (hasLt) {
console.log('     ❌ Contains &lt;');
}
      if (hasGt) {
console.log('     ❌ Contains &gt;');
}
      if (hasWeirdChars) {
console.log('     ❌ Contains � (replacement character)');
}
    }
  });

  console.log('\n\n📋 SUMMARY:');
  console.log(`   Total tasks checked: ${tasksSnapshot.size}`);
  console.log(`   Tasks with issues: ${issuesFound}`);

  if (issuesFound === 0) {
    console.log('\n✅ No encoding issues found in Firestore!');
    console.log('   → The problem is likely happening during display, not storage.');
  } else {
    console.log(`\n⚠️ Found ${issuesFound} tasks with encoding issues in Firestore`);
    console.log('   → Need to fix these in the database');
  }

  process.exit(0);
}

checkQuotesEncoding().catch(console.error);
