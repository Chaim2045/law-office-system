/**
 * Drift-guard — shared-web emit SSOT (PR-SHARE-1)
 *
 * Enforces that every registered shared module under shared-web/src/** stays in
 * lockstep with its two committed emitted copies (one per app) and with the
 * ?v= cache-bust tokens on every referencing html page.
 *
 * Modeled on tests/unit/shared/business-rules.sync.test.ts (byte-identity +
 * IIFE-load harness). See docs/PLAN-SHARED-CODE-MECHANISM.md §1.5.
 *
 * For each registered module it asserts:
 *   (check 1) re-emit from canonical and byte-compare against BOTH committed
 *             copies — fail on any diff (someone edited a copy directly, or
 *             forgot to re-emit).
 *   (check 2) each referencing page's ?v= token equals sh-<hash of emitted
 *             bytes> — catches the "stale immutable token" bug mechanically.
 *   (check 3) behavior smoke — load an emitted copy via new Function(...) against
 *             a fake window and assert it defines the expected global without
 *             throwing (mirrors the business-rules harness).
 *
 * If this test fails: someone edited an emitted copy under apps/*\/js/**, or
 * hand-edited a shared module's token, or forgot to run `npm run emit:shared`.
 * Fix by editing shared-web/src/** and running `npm run emit:shared`, then
 * committing the canonical + both copies + token changes together.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

// @ts-ignore — CommonJS require of the dependency-free emit module.
import * as emitNS from '../../../shared-web/emit.js';

type Mod = { subpath: string; expectedGlobal: string };
type App = { name: string; context: string; jsRoot: string; htmlRoot: string };

const emit = emitNS as unknown as {
  MODULES: Mod[];
  APPS: App[];
  REPO_ROOT: string;
  readCanonical: (mod: Mod) => Buffer;
  injectAppContext: (bytes: Buffer, context: string) => Buffer;
  emittedBytesFor: (mod: Mod, app: App) => Buffer;
  tokenFor: (bytes: Buffer) => string;
  htmlFilesForApp: (app: App) => string[];
  allHtmlFiles: () => string[];
  checkAgainstCommitted: () => string[];
};

// The APP_CONTEXT literal each app's copy of a parameterized module must carry.
const CONTEXT_BY_APP: Record<string, string> = { 'admin-panel': 'admin', 'user-app': 'user' };

const repoRoot = path.resolve(__dirname, '../../..');

// Sanity: the registry is non-empty (the mechanism must prove itself on ≥1 pair).
describe('shared-web emit — registry', () => {
  it('has at least one registered shared module', () => {
    expect(emit.MODULES.length).toBeGreaterThan(0);
  });

  it('emits into exactly the two app publish roots', () => {
    const names = emit.APPS.map((a) => a.name).sort();
    expect(names).toEqual(['admin-panel', 'user-app']);
  });
});

// ── check 1: byte-parity between canonical-emit and BOTH committed copies ─────
describe('shared-web emit — byte parity (canonical == both committed copies)', () => {
  for (const mod of emit.MODULES) {
    for (const app of emit.APPS) {
      it(`${mod.subpath} — committed ${app.name} copy is byte-identical to a fresh (per-target) emit`, () => {
        // Per-target: for a parameterized module this injects the app's
        // APP_CONTEXT; for a byte-identical module it equals the raw canonical.
        const expectedBytes = emit.emittedBytesFor(mod, app);
        const committedPath = path.join(repoRoot, app.jsRoot, mod.subpath);
        expect(fs.existsSync(committedPath), `${committedPath} exists`).toBe(true);
        const committedBytes = fs.readFileSync(committedPath);
        expect(
          committedBytes.equals(expectedBytes),
          `${app.name} copy of ${mod.subpath} must equal a fresh per-target emit of shared-web/src/${mod.subpath}`
        ).toBe(true);
      });
    }
  }
});

// ── check 2: token presence + content-hash correctness on every page ─────────
describe('shared-web emit — cache-bust token == content hash on every referencing page (per target)', () => {
  for (const mod of emit.MODULES) {
    for (const app of emit.APPS) {
      it(`${mod.subpath} — every <script src> token on ${app.name} pages equals its per-target sh-<hash>`, () => {
        const bytes = emit.emittedBytesFor(mod, app);
        const expectedToken = emit.tokenFor(bytes);

        // Independent recompute of the token (do not trust tokenFor blindly).
        const recomputed =
          'sh-' + crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);
        expect(expectedToken).toBe(recomputed);

        const srcLiteral = 'js/' + mod.subpath.split(path.sep).join('/');
        const escaped = srcLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const finder = new RegExp(
          'src=(["\'])(' + escaped + ')(\\?v=([^"\']*))?\\1',
          'g'
        );

        // Assert token correctness on every page of THIS app that references the
        // module. Not every module is loaded by both apps (e.g. business-rules-
        // adapter is admin-only), so we do NOT assert a per-app reference count
        // here — that guarantee is covered once, across both apps, below.
        for (const htmlPath of emit.htmlFilesForApp(app)) {
          const content = fs.readFileSync(htmlPath, 'utf8');
          let m: RegExpExecArray | null;
          finder.lastIndex = 0;
          while ((m = finder.exec(content)) !== null) {
            const presentToken = m[4]; // undefined if no ?v=
            expect(
              presentToken,
              `${path.relative(repoRoot, htmlPath)} references ${mod.subpath} with a stale/missing token`
            ).toBe(expectedToken);
          }
        }
      });
    }
  }

  // The reference-existence guarantee, once per module across BOTH apps (a module
  // may legitimately be loaded by only one app).
  for (const mod of emit.MODULES) {
    it(`${mod.subpath} — is referenced by at least one page (either app)`, () => {
      const srcLiteral = 'js/' + mod.subpath.split(path.sep).join('/');
      const escaped = srcLiteral.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const finder = new RegExp('src=(["\'])(' + escaped + ')(\\?v=([^"\']*))?\\1', 'g');
      let referencingPages = 0;
      for (const htmlPath of emit.allHtmlFiles()) {
        const content = fs.readFileSync(htmlPath, 'utf8');
        finder.lastIndex = 0;
        while (finder.exec(content) !== null) {
          referencingPages += 1;
        }
      }
      expect(referencingPages, `${mod.subpath} is referenced by at least one page`).toBeGreaterThan(0);
    });
  }
});

// ── check 3: behavior smoke — emitted copy loads + defines its global ────────
describe('shared-web emit — emitted copy defines its global without throwing', () => {
  for (const mod of emit.MODULES) {
    for (const app of emit.APPS) {
      it(`${mod.subpath} — ${app.name} copy sets window.${mod.expectedGlobal}`, () => {
        const committedPath = path.join(repoRoot, app.jsRoot, mod.subpath);
        const source = fs.readFileSync(committedPath, 'utf8');

        // Each module is an IIFE / class-def that writes its global onto `window`
        // at load time. Provide a fake window plus load-time-global fakes so the
        // module executes in a Node context exactly as the template harness does:
        //   - `Logger` — idle-timeout-manager calls Logger.log(...) at load.
        //   - `setTimeout` — holidays-cache schedules async pollers at load; a
        //     no-op prevents them firing during the test (the global it defines
        //     is set synchronously before any timer would run anyway).
        // `console` is a genuine Node global (system-constants logs at load) and
        // is intentionally NOT shadowed.
        // `location` is provided because modules/logger.js reads
        // `window.location.hostname` in its constructor (env auto-detect); a bare
        // {} would throw before the module defines its global. hostname is a
        // non-prod value so the user copy's prod console-override stays dormant
        // here (its user-only + prod-only behavior is asserted in check 7).
        const fakeWindow: Record<string, unknown> = { location: { hostname: 'localhost' } };
        const fakeLogger = { log: () => {}, error: () => {}, warn: () => {}, info: () => {} };
        const noopSetTimeout = () => 0;
        const runner = new Function('window', 'Logger', 'setTimeout', source);
        expect(() => runner(fakeWindow, fakeLogger, noopSetTimeout)).not.toThrow();
        // Modules define different global TYPES (function classes, Maps, frozen
        // objects), so assert the global is DEFINED — not that it is a function.
        expect(
          typeof fakeWindow[mod.expectedGlobal] !== 'undefined',
          `${app.name} copy of ${mod.subpath} must define window.${mod.expectedGlobal}`
        ).toBe(true);
      });
    }
  }
});

// ── check 4: parameterized modules carry the correct injected APP_CONTEXT ─────
// config-loader is the first parameterized module (PR-SHARE-3): the admin copy
// gates its version-tracking + verbose logs + "ready" log behind
// APP_CONTEXT==='admin'; the user copy is lean. Assert (a) each copy carries the
// literal APP_CONTEXT for its target, and (b) the emitted-copy behavior: admin
// has get/getVersion + a `version` field + a "ready" log; user is lean (no
// version field, no load-time console output beyond nothing).
describe('shared-web emit — config-loader APP_CONTEXT injection + per-target behavior', () => {
  const configMod = emit.MODULES.find((m) => m.subpath === 'core/config-loader.js');

  it('config-loader is registered', () => {
    expect(configMod, 'core/config-loader.js must be a registered MODULE').toBeTruthy();
  });

  if (!configMod) {
return;
}

  for (const app of emit.APPS) {
    it(`${app.name} copy carries const APP_CONTEXT = '${CONTEXT_BY_APP[app.name]}'`, () => {
      const committedPath = path.join(repoRoot, app.jsRoot, configMod.subpath);
      const source = fs.readFileSync(committedPath, 'utf8');
      // The injected literal must be present, and the OTHER app's literal absent
      // from the sentinel line.
      const expected = CONTEXT_BY_APP[app.name];
      const other = expected === 'admin' ? 'user' : 'admin';
      const anchorRe = new RegExp("const APP_CONTEXT = /\\*__APP_CONTEXT__\\*/ '" + expected + "';");
      const wrongRe = new RegExp("const APP_CONTEXT = /\\*__APP_CONTEXT__\\*/ '" + other + "';");
      expect(anchorRe.test(source), `${app.name} copy must inject APP_CONTEXT='${expected}'`).toBe(true);
      expect(wrongRe.test(source), `${app.name} copy must NOT carry APP_CONTEXT='${other}'`).toBe(false);
    });
  }

  // Behavior smoke, per target: load the emitted copy against a fake window and
  // assert the app-context-gated surface.
  function loadConfigLoader(app: App): { win: Record<string, unknown>; logs: string[] } {
    const committedPath = path.join(repoRoot, app.jsRoot, configMod!.subpath);
    const source = fs.readFileSync(committedPath, 'utf8');
    const win: Record<string, unknown> = {};
    const logs: string[] = [];
    // The module logs via the genuine `console` global; capture load-time output.
    const origLog = console.log;
    (console as unknown as { log: (...a: unknown[]) => void }).log = (...a: unknown[]) => {
      logs.push(a.join(' '));
    };
    try {
      const runner = new Function('window', source);
      runner(win);
    } finally {
      (console as unknown as { log: (...a: unknown[]) => void }).log = origLog;
    }
    return { win, logs };
  }

  it('admin copy: defines get/getVersion, a version field, and logs "Config Loader ready" at load', () => {
    const admin = emit.APPS.find((a) => a.name === 'admin-panel')!;
    const { win, logs } = loadConfigLoader(admin);
    const loader = win.SystemConfigLoader as Record<string, unknown>;
    expect(typeof loader).toBe('object');
    expect(typeof loader.get, 'admin get()').toBe('function');
    expect(typeof loader.getVersion, 'admin getVersion()').toBe('function');
    // version-tracking init (getVersion caller at SystemSettingsPage.js relies on it).
    expect('version' in loader, 'admin copy has a `version` field').toBe(true);
    expect((loader.getVersion as () => unknown)()).toBe(null);
    expect(logs.some((l) => l.includes('Config Loader ready')), 'admin logs "ready"').toBe(true);
  });

  it('user copy: lean — no `version` field, no load-time console output', () => {
    const user = emit.APPS.find((a) => a.name === 'user-app')!;
    const { win, logs } = loadConfigLoader(user);
    const loader = win.SystemConfigLoader as Record<string, unknown>;
    expect(typeof loader).toBe('object');
    // Admin-only version-tracking surface is OFF.
    expect('version' in loader, 'user copy has NO `version` field').toBe(false);
    // No new console.log fires at user load (the "ready" log is admin-gated).
    expect(logs.length, `user load produced console output: ${JSON.stringify(logs)}`).toBe(0);
    // get/getVersion are additive (present but dormant/uncalled in the user app).
    expect(typeof loader.get, 'user get() present but dormant').toBe('function');
    expect(typeof loader.getVersion, 'user getVersion() present but dormant').toBe('function');
  });
});

