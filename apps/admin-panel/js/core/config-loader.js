/**
 * System Config Loader — Shared (admin-panel + user-app)
 * ======================================================
 * Loads system configuration from Firestore _system/system_config.
 * Falls back to static SYSTEM_CONSTANTS if Firestore is unavailable.
 *
 * SSOT: shared-web/src/core/config-loader.js — NEVER edit the emitted copies
 * under apps/admin-panel/js/core/ or apps/user-app/js/core/. Edit HERE and run
 * `npm run emit:shared` (see shared-web/README.md).
 *
 * Per-app parameterization via the emit-injected APP_CONTEXT constant:
 *   'admin' → version tracking + verbose load logs + "ready" log (admin superset)
 *   'user'  → lean loader (no version tracking, no load logs)
 * get()/getVersion() are additive and present in both copies; only admin calls
 * them today (apps/admin-panel/js/ui/SystemSettingsPage.js). They are dormant,
 * never-called, side-effect-free in the user-app copy.
 *
 * Exports: window.SystemConfigLoader
 * After load: window.SYSTEM_CONFIG
 * Event: 'system-config:loaded'
 */

(function() {
  'use strict';

  // APP_CONTEXT is injected per target by shared-web/emit.js:
  //   'admin' when emitted into apps/admin-panel/js/…
  //   'user'  when emitted into apps/user-app/js/…
  // The sentinel comment below is the injection anchor. The default 'user' is a
  // fail-lean value: anything other than the exact literal 'admin' keeps the
  // admin-only surface OFF. See shared-web/README.md.
  const APP_CONTEXT = /*__APP_CONTEXT__*/ 'admin';

  const SystemConfigLoader = {
    config: null,
    loaded: false,
    loading: false,

    /**
     * Load config from Firestore with fallback to static constants.
     * Call after Firebase is ready and user is authenticated.
     */
    load: function() {
      const self = this;

      if (self.loaded) {
        return Promise.resolve(self.config);
      }
      if (self.loading) {
        return new Promise(function(resolve) {
          window.addEventListener('system-config:loaded', function handler() {
            window.removeEventListener('system-config:loaded', handler);
            resolve(self.config);
          });
        });
      }

      self.loading = true;

      return self._loadFromFirestore()
        .then(function(config) {
          self.config = config;
          self.loaded = true;
          self.loading = false;
          window.SYSTEM_CONFIG = config;
          window.dispatchEvent(new CustomEvent('system-config:loaded', { detail: config }));
          return config;
        })
        .catch(function(error) {
          console.warn('⚠️ Config load failed, using static defaults:', error.message);
          self.config = window.SYSTEM_CONSTANTS;
          self.loaded = true;
          self.loading = false;
          window.SYSTEM_CONFIG = self.config;
          window.dispatchEvent(new CustomEvent('system-config:loaded', { detail: self.config }));
          return self.config;
        });
    },

    _loadFromFirestore: function() {
      const self = this;
      const db = window.firebaseDB;

      if (!db) {
        return Promise.reject(new Error('Firestore not initialized'));
      }

      return db.collection('_system').doc('system_config').get()
        .then(function(doc) {
          if (!doc.exists) {
            if (APP_CONTEXT === 'admin') {
              console.log('⚠️ No system_config in Firestore, using static defaults');
            }
            return window.SYSTEM_CONSTANTS;
          }

          const data = doc.data();
          if (APP_CONTEXT === 'admin') {
            self.version = data._version || null;
            console.log('✅ System config loaded from Firestore (v' + self.version + ')');
          }
          return data;
        });
    },

    /**
     * Get a config value by dot-notation path.
     * Example: SystemConfigLoader.get('serviceTypes.hours.label')
     */
    get: function(path) {
      if (!this.config) {
        return undefined;
      }
      return path.split('.').reduce(function(obj, key) {
        return obj && obj[key];
      }, this.config);
    },

    /**
     * Get the current config version number.
     */
    getVersion: function() {
      return this.version;
    }
  };

  window.SystemConfigLoader = SystemConfigLoader;

  // Admin-only surface: version-tracking init + the "ready" log. Gated so the
  // user-app copy emits no extra console output and carries no `version` field.
  if (APP_CONTEXT === 'admin') {
    SystemConfigLoader.version = null;
    console.log('✅ Config Loader ready');
  }

})();
