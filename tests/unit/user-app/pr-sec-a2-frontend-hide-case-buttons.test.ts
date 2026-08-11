/**
 * PR-SEC-A2-frontend — hide the case-creation buttons from non-admins (the declared
 * fast-follow of #537).
 * ─────────────────────────────────────────────────────────────────────────────
 * #537 made createClient + addServiceToClient admin-only on the BACKEND. Until now the user-app
 * sidebar still showed "פתח תיק"/"הוסף לתיק קיים" to the 10 non-admin lawyers → they clicked and
 * hit a Hebrew permission-denied error (a dead-end button). This PR hides the "new-case" nav item
 * (which carries both flyout options) from non-admins, FAIL-CLOSED (hidden until the Firestore
 * `employees` role==='admin' — the SAME source the backend gates on via checkUserPermissions — is
 * confirmed), plus a defense-in-depth click-guard so the dialog never opens for a non-admin.
 *
 * Created: 2026-08-11 — fix/pr-sec-a2-frontend-hide-case-buttons
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect, beforeEach } from 'vitest';

import { Sidebar } from '../../../apps/user-app/js/modules/components/sidebar/sidebar.js';

const SB = fs.readFileSync(
  path.resolve(__dirname, '../../../apps/user-app/js/modules/components/sidebar/sidebar.js'), 'utf8');
const CFG = fs.readFileSync(
  path.resolve(__dirname, '../../../apps/user-app/js/modules/components/sidebar/sidebar-config.js'), 'utf8');

describe('PR-SEC-A2-frontend — source lock', () => {
  it('the new-case nav item is marked requiresAdmin in config', () => {
    expect(CFG).toMatch(/id:\s*'new-case'[\s\S]{0,160}requiresAdmin:\s*true/);
  });
  it('render marks requiresAdmin items with gh-sidebar-admin-only + hidden (fail-closed)', () => {
    expect(SB).toContain('gh-sidebar-admin-only');
    expect(SB).toContain('item.requiresAdmin');
    expect(SB).toContain('display: none;');
  });
  it('admin check reads window.manager.currentEmployee.role (the Firestore source backend #537 uses)', () => {
    expect(SB).toContain('window.manager && window.manager.currentEmployee');
    expect(SB).toContain("emp.role === 'admin'");
    expect(SB, 'must NOT gate on the ID-token claim (a separate store that can lag behind Firestore)').not.toContain('getIdTokenResult');
  });
  it('_handleAction guards new-client + existing-client on this._isAdminNow() (fail-closed)', () => {
    expect(SB).toMatch(/case 'new-client':[\s\S]{0,80}if \(!this\._isAdminNow\(\)\)/);
    expect(SB).toMatch(/case 'existing-client':[\s\S]{0,80}if \(!this\._isAdminNow\(\)\)/);
  });
  it('the reveal is wired into Auth.showApp (live login funnel), NOT dead code', () => {
    // Every live login path converges on Auth.showApp() AFTER setting manager.currentEmployee.
    const auth = fs.readFileSync(
      path.resolve(__dirname, '../../../apps/user-app/js/modules/authentication.js'), 'utf8');
    expect(auth).toMatch(/function showApp\(\)[\s\S]*?window\.sidebarInstance\?\.applyRoleVisibility\?\.\(\)/);
  });
  it('TRIPWIRE: the dead eval-based create-case surfaces (VA / smart-faq-bot) stay fully unloaded', () => {
    // VA + smart-faq-bot open `new CaseCreationDialog().open()` via eval, bypassing the sidebar guard.
    // They are dead — script tags commented at index.html:1366/1369, AND absent from every dynamic
    // loader (the KB-style lazy-load funnel). If re-enabled (static OR lazy-loaded), this fails → forcing
    // their create_case button to route through a guard, not reintroduce an un-gated entry. See rubric M1.
    const html = fs.readFileSync(
      path.resolve(__dirname, '../../../apps/user-app/index.html'), 'utf8');
    const activeHtml = html.replace(/<!--[\s\S]*?-->/g, ''); // strip HTML comments → only live markup remains
    const auth = fs.readFileSync(
      path.resolve(__dirname, '../../../apps/user-app/js/modules/authentication.js'), 'utf8');
    for (const src of ['virtual-assistant-complete.js', 'smart-faq-bot.js']) {
      const scriptTag = new RegExp('<script[^>]*' + src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      expect(activeHtml, `${src} must stay out of any live <script> — see rubric M1`).not.toMatch(scriptTag);
      expect(auth, `${src} must stay out of the lazy-loader list — see rubric M1`).not.toContain(src);
    }
  });
  it('the LIVE (lazy-loaded) KB create_case action is admin-gated (requiresAdmin + render guard)', () => {
    // The KB IS live — lazy-loaded on the help click via authentication.js loadScriptsSequentially([...]).
    // Its create_case actionButton opens CaseCreationDialog via eval, so it MUST be gated: a requiresAdmin
    // flag on the data + a render guard that reveals the button only for a Firestore-role admin, fail-closed.
    const kbData = fs.readFileSync(
      path.resolve(__dirname, '../../../apps/user-app/js/modules/knowledge-base/kb-data.js'), 'utf8');
    const kb = fs.readFileSync(
      path.resolve(__dirname, '../../../apps/user-app/js/modules/knowledge-base/knowledge-base.js'), 'utf8');
    // (1) the create_case actionButton (the ONLY KB action that opens CaseCreationDialog) is flagged.
    expect(kbData).toMatch(/CaseCreationDialog\(\)\)\.open\(\)['"],[\s\S]{0,300}requiresAdmin:\s*true/);
    // (2) the render actually consumes that flag, gated on the Firestore role (same source as the sidebar).
    expect(kb).toContain('article.content.actionButton.requiresAdmin');
    expect(kb).toContain("currentEmployee.role === 'admin'");
    // and confirm authentication.js does lazy-load the KB (proves this surface is genuinely LIVE, not dead).
    const authSrc = fs.readFileSync(
      path.resolve(__dirname, '../../../apps/user-app/js/modules/authentication.js'), 'utf8');
    expect(authSrc).toContain('kb-data.js');
  });
});

describe('PR-SEC-A2-frontend — behavioral: hidden until Firestore role=admin, click fail-closed', () => {
  let sidebar: any;
  let root: HTMLElement;
  const setEmployee = (role: string | null) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).manager = role === null ? {} : { currentEmployee: { role } };
  };
  beforeEach(() => {
    document.body.innerHTML = '';
    setEmployee(null); // employee not loaded yet → fail-closed
    root = document.createElement('div');
    document.body.appendChild(root);
    sidebar = new Sidebar(root);
    sidebar.init();
  });

  it('fail-closed: employee not loaded → the new-case item is hidden', () => {
    sidebar.applyRoleVisibility();
    const item = root.querySelector('.gh-sidebar-admin-only') as HTMLElement;
    expect(item, 'the new-case item is rendered').toBeTruthy();
    expect(item.style.display).toBe('none');
  });

  it('a non-admin (Firestore role=lawyer) keeps the item hidden', () => {
    setEmployee('lawyer');
    sidebar.applyRoleVisibility();
    const item = root.querySelector('.gh-sidebar-admin-only') as HTMLElement;
    expect(item.style.display).toBe('none');
  });

  it('an admin (Firestore role=admin — incl. the office-manager) reveals the item', () => {
    setEmployee('admin');
    sidebar.applyRoleVisibility();
    const item = root.querySelector('.gh-sidebar-admin-only') as HTMLElement;
    expect(item.style.display).toBe('');
  });

  it('click-guard: _handleAction does NOT open the dialog for a non-admin', () => {
    setEmployee('lawyer');
    let opened = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).CaseCreationDialog = class {
 open() {
 opened += 1;
}
};
    sidebar._handleAction('new-client');
    sidebar._handleAction('existing-client');
    expect(opened, 'dialog must never open for a non-admin').toBe(0);
  });

  it('click-guard: _handleAction opens the dialog for an admin', () => {
    setEmployee('admin');
    let opened = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).CaseCreationDialog = class {
 open() {
 opened += 1;
}
};
    sidebar._handleAction('new-client');
    expect(opened, 'dialog opens for an admin').toBe(1);
  });
});