// ── check 7: logger PROD console-override is USER-only (per-target behavior) ──
// logger is the second parameterized module (PR-SHARE-4). The USER copy appends a
// "PROD Console Override" that, in production, silences console.log/info/debug and
// installs window.enableDebug()/disableDebug(); the ADMIN copy gates it OFF so it
// NEVER silences console.log (preserves today's admin behavior). Both emitted
// copies CONTAIN the block text (it is gated, not stripped) — so a raw marker/byte
// check cannot distinguish them; only the RUNTIME behavior can. Load each copy
// against a fake PRODUCTION window and assert the app-context-gated surface.
describe('shared-web emit — logger PROD console-override is user-only (per target)', () => {
  const loggerMod = emit.MODULES.find((m) => m.subpath === 'modules/logger.js');

  it('logger is registered', () => {
    expect(loggerMod, 'modules/logger.js must be a registered MODULE').toBeTruthy();
  });

  if (!loggerMod) {
return;
}

  // Load an emitted logger copy against a fake PRODUCTION window. The user copy
  // REPLACES the genuine console.log/info/debug globally when it runs the prod
  // override, so save/restore them around the load. Returns whether the copy
  // installed the override (console.log got replaced) + the populated window.
  function loadLoggerInProd(app: App): { win: Record<string, unknown>; overrodeConsole: boolean } {
    const committedPath = path.join(repoRoot, app.jsRoot, loggerMod!.subpath);
    const source = fs.readFileSync(committedPath, 'utf8');
    // A production hostname → isProduction === true in SecureLogger's constructor.
    const win: Record<string, unknown> = { location: { hostname: 'app.netlify.app' } };
    const origLog = console.log;
    const origInfo = console.info;
    const origDebug = console.debug;
    let overrodeConsole = false;
    try {
      const runner = new Function('window', source);
      runner(win);
      // If the copy installed the prod override, console.log is no longer origLog.
      overrodeConsole = console.log !== origLog;
    } finally {
      (console as unknown as { log: unknown }).log = origLog;
      (console as unknown as { info: unknown }).info = origInfo;
      (console as unknown as { debug: unknown }).debug = origDebug;
    }
    return { win, overrodeConsole };
  }

  it('admin copy: NO prod console-override — console untouched, no debug doors', () => {
    const admin = emit.APPS.find((a) => a.name === 'admin-panel')!;
    const { win, overrodeConsole } = loadLoggerInProd(admin);
    // The crux: admin must NOT silence console.log in prod (behavior regression).
    expect(overrodeConsole, 'admin copy must NOT replace console.log in production').toBe(false);
    expect(typeof win.enableDebug, 'admin copy must NOT install window.enableDebug').toBe('undefined');
    expect(typeof win.disableDebug, 'admin copy must NOT install window.disableDebug').toBe('undefined');
    // Sanity: it still defines the logger global.
    expect(typeof win.Logger, 'admin copy defines window.Logger').toBe('object');
  });

  it('user copy: prod console-override PRESENT + gated on isProduction — debug doors installed', () => {
    const user = emit.APPS.find((a) => a.name === 'user-app')!;
    const { win, overrodeConsole } = loadLoggerInProd(user);
    // The user copy silences console.log/info/debug in prod and installs the doors.
    expect(overrodeConsole, 'user copy must silence console.log in production').toBe(true);
    expect(typeof win.enableDebug, 'user copy installs window.enableDebug in prod').toBe('function');
    expect(typeof win.disableDebug, 'user copy installs window.disableDebug in prod').toBe('function');
    expect(typeof win.Logger, 'user copy defines window.Logger').toBe('object');
  });

  it('user copy: override is GATED on isProduction — dormant in a non-prod env', () => {
    // Same user copy, but a non-prod hostname → the double guard
    // (APP_CONTEXT==='user' && isProduction) is false → no override, no doors.
    const user = emit.APPS.find((a) => a.name === 'user-app')!;
    const committedPath = path.join(repoRoot, user.jsRoot, loggerMod!.subpath);
    const source = fs.readFileSync(committedPath, 'utf8');
    const win: Record<string, unknown> = { location: { hostname: 'localhost' } };
    const origLog = console.log;
    try {
      new Function('window', source)(win);
      expect(console.log !== origLog, 'user copy must NOT silence console.log outside production').toBe(false);
    } finally {
      (console as unknown as { log: unknown }).log = origLog;
    }
    expect(typeof win.enableDebug, 'user copy installs no debug door outside prod').toBe('undefined');
  });
});

