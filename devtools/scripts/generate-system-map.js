#!/usr/bin/env node

/**
 * generate-system-map.js
 *
 * סורק את הפרויקט ומייצר SYSTEM_MAP.md עם מיפוי מלא:
 * - Backend Functions (onCall, onSchedule, onDocumentWritten, onRequest)
 * - Frontend Calls (httpsCallable, FirebaseService.call, callFunction)
 * - Firestore Collections (read/write/listener)
 * - HTML Pages (script tags, titles)
 * - Cross-references (orphans, mismatches)
 *
 * Usage: node devtools/scripts/generate-system-map.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ══════════════════════════════════════════════════════════════
// Configuration
// ══════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_FILE = path.join(ROOT, 'SYSTEM_MAP.md');

const FUNCTIONS_DIR = path.join(ROOT, 'functions');
const APPS_DIR = path.join(ROOT, 'apps');
const FIRESTORE_RULES = path.join(ROOT, 'firestore.rules');

const FRONTEND_SCAN_DIRS = [
  path.join(APPS_DIR, 'user-app', 'js'),
  path.join(APPS_DIR, 'user-app', 'components'),
  path.join(APPS_DIR, 'user-app', 'shared'),
  path.join(APPS_DIR, 'user-app', 'src'),
  path.join(APPS_DIR, 'admin-panel', 'js'),
  path.join(APPS_DIR, 'admin-panel', 'components'),
];

const SKIP_DIRS = ['node_modules', '.git', 'dist', '.firebase'];

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function getGitCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function relativePath(absPath) {
  return path.relative(ROOT, absPath).replace(/\\/g, '/');
}

function walkDir(dir, ext = '.js') {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      results.push(...walkDir(fullPath, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

function walkDirMultiExt(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue;
      results.push(...walkDirMultiExt(fullPath, extensions));
    } else if (entry.isFile() && extensions.some(e => entry.name.endsWith(e))) {
      results.push(fullPath);
    }
  }
  return results;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

// ══════════════════════════════════════════════════════════════
// Part 1: Backend Functions
// ══════════════════════════════════════════════════════════════

function scanBackendFunctions() {
  const files = walkDir(FUNCTIONS_DIR, '.js');
  const functions = [];

  // Patterns for function declarations
  const patterns = [
    // functions.https.onCall
    { regex: /(?:exports\.(\w+)\s*=\s*)?functions\.https\.onCall\s*\(/g, type: 'callable' },
    // onCall from v2
    { regex: /(?:const\s+(\w+)\s*=\s*)?onCall\s*\(\s*(?:\{[^}]*\}\s*,\s*)?/g, type: 'callable' },
    // onSchedule
    { regex: /(?:const\s+(\w+)\s*=\s*)?onSchedule\s*\(/g, type: 'scheduled' },
    // onDocumentWritten / onDocumentCreated / onDocumentUpdated / onDocumentDeleted
    { regex: /(?:const\s+(\w+)\s*=\s*)?onDocument(?:Written|Created|Updated|Deleted)\s*\(/g, type: 'trigger' },
    // functions.https.onRequest
    { regex: /(?:exports\.(\w+)\s*=\s*)?functions\.https\.onRequest\s*\(/g, type: 'http' },
    // onRequest from v2
    { regex: /(?:const\s+(\w+)\s*=\s*)?onRequest\s*\(\s*(?:\{[^}]*\}\s*,\s*)?/g, type: 'http' },
    // functions.pubsub
    { regex: /(?:exports\.(\w+)\s*=\s*)?functions\.pubsub/g, type: 'scheduled' },
    // functions.firestore.document
    { regex: /(?:exports\.(\w+)\s*=\s*)?functions\.firestore\.document\s*\(/g, type: 'trigger' },
  ];

  // Also scan for exports.X = ... to get the exported name
  const exportPattern = /exports\.(\w+)\s*=\s*(\w+)/g;

  for (const filePath of files) {
    const content = readFileSafe(filePath);
    const lines = content.split('\n');
    const rel = relativePath(filePath);

    // Skip migrations, scripts, test files
    if (rel.includes('migrations/') || rel.includes('scripts/') || rel.includes('test')) continue;

    // Collect local variable → export name mapping from exports.X = localVar
    const exportMap = new Map();
    let exportMatch;
    while ((exportMatch = exportPattern.exec(content)) !== null) {
      exportMap.set(exportMatch[2], exportMatch[1]);
    }

    for (const { regex, type } of patterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const pos = match.index;
        const lineNum = content.substring(0, pos).split('\n').length;
        let name = match[1] || null;

        // If name not captured inline, look at the line for exports.X = or const X =
        if (!name) {
          const line = lines[lineNum - 1] || '';
          const exportsMatch = line.match(/exports\.(\w+)\s*=/);
          const constMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
          if (exportsMatch) {
            name = exportsMatch[1];
          } else if (constMatch) {
            name = constMatch[1];
            // Check if this local variable is exported under a different name
            if (exportMap.has(name)) {
              name = exportMap.get(name);
            }
          }
        }

        if (!name) {
          // Try scanning surrounding lines
          for (let i = Math.max(0, lineNum - 3); i < Math.min(lines.length, lineNum + 3); i++) {
            const nearLine = lines[i];
            const nearExport = nearLine.match(/exports\.(\w+)\s*=/);
            if (nearExport) {
              name = nearExport[1];
              break;
            }
          }
        }

        if (!name) name = `<anonymous:${rel}:${lineNum}>`;

        // Avoid duplicates
        if (!functions.find(f => f.name === name && f.file === rel)) {
          functions.push({ name, type, file: rel, line: lineNum });
        }
      }
    }
  }

  // Also parse functions/index.js for exports that may not match patterns above
  const indexPath = path.join(FUNCTIONS_DIR, 'index.js');
  if (fs.existsSync(indexPath)) {
    const indexContent = readFileSafe(indexPath);
    const indexExportPattern = /exports\.(\w+)\s*=\s*(?:\w+\.)?(\w+)/g;
    let m;
    while ((m = indexExportPattern.exec(indexContent)) !== null) {
      const exportedName = m[1];
      if (!functions.find(f => f.name === exportedName)) {
        const lineNum = indexContent.substring(0, m.index).split('\n').length;
        functions.push({
          name: exportedName,
          type: 'callable',
          file: relativePath(indexPath),
          line: lineNum,
        });
      }
    }
  }

  return functions;
}

// ══════════════════════════════════════════════════════════════
// Part 2: Frontend Calls
// ══════════════════════════════════════════════════════════════

function scanFrontendCalls() {
  const calls = [];

  const allFiles = [];
  for (const dir of FRONTEND_SCAN_DIRS) {
    allFiles.push(...walkDir(dir, '.js'));
  }

  // Patterns for calling Cloud Functions
  const callPatterns = [
    // httpsCallable(functions, 'name') or httpsCallable(functions, "name")
    /httpsCallable\s*\(\s*\w+\s*,\s*['"`]([^'"`]+)['"`]\s*\)/g,
    // functions.httpsCallable('name') or firebase.functions().httpsCallable('name')
    /\.httpsCallable\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    // FirebaseService.call('name') or window.FirebaseService.call('name')
    /FirebaseService\.call\s*\(\s*['"`]([^'"`]+)['"`]/g,
    // callFunction('name')
    /callFunction\s*\(\s*['"`]([^'"`]+)['"`]/g,
    // callCloudFunction('name')
    /callCloudFunction\s*\(\s*['"`]([^'"`]+)['"`]/g,
    // apiClient.call('name') or api.call('name')
    /api(?:Client)?\.call\s*\(\s*['"`]([^'"`]+)['"`]/g,
  ];

  for (const filePath of allFiles) {
    const content = readFileSafe(filePath);
    const rel = relativePath(filePath);

    // Determine app
    let app = 'unknown';
    if (rel.includes('user-app')) app = 'user-app';
    else if (rel.includes('admin-panel')) app = 'admin-panel';

    for (const regex of callPatterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const funcName = match[1];
        const lineNum = content.substring(0, match.index).split('\n').length;

        calls.push({
          functionName: funcName,
          file: rel,
          line: lineNum,
          app,
        });
      }
    }
  }

  return calls;
}

// ══════════════════════════════════════════════════════════════
// Part 3: Firestore Collections
// ══════════════════════════════════════════════════════════════

function scanFirestoreCollections() {
  const collections = new Map(); // name → { readers: Set, writers: Set, listeners: Set }

  // Scan both backend and frontend
  const backendFiles = walkDir(FUNCTIONS_DIR, '.js');
  const frontendFiles = [];
  for (const dir of FRONTEND_SCAN_DIRS) {
    frontendFiles.push(...walkDir(dir, '.js'));
  }

  const allFiles = [...backendFiles, ...frontendFiles];

  // Patterns for collection references
  const collectionPatterns = [
    /\.collection\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    /doc\s*\(\s*['"`]([^'"`/]+)['"`]\s*\)/g, // doc('collectionName/docId') — take first segment
  ];

  // Patterns for write operations
  const writePatterns = [
    /\.set\s*\(/,
    /\.update\s*\(/,
    /\.add\s*\(/,
    /\.delete\s*\(/,
    /transaction\.set\s*\(/,
    /transaction\.update\s*\(/,
    /transaction\.delete\s*\(/,
    /batch\.set\s*\(/,
    /batch\.update\s*\(/,
    /batch\.delete\s*\(/,
  ];

  // Pattern for listeners
  const listenerPattern = /\.onSnapshot\s*\(/;

  for (const filePath of allFiles) {
    const content = readFileSafe(filePath);
    const rel = relativePath(filePath);
    const lines = content.split('\n');

    // Skip migrations, scripts
    if (rel.includes('migrations/') || rel.includes('scripts/') || rel.includes('node_modules')) continue;

    for (const regex of collectionPatterns) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(content)) !== null) {
        let collName = match[1];

        // Skip if looks like a path segment with slash (subcollections handled separately)
        if (collName.includes('/')) {
          collName = collName.split('/')[0];
        }

        // Skip obviously non-collection strings
        if (collName.length < 2 || collName.length > 50) continue;
        if (/^(https?|function|data|error|result|doc|id|email|uid|ref|path)$/i.test(collName)) continue;
        // Skip if contains spaces (likely not a collection name)
        if (/\s/.test(collName)) continue;

        if (!collections.has(collName)) {
          collections.set(collName, { readers: new Set(), writers: new Set(), listeners: new Set() });
        }

        const entry = collections.get(collName);

        // Determine if this is a read, write, or listener by looking at surrounding context
        const lineNum = content.substring(0, match.index).split('\n').length;
        const surroundingLines = lines.slice(Math.max(0, lineNum - 2), Math.min(lines.length, lineNum + 5)).join('\n');

        let isWrite = false;
        let isListener = false;

        for (const wp of writePatterns) {
          if (wp.test(surroundingLines)) {
            isWrite = true;
            break;
          }
        }

        if (listenerPattern.test(surroundingLines)) {
          isListener = true;
        }

        if (isWrite) {
          entry.writers.add(rel);
        }
        if (isListener) {
          entry.listeners.add(rel);
        }
        // Always add as reader (accessing a collection = reading)
        entry.readers.add(rel);
      }
    }
  }

  return collections;
}

// ══════════════════════════════════════════════════════════════
// Part 4: HTML Pages
// ══════════════════════════════════════════════════════════════

function scanHtmlPages() {
  const htmlFiles = walkDirMultiExt(APPS_DIR, ['.html']);
  const pages = [];

  for (const filePath of htmlFiles) {
    const content = readFileSafe(filePath);
    const rel = relativePath(filePath);

    // Extract title
    const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is);
    const title = titleMatch ? titleMatch[1].trim() : '(no title)';

    // Extract script tags
    const scripts = [];
    const scriptRegex = /<script[^>]*(?:src\s*=\s*['"]([^'"]+)['"])[^>]*>/gi;
    let sm;
    while ((sm = scriptRegex.exec(content)) !== null) {
      if (sm[1]) {
        // Clean cache-busting params
        scripts.push(sm[1].replace(/\?v=.*$/, ''));
      }
    }

    // Also find inline module scripts that import files
    const moduleImportRegex = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
    while ((sm = moduleImportRegex.exec(content)) !== null) {
      if (sm[1] && !scripts.includes(sm[1])) {
        scripts.push(sm[1]);
      }
    }

    pages.push({ file: rel, title, scripts });
  }

  return pages;
}

// ══════════════════════════════════════════════════════════════
// Part 5: Parse firestore.rules for collection names
// ══════════════════════════════════════════════════════════════

function parseFirestoreRulesCollections() {
  const rulesContent = readFileSafe(FIRESTORE_RULES);
  const collections = new Set();

  // match /collectionName/{docId}
  const rulePattern = /match\s+\/(\w+)\/\{/g;
  let m;
  while ((m = rulePattern.exec(rulesContent)) !== null) {
    const name = m[1];
    if (name !== 'databases' && name !== 'documents') {
      collections.add(name);
    }
  }

  return collections;
}

// ══════════════════════════════════════════════════════════════
// Part 5b: Collect all JS files loaded by HTML
// ══════════════════════════════════════════════════════════════

function getLoadedJsFiles(pages) {
  const loaded = new Set();
  for (const page of pages) {
    for (const script of page.scripts) {
      // Normalize script path
      let normalized = script;
      // Remove leading ./ or /
      normalized = normalized.replace(/^\.?\//, '');
      loaded.add(normalized);
    }
  }
  return loaded;
}

// ══════════════════════════════════════════════════════════════
// Cross-reference analysis
// ══════════════════════════════════════════════════════════════

function crossReference(backendFunctions, frontendCalls, collections, pages, rulesCollections) {
  const result = {
    backendWithoutFrontend: [],
    frontendWithoutBackend: [],
    collectionsNotInRules: [],
    jsNotLoadedByHtml: [],
  };

  const backendNames = new Set(backendFunctions.map(f => f.name));
  const calledNames = new Set(frontendCalls.map(c => c.functionName));

  // A. Backend functions not called from frontend
  // Exclude scheduled/trigger functions — they are not meant to be called from frontend
  for (const fn of backendFunctions) {
    if (fn.type === 'scheduled' || fn.type === 'trigger') continue;
    if (!calledNames.has(fn.name)) {
      result.backendWithoutFrontend.push(fn);
    }
  }

  // B. Frontend calls to non-existent backend functions
  for (const call of frontendCalls) {
    if (!backendNames.has(call.functionName)) {
      // Check if it's not already in the list
      if (!result.frontendWithoutBackend.find(c => c.functionName === call.functionName && c.file === call.file)) {
        result.frontendWithoutBackend.push(call);
      }
    }
  }

  // C. Collections in code but not in firestore.rules
  for (const [collName] of collections) {
    if (!rulesCollections.has(collName)) {
      result.collectionsNotInRules.push(collName);
    }
  }

  // D. JS files in apps/ not loaded by any HTML
  const loadedScripts = getLoadedJsFiles(pages);
  const allFrontendJs = walkDirMultiExt(APPS_DIR, ['.js']);

  for (const jsFile of allFrontendJs) {
    const rel = relativePath(jsFile);
    // Skip dist, node_modules
    if (rel.includes('dist/') || rel.includes('node_modules/')) continue;

    // Check if any loaded script path matches
    const jsFileName = path.basename(rel);
    const isLoaded = [...loadedScripts].some(loaded => {
      // Match by filename or partial path
      return rel.endsWith(loaded) || loaded.endsWith(jsFileName) || rel.includes(loaded);
    });

    // Also check if file is imported by other JS (module imports)
    // We'll be lenient: if the file is a module that gets imported by another file, it's "loaded"
    // For now, mark only top-level files that should be in script tags
    if (!isLoaded) {
      // Check if any other JS file imports this file
      const isImported = checkIfImported(jsFile, allFrontendJs);
      if (!isImported) {
        result.jsNotLoadedByHtml.push(rel);
      }
    }
  }

  return result;
}

function checkIfImported(targetFile, allJsFiles) {
  const targetName = path.basename(targetFile, '.js');
  const targetRel = relativePath(targetFile);

  for (const jsFile of allJsFiles) {
    if (jsFile === targetFile) continue;
    const content = readFileSafe(jsFile);
    // Check for import ... from './targetName' or require('./targetName')
    if (content.includes(targetName)) {
      // More precise check
      const importRegex = new RegExp(`(?:import|require)\\s*(?:\\(\\s*)?['"].*${escapeRegex(targetName)}(?:\\.js)?['"]`, 'g');
      if (importRegex.test(content)) {
        return true;
      }
    }
  }
  return false;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ══════════════════════════════════════════════════════════════
// Markdown generation
// ══════════════════════════════════════════════════════════════

function generateMarkdown(backendFunctions, frontendCalls, collections, pages, crossRef) {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const commitHash = getGitCommitHash();

  let md = '';

  md += `# SYSTEM MAP\n\n`;
  md += `> Generated: ${now}  \n`;
  md += `> Git commit: \`${commitHash}\`\n\n`;
  md += `---\n\n`;

  // ─── Part 1: Backend Functions ───
  md += `## 1. Backend Functions\n\n`;
  md += `| # | Function Name | Type | Source File | Line |\n`;
  md += `|---|---------------|------|-------------|------|\n`;

  const sortedFunctions = [...backendFunctions].sort((a, b) => a.name.localeCompare(b.name));
  sortedFunctions.forEach((fn, i) => {
    md += `| ${i + 1} | \`${fn.name}\` | ${fn.type} | \`${fn.file}\` | ${fn.line} |\n`;
  });
  md += `\n**Total: ${backendFunctions.length} functions**\n\n`;
  md += `---\n\n`;

  // ─── Part 2: Frontend Calls ───
  md += `## 2. Frontend Calls to Cloud Functions\n\n`;
  md += `| # | Function Called | Calling File | Line | App |\n`;
  md += `|---|----------------|-------------|------|-----|\n`;

  const sortedCalls = [...frontendCalls].sort((a, b) => a.functionName.localeCompare(b.functionName));
  sortedCalls.forEach((call, i) => {
    md += `| ${i + 1} | \`${call.functionName}\` | \`${call.file}\` | ${call.line} | ${call.app} |\n`;
  });
  md += `\n**Total: ${frontendCalls.length} calls**\n\n`;
  md += `---\n\n`;

  // ─── Part 3: Firestore Collections ───
  md += `## 3. Firestore Collections\n\n`;
  md += `| # | Collection | Readers | Writers | Listeners |\n`;
  md += `|---|------------|---------|---------|----------|\n`;

  const sortedCollections = [...collections.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  sortedCollections.forEach(([name, data], i) => {
    const readers = [...data.readers].map(f => `\`${f}\``).join(', ') || '-';
    const writers = [...data.writers].map(f => `\`${f}\``).join(', ') || '-';
    const listeners = [...data.listeners].map(f => `\`${f}\``).join(', ') || '-';
    md += `| ${i + 1} | \`${name}\` | ${readers} | ${writers} | ${listeners} |\n`;
  });
  md += `\n**Total: ${collections.size} collections**\n\n`;
  md += `---\n\n`;

  // ─── Part 4: HTML Pages ───
  md += `## 4. HTML Pages\n\n`;

  for (const page of pages) {
    md += `### \`${page.file}\`\n`;
    md += `- **Title:** ${page.title}\n`;
    md += `- **Scripts:**\n`;
    if (page.scripts.length === 0) {
      md += `  - (none)\n`;
    } else {
      for (const script of page.scripts) {
        md += `  - \`${script}\`\n`;
      }
    }
    md += `\n`;
  }

  md += `---\n\n`;

  // ─── Part 5: Cross-reference ───
  md += `## 5. Cross-Reference Analysis\n\n`;

  // A
  md += `### A. Backend Functions with No Frontend Calls\n\n`;
  if (crossRef.backendWithoutFrontend.length === 0) {
    md += `All callable/http backend functions are called from the frontend.\n\n`;
  } else {
    md += `| # | Function | Type | File |\n`;
    md += `|---|----------|------|------|\n`;
    crossRef.backendWithoutFrontend.forEach((fn, i) => {
      md += `| ${i + 1} | \`${fn.name}\` | ${fn.type} | \`${fn.file}\` |\n`;
    });
    md += `\n`;
  }

  // B
  md += `### B. Frontend Calls to Non-Existent Backend Functions\n\n`;
  if (crossRef.frontendWithoutBackend.length === 0) {
    md += `All frontend calls match existing backend functions.\n\n`;
  } else {
    md += `| # | Function Called | Calling File | Line | App |\n`;
    md += `|---|----------------|-------------|------|-----|\n`;
    crossRef.frontendWithoutBackend.forEach((call, i) => {
      md += `| ${i + 1} | \`${call.functionName}\` | \`${call.file}\` | ${call.line} | ${call.app} |\n`;
    });
    md += `\n`;
  }

  // C
  md += `### C. Collections in Code but Not in firestore.rules\n\n`;
  if (crossRef.collectionsNotInRules.length === 0) {
    md += `All collections found in code are defined in firestore.rules.\n\n`;
  } else {
    md += `| # | Collection Name |\n`;
    md += `|---|----------------|\n`;
    crossRef.collectionsNotInRules.forEach((name, i) => {
      md += `| ${i + 1} | \`${name}\` |\n`;
    });
    md += `\n`;
  }

  // D
  md += `### D. JS Files Not Loaded by Any HTML\n\n`;
  if (crossRef.jsNotLoadedByHtml.length === 0) {
    md += `All JS files are loaded by HTML or imported by other modules.\n\n`;
  } else {
    md += `| # | File |\n`;
    md += `|---|------|\n`;
    crossRef.jsNotLoadedByHtml.forEach((file, i) => {
      md += `| ${i + 1} | \`${file}\` |\n`;
    });
    md += `\n`;
  }

  return md;
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

function main() {
  console.log('🔍 Scanning project...\n');

  console.log('  [1/5] Backend Functions...');
  const backendFunctions = scanBackendFunctions();
  console.log(`        Found ${backendFunctions.length} functions`);

  console.log('  [2/5] Frontend Calls...');
  const frontendCalls = scanFrontendCalls();
  console.log(`        Found ${frontendCalls.length} calls`);

  console.log('  [3/5] Firestore Collections...');
  const collections = scanFirestoreCollections();
  console.log(`        Found ${collections.size} collections`);

  console.log('  [4/5] HTML Pages...');
  const pages = scanHtmlPages();
  console.log(`        Found ${pages.length} pages`);

  console.log('  [5/5] Cross-reference analysis...');
  const rulesCollections = parseFirestoreRulesCollections();
  const crossRef = crossReference(backendFunctions, frontendCalls, collections, pages, rulesCollections);
  console.log(`        Backend without frontend calls: ${crossRef.backendWithoutFrontend.length}`);
  console.log(`        Frontend calls without backend: ${crossRef.frontendWithoutBackend.length}`);
  console.log(`        Collections not in rules: ${crossRef.collectionsNotInRules.length}`);
  console.log(`        JS files not loaded by HTML: ${crossRef.jsNotLoadedByHtml.length}`);

  console.log('\n📝 Generating SYSTEM_MAP.md...');
  const markdown = generateMarkdown(backendFunctions, frontendCalls, collections, pages, crossRef);
  fs.writeFileSync(OUTPUT_FILE, markdown, 'utf8');

  console.log(`✅ Done! Output: ${relativePath(OUTPUT_FILE)}`);
  console.log(`   Total size: ${(Buffer.byteLength(markdown) / 1024).toFixed(1)} KB`);
}

main();
