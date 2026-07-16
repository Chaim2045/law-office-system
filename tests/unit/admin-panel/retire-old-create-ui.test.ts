/**
 * H.6.c-5 — Retire old manual client creation UI
 *
 * Guards:
 * 1. SimpleClientDialog.js (raw Firestore write bypass) must not exist
 * 2. case-creation-dialog.js (dead manual create wizard) must not exist
 * 3. FAB on clients page navigates to pending-clients.html (not the old dialog)
 * 4. No HTML page loads the deleted files
 */
import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

const ADMIN_PANEL = path.resolve(__dirname, '../../../apps/admin-panel');

describe('H.6.c-5: old manual create UI retired', () => {
    it('SimpleClientDialog.js must not exist (raw Firestore write bypass)', () => {
        const filePath = path.join(ADMIN_PANEL, 'js/ui/SimpleClientDialog.js');
        expect(fs.existsSync(filePath)).toBe(false);
    });

    it('case-creation-dialog.js must not exist (dead manual create wizard)', () => {
        const filePath = path.join(ADMIN_PANEL, 'js/modules/case-creation-dialog.js');
        expect(fs.existsSync(filePath)).toBe(false);
    });

    it('FAB navigates to pending-clients.html on clients page (not old dialog)', () => {
        const fabPath = path.join(ADMIN_PANEL, 'js/ui/FloatingActionButton.js');
        const content = fs.readFileSync(fabPath, 'utf-8');
        expect(content).toContain('pending-clients.html');
        expect(content).not.toContain('CaseCreationSystem');
        expect(content).not.toContain('caseCreationDialog');
    });

    it('no HTML page loads SimpleClientDialog.js or case-creation-dialog.js', () => {
        const htmlFiles = fs.readdirSync(ADMIN_PANEL)
            .filter(f => f.endsWith('.html'));
        for (const htmlFile of htmlFiles) {
            const content = fs.readFileSync(path.join(ADMIN_PANEL, htmlFile), 'utf-8');
            expect(content).not.toContain('SimpleClientDialog');
            expect(content).not.toContain('case-creation-dialog');
        }
    });
});