// ── APP_CONTEXT sentinel plumbing (shared by the two generic guards below) ────
// The canonical of a parameterized module carries the injection anchor:
//   const APP_CONTEXT = /*__APP_CONTEXT__*/ 'user';
// This regex locates the anchor and captures the string literal that immediately
// follows it (group 2 = the 'admin'|'user' value). It mirrors the anchor that
// shared-web/emit.js `injectAppContext` swaps — kept in lockstep on purpose so a
// future module that changes the sentinel breaks BOTH the emit and this guard.
const SENTINEL_LITERAL_RE = /\/\*__APP_CONTEXT__\*\/\s*(['"])(admin|user)\1/;

// "non-privileged literal" — admin is the PRIVILEGED surface (version tracking,
// verbose logs, and the future SHARE-6 SHOW_FINANCIALS/confidentiality flag are
// all gated behind APP_CONTEXT==='admin'). 'user' is the safe, lean default: a
// broken injection that no-ops leaves 'user' in place → admin surface stays OFF,
// never "confidential data ON the user surface".
const NON_PRIVILEGED_LITERAL = 'user';

/** The 'admin'|'user' literal at the sentinel in a source string, or null if the
 *  module has no sentinel (a byte-identical / non-parameterized module). */
function sentinelLiteral(source: string): string | null {
  const m = SENTINEL_LITERAL_RE.exec(source);
  return m ? m[2] : null;
}

// The set of registered modules whose CANONICAL source carries the sentinel —
// i.e. the parameterized modules. Non-parameterized modules are absent (they
// emit byte-identical into both apps and are covered by check 1).
const parameterizedMods = emit.MODULES.filter(
  (mod) => sentinelLiteral(emit.readCanonical(mod).toString('utf8')) !== null
);

// ── check 5 (HARDENING 1): GENERIC per-target injection assertion ─────────────
// For EVERY parameterized module (sentinel present in canonical), assert per app
// that the emitted copy carries ITS target's literal at the sentinel and NOT the
// other app's. Unlike check 4 (config-loader-specific), this loop auto-covers any
// FUTURE parameterized module (e.g. SHARE-6's SHOW_FINANCIALS) with no new test.
describe('shared-web emit — every parameterized module injects the correct per-target literal', () => {
  it('at least one module is parameterized (the mechanism proves itself)', () => {
    // Not a hard requirement of the mechanism, but PR-SHARE-3 shipped config-loader
    // as the first — if this ever drops to 0, checks 5+6 would vacuously pass, so
    // surface it loudly.
    expect(
      parameterizedMods.map((m) => m.subpath),
      'expected ≥1 module carrying the __APP_CONTEXT__ sentinel'
    ).toContain('core/config-loader.js');
  });

  for (const mod of parameterizedMods) {
    for (const app of emit.APPS) {
      const expected = CONTEXT_BY_APP[app.name];
      const other = expected === 'admin' ? 'user' : 'admin';
      it(`${mod.subpath} — emitted ${app.name} copy carries '${expected}' at the sentinel, not '${other}'`, () => {
        const committedPath = path.join(repoRoot, app.jsRoot, mod.subpath);
        expect(fs.existsSync(committedPath), `${committedPath} exists`).toBe(true);
        const source = fs.readFileSync(committedPath, 'utf8');
        const literal = sentinelLiteral(source);
        expect(
          literal,
          `${app.name} copy of ${mod.subpath} must carry an APP_CONTEXT sentinel literal`
        ).not.toBeNull();
        // (a)/(b): the injected literal is exactly this target's, and NOT the other's.
        expect(
          literal,
          `${app.name} copy of ${mod.subpath} must inject '${expected}' at the sentinel`
        ).toBe(expected);
        expect(
          literal,
          `${app.name} copy of ${mod.subpath} must NOT carry '${other}' at the sentinel`
        ).not.toBe(other);
      });
    }
  }
});

// ── check 6 (HARDENING 2): fail-secure DEFAULT literal guard ──────────────────
// The whole mechanism is fail-secure ONLY IF a no-op injection (missing/typo'd
// sentinel) leaves the NON-PRIVILEGED default in the copy. That rests on the
// CANONICAL default itself being the non-privileged literal. Assert it here: if a
// future parameterized module ships a canonical default of 'admin', a broken
// injection would degrade to "admin/confidential surface ON the user copy" — the
// exact leak the SHARE-6 confidentiality flag must never permit. This guard makes
// that ship-time mistake a hard, self-explaining test failure.
describe('shared-web emit — parameterized canonical DEFAULT literal is fail-secure', () => {
  for (const mod of parameterizedMods) {
    it(`${mod.subpath} — canonical default at the sentinel is the non-privileged '${NON_PRIVILEGED_LITERAL}'`, () => {
      const canonicalSource = emit.readCanonical(mod).toString('utf8');
      const literal = sentinelLiteral(canonicalSource);
      expect(
        literal,
        `${mod.subpath} canonical must carry the __APP_CONTEXT__ sentinel`
      ).not.toBeNull();
      expect(
        literal,
        `LEAK RISK: shared-web/src/${mod.subpath} ships a canonical default of ` +
          `'${literal}' at the __APP_CONTEXT__ sentinel. The default MUST be the ` +
          `non-privileged '${NON_PRIVILEGED_LITERAL}' — if injection ever no-ops ` +
          '(missing/renamed sentinel), the copy keeps this default. A privileged ' +
          'default (\'admin\') would degrade a broken injection to "admin/confidential ' +
          'surface ON the user app", instead of the fail-secure "admin surface OFF".'
      ).toBe(NON_PRIVILEGED_LITERAL);
    });
  }
});

// ── check 8: service-card-renderer H4 CONFIDENTIALITY + H2/H3 behavior ────────
// PR-SHARE-6, the highest-stakes pair. The §7.6 confidentiality invariant is the
// headline: the USER emitted copy MUST NEVER render price/cost/hours-worked/entries
// for a fixed-price service; the ADMIN copy MUST. Both emitted copies contain the
// full source (the financial block is GATED behind SHOW_FINANCIALS, not stripped —
// like logger's prod-override), so only the RUNTIME render can prove the split.
// Also asserts H2 (all-inactive packages → 0 in BOTH) and H3 (title uses
// service.name when present, in BOTH).
describe('shared-web emit — service-card-renderer confidentiality (H4) + behavior (H2/H3)', () => {
  const cardMod = emit.MODULES.find((m) => m.subpath === 'modules/service-card-renderer.js');

  it('service-card-renderer is registered', () => {
    expect(cardMod, 'modules/service-card-renderer.js must be a registered MODULE').toBeTruthy();
  });

  if (!cardMod) {
return;
}

  // Load an emitted copy against a fake window and return its window.renderServiceCard.
  // The module IIFE reads window.escapeHtml (absent → its inline 5-entity fallback),
  // window.calculate* (defined by the module itself), and calls Logger.log(...) at
  // load — so a fake Logger is provided, mirroring check-3's harness.
  function loadRenderer(app: App): (
    service: Record<string, unknown>,
    type: string,
    pricingType?: string,
    caseItem?: unknown,
    options?: unknown
  ) => string {
    const committedPath = path.join(repoRoot, app.jsRoot, cardMod!.subpath);
    const source = fs.readFileSync(committedPath, 'utf8');
    const win: Record<string, unknown> = {};
    const fakeLogger = { log: () => {}, error: () => {}, warn: () => {}, info: () => {} };
    // service-card-renderer also console.log's inside the legal_procedure/hourly
    // branch; the fixtures below never hit it, but keep a genuine console.
    new Function('window', 'Logger', source)(win, fakeLogger);
    return win.renderServiceCard as ReturnType<typeof loadRenderer>;
  }

  const adminApp = emit.APPS.find((a) => a.name === 'admin-panel')!;
  const userApp = emit.APPS.find((a) => a.name === 'user-app')!;

  // A fixed-price service with real financials: price + minutes-worked + entries.
  const fixedPriceFixture = {
    id: 'svc-fixed-1',
    name: 'שירות ייעוץ',
    description: 'תיאור השירות',
    fixedPrice: 5000,
    work: { totalMinutesWorked: 150, entriesCount: 4 }
  };

  // The financial tokens that must NEVER appear in the STAFF (user) fixed-price render.
  const FINANCIAL_TOKENS = ['₪', 'פיקס', 'שעות עבודה', 'רשומות'];

  it('CRUX — USER fixed-price render leaks NO financials (no ₪, פיקס, שעות עבודה, רשומות, no price)', () => {
    const render = loadRenderer(userApp);
    const html = render(fixedPriceFixture, 'fixed');
    for (const token of FINANCIAL_TOKENS) {
      expect(
        html.includes(token),
        `USER fixed-price render must NOT contain "${token}" — §7.6 confidentiality leak`
      ).toBe(false);
    }
    // The numeric price must not appear in any form (5000 / 5,000).
    expect(html.includes('5000'), 'USER render must not contain raw price 5000').toBe(false);
    expect(html.includes('5,000'), 'USER render must not contain formatted price 5,000').toBe(false);
    // Positive: it DOES render the staff badge + the staff-safe icon.
    expect(html.includes('שירות קבוע'), 'USER render shows the "שירות קבוע" badge').toBe(true);
    expect(html.includes('fa-file-contract'), 'USER render uses the staff icon fa-file-contract').toBe(true);
  });

  it('ADMIN fixed-price render DOES show financials (₪ + formatted price + hours + entries)', () => {
    const render = loadRenderer(adminApp);
    const html = render(fixedPriceFixture, 'fixed');
    expect(html.includes('₪'), 'ADMIN render contains ₪').toBe(true);
    expect(html.includes('5,000'), 'ADMIN render contains the formatted price 5,000').toBe(true);
    expect(html.includes('פיקס'), 'ADMIN render contains "פיקס"').toBe(true);
    expect(html.includes('שעות עבודה'), 'ADMIN render contains "שעות עבודה"').toBe(true);
    expect(html.includes('רשומות'), 'ADMIN render contains "רשומות"').toBe(true);
    expect(html.includes('fa-shekel-sign'), 'ADMIN render uses the shekel icon').toBe(true);
  });

  it('SHOW_FINANCIALS is default-deny — the fixed-price STAFF (else) branch of the USER source has NO financial tokens', () => {
    // The user copy CONTAINS the financial block text (it is GATED behind
    // SHOW_FINANCIALS, not stripped — like logger's prod-override), so a whole-file
    // grep for "₪"/"פיקס" would legitimately match (the admin block source + the
    // separate legal_procedure "מחיר פיקס" branch + this file's own header comment).
    // The meaningful source-level invariant is narrower: the fixed-price STAFF
    // branch — everything from the `} else {` that opens it onward — must contain
    // NONE of the fixed-price financial tokens. Combined with the runtime render
    // assertions above (USER output has zero financials), this proves the tokens
    // live only inside the admin SHOW_FINANCIALS branch, never the staff path.
    const userSource = fs.readFileSync(
      path.join(repoRoot, userApp.jsRoot, cardMod.subpath),
      'utf8'
    );
    const gateIdx = userSource.indexOf('if (SHOW_FINANCIALS) {');
    expect(gateIdx, 'user source has the SHOW_FINANCIALS gate').toBeGreaterThan(-1);
    // The staff (else) branch begins at the `} else {` AFTER the gate.
    const elseIdx = userSource.indexOf('} else {', gateIdx);
    expect(elseIdx, 'user source has the staff else-branch').toBeGreaterThan(gateIdx);
    // From the staff branch onward — no ₪, no price, no hours-worked, no entries.
    // (₪ and 'פיקס' and 'שעות עבודה'/'רשומות' only exist above this point.)
    const staffBranch = userSource.slice(elseIdx);
    for (const token of ['₪', 'פיקס', 'שעות עבודה', 'רשומות']) {
      expect(
        staffBranch.includes(token),
        `"${token}" must NOT appear in/after the fixed-price staff else-branch of the user source`
      ).toBe(false);
    }
    // And the price interpolation (Number(service.fixedPrice)) is gated too.
    expect(
      staffBranch.includes('fixedPrice'),
      'the fixed-price staff branch must not reference service.fixedPrice'
    ).toBe(false);
  });

  it('H2 — all-inactive packages → remaining-hours 0 in BOTH emits (never the service-level residual)', () => {
    // Asserts the renderer's LOCAL calculateRemainingHours returns 0 for an
    // all-inactive-packages service — this is the live path in the ADMIN panel.
    // In the user-app this function is SHADOWED by core-utils.js/calculators.js
    // (which keeps the service-level fallback), so H2 is functionally inert
    // there — this test covers the renderer's local behavior, not the
    // user-app's live remaining-hours calculation.
    const allInactive = {
      id: 'svc-hours-1',
      packages: [{ status: 'inactive', hoursRemaining: 42, hours: 100, hoursUsed: 58 }],
      hoursRemaining: 42
    };
    for (const app of [adminApp, userApp]) {
      const render = loadRenderer(app);
      const html = render(allInactive, 'hours');
      // No-name fallback title: "שירות שעות · נותרו 0.0 ש'" → proves remaining=0.
      // (The trailing apostrophe is escaped to &#39; at the sink, so match on the
      // number, not the quote char.)
      expect(
        html.includes('נותרו 0.0'),
        `${app.name}: all-inactive packages must yield remaining-hours 0 (got a non-zero title)`
      ).toBe(true);
      expect(
        html.includes('נותרו 42'),
        `${app.name}: must NOT fall back to the service-level residual (42)`
      ).toBe(false);
    }
  });

  it('H3 — hours-service title uses service.name when present, in BOTH emits', () => {
    const named = {
      id: 'svc-hours-2',
      name: 'ייעוץ חודשי',
      packages: [{ status: 'active', hoursRemaining: 10, hours: 20, hoursUsed: 10 }]
    };
    for (const app of [adminApp, userApp]) {
      const render = loadRenderer(app);
      const html = render(named, 'hours');
      expect(
        html.includes('ייעוץ חודשי'),
        `${app.name}: hours-service title must use service.name`
      ).toBe(true);
      // The generic constant must NOT be the title (it is the subtitle here).
      expect(
        html.includes('שירות שעות · נותרו'),
        `${app.name}: named service must NOT use the no-name fallback title`
      ).toBe(false);
    }
  });
});

// ── umbrella: the emit's own --check logic reports zero drift ─────────────────
describe('shared-web emit — checkAgainstCommitted() reports no drift', () => {
  it('verify:shared logic finds no byte or token mismatches', () => {
    const problems = emit.checkAgainstCommitted();
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
