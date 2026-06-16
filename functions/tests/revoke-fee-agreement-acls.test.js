/**
 * PR-SEC-2 — cutover + migration tests
 * ─────────────────────────────────────────────────────────────────────────────
 * (a) planDocRevocation (pure core of revoke-fee-agreement-public-acls.js): strips
 *     the stale downloadUrl, preserves storagePath + other fields, flags prefix
 *     mismatches, and is a no-op when there is nothing to strip.
 * (b) AST regression guards — the makePublic leak must NOT reappear in either
 *     upload path, no permanent public downloadUrl is stored, and the admin viewer
 *     goes through the getFeeAgreementUrl callable (not a stored downloadUrl).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { planDocRevocation, expectedPrefix } =
  require('../scripts/revoke-fee-agreement-public-acls');

const REPO = path.resolve(__dirname, '..', '..');

// ════════════════════════════════════════════════════════════════════════════
// (a) planDocRevocation — pure
// ════════════════════════════════════════════════════════════════════════════
describe('planDocRevocation', () => {
  const good = {
    id: 'agreement_1700000000000',
    storagePath: 'clients/2025992/agreements/agreement_1700000000000.pdf',
    downloadUrl: 'https://storage.googleapis.com/bucket/clients/2025992/agreements/x.pdf',
    fileType: 'application/pdf',
    fileSize: 12345,
    originalName: 'hesken.pdf'
  };

  it('strips downloadUrl, preserves storagePath + every other field', () => {
    const { changed, newAgreements, items } = planDocRevocation([good], 'clients', '2025992');
    expect(changed).toBe(true);
    expect(newAgreements).toHaveLength(1);
    expect(newAgreements[0]).not.toHaveProperty('downloadUrl');
    expect(newAgreements[0].storagePath).toBe(good.storagePath);
    expect(newAgreements[0].id).toBe(good.id);
    expect(newAgreements[0].fileType).toBe('application/pdf');
    expect(newAgreements[0].originalName).toBe('hesken.pdf');
    expect(items[0]).toMatchObject({ agreementId: good.id, hadDownloadUrl: true, prefixOk: true });
  });

  it('no-op when no item carries a downloadUrl', () => {
    const noUrl = { id: 'a1', storagePath: 'clients/1/agreements/a1.pdf', fileType: 'application/pdf' };
    const { changed, newAgreements } = planDocRevocation([noUrl], 'clients', '1');
    expect(changed).toBe(false);
    expect(newAgreements[0]).toEqual(noUrl);
  });

  it('flags a storagePath outside the entity folder (prefix mismatch)', () => {
    const poisoned = { id: 'a2', storagePath: 'clients/9999/agreements/leak.pdf', downloadUrl: 'http://x' };
    const { items } = planDocRevocation([poisoned], 'clients', '2025992');
    expect(items[0].prefixOk).toBe(false);
  });

  it('handles the cases/ collection prefix', () => {
    const c = { id: 'a3', storagePath: 'cases/CASE1/agreements/a3.pdf', downloadUrl: 'http://x' };
    const { items } = planDocRevocation([c], 'cases', 'CASE1');
    expect(items[0].prefixOk).toBe(true);
    expect(expectedPrefix('cases', 'CASE1')).toBe('cases/CASE1/agreements/');
  });

  it('tolerates non-array / garbage feeAgreements', () => {
    expect(planDocRevocation(undefined, 'clients', '1')).toMatchObject({ changed: false, newAgreements: [] });
    expect(planDocRevocation(null, 'clients', '1').changed).toBe(false);
    const { changed, newAgreements } = planDocRevocation([null, 42, good], 'clients', '2025992');
    expect(changed).toBe(true);              // the one good item still strips
    expect(newAgreements).toHaveLength(3);
  });

  it('strips downloadUrl from EACH item in a multi-agreement array', () => {
    const a = { ...good, id: 'a1' };
    const b = { ...good, id: 'b1', storagePath: 'clients/2025992/agreements/b1.pdf' };
    const { newAgreements } = planDocRevocation([a, b], 'clients', '2025992');
    expect(newAgreements.every((x) => !('downloadUrl' in x))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// (b) AST regression guards — the leak must not reappear
// ════════════════════════════════════════════════════════════════════════════
function readSrc(rel) {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('upload paths no longer leak (makePublic removed)', () => {
  const uploadFiles = [
    'functions/fee-agreements/index.js',
    'functions/src/whatsapp-bot/WhatsAppBot.js'
  ];

  it.each(uploadFiles)('%s does NOT call makePublic()', (rel) => {
    const code = stripComments(readSrc(rel));
    expect(code).not.toMatch(/\.makePublic\s*\(/);
  });

  it.each(uploadFiles)('%s does NOT store a permanent public downloadUrl', (rel) => {
    const code = stripComments(readSrc(rel));
    // no `downloadUrl: ...` field written into the agreement record
    expect(code).not.toMatch(/downloadUrl\s*:/);
    // no hand-built public storage.googleapis.com URL
    expect(code).not.toMatch(/storage\.googleapis\.com/);
  });
});

describe('admin viewer uses the signed-URL callable', () => {
  const rel = 'apps/admin-panel/js/ui/ClientManagementModal.js';
  it('viewFeeAgreement calls getFeeAgreementUrl, not a stored downloadUrl', () => {
    const code = stripComments(readSrc(rel));
    expect(code).toContain("httpsCallable('getFeeAgreementUrl')");
    expect(code).not.toMatch(/window\.open\(\s*agreement\.downloadUrl/);
  });
});
