#!/usr/bin/env node

/**
 * ╔═══════════════════════════════════════════════════════════════════════╗
 * ║               MODALS MIGRATION DETECTION SCRIPT                       ║
 * ║                   Law Office Management System                        ║
 * ╠═══════════════════════════════════════════════════════════════════════╣
 * ║  Automatically detects all modal usage in the codebase               ║
 * ║  Generates migration report and recommendations                       ║
 * ║                                                                       ║
 * ║  Usage: node tools/migration-scanner.js                              ║
 * ║  Output: tools/migration-report.json                                 ║
 * ╚═══════════════════════════════════════════════════════════════════════╝
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Directories to scan
  scanDirs: ['js', 'script.js'],

  // File extensions to include
  extensions: ['.js'],

  // Directories to exclude
  excludeDirs: ['node_modules', 'dist', '__tests__', 'tools'],

  // Files to exclude
  excludeFiles: ['modals-manager.js', 'modals-compat.js'],

  // Output file
  outputFile: 'tools/migration-report.json',
  outputHtml: 'tools/migration-report.html',
};

// ═══════════════════════════════════════════════════════════════════════
// DETECTION PATTERNS
// ═══════════════════════════════════════════════════════════════════════

const PATTERNS = {
  // Native browser modals
  alert: {
    regex: /\balert\s*\(\s*(['"`])(.*?)\1\s*\)/g,
    type: 'simple',
    replacement: 'ModalsManager.showAlert',
    priority: 'high',
    effort: 'low',
  },

  confirm: {
    regex: /\bconfirm\s*\(\s*(['"`])(.*?)\1\s*\)/g,
    type: 'simple',
    replacement: 'ModalsManager.showConfirm',
    priority: 'high',
    effort: 'low',
  },

  prompt: {
    regex: /\bprompt\s*\(\s*(['"`])(.*?)\1\s*(?:,\s*(['"`])(.*?)\3\s*)?\)/g,
    type: 'simple',
    replacement: 'ModalsManager.showPrompt',
    priority: 'medium',
    effort: 'low',
  },

  // Custom loading overlays
  showSimpleLoading: {
    regex: /\bshowSimpleLoading\s*\(\s*(['"`])(.*?)\1\s*\)/g,
    type: 'loading',
    replacement: 'ModalsManager.showLoading',
    priority: 'high',
    effort: 'low',
  },

  hideSimpleLoading: {
    regex: /\bhideSimpleLoading\s*\(\s*\)/g,
    type: 'loading',
    replacement: 'ModalsManager.hideLoading',
    priority: 'high',
    effort: 'low',
  },

  // Complex domain modals
  showCreateCaseDialog: {
    regex: /\bshowCreateCaseDialog\s*\(/g,
    type: 'domain',
    replacement: 'ModalsManager.showCreateCase',
    priority: 'medium',
    effort: 'high',
  },

  showUpdateCaseDialog: {
    regex: /\bshowUpdateCaseDialog\s*\(/g,
    type: 'domain',
    replacement: 'ModalsManager.showUpdateCase',
    priority: 'medium',
    effort: 'high',
  },

  showTaskCompletionModal: {
    regex: /\bshowTaskCompletionModal\s*\(/g,
    type: 'domain',
    replacement: 'ModalsManager.showTaskCompletion',
    priority: 'medium',
    effort: 'high',
  },

  showFeedback: {
    regex: /\bshowFeedback\s*\(/g,
    type: 'domain',
    replacement: 'ModalsManager.showFeedback',
    priority: 'low',
    effort: 'medium',
  },

  showBlockedClientDialog: {
    regex: /\bshowBlockedClientDialog\s*\(/g,
    type: 'domain',
    replacement: 'ModalsManager.showBlockedClient',
    priority: 'low',
    effort: 'medium',
  },

  // Generic modal creation
  createModal: {
    regex: /\b(?:const|let|var)\s+\w+\s*=\s*document\.createElement\s*\(\s*['"`]div['"`]\s*\)[\s\S]*?popup-overlay/g,
    type: 'custom',
    replacement: 'ModalsManager (manual migration)',
    priority: 'low',
    effort: 'high',
  },
};

// ═══════════════════════════════════════════════════════════════════════
// SCANNER CLASS
// ═══════════════════════════════════════════════════════════════════════

class MigrationScanner {
  constructor() {
    this.results = {
      summary: {
        totalFiles: 0,
        filesWithModals: 0,
        totalInstances: 0,
        byType: {},
        byPriority: { high: 0, medium: 0, low: 0 },
        estimatedEffort: { low: 0, medium: 0, high: 0 },
      },
      files: [],
      patterns: {},
    };
  }

  /**
   * Main scan function
   */
  async scan() {
    console.log('🔍 Starting migration scan...\n');

    const rootDir = path.join(__dirname, '..');

    // Scan directories
    for (const dir of CONFIG.scanDirs) {
      const fullPath = path.join(rootDir, dir);

      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          await this.scanDirectory(fullPath);
        } else if (stat.isFile()) {
          await this.scanFile(fullPath);
        }
      }
    }

    // Calculate summary
    this.calculateSummary();

    // Generate reports
    await this.generateReports();

    return this.results;
  }

  /**
   * Scan directory recursively
   */
  async scanDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const stat = fs.statSync(fullPath);

      // Skip excluded directories
      if (stat.isDirectory()) {
        if (CONFIG.excludeDirs.some(excluded => fullPath.includes(excluded))) {
          continue;
        }
        await this.scanDirectory(fullPath);
      } else if (stat.isFile()) {
        await this.scanFile(fullPath);
      }
    }
  }

  /**
   * Scan single file
   */
  async scanFile(filePath) {
    // Check extension
    const ext = path.extname(filePath);
    if (!CONFIG.extensions.includes(ext)) {
      return;
    }

    // Check if excluded
    const fileName = path.basename(filePath);
    if (CONFIG.excludeFiles.includes(fileName)) {
      return;
    }

    this.results.summary.totalFiles++;

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Scan for patterns
    const fileResult = {
      path: path.relative(path.join(__dirname, '..'), filePath),
      instances: [],
      totalInstances: 0,
    };

    for (const [patternName, pattern] of Object.entries(PATTERNS)) {
      let match;
      pattern.regex.lastIndex = 0; // Reset regex

      while ((match = pattern.regex.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const lineContent = lines[lineNumber - 1].trim();

        fileResult.instances.push({
          pattern: patternName,
          type: pattern.type,
          line: lineNumber,
          content: lineContent,
          match: match[0],
          replacement: pattern.replacement,
          priority: pattern.priority,
          effort: pattern.effort,
        });

        fileResult.totalInstances++;

        // Update pattern stats
        if (!this.results.patterns[patternName]) {
          this.results.patterns[patternName] = {
            count: 0,
            files: [],
            type: pattern.type,
            replacement: pattern.replacement,
            priority: pattern.priority,
            effort: pattern.effort,
          };
        }
        this.results.patterns[patternName].count++;
        if (!this.results.patterns[patternName].files.includes(fileResult.path)) {
          this.results.patterns[patternName].files.push(fileResult.path);
        }
      }
    }

    // Add to results if file has instances
    if (fileResult.totalInstances > 0) {
      this.results.files.push(fileResult);
      this.results.summary.filesWithModals++;
    }
  }

  /**
   * Calculate summary statistics
   */
  calculateSummary() {
    // Total instances
    this.results.summary.totalInstances = this.results.files.reduce(
      (sum, file) => sum + file.totalInstances,
      0
    );

    // By type
    for (const [name, pattern] of Object.entries(this.results.patterns)) {
      const type = pattern.type;
      this.results.summary.byType[type] = (this.results.summary.byType[type] || 0) + pattern.count;
    }

    // By priority & effort
    for (const file of this.results.files) {
      for (const instance of file.instances) {
        this.results.summary.byPriority[instance.priority]++;
        this.results.summary.estimatedEffort[instance.effort]++;
      }
    }
  }

  /**
   * Generate reports
   */
  async generateReports() {
    const rootDir = path.join(__dirname, '..');

    // JSON Report
    const jsonPath = path.join(rootDir, CONFIG.outputFile);
    fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));
    console.log(`✅ JSON report saved: ${CONFIG.outputFile}\n`);

    // HTML Report
    const htmlContent = this.generateHtmlReport();
    const htmlPath = path.join(rootDir, CONFIG.outputHtml);
    fs.writeFileSync(htmlPath, htmlContent);
    console.log(`✅ HTML report saved: ${CONFIG.outputHtml}\n`);

    // Console Summary
    this.printConsoleSummary();
  }

  /**
   * Generate HTML report
   */
  generateHtmlReport() {
    const { summary, files, patterns } = this.results;

    return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Migration Report - ModalsManager</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      background: #f8fafc;
      padding: 20px;
      direction: rtl;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      border-radius: 16px;
      margin-bottom: 30px;
      box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header p { opacity: 0.9; font-size: 16px; }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 8px;
    }
    .stat-label {
      font-size: 14px;
      color: #64748b;
      font-weight: 500;
    }

    .section {
      background: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .section h2 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #1e293b;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 10px;
    }

    .patterns-grid {
      display: grid;
      gap: 15px;
    }
    .pattern-card {
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pattern-info { flex: 1; }
    .pattern-name {
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 5px;
    }
    .pattern-meta {
      font-size: 13px;
      color: #64748b;
    }
    .pattern-count {
      background: #667eea;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 18px;
    }

    .priority-high { border-right: 4px solid #ef4444; }
    .priority-medium { border-right: 4px solid #f59e0b; }
    .priority-low { border-right: 4px solid #10b981; }

    .files-list {
      display: grid;
      gap: 15px;
    }
    .file-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 20px;
    }
    .file-path {
      font-family: 'Courier New', monospace;
      font-size: 14px;
      color: #667eea;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .instance {
      background: #f8fafc;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 10px;
      border-left: 3px solid #cbd5e1;
    }
    .instance-code {
      font-family: 'Courier New', monospace;
      font-size: 13px;
      color: #334155;
      margin-bottom: 5px;
    }
    .instance-meta {
      font-size: 12px;
      color: #64748b;
      display: flex;
      gap: 15px;
    }

    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-high { background: #fee2e2; color: #991b1b; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low { background: #dcfce7; color: #166534; }
    .badge-simple { background: #dbeafe; color: #1e40af; }
    .badge-loading { background: #e0e7ff; color: #3730a3; }
    .badge-domain { background: #fce7f3; color: #9f1239; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Migration Report: ModalsManager</h1>
      <p>נתח אוטומטי של כל השימושים במודלים במערכת</p>
      <p>נוצר ב-${new Date().toLocaleString('he-IL')}</p>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${summary.totalFiles}</div>
        <div class="stat-label">קבצים נסרקו</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.filesWithModals}</div>
        <div class="stat-label">קבצים עם מודלים</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.totalInstances}</div>
        <div class="stat-label">סה"כ שימושים</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${Object.keys(patterns).length}</div>
        <div class="stat-label">סוגי מודלים</div>
      </div>
    </div>

    <div class="section">
      <h2>📈 סטטיסטיקות לפי עדיפות</h2>
      <div class="patterns-grid">
        <div class="pattern-card priority-high">
          <div class="pattern-info">
            <div class="pattern-name">עדיפות גבוהה</div>
            <div class="pattern-meta">דורש טיפול מיידי</div>
          </div>
          <div class="pattern-count">${summary.byPriority.high}</div>
        </div>
        <div class="pattern-card priority-medium">
          <div class="pattern-info">
            <div class="pattern-name">עדיפות בינונית</div>
            <div class="pattern-meta">טיפול בשלב הבא</div>
          </div>
          <div class="pattern-count">${summary.byPriority.medium}</div>
        </div>
        <div class="pattern-card priority-low">
          <div class="pattern-info">
            <div class="pattern-name">עדיפות נמוכה</div>
            <div class="pattern-meta">ניתן לדחות</div>
          </div>
          <div class="pattern-count">${summary.byPriority.low}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>🎯 פרוט לפי סוג מודל</h2>
      <div class="patterns-grid">
        ${Object.entries(patterns)
          .sort((a, b) => b[1].count - a[1].count)
          .map(
            ([name, data]) => `
          <div class="pattern-card priority-${data.priority}">
            <div class="pattern-info">
              <div class="pattern-name">${name}</div>
              <div class="pattern-meta">
                <span class="badge badge-${data.type}">${data.type}</span>
                <span class="badge badge-${data.priority}">${data.priority}</span>
                → ${data.replacement}
              </div>
            </div>
            <div class="pattern-count">${data.count}</div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>

    <div class="section">
      <h2>📁 פירוט לפי קובץ</h2>
      <div class="files-list">
        ${files
          .sort((a, b) => b.totalInstances - a.totalInstances)
          .map(
            (file) => `
          <div class="file-card">
            <div class="file-path">📄 ${file.path}</div>
            ${file.instances
              .map(
                (inst) => `
              <div class="instance">
                <div class="instance-code">${this.escapeHtml(inst.content)}</div>
                <div class="instance-meta">
                  <span>שורה ${inst.line}</span>
                  <span class="badge badge-${inst.type}">${inst.type}</span>
                  <span class="badge badge-${inst.priority}">${inst.priority}</span>
                  <span>→ ${inst.replacement}</span>
                </div>
              </div>
            `
              )
              .join('')}
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Print console summary
   */
  printConsoleSummary() {
    const { summary, patterns } = this.results;

    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 MIGRATION SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`📁 Files scanned:       ${summary.totalFiles}`);
    console.log(`📄 Files with modals:   ${summary.filesWithModals}`);
    console.log(`🎯 Total instances:     ${summary.totalInstances}\n`);

    console.log('By Type:');
    for (const [type, count] of Object.entries(summary.byType)) {
      console.log(`  - ${type.padEnd(10)} ${count}`);
    }
    console.log();

    console.log('By Priority:');
    console.log(`  - High:   ${summary.byPriority.high} (needs immediate attention)`);
    console.log(`  - Medium: ${summary.byPriority.medium}`);
    console.log(`  - Low:    ${summary.byPriority.low}\n`);

    console.log('Top Patterns:');
    Object.entries(patterns)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .forEach(([name, data]) => {
        console.log(`  - ${name.padEnd(25)} ${data.count.toString().padStart(3)} instances`);
      });

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ Scan complete!');
    console.log('═══════════════════════════════════════════════════════\n');
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════

if (require.main === module) {
  const scanner = new MigrationScanner();
  scanner.scan().catch((error) => {
    console.error('❌ Error during scan:', error);
    process.exit(1);
  });
}

module.exports = MigrationScanner;
