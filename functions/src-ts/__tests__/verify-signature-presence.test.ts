/**
 * Unit tests — verifySignaturePresence (Phase 2 H.5)
 * ───────────────────────────────────────────────────
 * Mocks every external boundary (the Anthropic SDK, Firebase Storage download,
 * Firestore read, the secret) so NO real document ever egresses and no network
 * is touched (Engineering Bar §2.3 "mock the SDK boundary, not the logic"). The
 * handler is exported separately from the v2 wrapper for direct invocation.
 *
 * Covers the customer scenario (G4): an admin checks a stored agreement →
 * receives the two presence booleans + a derived `passed` gate; plus the
 * security-critical invariants: AUDIT-FIRST/egress-second (fail-secure), the
 * admin-only gate, and that NO PII (PDF bytes, the model's reasoning, the client
 * name, the API key) ever reaches logger.*.
 */
import * as fs from 'fs';
import * as path from 'path';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

// ─── Mock the lazy-imported Anthropic SDK (no network, canned verdict) ───────
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class FakeAnthropic {
    public messages = { create: mockCreate };
    constructor(_opts: unknown) {
      /* records nothing — the key never leaves the wrapper */
    }
  }
}));

// ─── Mock firebase-admin (Firestore read + Storage download) ─────────────────
const mockDocGet = jest.fn();
const mockDownload = jest.fn();
jest.mock('firebase-admin', () => ({
  firestore: () => ({
    collection: () => ({ doc: () => ({ get: mockDocGet }) })
  }),
  storage: () => ({
    bucket: () => ({ file: () => ({ download: mockDownload }) })
  })
}));

// ─── Mock the secret (fake key value — asserted to never reach logs) ─────────
const FAKE_KEY = 'sk-ant-fake-key-DO-NOT-LOG';
jest.mock('firebase-functions/params', () => ({
  defineSecret: () => ({ value: () => FAKE_KEY })
}));

// ─── Mock the audit primitive (audit-FIRST) ──────────────────────────────────
const mockLogCritical = jest.fn();
jest.mock('../audit-critical', () => ({
  logCriticalAction: (...args: unknown[]) => mockLogCritical(...args)
}));

// ─── Capture every logger payload so we can assert it carries no PII ─────────
interface LoggerCall {
  level: string;
  event: string;
  fields: unknown;
}
const loggerCalls: LoggerCall[] = [];
jest.mock('../../shared/logger', () => ({
  info: (event: string, fields: unknown) => loggerCalls.push({ level: 'info', event, fields }),
  warn: (event: string, fields: unknown) => loggerCalls.push({ level: 'warn', event, fields }),
  error: (event: string, fields: unknown) => loggerCalls.push({ level: 'error', event, fields }),
  debug: () => undefined
}));

// Import AFTER the mocks are registered.
import { verifySignaturePresenceHandler } from '../signatures/verify-signature-presence';

const PDF_BYTES = Buffer.from('%PDF-1.4 fake signed agreement bytes');
const CLIENT_NAME = 'ישראל ישראלי';
const MODEL_REASONING = `נראות חתימת הלקוח ${CLIENT_NAME} וחתימת עורך הדין בתחתית העמוד`;

function makeReq(
  data: unknown,
  token: Record<string, unknown> | null = { role: 'admin' },
  uid = 'admin-uid'
): CallableRequest<unknown> {
  return { auth: token ? { uid, token } : null, data } as unknown as CallableRequest<unknown>;
}

function agreementDoc(extra: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      feeAgreements: [
        {
          id: 'agreement_123456',
          storagePath: 'clients/2025001/agreements/agreement_123456.pdf',
          fileType: 'application/pdf',
          ...extra
        }
      ]
    })
  };
}

function modelVerdict(v: {
  clientSignaturePresent: boolean;
  lawyerSignaturePresent: boolean;
  confidence: number;
  reasoning?: string;
}) {
  return {
    content: [{ type: 'text', text: JSON.stringify({ reasoning: MODEL_REASONING, ...v }) }],
    usage: { input_tokens: 1200, output_tokens: 40 },
    stop_reason: 'end_turn'
  };
}

const OK_INPUT = { clientId: '2025001', agreementId: 'agreement_123456' };

beforeEach(() => {
  jest.clearAllMocks();
  loggerCalls.length = 0;
  mockDocGet.mockResolvedValue(agreementDoc());
  mockDownload.mockResolvedValue([PDF_BYTES]);
  mockLogCritical.mockResolvedValue('audit-id-1');
  mockCreate.mockResolvedValue(
    modelVerdict({ clientSignaturePresent: true, lawyerSignaturePresent: true, confidence: 0.95 })
  );
});

