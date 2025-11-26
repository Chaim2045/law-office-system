/**
 * Alerts Manager Module
 * מודול ניהול התראות
 *
 * @module AlertsManager
 * @version 1.0.0
 * @created 2025-11-26
 */

export class AlertsManager {
    constructor() {
        this.db = null;
        this.alerts = new Map();
        this.alertQueue = [];

        // Configuration
        this.config = {
            maxAlerts: 100,
            alertRetentionDays: 30,
            priorities: {
                critical: 1,
                warning: 2,
                info: 3
            }
        };

        // Alert handlers
        this.handlers = new Map();
    }

    /**
     * Initialize Manager
     */
    async init() {
        try {
            this.db = window.firebaseDB;

            // Load existing alerts
            await this.loadAlerts();

            console.log('✅ AlertsManager initialized');
            return true;

        } catch (error) {
            console.error('❌ AlertsManager init failed:', error);
            return false;
        }
    }

    /**
     * Load Existing Alerts
     */
    async loadAlerts() {
        try {
            const snapshot = await this.db
                .collection('system_alerts')
                .where('resolved', '==', false)
                .orderBy('createdAt', 'desc')
                .limit(this.config.maxAlerts)
                .get();

            this.alerts.clear();

            snapshot.forEach(doc => {
                const alert = {
                    id: doc.id,
                    ...doc.data()
                };
                this.alerts.set(doc.id, alert);
            });

            return Array.from(this.alerts.values());

        } catch (error) {
            console.error('Error loading alerts:', error);
            return [];
        }
    }

    /**
     * Create New Alert
     */
    async createAlert(alertData) {
        try {
            const alert = {
                ...alertData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                resolved: false,
                acknowledged: false,
                id: this.generateAlertId()
            };

            // Add to queue
            this.alertQueue.push(alert);

            // Process queue
            await this.processAlertQueue();

            return alert.id;

        } catch (error) {
            console.error('Error creating alert:', error);
            return null;
        }
    }

    /**
     * Process Alert Queue
     */
    async processAlertQueue() {
        while (this.alertQueue.length > 0) {
            const alert = this.alertQueue.shift();

            try {
                // Save to Firebase
                await this.db.collection('system_alerts').doc(alert.id).set(alert);

                // Add to cache
                this.alerts.set(alert.id, alert);

                // Trigger handlers
                this.triggerHandlers(alert);

            } catch (error) {
                console.error('Error processing alert:', error);
                // Re-add to queue for retry
                this.alertQueue.unshift(alert);
                break;
            }
        }
    }

    /**
     * Acknowledge Alert
     */
    async acknowledgeAlert(alertId) {
        try {
            await this.db.collection('system_alerts').doc(alertId).update({
                acknowledged: true,
                acknowledgedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update cache
            const alert = this.alerts.get(alertId);
            if (alert) {
                alert.acknowledged = true;
                alert.acknowledgedAt = Date.now();
            }

            return true;

        } catch (error) {
            console.error('Error acknowledging alert:', error);
            return false;
        }
    }

    /**
     * Resolve Alert
     */
    async resolveAlert(alertId, resolution) {
        try {
            await this.db.collection('system_alerts').doc(alertId).update({
                resolved: true,
                resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                resolution: resolution
            });

            // Remove from cache
            this.alerts.delete(alertId);

            return true;

        } catch (error) {
            console.error('Error resolving alert:', error);
            return false;
        }
    }

    /**
     * Get Active Alerts
     */
    getActiveAlerts() {
        return Array.from(this.alerts.values())
            .filter(alert => !alert.resolved)
            .sort((a, b) => {
                // Sort by priority then by time
                const priorityDiff = this.config.priorities[a.type] - this.config.priorities[b.type];
                if (priorityDiff !== 0) {
return priorityDiff;
}
                return b.createdAt - a.createdAt;
            });
    }

    /**
     * Get Alerts by Type
     */
    getAlertsByType(type) {
        return Array.from(this.alerts.values())
            .filter(alert => alert.type === type && !alert.resolved);
    }

    /**
     * Get Alert Statistics
     */
    getStatistics() {
        const stats = {
            total: this.alerts.size,
            critical: 0,
            warning: 0,
            info: 0,
            acknowledged: 0,
            unacknowledged: 0
        };

        this.alerts.forEach(alert => {
            stats[alert.type]++;
            if (alert.acknowledged) {
                stats.acknowledged++;
            } else {
                stats.unacknowledged++;
            }
        });

        return stats;
    }

    /**
     * Register Alert Handler
     */
    registerHandler(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type).push(handler);
    }

    /**
     * Trigger Handlers
     */
    triggerHandlers(alert) {
        // Get handlers for this alert type
        const handlers = this.handlers.get(alert.type) || [];

        // Get global handlers
        const globalHandlers = this.handlers.get('*') || [];

        // Execute all handlers
        [...handlers, ...globalHandlers].forEach(handler => {
            try {
                handler(alert);
            } catch (error) {
                console.error('Error in alert handler:', error);
            }
        });
    }

    /**
     * Generate Alert ID
     */
    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Clean Old Alerts
     */
    async cleanOldAlerts() {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - this.config.alertRetentionDays);

            const snapshot = await this.db
                .collection('system_alerts')
                .where('createdAt', '<', cutoffDate)
                .get();

            const batch = this.db.batch();

            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            console.log(`Cleaned ${snapshot.size} old alerts`);

        } catch (error) {
            console.error('Error cleaning old alerts:', error);
        }
    }

    /**
     * Destroy Manager
     */
    destroy() {
        this.alerts.clear();
        this.alertQueue = [];
        this.handlers.clear();
    }
}