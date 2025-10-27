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

// ==================== Event Type Definitions ====================

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
export type EventMap = ClientEvents &
  TaskEvents &
  TimesheetEvents &
  BudgetEvents &
  UIEvents &
  SelectorEvents &
  SystemEvents;

// ==================== Event Bus Implementation ====================

/**
 * Event listener callback type
 */
type EventCallback<T> = (data: T) => void | Promise<void>;

/**
 * Event listener with metadata
 */
interface EventListener<T> {
  callback: EventCallback<T>;
  priority: number;
  once: boolean;
  id: string;
}

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
class TypedEventBus {
  // Map of event listeners
  private listeners: Map<keyof EventMap, Set<EventListener<any>>> = new Map();

  // Event history for debugging (limited to last 100 events)
  private history: EventHistoryEntry[] = [];
  private maxHistorySize = 100;

  // Debug mode flag
  private debugMode = false;

  // Statistics
  private stats: EventBusStats = {
    totalEventsEmitted: 0,
    totalListeners: 0,
    eventCounts: {},
    averageEmitTime: 0,
    errors: 0,
  };

  // Listener ID counter
  private listenerIdCounter = 0;

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
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
  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
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
    const sortedListeners = Array.from(eventListeners).sort(
      (a, b) => b.priority - a.priority
    );

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
      } catch (error) {
        errors++;
        console.error(
          `❌ [EventBus] Error in listener for ${String(event)}:`,
          error
        );
        this.emit('system:error', {
          error: error as Error,
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
      console.log(
        `✅ [EventBus] ${String(event)} completed in ${duration.toFixed(2)}ms (${listenersNotified} listeners)`
      );
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
  on<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
    options: { priority?: number; once?: boolean } = {}
  ): () => void {
    const { priority = 0, once = false } = options;

    // Get or create listener set
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const eventListeners = this.listeners.get(event)!;

    // Create listener object
    const listener: EventListener<EventMap[K]> = {
      callback,
      priority,
      once,
      id: `listener-${++this.listenerIdCounter}`,
    };

    eventListeners.add(listener);
    this.stats.totalListeners++;

    if (this.debugMode) {
      console.log(
        `📥 [EventBus] Subscribed to: ${String(event)} (ID: ${listener.id}, Priority: ${priority})`
      );
    }

    // Return unsubscribe function
    return () => {
      eventListeners.delete(listener);
      this.stats.totalListeners--;

      if (this.debugMode) {
        console.log(
          `📤 [EventBus] Unsubscribed from: ${String(event)} (ID: ${listener.id})`
        );
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
  once<K extends keyof EventMap>(
    event: K,
    callback: EventCallback<EventMap[K]>,
    priority = 0
  ): () => void {
    return this.on(event, callback, { priority, once: true });
  }

  /**
   * Remove all listeners for an event
   */
  off<K extends keyof EventMap>(event: K): void {
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
  clear(): void {
    this.listeners.clear();
    this.stats.totalListeners = 0;

    if (this.debugMode) {
      console.log('🗑️ [EventBus] Cleared all listeners');
    }
  }

  /**
   * Get event history (for debugging)
   */
  getHistory(): EventHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get last N events from history
   */
  getLastEvents(count: number): EventHistoryEntry[] {
    return this.history.slice(-count);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
    if (this.debugMode) {
      console.log('🗑️ [EventBus] History cleared');
    }
  }

  /**
   * Get statistics
   */
  getStats(): EventBusStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
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
  getEventSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const [event, listeners] of this.listeners.entries()) {
      summary[String(event)] = listeners.size;
    }
    return summary;
  }

  /**
   * Replay events from history (for debugging)
   */
  replay(fromIndex = 0, toIndex?: number): void {
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
  private addToHistory(entry: EventHistoryEntry): void {
    this.history.push(entry);

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * Update statistics
   */
  private updateStats(event: keyof EventMap, duration: number, errors: number): void {
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
  (window as any).EventBus = EventBus;
}

// ==================== Exports ====================

export default EventBus;
export type { EventHistoryEntry, EventBusStats };
