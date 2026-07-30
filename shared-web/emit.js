#!/usr/bin/env node

/**
 * shared-web/emit.js — cross-app SSOT emit for shared frontend modules
 * ════════════════════════════════════════════════════════════════════════════
 *
 * WHY THIS EXISTS
 * The two frontend apps (apps/admin-panel, apps/user-app) deploy to two Netlify
 * origins with DISJOINT publish roots (see docs/PLAN-SHARED-CODE-MECHANISM.md §0.1).
 * No single physical file can be shared by <script src> reference. So a shared
 * module has ONE canonical source under shared-web/src/** and this script EMITS a
 * byte-identical copy into BOTH apps' js/ trees, then stamps a content-hash
 * ?v= cache-bust token on every referencing <script src> across ALL html pages.
 *
 * THE ONE WORKFLOW (see shared-web/README.md)
 *   1. Edit ONLY shared-web/src/**.
 *   2. Run `npm run emit:shared`.
 *   3. Commit the canonical source + BOTH emitted copies + the token changes.
 *   NEVER edit the emitted copies under apps/*\/js/ directly — the drift-guard
 *   (tests/unit/shared/shared-web-emit.sync.test.ts) fails CI if you do.
 *
 * MODES
 *   node shared-web/emit.js            → writes emitted copies + rewrites tokens
 *   node shared-web/emit.js --check    → no writes; emits to a temp dir and
 *                                        compares committed copies + tokens,
 *                                        exit code 1 on any mismatch (verify:shared)
 *
 * DEPENDENCY-FREE: uses only Node core (fs + path + crypto), mirroring the
 * house style of update-cache-busting.js. No bundler, no new runtime deps.
 * ════════════════════════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Repo root = parent of shared-web/. All paths below are resolved against it.
const REPO_ROOT = path.resolve(__dirname, '..');

// ── Registration ────────────────────────────────────────────────────────────
// The explicit list of shared modules. Add a row here to bring another pair
// under the mechanism. `subpath` is the path UNDER each app's js/ root (and
// under shared-web/src/). `expectedGlobal` documents the window.* the module
// defines — consumed by the drift-guard behavior smoke, not by the emit.
const MODULES = [
  {
    subpath: 'modules/idle-timeout-manager.js',
    expectedGlobal: 'IdleTimeoutManager'
  },
  // PR-SHARE-2 — W1 trivial pairs (2-6). Pairs 2-5 adopted byte-identical from
  // the already-identical prod copies; system-constants adopted after a
  // display-invisible header-comment normalization (drops the app-name from the
  // banner) so it emits byte-identical into BOTH apps.
  {
    subpath: 'modules/work-hours-calculator.js',
    expectedGlobal: 'WorkHoursCalculator'
  },
  {
    subpath: 'shared/business-rules-adapter.js',
    expectedGlobal: 'BUSINESS_RULES'
  },
  {
    subpath: 'shared/holidays-cache.js',
    expectedGlobal: 'WORK_HOURS_HOLIDAYS_MAP'
  },
  {
    subpath: 'shared/work-hours-constants.js',
    expectedGlobal: 'WORK_HOURS_CONSTANTS'
  },
  {
    subpath: 'core/system-constants.js',
    expectedGlobal: 'SYSTEM_CONSTANTS'
  },
  // PR-SHARE-3 — W2 parameterized pair. The canonical carries an APP_CONTEXT
  // sentinel (see injectAppContext) that emit.js stamps per target ('admin' vs
  // 'user'). The admin superset (version tracking + get/getVersion + verbose
  // logs) is gated behind `APP_CONTEXT === 'admin'`; the user copy is lean.
  // Because the injected value differs per target, the admin and user emitted
  // copies legitimately have DIFFERENT bytes and therefore DIFFERENT content-hash
  // tokens — the emit computes tokens PER TARGET (unlike the byte-identical pairs
  // above, whose two copies share one token).
  {
    subpath: 'core/config-loader.js',
    expectedGlobal: 'SystemConfigLoader'
  }
];

// The two publish-root app trees the canonical source emits into. `context` is
// the APP_CONTEXT literal injected into parameterized modules for that target.
const APPS = [
  { name: 'admin-panel', context: 'admin', jsRoot: path.join('apps', 'admin-panel', 'js'), htmlRoot: path.join('apps', 'admin-panel') },
  { name: 'user-app', context: 'user', jsRoot: path.join('apps', 'user-app', 'js'), htmlRoot: path.join('apps', 'user-app') }
];

// Directories never scanned for html (build output / deps / vcs).
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git']);

// ── Core helpers ────────────────────────────────────────────────────────────

/** Absolute path to a module's canonical source under shared-web/src/. */
function canonicalPath(mod) {
  return path.join(REPO_ROOT, 'shared-web', 'src', mod.subpath);
}

/**
 * Normalize a buffer to LF line endings (strip every CR).
 * OS-determinism: git stores/serves these files as LF (see .gitattributes),
 * but a Windows working tree with core.autocrlf=true checks them out as CRLF.
 * Hashing/writing the raw CRLF bytes would produce a token that disagrees with
 * the LF bytes CI (Linux) and Netlify actually serve. Normalizing here makes the
 * emitted bytes AND the content-hash token identical on Windows/Linux/Mac.
 */
