/**
 * TypeScript Event Bus - Advanced Event-Driven Architecture
 *
 * תכונות מתקדמות:
 * - ✅ Type-safe events (בדיקת טיפוסים בזמן קומפילציה)
 * - ✅ Autocomplete ב-IDE
 * - ✅ Event history & replay (היסטוריה ושחזור)
 * - ✅ Performance monitoring (מדידת ביצועים)
 * - ✅ Debug mode (מצב דיבאג)
 * - ✅ Event priority (עדיפות לאירועים)
 * - ✅ Error boundaries (טיפול בשגיאות)
 *
 * @example
 * ```typescript
 * // Emit event
 * EventBus.emit('client:selected', {
 *   clientId: '123',
 *   clientName: 'John Doe',
 *   caseId: '456'
 * });
 *
 * // Listen to event
 * const unsubscribe = EventBus.on('client:selected', (data) => {
 *   console.log(`Client selected: ${data.clientName}`);
 * });
 *
 * // Unsubscribe
 * unsubscribe();
 * ```
 *
 * Created: October 2025
 * Part of: Law Office Management System v2.0
 */
/**
 * TypeScript Event Bus Class
 *
 * מאפיינים:
 * - Type-safe event emission and subscription
 * - Event history for debugging and replay
 * - Performance monitoring
 * - Error handling with boundaries
 * - Priority-based event handling
 */
