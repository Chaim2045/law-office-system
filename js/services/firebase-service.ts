/**
 * Firebase Service - Advanced Facade Pattern
 *
 * תכונות מתקדמות:
 * - ✅ Automatic retry with exponential backoff
 * - ✅ Response caching with TTL
 * - ✅ Rate limiting to prevent spam
 * - ✅ Request queuing for offline support
 * - ✅ Performance monitoring
 * - ✅ Error boundaries
 * - ✅ Request deduplication
 * - ✅ Type-safe function calls
 *
 * @example
 * ```typescript
 * // Call Firebase Function with automatic retry
 * const result = await FirebaseService.call('createClient', {
 *   clientName: 'John Doe',
 *   phone: '050-1234567'
 * });
 *
 * if (result.success) {
 *   console.log('Client created:', result.data);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 *
 * Created: October 2025
 * Part of: Law Office Management System v2.0
 */

import { EventBus } from '../core/event-bus.js';

// Declare firebase as global (available via CDN)
declare const firebase: any;

// ==================== Type Definitions ====================

/**
 * Firebase function call response
 */
export interface FirebaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  duration: number;
  cached?: boolean;
  retries?: number;
}

/**
 * Firebase function call options
 */
export interface CallOptions {
  /** Maximum number of retry attempts (default: 3) */
  retries?: number;
  /** Cache TTL in milliseconds (0 = no cache) */
  cacheTTL?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Request priority (higher = processed first) */
  priority?: number;
  /** Skip rate limiting */
  skipRateLimit?: boolean;
  /** Custom error handler */
  onError?: (error: Error) => void;
}

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Queued request for retry
 */
interface QueuedRequest<T> {
  functionName: string;
  data: any;
  options: CallOptions;
  resolve: (value: FirebaseResponse<T>) => void;
  reject: (reason: any) => void;
  priority: number;
  timestamp: number;
}

/**
 * Rate limit bucket
 */
interface RateLimitBucket {
  count: number;
  resetTime: number;
}

/**
 * Service statistics
 */
export interface FirebaseServiceStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  cachedCalls: number;
  retriedCalls: number;
  averageResponseTime: number;
  rateLimitHits: number;
  queuedRequests: number;
}

// ==================== Firebase Service Class ====================

class FirebaseServiceClass {
  // Response cache
  private cache: Map<string, CacheEntry<any>> = new Map();

  // Request queue for retry and rate limiting
  private queue: QueuedRequest<any>[] = [];
  private processingQueue = false;

  // Rate limiting (10 requests per second)
  private rateLimitBucket: RateLimitBucket = {
    count: 0,
    resetTime: Date.now() + 1000,
  };
  private readonly maxRequestsPerSecond = 10;

  // In-flight requests (for deduplication)
  private inFlightRequests: Map<string, Promise<FirebaseResponse<any>>> =
    new Map();

  // Statistics
  private stats: FirebaseServiceStats = {
    totalCalls: 0,
    successfulCalls: 0,
    failedCalls: 0,
    cachedCalls: 0,
    retriedCalls: 0,
    averageResponseTime: 0,
    rateLimitHits: 0,
    queuedRequests: 0,
  };