function toLF(buffer) {
  return Buffer.from(buffer.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
}

/** Read the canonical bytes of a module, normalized to LF. */
function readCanonical(mod) {
  return toLF(fs.readFileSync(canonicalPath(mod)));
}

/**
 * Per-target APP_CONTEXT injection (PR-SHARE-3, docs/PLAN-SHARED-CODE-MECHANISM.md
 * §2.1 Option A). The canonical of a parameterized module contains a sentinel:
 *   const APP_CONTEXT = / *__APP_CONTEXT__* / 'user';
 * This replaces the string literal following the sentinel with the target app's
 * context ('admin' | 'user'). Deterministic and greppable.
 *
 * Modules WITHOUT the sentinel are returned unchanged (the regex does not match)
 * → they emit byte-identical into both apps, exactly as before this PR.
 */
function injectAppContext(bytes, context) {
  const src = bytes.toString('utf8');
  // Anchor on the sentinel comment, then swap only the immediately-following
  // 'admin'|'user' string literal. Single replacement (the sentinel is unique).
  const re = /(\/\*__APP_CONTEXT__\*\/\s*)(['"])(?:admin|user)\2/;
  if (!re.test(src)) {
    return bytes;
  }
  return Buffer.from(src.replace(re, '$1$2' + context + '$2'), 'utf8');
}

/**
 * The exact bytes emitted into a given app for a module: canonical (LF) with the
 * app's APP_CONTEXT injected. For non-parameterized modules this equals the raw
 * canonical bytes (same for both apps). This is the SINGLE source of the emitted
 * bytes — both the writer and the drift-guard go through it.
 */
function emittedBytesFor(mod, app) {
  return injectAppContext(readCanonical(mod), app.context);
}

/** Content-hash cache-bust token: sh-<first 8 hex chars of sha256(bytes)>. */
function tokenFor(bytes) {
  return 'sh-' + crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);
}

/** Escape a string for safe embedding into a RegExp. */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a global RegExp that matches a <script src="js/<subpath>"> reference,
 * capturing the src attribute value up to (but not including) an optional
 * ?v=... token and the closing quote. Matches single OR double quotes.
 *   group 1 = quote char
 *   group 2 = "js/<subpath>"  (no query)
 */
function refRegExp(subpath) {
  // The src is always "js/<subpath>" relative to the app root.
  const srcLiteral = escapeRegExp('js/' + subpath.split(path.sep).join('/'));
  return new RegExp(
    'src=(["\'])(' + srcLiteral + ')(?:\\?v=[^"\']*)?\\1',
    'g'
  );
}

/** Recursively collect all *.html files under a directory, skipping SKIP_DIRS. */
function collectHtmlFiles(absDir, acc) {
  acc = acc || [];
  let entries;
  try {
    entries = fs.readdirSync(absDir, { withFileTypes: true });
  } catch (e) {
    return acc;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      collectHtmlFiles(path.join(absDir, entry.name), acc);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      acc.push(path.join(absDir, entry.name));
    }
  }
  return acc;
}

/** All html files under one app's html root (absolute paths). */
function htmlFilesForApp(app) {
  return collectHtmlFiles(path.join(REPO_ROOT, app.htmlRoot), []);
}

/** All html files across both apps (absolute paths). */
function allHtmlFiles() {
  const files = [];
  for (const app of APPS) {
    collectHtmlFiles(path.join(REPO_ROOT, app.htmlRoot), files);
  }
  return files;
}

// ── Emit (write) ────────────────────────────────────────────────────────────

/**
 * Emit every registered module into both app trees and rewrite the ?v= token
 * on every referencing <script src> across all html pages.
 * Writes to the real repo tree. Returns a summary object.
 */
function emitToApps() {
  const summary = { modules: [], htmlFilesRewritten: 0, tokenRewrites: 0 };

  // 1) Write the per-target copies + compute tokens PER APP (the injected
  //    APP_CONTEXT can make admin/user bytes — and thus tokens — differ).
  //    tokenByApp[app.name][subpath] = the content-hash token for that copy.
  const tokenByApp = {};
  const modTokens = {};
  for (const app of APPS) {
    tokenByApp[app.name] = {};
  }
  for (const mod of MODULES) {
    const perApp = {};
    for (const app of APPS) {
      const bytes = emittedBytesFor(mod, app);
      const token = tokenFor(bytes);
      tokenByApp[app.name][mod.subpath] = token;
      const dest = path.join(REPO_ROOT, app.jsRoot, mod.subpath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, bytes);
      perApp[app.name] = {
        token,
        copy: path.relative(REPO_ROOT, dest).split(path.sep).join('/')
      };
    }
    modTokens[mod.subpath] = perApp;
    summary.modules.push({ subpath: mod.subpath, perApp });
  }

  // 2) Rewrite tokens on every referencing <script src> in every html page,
  //    using THAT PAGE'S APP token for the module (per-target correctness).
  for (const app of APPS) {
    for (const htmlPath of htmlFilesForApp(app)) {
      const original = fs.readFileSync(htmlPath, 'utf8');
      let content = original;
      for (const mod of MODULES) {
        const token = tokenByApp[app.name][mod.subpath];
        const re = refRegExp(mod.subpath);
        content = content.replace(re, (match, quote, src) => {
          summary.tokenRewrites += 1;
          return 'src=' + quote + src + '?v=' + token + quote;
        });
      }
      // Only write when bytes actually changed (avoid touching untouched files).
      if (content !== original) {
        fs.writeFileSync(htmlPath, content, 'utf8');
        summary.htmlFilesRewritten += 1;
      }
    }
  }

  return summary;
}

// ── Check (no writes) ───────────────────────────────────────────────────────

/**
 * Verify the committed emitted copies + html tokens match a fresh emit from
 * canonical, WITHOUT writing to the repo tree. Emits into a temp dir for the
 * byte comparison. Returns an array of problem strings (empty = all good).
 */
function checkAgainstCommitted() {
  const problems = [];
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-web-check-'));

  try {
    // Expected token is PER APP (parameterized modules differ per target).
    // expectedTokenByApp[app.name][subpath] = content hash of that app's copy.
    const expectedTokenByApp = {};
    for (const app of APPS) {
      expectedTokenByApp[app.name] = {};
    }

    for (const mod of MODULES) {
      for (const app of APPS) {
        const bytes = emittedBytesFor(mod, app);
        const token = tokenFor(bytes);
        expectedTokenByApp[app.name][mod.subpath] = token;

        // Emit into the temp dir (proves emit is reproducible), then byte-compare
        // this app's committed copy against the freshly-emitted bytes.
        const tmpFile = path.join(tmpBase, app.name, mod.subpath);
        fs.mkdirSync(path.dirname(tmpFile), { recursive: true });
        fs.writeFileSync(tmpFile, bytes);
        const emittedBytes = fs.readFileSync(tmpFile);

        const committedPath = path.join(REPO_ROOT, app.jsRoot, mod.subpath);
        const rel = path.relative(REPO_ROOT, committedPath).split(path.sep).join('/');
        if (!fs.existsSync(committedPath)) {
          problems.push(`MISSING committed copy: ${rel} — run \`npm run emit:shared\``);
          continue;
        }
        const committedBytes = fs.readFileSync(committedPath);
        if (!committedBytes.equals(emittedBytes)) {
          problems.push(
            `BYTE MISMATCH: ${rel} differs from a fresh emit of shared-web/src/${mod.subpath} ` +
            '— someone edited the copy directly or forgot to re-emit. Run `npm run emit:shared`.'
          );
        }
      }
    }

    // Token correctness: every referencing page's ?v= must equal the content hash
    // of THAT PAGE'S APP copy.
    for (const app of APPS) {
      for (const htmlPath of htmlFilesForApp(app)) {
        const content = fs.readFileSync(htmlPath, 'utf8');
        const rel = path.relative(REPO_ROOT, htmlPath).split(path.sep).join('/');
        for (const mod of MODULES) {
          const token = expectedTokenByApp[app.name][mod.subpath];
          // Find each reference and its token (or lack thereof).
          const finder = new RegExp(
            'src=(["\'])(' + escapeRegExp('js/' + mod.subpath.split(path.sep).join('/')) + ')(\\?v=([^"\']*))?\\1',
            'g'
          );
          let m;
          while ((m = finder.exec(content)) !== null) {
            const presentToken = m[4]; // undefined if no ?v=
            if (presentToken !== token) {
              problems.push(
                `TOKEN MISMATCH: ${rel} references ${mod.subpath} with ?v=${presentToken || '(none)'} ` +
                `but content hash is ?v=${token}. Run \`npm run emit:shared\`.`
              );
            }
          }
        }
      }
    }
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }

  return problems;
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function main() {
  const isCheck = process.argv.includes('--check');
  if (isCheck) {
    const problems = checkAgainstCommitted();
    if (problems.length > 0) {
      console.error('❌ verify:shared — shared-web emit drift detected:');
      for (const p of problems) {
        console.error('   • ' + p);
      }
      process.exit(1);
    }
    console.log('✅ verify:shared — all shared-web emitted copies + tokens are in sync.');
    return;
  }

  const summary = emitToApps();
  console.log('✅ emit:shared complete');
  for (const mod of summary.modules) {
    console.log(`   • ${mod.subpath}`);
    for (const app of APPS) {
      const info = mod.perApp[app.name];
      console.log(`       ${info.copy} → ?v=${info.token}`);
    }
  }
  console.log(`   html files rewritten: ${summary.htmlFilesRewritten}, token rewrites: ${summary.tokenRewrites}`);
}

if (require.main === module) {
  main();
}

// Exported for reuse by the drift-guard test (tests/unit/shared/shared-web-emit.sync.test.ts).
module.exports = {
  MODULES,
  APPS,
  REPO_ROOT,
  canonicalPath,
  readCanonical,
  injectAppContext,
  emittedBytesFor,
  tokenFor,
  refRegExp,
  htmlFilesForApp,
  allHtmlFiles,
  emitToApps,
  checkAgainstCommitted
};
