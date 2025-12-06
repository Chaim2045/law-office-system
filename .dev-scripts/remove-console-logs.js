/**
 * Remove console.log from production code
 * Keeps: console.error, console.warn, console.info
 * Removes: console.log
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Directories to clean
const directories = [
    'js/**/*.js',
    'master-admin-panel/js/**/*.js',
    // Don't touch these:
    // '!node_modules/**',
    // '!.dev-scripts/**',
    // '!functions/**'  // Keep functions console.log for Cloud Functions logs
];

let totalFiles = 0;
let totalRemovals = 0;
let filesModified = 0;

function removeConsoleLogs(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        let modified = content;
        let removals = 0;

        // Pattern 1: Simple console.log with single or double quotes
        // console.log('...');
        // console.log("...");
        const pattern1 = /console\.log\(['"](.*?)['"]\);?\n?/g;

        // Pattern 2: console.log with variables or template literals
        // console.log(...);
        // More complex - match full statement
        const pattern2 = /console\.log\((?:[^)(]|\([^)(]*\))*\);?\n?/g;

        // Count before
        const beforeCount = (content.match(/console\.log\(/g) || []).length;

        // Remove all console.log statements
        modified = modified.replace(pattern2, '');

        // Count after
        const afterCount = (modified.match(/console\.log\(/g) || []).length;
        removals = beforeCount - afterCount;

        // Only write if we actually removed something
        if (removals > 0) {
            fs.writeFileSync(filePath, modified, 'utf8');
            console.log(`✅ ${filePath}: removed ${removals} console.log(s)`);
            filesModified++;
            totalRemovals += removals;
        }

        totalFiles++;
        return removals;

    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
        return 0;
    }
}

console.log('🧹 Removing console.log from production code...\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Process each directory pattern
directories.forEach(pattern => {
    const files = glob.sync(pattern, {
        ignore: ['node_modules/**', '.dev-scripts/**', 'functions/**']
    });

    files.forEach(file => {
        removeConsoleLogs(file);
    });
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 Summary:');
console.log(`   Files scanned: ${totalFiles}`);
console.log(`   Files modified: ${filesModified}`);
console.log(`   Total console.log removed: ${totalRemovals}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (totalRemovals > 0) {
    console.log('✅ Production code is now clean!\n');
    console.log('⚠️  Note: console.error and console.warn were kept for debugging.\n');
} else {
    console.log('ℹ️  No console.log found to remove.\n');
}
