/**
 * Sync Constants Test
 * ====================
 *
 * Verifies that all 3 adapter files are in sync with the canonical source.
 * Run: node tests/sync-constants.test.js
 *
 * This test should also run as part of pre-commit hooks and CI.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ═════════════════════════════════���═════════
// Load the canonical source
// ═══════════════════════════════════════════
const canonical = require(path.join(ROOT, 'shared', 'system-constants.js'));

// ═══════════════════════════════════════════
// Load the Functions adapter (CommonJS — direct require)
// ═══════════════════════════════════════════
const functionsAdapter = require(path.join(ROOT, 'functions', 'shared', 'constants.js'));

// ═══════════════════════════════════════════
// Extract SYSTEM_CONSTANTS from IIFE adapters (parse the JS file)
// ═══════════════════════════════════════════
function extractConstantsFromIIFE(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');

  // Create a fake window and console
  const fakeWindow = {};
  const fakeConsole = { log: function() {} };
  const wrappedCode = code
    .replace(/window\.SYSTEM_CONSTANTS/g, 'fakeWindow.SYSTEM_CONSTANTS')
    .replace(/window\.SystemConstantsHelpers/g, 'fakeWindow.SystemConstantsHelpers');

  // Execute in a sandboxed context
  const fn = new Function('fakeWindow', 'console', wrappedCode + '\nreturn fakeWindow;');
  return fn(fakeWindow, fakeConsole);
}

const adminAdapterPath = path.join(ROOT, 'apps', 'admin-panel', 'js', 'core', 'system-constants.js');
const userAppAdapterPath = path.join(ROOT, 'apps', 'user-app', 'js', 'core', 'system-constants.js');

const adminAdapter = extractConstantsFromIIFE(adminAdapterPath);
const userAppAdapter = extractConstantsFromIIFE(userAppAdapterPath);


// ═══════════════════════════════════════════
// Deep comparison utility
// ═══════════════════════════════════════════
function deepEqual(a, b, pathStr) {
  const errors = [];

  if (a === b) {
return errors;
}

  if (typeof a !== typeof b) {
    errors.push(`${pathStr}: type mismatch — canonical=${typeof a}, adapter=${typeof b}`);
    return errors;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) {
      errors.push(`${pathStr}: canonical is array, adapter is not`);
      return errors;
    }
    if (a.length !== b.length) {
      errors.push(`${pathStr}: array length — canonical=${a.length}, adapter=${b.length}`);
      return errors;
    }
    for (let i = 0; i < a.length; i++) {
      errors.push(...deepEqual(a[i], b[i], `${pathStr}[${i}]`));
    }
    return errors;
  }

  if (typeof a === 'object' && a !== null) {
    const aKeys = Object.keys(a).sort();
    const bKeys = Object.keys(b || {}).sort();

    // Check for missing keys
    for (const key of aKeys) {
      if (!bKeys.includes(key)) {
        errors.push(`${pathStr}.${key}: missing in adapter`);
      }
    }
    // Check for extra keys
    for (const key of bKeys) {
      if (!aKeys.includes(key)) {
        errors.push(`${pathStr}.${key}: extra key in adapter (not in canonical)`);
      }
    }
    // Check values
    for (const key of aKeys) {
      if (bKeys.includes(key)) {
        errors.push(...deepEqual(a[key], b[key], `${pathStr}.${key}`));
      }
    }
    return errors;
  }

  if (a !== b) {
    errors.push(`${pathStr}: value mismatch — canonical=${JSON.stringify(a)}, adapter=${JSON.stringify(b)}`);
  }

  return errors;
}


// ═══════════════════════════════════════════
// Run Tests
// ═══════════════════════════════════════════
let totalErrors = 0;
let totalTests = 0;

function testAdapter(name, adapterConstants) {
  totalTests++;
  const errors = deepEqual(canonical.SYSTEM_CONSTANTS, adapterConstants, 'SYSTEM_CONSTANTS');

  if (errors.length === 0) {
    console.log(`  ✅ ${name} — in sync`);
  } else {
    console.log(`  ❌ ${name} — ${errors.length} differences:`);
    errors.forEach(err => console.log(`     ${err}`));
    totalErrors += errors.length;
  }
}

function testHelpers(name, adapterHelpers) {
  totalTests++;
  const expectedHelpers = [
    'getStageName',
    'getServiceTypeLabel',
    'getPricingTypeLabel',
    'getRoleLabel',
    'isValidServiceType',
    'isValidPricingType',
    'isValidStageId',
    'isValidRole',
    'isValidPackageType'
  ];

  const missing = expectedHelpers.filter(h => typeof adapterHelpers[h] !== 'function');

  if (missing.length === 0) {
    console.log(`  ✅ ${name} helpers — all present`);
  } else {
    console.log(`  ❌ ${name} helpers — missing: ${missing.join(', ')}`);
    totalErrors += missing.length;
  }
}

function testHelperResults(name, helpers) {
  totalTests++;
  const errors = [];

  // Test getStageName
  if (helpers.getStageName('stage_a') !== canonical.getStageName('stage_a')) {
    errors.push(`getStageName('stage_a'): ${helpers.getStageName('stage_a')} !== ${canonical.getStageName('stage_a')}`);
  }
  if (helpers.getStageName('unknown') !== canonical.getStageName('unknown')) {
    errors.push('getStageName(\'unknown\') fallback mismatch');
  }

  // Test getServiceTypeLabel
  if (helpers.getServiceTypeLabel('hours') !== canonical.getServiceTypeLabel('hours')) {
    errors.push('getServiceTypeLabel(\'hours\') mismatch');
  }

  // Test isValidServiceType
  if (helpers.isValidServiceType('hours') !== true) {
    errors.push('isValidServiceType(\'hours\') should be true');
  }
  if (helpers.isValidServiceType('invalid') !== false) {
    errors.push('isValidServiceType(\'invalid\') should be false');
  }

  // Test isValidStageId
  if (helpers.isValidStageId('stage_b') !== true) {
    errors.push('isValidStageId(\'stage_b\') should be true');
  }

  if (errors.length === 0) {
    console.log(`  ✅ ${name} helper results — correct`);
  } else {
    console.log(`  ❌ ${name} helper results — ${errors.length} failures:`);
    errors.forEach(err => console.log(`     ${err}`));
    totalErrors += errors.length;
  }
}


console.log('\n🔄 System Constants Sync Test\n');
console.log('Canonical source: shared/system-constants.js\n');

// Test 1: Functions adapter — SYSTEM_CONSTANTS values
console.log('1. Functions adapter (functions/shared/constants.js):');
testAdapter('SYSTEM_CONSTANTS', functionsAdapter.SYSTEM_CONSTANTS);
testHelpers('Functions', functionsAdapter);
testHelperResults('Functions', functionsAdapter);

// Test 2: Admin Panel adapter — SYSTEM_CONSTANTS values
console.log('\n2. Admin Panel adapter (apps/admin-panel/js/core/system-constants.js):');
testAdapter('SYSTEM_CONSTANTS', adminAdapter.SYSTEM_CONSTANTS);
testHelpers('Admin Panel', adminAdapter.SystemConstantsHelpers);
testHelperResults('Admin Panel', adminAdapter.SystemConstantsHelpers);

// Test 3: User App adapter — SYSTEM_CONSTANTS values
console.log('\n3. User App adapter (apps/user-app/js/core/system-constants.js):');
testAdapter('SYSTEM_CONSTANTS', userAppAdapter.SYSTEM_CONSTANTS);
testHelpers('User App', userAppAdapter.SystemConstantsHelpers);
testHelperResults('User App', userAppAdapter.SystemConstantsHelpers);


// ═══════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════
console.log(`\n${'═'.repeat(50)}`);
if (totalErrors === 0) {
  console.log(`✅ ALL ${totalTests} TESTS PASSED — all adapters in sync`);
  process.exit(0);
} else {
  console.log(`❌ ${totalErrors} ERRORS across ${totalTests} tests — adapters OUT OF SYNC`);
  process.exit(1);
}