describe('auth gate', () => {
  it('rejects unauthenticated', async () => {
    await expect(verifySignaturePresenceHandler(makeReq(OK_INPUT, null))).rejects.toThrow(HttpsError);
    expect(mockLogCritical).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('rejects a non-admin (legacy admin:true-only token is NOT admin)', async () => {
    await expect(
      verifySignaturePresenceHandler(makeReq(OK_INPUT, { admin: true }))
    ).rejects.toThrow('רק מנהל מערכת רשאי לבדוק חתימות.');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('input validation', () => {
  it('rejects a malformed agreementId (path-traversal charset)', async () => {
    await expect(
      verifySignaturePresenceHandler(makeReq({ clientId: '2025001', agreementId: '../../etc' }))
    ).rejects.toThrow(HttpsError);
    expect(mockLogCritical).not.toHaveBeenCalled();
  });

  it('rejects unknown extra fields (strict)', async () => {
    await expect(
      verifySignaturePresenceHandler(makeReq({ ...OK_INPUT, evil: 1 }))
    ).rejects.toThrow(HttpsError);
  });
});

describe('resolution errors', () => {
  it('client doc missing → not-found', async () => {
    mockDocGet.mockResolvedValue({ exists: false, data: () => ({}) });
    await expect(verifySignaturePresenceHandler(makeReq(OK_INPUT))).rejects.toThrow('הלקוח לא נמצא במערכת.');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('agreement id not in feeAgreements → not-found', async () => {
    await expect(
      verifySignaturePresenceHandler(makeReq({ clientId: '2025001', agreementId: 'agreement_999999' }))
    ).rejects.toThrow('הסכם שכר הטרחה לא נמצא עבור לקוח זה.');
  });

  it('unsupported file type (no recognizable extension) → failed-precondition', async () => {
    mockDocGet.mockResolvedValue(
      agreementDoc({ fileType: 'text/plain', storagePath: 'clients/2025001/agreements/x.txt' })
    );
    await expect(verifySignaturePresenceHandler(makeReq(OK_INPUT))).rejects.toThrow(
      'סוג הקובץ אינו נתמך לבדיקת חתימה. נדרש קובץ PDF או תמונה (JPG/PNG/WEBP).'
    );
  });
});

describe('audit-FIRST, egress-second (fail-secure)', () => {
  it('audit runs BEFORE any download / model call', async () => {
    const order: string[] = [];
    mockLogCritical.mockImplementation(async () => {
      order.push('audit');
      return 'a';
    });
    mockDownload.mockImplementation(async () => {
      order.push('download');
      return [PDF_BYTES];
    });
    mockCreate.mockImplementation(async () => {
      order.push('model');
      return modelVerdict({ clientSignaturePresent: true, lawyerSignaturePresent: true, confidence: 0.9 });
    });
    await verifySignaturePresenceHandler(makeReq(OK_INPUT));
    expect(order).toEqual(['audit', 'download', 'model']);
  });

  it('if the audit write fails, NO document is downloaded or sent', async () => {
    mockLogCritical.mockRejectedValue(new Error('audit down'));
    await expect(verifySignaturePresenceHandler(makeReq(OK_INPUT))).rejects.toThrow(HttpsError);
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('audit payload is non-PII (business ids only)', async () => {
    await verifySignaturePresenceHandler(makeReq(OK_INPUT));
    expect(mockLogCritical).toHaveBeenCalledWith('VERIFY_SIGNATURE_PRESENCE', 'admin-uid', {
      clientId: '2025001',
      agreementId: 'agreement_123456',
      collection: 'clients'
    });
  });
});

describe('the verdict + derived passed gate', () => {
  it('both present + high confidence → passed:true', async () => {
    const res = await verifySignaturePresenceHandler(makeReq(OK_INPUT));
    expect(res).toEqual({
      clientSignaturePresent: true,
      lawyerSignaturePresent: true,
      confidence: 0.95,
      reasoning: MODEL_REASONING,
      passed: true
    });
  });

  it('one signature missing → passed:false', async () => {
    mockCreate.mockResolvedValue(
      modelVerdict({ clientSignaturePresent: true, lawyerSignaturePresent: false, confidence: 0.99 })
    );
    const res = await verifySignaturePresenceHandler(makeReq(OK_INPUT));
    expect(res.passed).toBe(false);
  });

  it('both present but confidence below threshold → passed:false', async () => {
    mockCreate.mockResolvedValue(
      modelVerdict({ clientSignaturePresent: true, lawyerSignaturePresent: true, confidence: 0.5 })
    );
    const res = await verifySignaturePresenceHandler(makeReq(OK_INPUT));
    expect(res.passed).toBe(false);
    expect(res.confidence).toBe(0.5);
  });

  it('confidence out of range is clamped to [0,1]', async () => {
    mockCreate.mockResolvedValue(
      modelVerdict({ clientSignaturePresent: true, lawyerSignaturePresent: true, confidence: 1.5 })
    );
    const res = await verifySignaturePresenceHandler(makeReq(OK_INPUT));
    expect(res.confidence).toBe(1);
    expect(res.passed).toBe(true);
  });

  it('sends the model the configured model id + a document content block', async () => {
    await verifySignaturePresenceHandler(makeReq(OK_INPUT));
    const params = mockCreate.mock.calls[0][0];
    expect(params.model).toBe('claude-opus-4-8');
    expect(params.messages[0].content[0]).toEqual({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: PDF_BYTES.toString('base64') }
    });
  });
});

describe('model + output errors', () => {
  it('SDK throws → unavailable, and the API key never reaches logs', async () => {
    mockCreate.mockRejectedValue(new Error('anthropic 529 overloaded'));
    await expect(verifySignaturePresenceHandler(makeReq(OK_INPUT))).rejects.toThrow(
      'שירות בדיקת החתימה אינו זמין כעת. אנא נסה שוב מאוחר יותר או פנה לתמיכה.'
    );
    const serialized = JSON.stringify(loggerCalls);
    expect(serialized).not.toContain(FAKE_KEY);
  });

  it('non-JSON model output → internal error', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json' }],
      usage: { input_tokens: 1, output_tokens: 1 },
      stop_reason: 'end_turn'
    });
    await expect(verifySignaturePresenceHandler(makeReq(OK_INPUT))).rejects.toThrow(
      'תוצאת בדיקת החתימה לא התקבלה בפורמט תקין. אנא נסה שוב או פנה לתמיכה.'
    );
  });
});

describe('PII discipline (PUBLIC repo) — nothing sensitive reaches logger.*', () => {
  it('no PDF bytes / model reasoning / client name / API key in any log payload', async () => {
    await verifySignaturePresenceHandler(makeReq(OK_INPUT));
    const serialized = JSON.stringify(loggerCalls);
    expect(serialized).not.toContain(PDF_BYTES.toString('base64'));
    expect(serialized).not.toContain(MODEL_REASONING);
    expect(serialized).not.toContain(CLIENT_NAME);
    expect(serialized).not.toContain(FAKE_KEY);
    // The completion log DID run (usage logged) — proving the assertion is live.
    expect(loggerCalls.some((c) => c.event === 'signature.verify.completed')).toBe(true);
  });

  it('also holds on the SDK-error branch (no key / base64 in error logs)', async () => {
    mockCreate.mockRejectedValue(new Error(`boom ${FAKE_KEY}`));
    await expect(verifySignaturePresenceHandler(makeReq(OK_INPUT))).rejects.toThrow(HttpsError);
    const serialized = JSON.stringify(loggerCalls);
    expect(serialized).not.toContain(FAKE_KEY);
    expect(serialized).not.toContain(PDF_BYTES.toString('base64'));
  });
});

// Static source guard (devils-advocate #3): mirrors validate-sales-record.test.ts —
// no logger.* statement in the SOURCE may reference a PII / secret token, so a
// future "add error.message for debuggability" edit fails CI rather than leaking.
describe('static no-PII-in-logs source guard', () => {
  const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'signatures', 'verify-signature-presence.ts'),
    'utf8'
  );
  // Each logger.* call is one statement ending in ';' — slice from the call start
  // to the next ';' to capture its full argument list.
  const loggerStatements = SRC.split(/logger\.(?:info|warn|error|debug)\(/)
    .slice(1)
    .map((chunk) => chunk.split(';')[0]);

  it('the source actually contains logger calls to scan', () => {
    expect(loggerStatements.length).toBeGreaterThan(3);
  });

  it.each([
    'documentBase64',
    'documentBlock',
    'reasoning',
    '.message',
    '.stack',
    '.value(',
    'apiKey',
    'base64'
  ])('no logger.* statement references %s', (forbidden) => {
    for (const stmt of loggerStatements) {
      expect(stmt).not.toContain(forbidden);
    }
  });
});

describe('confused-deputy guard (devils-advocate #4)', () => {
  it('rejects a feeAgreements[].storagePath outside the resolved entity folder', async () => {
    mockDocGet.mockResolvedValue(
      agreementDoc({ storagePath: 'clients/9999999/agreements/secret.pdf', fileType: 'application/pdf' })
    );
    await expect(verifySignaturePresenceHandler(makeReq(OK_INPUT))).rejects.toThrow('נתיב קובץ ההסכם אינו תקין.');
    expect(mockDownload).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
