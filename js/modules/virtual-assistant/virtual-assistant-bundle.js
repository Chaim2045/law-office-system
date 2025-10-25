/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VIRTUAL ASSISTANT - BUNDLED VERSION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * All modules in one file for easy deployment
 * @version 2.0.0
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// Load all dependencies
(async function() {
    // Wait for DOM
    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    // Load modules in order
    const modulePath = 'js/modules/virtual-assistant/';
    const modules = [
        'virtual-assistant-core.js',
        'virtual-assistant-data.js',
        'virtual-assistant-engines.js',
        'virtual-assistant-ui.js',
        'virtual-assistant-main.js'
    ];

    for (const moduleName of modules) {
        try {
            await import(`./${moduleName}?v=2.0.0`);
            Logger.log(`[VA] Loaded: ${moduleName}`);
        } catch (error) {
            console.error(`[VA] Failed to load ${moduleName}:`, error);
        }
    }

    Logger.log('[VA] All modules loaded');
})();
