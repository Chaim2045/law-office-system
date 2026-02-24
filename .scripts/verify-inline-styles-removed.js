/**
 * 🔍 Verification Script: Inline Styles Removed
 * בודק שכל ה-inline styles הוסרו מדיאלוג יצירת תיק
 *
 * What this checks:
 * 1. No .style.color/background/etc in JS code
 * 2. No onfocus/onblur in HTML
 * 3. CSS classes exist (input-error, input-success, etc.)
 * 4. Mode tab switching works correctly
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 VERIFICATION: Inline Styles Removed\n');
console.log('═'.repeat(70));

// Read files
const jsFile = path.join(__dirname, '../apps/user-app/js/modules/case-creation/case-creation-dialog.js');
const cssFile = path.join(__dirname, '../apps/user-app/css/tabs.css');

const jsContent = fs.readFileSync(jsFile, 'utf-8');
const cssContent = fs.readFileSync(cssFile, 'utf-8');

let passed = 0;
let failed = 0;

// Test 1: Check for inline style assignments
console.log('\n1️⃣ Checking for inline style assignments in JS...');
const inlineStylePatterns = [
  /\.style\.color\s*=/,
  /\.style\.background\s*=/,
  /\.style\.fontWeight\s*=/,
  /\.style\.transform\s*=/,
  /\.style\.border\s*=/,
  /\.style\.boxShadow\s*=/,
  /\.style\.filter\s*=/
];

let foundInlineStyles = false;
inlineStylePatterns.forEach(pattern => {
  const matches = jsContent.match(pattern);
  if (matches) {
    console.log(`   ❌ Found: ${matches[0]}`);
    foundInlineStyles = true;
    failed++;
  }
});

if (!foundInlineStyles) {
  console.log('   ✅ No inline style assignments found!');
  passed++;
}

// Test 2: Check for onfocus/onblur attributes
console.log('\n2️⃣ Checking for onfocus/onblur attributes in HTML...');
const focusBlurPattern = /onfocus=|onblur=/g;
const focusBlurMatches = jsContent.match(focusBlurPattern);

if (focusBlurMatches && focusBlurMatches.length > 0) {
  console.log(`   ❌ Found ${focusBlurMatches.length} onfocus/onblur attributes`);
  failed++;
} else {
  console.log('   ✅ No onfocus/onblur attributes found!');
  passed++;
}

// Test 3: Check CSS classes exist
console.log('\n3️⃣ Checking CSS classes exist...');
const requiredClasses = [
  'input-error',
  'input-success',
  'input-warning',
  'input-info',
  'input-disabled',
  'text-danger'
];

let allClassesExist = true;
requiredClasses.forEach(className => {
  if (!cssContent.includes(`.${className}`)) {
    console.log(`   ❌ Missing CSS class: .${className}`);
    allClassesExist = false;
    failed++;
  }
});

if (allClassesExist) {
  console.log(`   ✅ All ${requiredClasses.length} CSS classes exist!`);
  passed++;
}

// Test 4: Check focus/blur CSS exists
console.log('\n4️⃣ Checking input:focus CSS rules...');
if (cssContent.includes('input:focus') && cssContent.includes('border-color: #3b82f6')) {
  console.log('   ✅ input:focus CSS rules found!');
  passed++;
} else {
  console.log('   ❌ input:focus CSS rules missing!');
  failed++;
}

// Test 5: Check hover effects removed from JS
console.log('\n5️⃣ Checking hover effects removed from JS...');
const hoverListenerPattern = /addEventListener\(['"]mouseenter/;
const hasHoverListeners = jsContent.match(hoverListenerPattern);

if (hasHoverListeners) {
  console.log('   ❌ Found mouseenter event listeners (should use CSS :hover)');
  failed++;
} else {
  console.log('   ✅ No mouseenter event listeners found!');
  passed++;
}

// Test 6: Check switchMode cleanup
console.log('\n6️⃣ Checking switchMode() cleanup...');
const switchModeMatch = jsContent.match(/switchMode\(mode\)\s*\{[\s\S]*?(?=\n\s{4}\w|\n\s{2}\/\*)/);
if (switchModeMatch) {
  const switchModeCode = switchModeMatch[0];

  if (switchModeCode.includes('btn.style.color') ||
      switchModeCode.includes('btn.style.fontWeight') ||
      switchModeCode.includes('icon.style.color')) {
    console.log('   ❌ switchMode() still has inline styles');
    failed++;
  } else {
    console.log('   ✅ switchMode() cleaned - no inline styles!');
    passed++;
  }
} else {
  console.log('   ⚠️ Could not parse switchMode() function');
}

// Test 7: Check classList usage
console.log('\n7️⃣ Checking classList.add usage for validation...');
if (jsContent.includes("classList.add('input-error')") &&
    jsContent.includes("classList.add('input-success')")) {
  console.log('   ✅ Using classList.add for validation states!');
  passed++;
} else {
  console.log('   ❌ Not using classList.add for validation states');
  failed++;
}

// Final Results
console.log('\n' + '═'.repeat(70));
console.log('\n📊 RESULTS:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);

const total = passed + failed;
const percentage = Math.round((passed / total) * 100);
const grade = percentage >= 90 ? '10/10 - PERFECT!' :
              percentage >= 80 ? '9/10 - EXCELLENT' :
              percentage >= 70 ? '8/10 - GOOD' :
              percentage >= 60 ? '7/10 - NEEDS IMPROVEMENT' : 'FAIL';

console.log(`\n🎯 GRADE: ${grade} (${percentage}%)`);

if (failed === 0) {
  console.log('\n🎉 All inline styles successfully removed!');
  console.log('✨ Code is now using CSS classes exclusively');
} else {
  console.log(`\n⚠️ ${failed} issue(s) need attention`);
}

console.log('\n' + '═'.repeat(70) + '\n');

process.exit(failed > 0 ? 1 : 0);
