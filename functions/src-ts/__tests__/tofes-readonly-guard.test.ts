/**
 * tofes-mecher read-only circuit-breaker — static AST guard
 * ─────────────────────────────────────────────────────────────────────────────
 * The bridge to tofes-mecher (`law-office-sales-form`) is READ-ONLY by contract.
 * IAM (`roles/datastore.viewer`) enforces it at the GCP layer, but the code had
 * NO circuit-breaker: any consumer holding the raw named app could call a write
 * method, and nothing bound the SA key to the tofes project. This guard is the
 * code-side enforcement (blind-spot hunt, 2026-07-09):
 *
 *   (a) `app.ts` (the ONLY module that touches the tofes Firestore handle) is
 *       write-free — no `.set/.update/.delete/.add/.batch/.create` etc.
 *   (b) The sanctioned surface is the frozen READ-ONLY `getTofesMecherReader`
 *       (readDoc / readCollection only). It exists and is `Object.freeze`d.
 *   (c) No CONSUMER holds the raw app — none call `getTofesMecherApp(`; the live
 *       readers (validate + export) route through `getTofesMecherReader(`.
 *   (d) The wrong-project circuit-breaker asserts on the KEY's own `project_id`
 *       (NOT the tautological `app.options.projectId`).
 *
 * DUAL-defense note (mirrors verify-claims.test.ts): this file is the STATIC
 * layer. The RUNTIME layer — the reader exposes only reads, is frozen, and a
 * wrong-project key is refused before cert()/initializeApp — lives in
 * validate-sales-record.test.ts ("getTofesMecherApp — credential + singleton"
 * and "getTofesMecherReader exposes ONLY read methods").
 *
 * ❌ Like every AST grep, this catches only LITERAL source patterns — a future
 * wrapper helper named e.g. `saveX()` calling `.set()` inside app.ts would slip
 * the regex. If a real write is ever intentionally added, this test is the place
 * to update (and the read-only contract + rubric must be revisited).
 */
import * as fs from 'fs';
import * as path from 'path';

/** Strip block + line comments so a token inside a comment never false-matches. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function readSrc(relToTofes: string): string {
  return stripComments(
    fs.readFileSync(path.resolve(__dirname, relToTofes), 'utf8')
  );
}

/** All non-declaration .ts source files directly under a dir (relative to here). */
function tsFilesUnder(relDir: string): Array<{ name: string; rel: string }> {
  const dir = path.resolve(__dirname, relDir);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map((f) => ({ name: `${relDir}/${f}`, rel: `${relDir}/${f}` }));
}

const APP = '../tofes-mecher/app.ts';
const VALIDATE = '../tofes-mecher/validate-sales-record.ts';
const EXPORT = '../tofes-mecher/export-sales-to-bigquery.ts';
const LIST = '../tofes-mecher/list-unlinked-sales-records.ts';

