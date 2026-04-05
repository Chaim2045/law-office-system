/**
 * System Config Loader — Admin Panel
 * ====================================
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
    version: null,

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
            console.log('⚠️ No system_config in Firestore, using static defaults');
            return window.SYSTEM_CONSTANTS;
          }

          const data = doc.data();
          self.version = data._version || null;
          console.log('✅ System config loaded from Firestore (v' + self.version + ')');
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
  console.log('✅ Config Loader ready');

})();
