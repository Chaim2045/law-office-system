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
declare class FirebaseServiceClass {
    private cache;
    private queue;
    private processingQueue;
    private rateLimitBucket;
    private readonly maxRequestsPerSecond;
    private inFlightRequests;
    private stats;
    private debugMode;
    /**
     * Enable or disable debug mode
     */
    setDebugMode(enabled: boolean): void;
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
    call<T = any>(functionName: string, data?: any, options?: CallOptions): Promise<FirebaseResponse<T>>;
    /**
     * Execute Firebase function call with retry logic
     */
    private executeCall;
    /**
     * Call Firebase function with timeout
     */
    private callWithTimeout;
    /**
     * Check if error is retryable
     */
    private isRetryableError;
    /**
     * Get error code from error object
     */
    private getErrorCode;
    /**
     * Check rate limit
     */
    private checkRateLimit;
    /**
     * Process queued requests
     */
    private processQueue;
    /**
     * Generate cache key
     */
    private getCacheKey;
    /**
     * Generate request key for deduplication
     */
    private getRequestKey;
    /**
     * Get from cache
     */
    private getFromCache;
    /**
     * Add to cache
     */
    private addToCache;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Clear specific cache entry
     */
    clearCacheEntry(functionName: string, data: any): void;
    /**
     * Get statistics
     */
    getStats(): FirebaseServiceStats;
    /**
     * Reset statistics
     */
    resetStats(): void;
    /**
     * Update average response time
     */
    private updateAverageResponseTime;
    /**
     * Sleep utility
     */
    private sleep;
}
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
export declare const FirebaseService: FirebaseServiceClass;
export default FirebaseService;
//# sourceMappingURL=firebase-service.d.ts.map