class TypedEventBus {
    constructor() {
        // Map of event listeners
        this.listeners = new Map();
        // Event history for debugging (limited to last 100 events)
        this.history = [];
        this.maxHistorySize = 100;
        // Debug mode flag
        this.debugMode = false;
        // Statistics
        this.stats = {
            totalEventsEmitted: 0,
            totalListeners: 0,
            eventCounts: {},
            averageEmitTime: 0,
            errors: 0,
        };
        // Listener ID counter
        this.listenerIdCounter = 0;
    }
    /**
     * Enable or disable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        if (enabled) {
            console.log('🔍 EventBus Debug Mode: ENABLED');
        }
    }
    /**
     * Emit an event with type-safe data
     *
     * @param event - Event name (type-checked)
     * @param data - Event data (type-checked based on event)
     *
     * @example
     * ```typescript
     * EventBus.emit('client:selected', {
     *   clientId: '123',
     *   clientName: 'John Doe'
     * });
     * ```
     */
    emit(event, data) {
        const startTime = performance.now();
        if (this.debugMode) {
            console.log(`📤 [EventBus] Emitting: ${String(event)}`, data);
        }
        // Get listeners for this event
        const eventListeners = this.listeners.get(event);
        if (!eventListeners || eventListeners.size === 0) {
            if (this.debugMode) {
                console.warn(`⚠️ [EventBus] No listeners for: ${String(event)}`);
            }
            return;
        }
        // Sort listeners by priority (higher priority first)
        const sortedListeners = Array.from(eventListeners).sort((a, b) => b.priority - a.priority);
        let listenersNotified = 0;
        let errors = 0;
        // Notify all listeners
        for (const listener of sortedListeners) {
            try {
                listener.callback(data);
                listenersNotified++;
                // Remove one-time listeners
                if (listener.once) {
                    eventListeners.delete(listener);
                }
            }
            catch (error) {
                errors++;
                console.error(`❌ [EventBus] Error in listener for ${String(event)}:`, error);
                this.emit('system:error', {
                    error: error,
                    context: `Event listener for ${String(event)}`,
                    severity: 'medium',
                });
            }
        }
        // Update statistics
        const duration = performance.now() - startTime;
        this.updateStats(event, duration, errors);
        // Add to history
        this.addToHistory({
            event,
            data,
            timestamp: Date.now(),
            duration,
            listenersNotified,
            errors,
        });
        if (this.debugMode) {
            console.log(`✅ [EventBus] ${String(event)} completed in ${duration.toFixed(2)}ms (${listenersNotified} listeners)`);
        }
    }
    /**
     * Subscribe to an event
     *
     * @param event - Event name (type-checked)
     * @param callback - Callback function (type-checked based on event)
     * @param options - Optional configuration (priority, once)
     * @returns Unsubscribe function
     *
     * @example
     * ```typescript
     * const unsubscribe = EventBus.on('client:selected', (data) => {
     *   console.log(`Selected: ${data.clientName}`);
     * });
     *
     * // Later...
     * unsubscribe();
     * ```
     */
    on(event, callback, options = {}) {
        const { priority = 0, once = false } = options;
        // Get or create listener set
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        const eventListeners = this.listeners.get(event);
        // Create listener object
        const listener = {
            callback,
            priority,
            once,
            id: `listener-${++this.listenerIdCounter}`,
        };
        eventListeners.add(listener);
        this.stats.totalListeners++;
        if (this.debugMode) {
            console.log(`📥 [EventBus] Subscribed to: ${String(event)} (ID: ${listener.id}, Priority: ${priority})`);
        }
        // Return unsubscribe function
        return () => {
            eventListeners.delete(listener);
            this.stats.totalListeners--;
            if (this.debugMode) {
                console.log(`📤 [EventBus] Unsubscribed from: ${String(event)} (ID: ${listener.id})`);
            }
        };
    }
    /**
     * Subscribe to an event (one-time only)
     *
     * @param event - Event name
     * @param callback - Callback function
     * @param priority - Optional priority
     * @returns Unsubscribe function
     */
    once(event, callback, priority = 0) {
        return this.on(event, callback, { priority, once: true });
    }
    /**
     * Remove all listeners for an event
     */
    off(event) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            this.stats.totalListeners -= eventListeners.size;
            this.listeners.delete(event);
            if (this.debugMode) {
                console.log(`🗑️ [EventBus] Removed all listeners for: ${String(event)}`);
            }
        }
    }
    /**
     * Remove all listeners for all events
     */
    clear() {
        this.listeners.clear();
        this.stats.totalListeners = 0;
        if (this.debugMode) {
            console.log('🗑️ [EventBus] Cleared all listeners');
        }
    }
    /**
     * Get event history (for debugging)
     */
    getHistory() {
        return [...this.history];
    }
    /**
     * Get last N events from history
     */
    getLastEvents(count) {
        return this.history.slice(-count);
    }
    /**
     * Clear event history
     */
    clearHistory() {
        this.history = [];
        if (this.debugMode) {
            console.log('🗑️ [EventBus] History cleared');
        }
    }
    /**
     * Get statistics
     */
    getStats() {
        return { ...this.stats };
    }
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            totalEventsEmitted: 0,
            totalListeners: this.stats.totalListeners,
            eventCounts: {},
            averageEmitTime: 0,
            errors: 0,
        };
        if (this.debugMode) {
            console.log('🗑️ [EventBus] Statistics reset');
        }
    }
    /**
     * Get list of all registered events with listener counts
     */
    getEventSummary() {
        const summary = {};
        for (const [event, listeners] of this.listeners.entries()) {
            summary[String(event)] = listeners.size;
        }
        return summary;
    }
    /**
     * Replay events from history (for debugging)
     */
    replay(fromIndex = 0, toIndex) {
        const events = toIndex
            ? this.history.slice(fromIndex, toIndex)
            : this.history.slice(fromIndex);
        console.log(`🔄 [EventBus] Replaying ${events.length} events...`);
        for (const entry of events) {
            this.emit(entry.event, entry.data);
        }
    }
    // ==================== Private Methods ====================
    /**
     * Add event to history (limited to maxHistorySize)
     */
    addToHistory(entry) {
        this.history.push(entry);
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
    }
    /**
     * Update statistics
     */
    updateStats(event, duration, errors) {
        this.stats.totalEventsEmitted++;
        this.stats.errors += errors;
        // Update event count
        const eventName = String(event);
        this.stats.eventCounts[eventName] =
            (this.stats.eventCounts[eventName] || 0) + 1;
        // Update average emit time
        const totalEvents = this.stats.totalEventsEmitted;
        this.stats.averageEmitTime =
            (this.stats.averageEmitTime * (totalEvents - 1) + duration) / totalEvents;
    }
}
// ==================== Singleton Instance ====================
/**
 * Global EventBus instance
 *
 * שימוש:
 * ```typescript
 * import { EventBus } from './event-bus';
 *
 * EventBus.emit('client:selected', { ... });
 * EventBus.on('client:selected', (data) => { ... });
 * ```
 */
export const EventBus = new TypedEventBus();
// Make it available globally for debugging
if (typeof window !== 'undefined') {
    window.EventBus = EventBus;
}
// ==================== Exports ====================
export default EventBus;
//# sourceMappingURL=event-bus.js.map