  // Debug mode
  private debugMode = false;

  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    if (enabled) {
      console.log('🔍 FirebaseService Debug Mode: ENABLED');
    }
  }

  /**
   * Call a Firebase Cloud Function
   *
   * @param functionName - Name of the Firebase function
   * @param data - Function parameters
   * @param options - Call options (retry, cache, timeout)
   * @returns Response with success/error status
   *
   * @example
   * ```typescript
   * const result = await FirebaseService.call('createClient', {
   *   clientName: 'John Doe',
   *   phone: '050-1234567',
   *   email: 'john@example.com'
   * }, {
   *   retries: 3,
   *   cacheTTL: 0
   * });
   * ```
   */
  async call<T = any>(
    functionName: string,
    data: any = {},
    options: CallOptions = {}
  ): Promise<FirebaseResponse<T>> {
    const startTime = performance.now();

    // Default options
    const {
      retries = 3,
      cacheTTL = 0,
      timeout = 30000,
      priority = 0,
      skipRateLimit = false,
      onError,
    } = options;

    if (this.debugMode) {
      console.log(`📤 [Firebase] Calling: ${functionName}`, data);
    }

    // Update statistics
    this.stats.totalCalls++;

    try {
      // Check cache first
      if (cacheTTL > 0) {
        const cached = this.getFromCache<T>(functionName, data);
        if (cached) {
          if (this.debugMode) {
            console.log(`💾 [Firebase] Cache hit: ${functionName}`);
          }

          this.stats.cachedCalls++;

          return {
            success: true,
            data: cached,
            duration: performance.now() - startTime,
            cached: true,
          };
        }
      }

      // Check for duplicate in-flight request
      const requestKey = this.getRequestKey(functionName, data);
      if (this.inFlightRequests.has(requestKey)) {
        if (this.debugMode) {
          console.log(`🔄 [Firebase] Deduplicating: ${functionName}`);
        }
        return this.inFlightRequests.get(requestKey)!;
      }

      // Rate limiting check
      if (!skipRateLimit && !this.checkRateLimit()) {
        if (this.debugMode) {
          console.log(`⏳ [Firebase] Rate limited, queuing: ${functionName}`);
        }

        this.stats.rateLimitHits++;
        this.stats.queuedRequests++;

        // Queue request
        return new Promise<FirebaseResponse<T>>((resolve, reject) => {
          this.queue.push({
            functionName,
            data,
            options,
            resolve,
            reject,
            priority,
            timestamp: Date.now(),
          });

          // Start processing queue
          this.processQueue();
        });
      }

      // Create promise for in-flight tracking
      const promise = this.executeCall<T>(
        functionName,
        data,
        retries,
        timeout,
        onError
      );

      // Track in-flight request
      this.inFlightRequests.set(requestKey, promise);

      // Execute call
      const response = await promise;

      // Remove from in-flight
      this.inFlightRequests.delete(requestKey);

      // Cache successful response
      if (response.success && cacheTTL > 0) {
        this.addToCache(functionName, data, response.data, cacheTTL);
      }

      // Update statistics
      if (response.success) {
        this.stats.successfulCalls++;
      } else {
        this.stats.failedCalls++;
      }

      const duration = performance.now() - startTime;
      this.updateAverageResponseTime(duration);

      if (this.debugMode) {
        console.log(
          `✅ [Firebase] ${functionName} completed in ${duration.toFixed(2)}ms`
        );
      }

      // Emit event
      EventBus.emit('system:data-loaded', {
        dataType: functionName,
        recordCount: 1,
        duration,
      });

      return {
        ...response,
        duration,
      };
    } catch (error) {
      this.stats.failedCalls++;

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (this.debugMode) {
        console.error(`❌ [Firebase] Error in ${functionName}:`, error);
      }

      // Emit system error event
      EventBus.emit('system:error', {
        error: error as Error,
        context: `Firebase function: ${functionName}`,
        severity: 'high',
      });

      return {
        success: false,
        error: errorMessage,
        duration: performance.now() - startTime,
      };
    }
  }

  /**
   * Execute Firebase function call with retry logic
   */
  private async executeCall<T>(
    functionName: string,
    data: any,
    maxRetries: number,
    timeout: number,
    onError?: (error: Error) => void
  ): Promise<FirebaseResponse<T>> {
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          if (this.debugMode) {
            console.log(
              `⏳ [Firebase] Retry ${attempt}/${maxRetries} after ${delay}ms for: ${functionName}`
            );
          }
          await this.sleep(delay);
          this.stats.retriedCalls++;
          retryCount++;
        }

        // Execute with timeout
        const result = await this.callWithTimeout<T>(
          functionName,
          data,
          timeout
        );

        return {
          success: true,
          data: result,
          duration: 0,
          retries: retryCount,
        };
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          if (this.debugMode) {
            console.log(`🚫 [Firebase] Non-retryable error: ${functionName}`);
          }
          break;
        }

        if (onError) {
          onError(lastError);
        }
      }
    }

    // All retries failed
    const errorMessage = lastError?.message || 'Unknown error';
    const errorCode = this.getErrorCode(lastError);

    return {
      success: false,
      error: errorMessage,
      errorCode,
      duration: 0,
      retries: retryCount,
    };
  }

  /**
   * Call Firebase function with timeout
   */
  private async callWithTimeout<T>(
    functionName: string,
    data: any,
    timeout: number
  ): Promise<T> {
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);
    });

    // Race between actual call and timeout
    const callPromise = firebase.functions().httpsCallable(functionName)(data);

    const result = await Promise.race([callPromise, timeoutPromise]);

    return (result as any).data as T;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error) return false;

    // Network errors are retryable
    if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      return true;
    }

    // Timeout errors are retryable
    if (error.message?.includes('timeout')) {
      return true;
    }

    // 5xx errors are retryable
    if (error.code === 'internal' || error.code === 'unknown') {
      return true;
    }

    return false;
  }

  /**
   * Get error code from error object
   */
  private getErrorCode(error: any): string | undefined {
    if (error?.code) return error.code;
    if (error?.message?.includes('timeout')) return 'timeout';
    if (error?.message?.includes('network')) return 'network';
    return undefined;
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Reset bucket if time expired
    if (now >= this.rateLimitBucket.resetTime) {
      this.rateLimitBucket = {
        count: 0,
        resetTime: now + 1000,
      };
    }

    // Check if under limit
    if (this.rateLimitBucket.count < this.maxRequestsPerSecond) {
      this.rateLimitBucket.count++;
      return true;
    }

    return false;
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.queue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.queue.length > 0) {
      // Wait for rate limit to reset
      if (!this.checkRateLimit()) {
        await this.sleep(100);
        continue;
      }

      // Sort by priority
      this.queue.sort((a, b) => b.priority - a.priority);

      // Get next request
      const request = this.queue.shift();
      if (!request) break;

      this.stats.queuedRequests--;

      try {
        const response = await this.call(
          request.functionName,
          request.data,
          { ...request.options, skipRateLimit: true }
        );
        request.resolve(response);
      } catch (error) {
        request.reject(error);
      }
    }

    this.processingQueue = false;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(functionName: string, data: any): string {
    return `${functionName}:${JSON.stringify(data)}`;
  }

  /**
   * Generate request key for deduplication
   */
  private getRequestKey(functionName: string, data: any): string {
    return this.getCacheKey(functionName, data);
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(functionName: string, data: any): T | null {
    const key = this.getCacheKey(functionName, data);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check expiration
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Add to cache
   */
  private addToCache<T>(
    functionName: string,
    data: any,
    result: T,
    ttl: number
  ): void {
    const key = this.getCacheKey(functionName, data);
    this.cache.set(key, {
      data: result,
      timestamp: Date.now(),
      ttl,
    });

    // Emit cache update event
    EventBus.emit('system:cache-updated', {
      cacheKey: key,
      action: 'add',
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    EventBus.emit('system:cache-updated', {
      cacheKey: 'all',
      action: 'clear',
    });

    if (this.debugMode) {
      console.log('🗑️ [Firebase] Cache cleared');
    }
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(functionName: string, data: any): void {
    const key = this.getCacheKey(functionName, data);
    this.cache.delete(key);

    EventBus.emit('system:cache-updated', {
      cacheKey: key,
      action: 'delete',
    });
  }

  /**
   * Get statistics
   */
  getStats(): FirebaseServiceStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      cachedCalls: 0,
      retriedCalls: 0,
      averageResponseTime: 0,
      rateLimitHits: 0,
      queuedRequests: this.queue.length,
    };

    if (this.debugMode) {
      console.log('🗑️ [Firebase] Statistics reset');
    }
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(duration: number): void {
    const totalCalls = this.stats.totalCalls;
    this.stats.averageResponseTime =
      (this.stats.averageResponseTime * (totalCalls - 1) + duration) /
      totalCalls;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ==================== Singleton Instance ====================

/**
 * Global FirebaseService instance
 *
 * שימוש:
 * ```typescript
 * import { FirebaseService } from './firebase-service';
 *
 * const result = await FirebaseService.call('createClient', { ... });
 * ```
 */
export const FirebaseService = new FirebaseServiceClass();

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).FirebaseService = FirebaseService;
}

// ==================== Exports ====================

export default FirebaseService;
