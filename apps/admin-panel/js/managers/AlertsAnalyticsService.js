/**
 * AlertsAnalyticsService
 * שכבת wrapper מרכזית לחישובי אנליטיקס של התראות
 *
 * Created: 2026-01-04
 * Phase: Analytics Layer
 *
 * תפקיד: נקודת כניסה יחידה לכל חישובי alerts analytics
 * מחזירה תוצאה אחידה: { ok, data?, error? }
 * Fail-fast אמיתי: במקרה WORKHOURS_MISSING מחזירה ok=false
 */

(function() {
    'use strict';

    class AlertsAnalyticsService {
        constructor() {
            this.alertEngine = null;
        }

        /**
         * Initialize service with AlertEngine instance
         * @param {AlertEngine} alertEngine - AlertEngine instance
         */
        init(alertEngine) {
            if (!alertEngine) {
                console.warn('⚠️ AlertsAnalyticsService: No AlertEngine provided');
                return false;
            }

            this.alertEngine = alertEngine;
            console.log('✅ AlertsAnalyticsService: Initialized');
            return true;
        }

        /**
         * Compute alerts analytics for a user
         * נקודת כניסה מרכזית - עוטפת את AlertEngine.calculateAlerts
         *
         * @param {Object} userData - User data object
         * @returns {Object} { ok: boolean, data?: Alert[], error?: {code, message} }
         */
        computeAlertsAnalytics(userData) {
            // Validate input
            if (!userData) {
                return {
                    ok: false,
                    error: {
                        code: 'INVALID_INPUT',
                        message: 'נתוני משתמש חסרים'
                    }
                };
            }

            // Validate AlertEngine availability
            if (!this.alertEngine) {
                return {
                    ok: false,
                    error: {
                        code: 'ENGINE_MISSING',
                        message: 'מנוע התראות לא זמין'
                    }
                };
            }

            // Compute alerts with fail-fast error handling
            try {
                const alerts = this.alertEngine.calculateAlerts(userData);

                return {
                    ok: true,
                    data: alerts
                };

            } catch (error) {
                // Handle WORKHOURS_MISSING specifically (fail-fast from AlertEngine)
                if (error.message && error.message.includes('WORKHOURS_MISSING')) {
                    console.error('❌ AlertsAnalyticsService: WorkHoursCalculator unavailable');
                    return {
                        ok: false,
                        error: {
                            code: 'WORKHOURS_MISSING',
                            message: 'חישובי אנליטיקס הושבתו כדי למנוע נתונים שגויים'
                        }
                    };
                }

                // Re-throw unknown errors - don't hide them
                console.error('❌ AlertsAnalyticsService: Unexpected error:', error);
                throw error;
            }
        }

        /**
         * Check if analytics are available (WorkHoursCalculator present)
         * @returns {boolean}
         */
        isAnalyticsAvailable() {
            if (!this.alertEngine) {
                return false;
            }

            const calculator = this.alertEngine.workHoursCalculator || window.WorkHoursCalculatorInstance;
            return !!calculator;
        }

        /**
         * Clear AlertEngine cache for a user
         * @param {string} userId - User ID
         */
        clearCache(userId) {
            if (this.alertEngine && this.alertEngine.clearCache) {
                this.alertEngine.clearCache(userId);
            }
        }
    }

    // Export to window
    window.AlertsAnalyticsService = AlertsAnalyticsService;

    // Auto-initialize singleton
    if (!window.alertsAnalyticsService) {
        window.alertsAnalyticsService = new AlertsAnalyticsService();

        // Auto-init with global alertEngine if available
        if (window.alertEngine) {
            window.alertsAnalyticsService.init(window.alertEngine);
        }

        console.log('✅ AlertsAnalyticsService: Singleton created');
    }

})();
