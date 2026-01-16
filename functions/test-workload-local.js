/**
 * Local Test Script for Workload Analytics
 * ════════════════════════════════════════════════════════════════
 *
 * Tests: Module load, export validation, input schema
 * Does NOT require Firebase connection
 */

console.log('🧪 Testing Workload Analytics Module (Local)\n');

try {
  // ───────────────────────────────────────────────────────────────
  // 1. Module Load Test
  // ───────────────────────────────────────────────────────────────

  console.log('1️⃣ Testing module load...');
  const workloadModule = require('./workload-analytics');
  console.log('   ✅ Module loaded successfully');

  // ───────────────────────────────────────────────────────────────
  // 2. Export Validation
  // ───────────────────────────────────────────────────────────────

  console.log('\n2️⃣ Testing exports...');
  const exports = Object.keys(workloadModule);
  console.log('   Exports found:', exports);

  if (!workloadModule.getTeamWorkloadData) {
    throw new Error('getTeamWorkloadData not exported!');
  }
  console.log('   ✅ getTeamWorkloadData exported');
  console.log('   ✅ Type:', typeof workloadModule.getTeamWorkloadData);

  // ───────────────────────────────────────────────────────────────
  // 3. Input Validation Tests (using Joi directly)
  // ───────────────────────────────────────────────────────────────

  console.log('\n3️⃣ Testing input validation (Joi schema)...');
  const Joi = require('joi');

  const inputSchema = Joi.object({
    employeeEmails: Joi.array()
      .items(Joi.string().email())
      .min(1)
      .max(50)
      .required()
  });

  // Test Case 1: Valid input
  const validInput = {
    employeeEmails: ['user1@example.com', 'user2@example.com']
  };
  const { error: error1 } = inputSchema.validate(validInput);
  if (error1) {
    throw new Error(`Valid input rejected: ${error1.message}`);
  }
  console.log('   ✅ Valid input accepted');

  // Test Case 2: Invalid email
  const invalidEmail = {
    employeeEmails: ['not-an-email']
  };
  const { error: error2 } = inputSchema.validate(invalidEmail);
  if (!error2) {
    throw new Error('Invalid email was accepted!');
  }
  console.log('   ✅ Invalid email rejected');

  // Test Case 3: Too many emails
  const tooManyEmails = {
    employeeEmails: Array(51).fill('user@example.com')
  };
  const { error: error3 } = inputSchema.validate(tooManyEmails);
  if (!error3) {
    throw new Error('Too many emails (>50) was accepted!');
  }
  console.log('   ✅ Limit (>50 emails) enforced');

  // Test Case 4: Empty array
  const emptyArray = {
    employeeEmails: []
  };
  const { error: error4 } = inputSchema.validate(emptyArray);
  if (!error4) {
    throw new Error('Empty array was accepted!');
  }
  console.log('   ✅ Empty array rejected');

  // ───────────────────────────────────────────────────────────────
  // 4. Chunking Logic Test
  // ───────────────────────────────────────────────────────────────

  console.log('\n4️⃣ Testing chunking logic...');

  function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  const testArray = Array(25).fill(0).map((_, i) => `user${i}@example.com`);
  const chunks = chunkArray(testArray, 10);

  console.log(`   Input: ${testArray.length} emails`);
  console.log(`   Chunks created: ${chunks.length}`);
  console.log(`   Chunk sizes: ${chunks.map(c => c.length).join(', ')}`);

  if (chunks.length !== 3) {
    throw new Error('Expected 3 chunks, got ' + chunks.length);
  }
  if (chunks[0].length !== 10 || chunks[1].length !== 10 || chunks[2].length !== 5) {
    throw new Error('Chunk sizes incorrect');
  }
  console.log('   ✅ Chunking works correctly');

  // ───────────────────────────────────────────────────────────────
  // 5. Date Helper Test
  // ───────────────────────────────────────────────────────────────

  console.log('\n5️⃣ Testing date helper...');

  function getStartOfMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  }

  const startOfMonth = getStartOfMonth();
  const dateRegex = /^\d{4}-\d{2}-01$/;

  if (!dateRegex.test(startOfMonth)) {
    throw new Error('Invalid date format: ' + startOfMonth);
  }
  console.log('   Start of month:', startOfMonth);
  console.log('   ✅ Date format correct (YYYY-MM-01)');

  // ───────────────────────────────────────────────────────────────
  // SUCCESS
  // ───────────────────────────────────────────────────────────────

  console.log('\n✅ All local tests passed!\n');
  console.log('─────────────────────────────────────────────────');
  console.log('Note: Firebase connectivity tests require emulator');
  console.log('Run: npm run serve (in functions/)');
  console.log('─────────────────────────────────────────────────\n');

} catch (error) {
  console.error('\n❌ Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