const FORBIDDEN_WRITE_PATTERNS: ReadonlyArray<{ pattern: RegExp; name: string }> = [
  { pattern: /\.set\s*\(/, name: '.set(' },
  { pattern: /\.update\s*\(/, name: '.update(' },
  { pattern: /\.delete\s*\(/, name: '.delete(' },
  { pattern: /\.add\s*\(/, name: '.add(' },
  { pattern: /\.create\s*\(/, name: '.create(' },
  { pattern: /\.batch\s*\(/, name: '.batch(' },
  { pattern: /writeBatch/, name: 'writeBatch' },
  { pattern: /bulkWriter/, name: 'bulkWriter' },
  { pattern: /runTransaction/, name: 'runTransaction' }
];

describe('tofes-mecher read-only circuit-breaker (static AST)', () => {
  // ── (a) app.ts — the sole tofes-handle holder — is write-free ──────────────
  describe('(a) app.ts contains NO Firestore write method', () => {
    let code: string;
    beforeAll(() => {
      // Strip the crypto hash chain (createHash(...).update(...).digest(...)) so
      // its `.update(` — a Node crypto method, NOT a Firestore write — does not
      // false-match the `.update(` write pattern. Targeted: removes only that
      // exact chain, so a real Firestore `.update(` would still be caught.
      code = readSrc(APP).replace(/createHash\([\s\S]*?\.digest\([^)]*\)/g, 'HASH');
    });

    it.each(FORBIDDEN_WRITE_PATTERNS)(
      'app.ts has NO occurrence of $name',
      ({ pattern, name }) => {
        const matches = code.match(new RegExp(pattern.source, 'g'));
        if (matches && matches.length > 0) {
          throw new Error(
            `Forbidden write API "${name}" found ${matches.length} time(s) in ` +
            'tofes-mecher/app.ts. The tofes-mecher bridge is READ-ONLY by ' +
            'contract — no write method may reach its Firestore handle. If a ' +
            'write was added intentionally, the read-only contract + rubric ' +
            'must be revisited.'
          );
        }
        expect(matches).toBeNull();
      }
    );
  });

  // ── (b) the sanctioned surface is the frozen read-only reader ──────────────
  describe('(b) getTofesMecherReader is a frozen read-only surface', () => {
    let code: string;
    beforeAll(() => { code = readSrc(APP); });

    it('exports getTofesMecherReader with readDoc + readCollection only', () => {
      expect(code).toMatch(/export\s+function\s+getTofesMecherReader/);
      expect(code).toContain('readDoc');
      expect(code).toContain('readCollection');
    });

    it('freezes the reader (no write method can be attached at runtime)', () => {
      expect(code).toMatch(/Object\.freeze/);
    });
  });

  // ── (c) no module OUTSIDE app.ts holds the raw app (directory-wide scan) ────
  // Not a fixed allowlist: scans EVERY .ts under tofes-mecher/ (except app.ts)
  // and cutover/, so a FUTURE module that imports the still-exported
  // getTofesMecherApp is caught (devils-advocate Attack #4). getTofesMecherApp
  // stays exported for its credential/singleton tests; this is its backstop.
  describe('(c) no module outside app.ts calls getTofesMecherApp(', () => {
    const scanned = [
      ...tsFilesUnder('../tofes-mecher').filter((f) => !f.rel.endsWith('/app.ts')),
      ...tsFilesUnder('../cutover')
    ];

    it('the scan actually found the tofes-mecher + cutover modules', () => {
      expect(scanned.length).toBeGreaterThanOrEqual(4);
    });

    it.each(scanned)('$name does NOT call getTofesMecherApp(', ({ rel }) => {
      expect(readSrc(rel)).not.toMatch(/getTofesMecherApp\s*\(/);
    });

    it.each([
      { name: 'validate-sales-record', rel: VALIDATE },
      { name: 'export-sales-to-bigquery', rel: EXPORT },
      { name: 'list-unlinked-sales-records', rel: LIST }
    ])('$name reads via getTofesMecherReader(', ({ rel }) => {
      expect(readSrc(rel)).toMatch(/getTofesMecherReader\s*\(/);
    });
  });

  // ── (c2) reader files never write through a returned snapshot's .ref ────────
  // readDoc/readCollection return snapshots whose `.ref` is a write-capable
  // DocumentReference on tofes (devils-advocate Attack #1). The reader files are
  // pure tofes-readers (their only legit writes are to the MAIN project via
  // `admin.firestore()...`), so a `.ref`-write here would be a tofes write.
  describe('(c2) reader files never call .ref.<write>', () => {
    it.each([
      { name: 'validate-sales-record', rel: VALIDATE },
      { name: 'export-sales-to-bigquery', rel: EXPORT },
      { name: 'list-unlinked-sales-records', rel: LIST }
    ])('$name has no .ref.set/.update/.delete/.create/.add', ({ rel }) => {
      expect(readSrc(rel)).not.toMatch(
        /\.ref\s*\.\s*(set|update|delete|create|add)\s*\(/
      );
    });
  });

  // ── (e) app.ts init log leaks no email (§2.2) — hash only ───────────────────
  describe('(e) init self-test log is PII-safe', () => {
    let code: string;
    beforeAll(() => { code = readSrc(APP); });

    it('logs clientEmailHash, never a raw client_email / clientEmail value', () => {
      expect(code).toMatch(/clientEmailHash/);
      // No `logger.*({... clientEmail: ...})` (the raw email) — hash only.
      expect(code).not.toMatch(/clientEmail\s*:/);
      // No raw email string literal reaches a logger call in app.ts.
      expect(code).not.toMatch(/logger\.\w+\([^)]*@/);
    });
  });

  // ── (d) the wrong-project circuit-breaker checks the KEY's own project_id ───
  describe('(d) wrong-project circuit-breaker', () => {
    let code: string;
    beforeAll(() => { code = readSrc(APP); });

    it('asserts on the parsed key project_id, not app.options.projectId', () => {
      // The load-bearing check: refuse a key whose OWN project_id is not tofes.
      expect(code).toMatch(/parsed\.project_id\s*!==\s*TOFES_MECHER_PROJECT_ID/);
      // The tautological check must NOT be what we rely on.
      expect(code).not.toMatch(/app\.options\.projectId\s*[!=]==/);
    });
  });
});
