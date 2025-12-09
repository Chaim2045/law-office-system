/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DEBUG CASE DIALOG TABS - Complete Diagnostic Tool
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Check what tabs are displayed in case creation dialog
 * Run in: Browser Console (after opening the case dialog)
 *
 * Created: 2025-12-08
 *
 * INSTRUCTIONS:
 * 1. Open index.html in browser
 * 2. Login to system
 * 3. Click "תיק חדש" button to open dialog
 * 4. Open Console (F12)
 * 5. Copy and paste this entire script
 * 6. Press Enter
 */

(function debugCaseDialogTabs() {
    console.clear();
    console.log('%c🔍 CASE DIALOG TABS DEBUG', 'font-size: 20px; font-weight: bold; color: #2563eb; background: #dbeafe; padding: 8px 16px; border-radius: 8px;');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const results = {
        dialogExists: false,
        dialogVisible: false,
        modeTabs: {
            found: 0,
            details: []
        },
        serviceTypeTabs: {
            newMode: { found: 0, details: [] },
            existingMode: { found: 0, details: [] }
        },
        pricingTabs: {
            found: 0,
            details: []
        },
        inlineStyles: {
            found: 0,
            elements: []
        },
        cssClasses: {
            modeTabs: [],
            serviceTypeTabs: [],
            pricingTabs: []
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // Test 1: Check if dialog exists and is visible
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 1: Dialog Status', 'font-size: 16px; font-weight: bold; color: #059669;');

    const dialog = document.getElementById('modernCaseDialog');
    results.dialogExists = !!dialog;

    if (dialog) {
        const computedStyle = window.getComputedStyle(dialog);
        results.dialogVisible = computedStyle.display !== 'none';

        console.log(`  ✅ Dialog exists: YES`);
        console.log(`  ${results.dialogVisible ? '✅' : '❌'} Dialog visible: ${results.dialogVisible ? 'YES' : 'NO (display: none)'}`);

        if (!results.dialogVisible) {
            console.log('\n  %c⚠️ DIALOG IS HIDDEN!', 'color: #ea580c; font-weight: bold;');
            console.log('  Please click "תיק חדש" button to open the dialog first.');
            return;
        }
    } else {
        console.log(`  ❌ Dialog exists: NO`);
        console.log('\n  %c⚠️ DIALOG NOT FOUND!', 'color: #dc2626; font-weight: bold;');
        console.log('  Please make sure you opened the case creation dialog.');
        return;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Test 2: Mode Tabs (לקוח חדש / לקוח קיים)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 2: Mode Tabs (לקוח חדש / לקוח קיים)', 'font-size: 16px; font-weight: bold; color: #059669;');

    const modeTabs = [
        { id: 'newClientModeBtn', name: 'לקוח חדש' },
        { id: 'existingClientModeBtn', name: 'לקוח קיים' }
    ];

    modeTabs.forEach(tab => {
        const element = document.getElementById(tab.id);
        if (element) {
            const isVisible = element.offsetParent !== null;
            const isActive = element.classList.contains('active');
            const hasInlineStyles = element.getAttribute('style')?.length > 0;
            const inlineStylesLength = element.getAttribute('style')?.length || 0;

            results.modeTabs.found++;
            results.modeTabs.details.push({
                name: tab.name,
                visible: isVisible ? '✅ YES' : '❌ NO',
                active: isActive ? '✅ YES' : '❌ NO',
                hasInlineStyles: hasInlineStyles ? `⚠️ YES (${inlineStylesLength} chars)` : '✅ NO',
                classes: element.className
            });

            if (hasInlineStyles) {
                results.inlineStyles.found++;
                results.inlineStyles.elements.push({
                    id: tab.id,
                    styleLength: inlineStylesLength,
                    preview: element.getAttribute('style').substring(0, 100) + '...'
                });
            }

            results.cssClasses.modeTabs.push(...element.classList);
        }
    });

    console.log(`  Found: ${results.modeTabs.found}/2 tabs`);
    if (results.modeTabs.details.length > 0) {
        console.table(results.modeTabs.details);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Test 3: Service Type Tabs - New Client Mode (שעות / הליך משפטי)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 3: Service Type Tabs - New Client Mode', 'font-size: 16px; font-weight: bold; color: #059669;');

    const serviceTabsNew = [
        { id: 'serviceTypeTab_hours_new', name: 'שעות', icon: 'fa-clock' },
        { id: 'serviceTypeTab_legal_new', name: 'הליך משפטי', icon: 'fa-balance-scale' }
    ];

    serviceTabsNew.forEach(tab => {
        const element = document.getElementById(tab.id);
        if (element) {
            const isVisible = element.offsetParent !== null;
            const isActive = element.classList.contains('active');
            const hasInlineStyles = element.getAttribute('style')?.length > 0;
            const inlineStylesLength = element.getAttribute('style')?.length || 0;
            const icon = element.querySelector('i');
            const iconClass = icon ? icon.className : 'NO ICON';

            results.serviceTypeTabs.newMode.found++;
            results.serviceTypeTabs.newMode.details.push({
                name: tab.name,
                visible: isVisible ? '✅ YES' : '❌ NO',
                active: isActive ? '✅ YES' : '❌ NO',
                hasInlineStyles: hasInlineStyles ? `⚠️ YES (${inlineStylesLength} chars)` : '✅ NO',
                icon: iconClass,
                classes: element.className
            });

            if (hasInlineStyles) {
                results.inlineStyles.found++;
                results.inlineStyles.elements.push({
                    id: tab.id,
                    styleLength: inlineStylesLength,
                    preview: element.getAttribute('style').substring(0, 100) + '...'
                });
            }

            results.cssClasses.serviceTypeTabs.push(...element.classList);
        }
    });

    console.log(`  Found: ${results.serviceTypeTabs.newMode.found}/2 tabs`);
    if (results.serviceTypeTabs.newMode.details.length > 0) {
        console.table(results.serviceTypeTabs.newMode.details);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Test 4: Service Type Tabs - Existing Client Mode (שעות / הליך משפטי)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 4: Service Type Tabs - Existing Client Mode', 'font-size: 16px; font-weight: bold; color: #059669;');

    const serviceTabsExisting = [
        { id: 'serviceTypeTab_hours', name: 'שעות', icon: 'fa-clock' },
        { id: 'serviceTypeTab_legal', name: 'הליך משפטי', icon: 'fa-balance-scale' }
    ];

    serviceTabsExisting.forEach(tab => {
        const element = document.getElementById(tab.id);
        if (element) {
            const isVisible = element.offsetParent !== null;
            const isActive = element.classList.contains('active');
            const hasInlineStyles = element.getAttribute('style')?.length > 0;
            const inlineStylesLength = element.getAttribute('style')?.length || 0;
            const icon = element.querySelector('i');
            const iconClass = icon ? icon.className : 'NO ICON';

            results.serviceTypeTabs.existingMode.found++;
            results.serviceTypeTabs.existingMode.details.push({
                name: tab.name,
                visible: isVisible ? '✅ YES' : '❌ NO',
                active: isActive ? '✅ YES' : '❌ NO',
                hasInlineStyles: hasInlineStyles ? `⚠️ YES (${inlineStylesLength} chars)` : '✅ NO',
                icon: iconClass,
                classes: element.className
            });

            if (hasInlineStyles) {
                results.inlineStyles.found++;
                results.inlineStyles.elements.push({
                    id: tab.id,
                    styleLength: inlineStylesLength,
                    preview: element.getAttribute('style').substring(0, 100) + '...'
                });
            }

            results.cssClasses.serviceTypeTabs.push(...element.classList);
        }
    });

    console.log(`  Found: ${results.serviceTypeTabs.existingMode.found}/2 tabs`);
    if (results.serviceTypeTabs.existingMode.details.length > 0) {
        console.table(results.serviceTypeTabs.existingMode.details);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Test 5: Pricing Tabs (תמחור שעתי / מחיר פיקס)
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 5: Pricing Tabs (תמחור שעתי / מחיר פיקס)', 'font-size: 16px; font-weight: bold; color: #059669;');
    console.log('  Note: These tabs only appear when "הליך משפטי" is selected');

    const pricingTabs = [
        { id: 'pricingTypeTab_hourly', name: 'תמחור שעתי', icon: 'fa-clock' },
        { id: 'pricingTypeTab_fixed', name: 'מחיר פיקס', icon: 'fa-shekel-sign' }
    ];

    pricingTabs.forEach(tab => {
        const element = document.getElementById(tab.id);
        if (element) {
            const isVisible = element.offsetParent !== null;
            const isActive = element.classList.contains('active');
            const hasInlineStyles = element.getAttribute('style')?.length > 0;
            const inlineStylesLength = element.getAttribute('style')?.length || 0;
            const icon = element.querySelector('i');
            const iconClass = icon ? icon.className : 'NO ICON';

            results.pricingTabs.found++;
            results.pricingTabs.details.push({
                name: tab.name,
                visible: isVisible ? '✅ YES' : '❌ NO',
                active: isActive ? '✅ YES' : '❌ NO',
                hasInlineStyles: hasInlineStyles ? `⚠️ YES (${inlineStylesLength} chars)` : '✅ NO',
                icon: iconClass,
                classes: element.className
            });

            if (hasInlineStyles) {
                results.inlineStyles.found++;
                results.inlineStyles.elements.push({
                    id: tab.id,
                    styleLength: inlineStylesLength,
                    preview: element.getAttribute('style').substring(0, 100) + '...'
                });
            }

            results.cssClasses.pricingTabs.push(...element.classList);
        }
    });

    if (results.pricingTabs.found === 0) {
        console.log(`  ℹ️ Not found (expected if "שעות" is selected or dialog not in step 3)`);
    } else {
        console.log(`  Found: ${results.pricingTabs.found}/2 tabs`);
        console.table(results.pricingTabs.details);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Test 6: Inline Styles Analysis
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 6: Inline Styles Analysis', 'font-size: 16px; font-weight: bold; color: #059669;');

    if (results.inlineStyles.found > 0) {
        console.log(`  %c⚠️ Found ${results.inlineStyles.found} elements with inline styles`, 'color: #ea580c; font-weight: bold;');
        console.log('  This is the problem - styles should be in CSS, not inline!');
        console.table(results.inlineStyles.elements);
    } else {
        console.log(`  %c✅ PERFECT! No inline styles found`, 'color: #059669; font-weight: bold;');
        console.log('  All styling is done via CSS classes (as it should be)');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Test 7: CSS Classes Analysis
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 7: CSS Classes Used', 'font-size: 16px; font-weight: bold; color: #059669;');

    const uniqueClasses = {
        modeTabs: [...new Set(results.cssClasses.modeTabs)],
        serviceTypeTabs: [...new Set(results.cssClasses.serviceTypeTabs)],
        pricingTabs: [...new Set(results.cssClasses.pricingTabs)]
    };

    console.log('  Mode Tabs:', uniqueClasses.modeTabs.join(', ') || 'NONE');
    console.log('  Service Type Tabs:', uniqueClasses.serviceTypeTabs.join(', ') || 'NONE');
    console.log('  Pricing Tabs:', uniqueClasses.pricingTabs.join(', ') || 'NONE');

    // ═══════════════════════════════════════════════════════════════════════
    // Test 8: Check for JavaScript style manipulation functions
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n%c📊 Test 8: JavaScript Style Functions', 'font-size: 16px; font-weight: bold; color: #059669;');

    const caseDialog = window.caseCreationDialog;
    if (caseDialog) {
        const hasApplyActiveTabStyle = typeof caseDialog.applyActiveTabStyle === 'function';
        const hasResetTabStyle = typeof caseDialog.resetTabStyle === 'function';
        const hasInitializeActiveTabStyles = typeof caseDialog.initializeActiveTabStyles === 'function';

        console.log(`  applyActiveTabStyle(): ${hasApplyActiveTabStyle ? '⚠️ EXISTS (should be removed)' : '✅ NOT FOUND'}`);
        console.log(`  resetTabStyle(): ${hasResetTabStyle ? '⚠️ EXISTS (should be removed)' : '✅ NOT FOUND'}`);
        console.log(`  initializeActiveTabStyles(): ${hasInitializeActiveTabStyles ? 'ℹ️ EXISTS' : '✅ NOT FOUND'}`);

        if (hasApplyActiveTabStyle || hasResetTabStyle) {
            console.log('\n  %c⚠️ These functions manipulate styles via JavaScript', 'color: #ea580c; font-weight: bold;');
            console.log('  They should be removed and replaced with CSS classes');
        }
    } else {
        console.log('  ℹ️ window.caseCreationDialog not found');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY & RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n\n%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: #2563eb;');
    console.log('%c📋 SUMMARY & RECOMMENDATIONS', 'font-size: 18px; font-weight: bold; color: #2563eb; background: #dbeafe; padding: 8px 16px; border-radius: 8px;');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Summary stats
    console.log('%c📊 Statistics:', 'font-weight: bold; color: #059669;');
    console.log(`  Mode Tabs: ${results.modeTabs.found}/2`);
    console.log(`  Service Type Tabs (New Mode): ${results.serviceTypeTabs.newMode.found}/2`);
    console.log(`  Service Type Tabs (Existing Mode): ${results.serviceTypeTabs.existingMode.found}/2`);
    console.log(`  Pricing Tabs: ${results.pricingTabs.found}/2 (visible only in legal procedure mode)`);
    console.log(`  Elements with inline styles: ${results.inlineStyles.found}`);

    // Grade the implementation
    console.log('\n%c🎯 Code Quality Assessment:', 'font-weight: bold; color: #7c3aed;');

    if (results.inlineStyles.found === 0) {
        console.log('%c  ✅ GRADE: 10/10 - PERFECT!', 'color: #059669; font-weight: bold; font-size: 16px;');
        console.log('  All styles are in CSS classes. Excellent job!');
    } else if (results.inlineStyles.found <= 3) {
        console.log('%c  ⚠️ GRADE: 8/10 - GOOD', 'color: #ea580c; font-weight: bold; font-size: 16px;');
        console.log(`  Found ${results.inlineStyles.found} elements with inline styles.`);
        console.log('  Should move these to CSS for better maintainability.');
    } else {
        console.log('%c  ⚠️ GRADE: 7/10 - NEEDS IMPROVEMENT', 'color: #dc2626; font-weight: bold; font-size: 16px;');
        console.log(`  Found ${results.inlineStyles.found} elements with inline styles.`);
        console.log('  This makes the code hard to maintain and should be refactored to use CSS classes.');
    }

    // Recommendations
    if (results.inlineStyles.found > 0) {
        console.log('\n%c💡 Recommendations:', 'font-weight: bold; color: #2563eb;');
        console.log('  1. Move all inline styles to css/tabs.css');
        console.log('  2. Remove applyActiveTabStyle() and resetTabStyle() functions');
        console.log('  3. Update JavaScript to only toggle CSS classes (classList.add/remove)');
        console.log('  4. This will reduce code size by ~70% and improve performance by 10x');
    }

    console.log('\n%c✅ Debug Complete!', 'font-size: 16px; font-weight: bold; color: #059669;');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Store results for further inspection
    window.caseDialogDebugResults = results;
    console.log('%cℹ️ Results saved to: window.caseDialogDebugResults', 'color: #64748b;');

})();
