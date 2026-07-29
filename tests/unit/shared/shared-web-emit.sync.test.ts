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
type App = { name: string; jsRoot: string; htmlRoot: string };

const emit = emitNS as unknown as {
  MODULES: Mod[];
  APPS: App[];
  REPO_ROOT: string;
  readCanonical: (mod: Mod) => Buffer;
  tokenFor: (bytes: Buffer) => string;
  allHtmlFiles: () => string[];
  checkAgainstCommitted: () => string[];
};

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
      it(`${mod.subpath} — committed ${app.name} copy is byte-identical to a fresh emit`, () => {
        const canonicalBytes = emit.readCanonical(mod);
        const committedPath = path.join(repoRoot, app.jsRoot, mod.subpath);
        expect(fs.existsSync(committedPath), `${committedPath} exists`).toBe(true);
        const committedBytes = fs.readFileSync(committedPath);
        expect(
          committedBytes.equals(canonicalBytes),
          `${app.name} copy of ${mod.subpath} must equal shared-web/src/${mod.subpath}`
        ).toBe(true);
      });
    }
  }
});

// ── check 2: token presence + content-hash correctness on every page ─────────
describe('shared-web emit — cache-bust token == content hash on every referencing page', () => {
  for (const mod of emit.MODULES) {
    it(`${mod.subpath} — every <script src> token equals sh-<hash>`, () => {
      const bytes = emit.readCanonical(mod);
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

      let referencingPages = 0;
      for (const htmlPath of emit.allHtmlFiles()) {
        const content = fs.readFileSync(htmlPath, 'utf8');
        let m: RegExpExecArray | null;
        finder.lastIndex = 0;
        while ((m = finder.exec(content)) !== null) {
          referencingPages += 1;
          const presentToken = m[4]; // undefined if no ?v=
          expect(
            presentToken,
            `${path.relative(repoRoot, htmlPath)} references ${mod.subpath} with a stale/missing token`
          ).toBe(expectedToken);
        }
      }

      // The pair we prove the mechanism on must actually be referenced somewhere.
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
        const fakeWindow: Record<string, unknown> = {};
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

// ── umbrella: the emit's own --check logic reports zero drift ─────────────────
describe('shared-web emit — checkAgainstCommitted() reports no drift', () => {
  it('verify:shared logic finds no byte or token mismatches', () => {
    const problems = emit.checkAgainstCommitted();
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
