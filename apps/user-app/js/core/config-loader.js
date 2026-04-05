/**
 * System Config Loader — User App
 * =================================
 * Loads system configuration from Firestore _system/system_config.
 * Falls back to static SYSTEM_CONSTANTS if Firestore is unavailable.
 *
 * Exports: window.SystemConfigLoader
 * After load: window.SYSTEM_CONFIG
 * Event: 'system-config:loaded'
 */

(function() {
  'use strict';

  const SystemConfigLoader = {
    config: null,
    loaded: false,
    loading: false,

    /**
     * Load config from Firestore with fallback to static constants.
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
      const db = window.firebaseDB;

      if (!db) {
        return Promise.reject(new Error('Firestore not initialized'));
      }

      return db.collection('_system').doc('system_config').get()
        .then(function(doc) {
          if (!doc.exists) {
            return window.SYSTEM_CONSTANTS;
          }
          return doc.data();
        });
    }
  };

  window.SystemConfigLoader = SystemConfigLoader;

})();
