/**
 * Unit tests — WhatsAppMessageDialog modal HTML escaping (stored-XSS gap)
 *
 * `showDialog(userEmail, userName)` builds a `dialogHTML` template string and
 * injects it into the live DOM via `document.body.insertAdjacentHTML(...)`. The
 * employee display name (`userName`, from the `user:action` event detail) was
 * interpolated RAW into a `<strong>` element — so a display name containing
 * markup (e.g. an employee whose name carries an `onerror` payload) executes
 * when an admin opens the WhatsApp dialog for that user.
 *
 * Fix = escape at the sink via a module-private `escapeHtml` helper (mirrors
 * ReportGenerator.escapeHtml — & < > " ' → entities). These tests drive the
 * REAL customer scenario: opening the dialog for a payload-named user must
 * render the name as inert text — never a live tag.
 *
 * Sibling of PR #382 (ReportGenerator). The #382 rubric tracked this exact sink
 * as the follow-up: "WhatsAppMessageDialog.js:72 userName -> innerHTML XSS".
 *
 * Created: 2026-06-17 — security/whatsapp-dialog-xss-escape
 */

import { describe, it, expect, beforeEach } from 'vitest';

// WhatsAppMessageDialog.js is an IIFE that assigns the module to window
// (happy-dom provides window/document). Import for side-effect, then read it off
// window — same harness pattern as report-generator-escaping.test.ts.
// @ts-ignore — classic admin-panel script, no type declarations
import '../../../apps/admin-panel/js/managers/WhatsAppMessageDialog.js';

const dialog: any = (window as any).WhatsAppMessageDialog;

// A canonical stored-XSS payload. Escaped form: `<` -> &lt;, `>` -> &gt;.
const XSS = '<img src=x onerror=alert(1)>';
const XSS_LIVE = '<img'; // the opening of a live tag — must NEVER appear serialized
const XSS_ESCAPED = '&lt;img src=x onerror=alert(1)&gt;';

beforeEach(() => {
  // Isolate each test — drop any modal a previous showDialog appended.
  document.body.innerHTML = '';
});

describe('WhatsAppMessageDialog — module', () => {
  it('exposes the showDialog public API', () => {
    expect(dialog).toBeTruthy();
    expect(typeof dialog.showDialog).toBe('function');
  });
});

describe('showDialog — escapes the user-controllable display name (line-72 sink)', () => {
  it('renders an onerror payload as inert text — NO live <img> element is created', () => {
    dialog.showDialog('attacker@example.com', XSS);

    expect(document.getElementById('whatsappMessageModal')).toBeTruthy();
    // The payload must never materialize as a real element in the injected DOM.
    expect(document.querySelector('#whatsappMessageModal img')).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });

  it('puts the raw payload in the subtitle as TEXT (proves it was escaped, not parsed)', () => {
    dialog.showDialog('attacker@example.com', XSS);

    const subtitle = document.querySelector('#whatsappMessageModal .modal-subtitle strong');
    expect(subtitle).toBeTruthy();
    // textContent decodes entities back to the literal string -> the payload is
    // present, but only as inert text inside <strong>, not as an <img> child.
    expect(subtitle?.textContent).toBe(XSS);
    expect(subtitle?.querySelector('img')).toBeNull();
  });

  it('serialized DOM contains the ESCAPED form and never the live tag', () => {
    dialog.showDialog('attacker@example.com', XSS);

    const html = document.body.innerHTML;
    expect(html).toContain(XSS_ESCAPED);
    expect(html).not.toContain(XSS_LIVE);
  });

  it('renders a benign display name unchanged (no behavior change for normal data)', () => {
    dialog.showDialog('guy@example.com', 'גיא הרשקוביץ');

    const subtitle = document.querySelector('#whatsappMessageModal .modal-subtitle strong');
    expect(subtitle?.textContent).toBe('גיא הרשקוביץ');
  });

  it('renders empty (not the string "undefined") for a missing name — G1 alignment', () => {
    dialog.showDialog('nameless@example.com', undefined);

    const subtitle = document.querySelector('#whatsappMessageModal .modal-subtitle strong');
    expect(subtitle).toBeTruthy();
    expect(subtitle?.textContent).toBe('');
    expect(document.body.innerHTML).not.toContain('undefined');
  });

  it('still renders the hardcoded template buttons (constants untouched by the fix)', () => {
    dialog.showDialog('guy@example.com', XSS);

    // The 4 MESSAGE_TEMPLATES buttons are non-user-controllable constants and
    // must keep rendering — proves the escape did not break the modal body.
    const buttons = document.querySelectorAll('#whatsappMessageModal .template-btn');
    expect(buttons.length).toBe(4);
  });
});
