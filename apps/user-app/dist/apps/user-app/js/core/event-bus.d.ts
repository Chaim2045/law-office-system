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
 * Client-related events
 */
export interface ClientEvents {
    'client:selected': {
        clientId: string;
        clientName: string;
        caseId?: string;
        caseName?: string;
    };
    'client:created': {
        clientId: string;
        clientName: string;
        createdBy: string;
    };
    'client:updated': {
        clientId: string;
        changes: Record<string, any>;
        updatedBy: string;
    };
    'client:deleted': {
        clientId: string;
        deletedBy: string;
    };
}
/**
 * Task-related events
 */
export interface TaskEvents {
    'task:created': {
        taskId: string;
        clientId: string;
        clientName: string;
        employee: string;
        originalEstimate: number;
    };
    'task:updated': {
        taskId: string;
        changes: Record<string, any>;
        updatedBy: string;
    };
    'task:completed': {
        taskId: string;
        clientId: string;
        completedBy: string;
        totalMinutes: number;
    };
    'task:budget-adjusted': {
        taskId: string;
        oldEstimate: number;
        newEstimate: number;
        reason: string;
        adjustedBy: string;
    };
    'task:deadline-extended': {
        taskId: string;
        oldDeadline: string;
        newDeadline: string;
        reason: string;
        extendedBy: string;
    };
}
/**
 * Timesheet-related events
 */
export interface TimesheetEvents {
    'timesheet:entry-created': {
        entryId: string;
        taskId: string;
        clientId: string;
        employee: string;
        minutes: number;
        date: string;
    };
    'timesheet:entry-updated': {
        entryId: string;
        changes: Record<string, any>;
        updatedBy: string;
    };
    'timesheet:entry-deleted': {
        entryId: string;
        deletedBy: string;
    };
}
/**
 * Budget-related events
 */
export interface BudgetEvents {
    'budget:warning-80': {
        taskId: string;
        clientName: string;
        percentageUsed: number;
        remainingMinutes: number;
    };
    'budget:warning-100': {
        taskId: string;
        clientName: string;
        overageMinutes: number;
    };
    'budget:overrun': {
        taskId: string;
        clientName: string;
        totalMinutes: number;
        estimatedMinutes: number;
    };
}
/**
 * UI-related events
 */
export interface UIEvents {
    'ui:dialog-opened': {
        dialogId: string;
        dialogType: string;
    };
    'ui:dialog-closed': {
        dialogId: string;
        result?: any;
    };
    'ui:notification-shown': {
        type: 'success' | 'error' | 'warning' | 'info';
        message: string;
    };
    'ui:tab-changed': {
        oldTab: string;
        newTab: string;
    };
}
/**
 * Selector-related events
 */
export interface SelectorEvents {
    'selector:budget-cleared': {};
    'selector:timesheet-cleared': {};
    'selector:procedure-cleared': {};
    'selector:values-changed': {
        selectorType: 'budget' | 'timesheet' | 'procedure';
        values: any;
    };
}
/**
 * System-wide events
 */
export interface SystemEvents {
    'system:error': {
        error: Error;
        context: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
    };
    'system:data-loaded': {
        dataType: string;
        recordCount: number;
        duration: number;
    };
    'system:cache-updated': {
        cacheKey: string;
        action: 'add' | 'update' | 'delete' | 'clear';
    };
}
/**
 * Combined event map - all events in the system
 */
export type EventMap = ClientEvents & TaskEvents & TimesheetEvents & BudgetEvents & UIEvents & SelectorEvents & SystemEvents;
/**
 * Event listener callback type
 */
type EventCallback<T> = (data: T) => void | Promise<void>;
/**
 * Event history entry for debugging
 */
interface EventHistoryEntry {
    event: keyof EventMap;
    data: any;
    timestamp: number;
    duration?: number;
    listenersNotified: number;
    errors: number;
}
/**
 * Event Bus statistics
 */
interface EventBusStats {
    totalEventsEmitted: number;
    totalListeners: number;
    eventCounts: Record<string, number>;
    averageEmitTime: number;
    errors: number;
}
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
declare class TypedEventBus {
    private listeners;
    private history;
    private maxHistorySize;
    private debugMode;
    private stats;
    private listenerIdCounter;
    /**
     * Enable or disable debug mode
     */
    setDebugMode(enabled: boolean): void;
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
    emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
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
    on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>, options?: {
        priority?: number;
        once?: boolean;
    }): () => void;
    /**
     * Subscribe to an event (one-time only)
     *
     * @param event - Event name
     * @param callback - Callback function
     * @param priority - Optional priority
     * @returns Unsubscribe function
     */
    once<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>, priority?: number): () => void;
    /**
     * Remove all listeners for an event
     */
    off<K extends keyof EventMap>(event: K): void;
    /**
     * Remove all listeners for all events
     */
    clear(): void;
    /**
     * Get event history (for debugging)
     */
    getHistory(): EventHistoryEntry[];
    /**
     * Get last N events from history
     */
    getLastEvents(count: number): EventHistoryEntry[];
    /**
     * Clear event history
     */
    clearHistory(): void;
    /**
     * Get statistics
     */
    getStats(): EventBusStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Get list of all registered events with listener counts
     */
    getEventSummary(): Record<string, number>;
    /**
     * Replay events from history (for debugging)
     */
    replay(fromIndex?: number, toIndex?: number): void;
    /**
     * Add event to history (limited to maxHistorySize)
     */
    private addToHistory;
    /**
     * Update statistics
     */
    private updateStats;
}
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
export declare const EventBus: TypedEventBus;
export default EventBus;
export type { EventHistoryEntry, EventBusStats };
//# sourceMappingURL=event-bus.d.ts.map