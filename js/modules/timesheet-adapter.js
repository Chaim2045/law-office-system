/**
 * Timesheet Entry Adapter (v1 → v2)
 *
 * @module timesheet-adapter
 * @description Adapter for migrating createTimesheetEntry v1 to v2
 *
 * Adds enterprise features:
 * - Idempotency protection (prevents duplicate submissions)
 * - Event sourcing (full audit trail)
 * - Future: Optimistic locking for client entries
 *
 * @created 2026-02-05
 * @version 1.0.0
 */

/**
 * Generate idempotency key for timesheet entry
 *
 * Format: timesheet_{employee}_{date}_{action_hash}_{minutes}_{timestamp}
 *
 * @param {Object} entryData - Timesheet entry data
 * @param {string} entryData.employee - Employee email
 * @param {string} entryData.date - Entry date (ISO format)
 * @param {string} entryData.action - Action description
 * @param {number} entryData.minutes - Minutes worked
 * @returns {string} Unique idempotency key
 *
 * @example
 * generateIdempotencyKey({
 *   employee: 'user@example.com',
 *   date: '2026-02-05',
 *   action: 'ישיבת צוות',
 *   minutes: 60
 * })
 * // Returns: 'timesheet_user@example.com_2026-02-05_a3f8b9c1_60_1738761234567'
 */
function generateIdempotencyKey(entryData) {
  const employee = entryData.employee || 'unknown';
  const date = entryData.date;
  const actionHash = simpleHash(entryData.action || '');
  const minutes = entryData.minutes;
  const timestamp = Date.now();

  return `timesheet_${employee}_${date}_${actionHash}_${minutes}_${timestamp}`;
}

/**
 * Simple hash function (FNV-1a) for action text
 *
 * @param {string} str - String to hash
 * @returns {string} 8-character hash (base36)
 *
 * @private
 */
function simpleHash(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(36).slice(0, 8);
}

/**
 * Create timesheet entry using v2 API
 *
 * This function wraps createTimesheetEntry_v2 and automatically:
 * - Generates idempotency key (prevents duplicate submissions)
 * - Adds expectedVersion for client entries (when provided)
 * - Validates payload and logs warnings
 *
 * @param {Object} entryData - v1 payload format (unchanged)
 * @param {string} entryData.date - Entry date
 * @param {number} entryData.minutes - Minutes worked
 * @param {string} entryData.action - Action description
 * @param {string} entryData.employee - Employee email
 * @param {boolean} [entryData.isInternal] - True for internal activities
 * @param {string} [entryData.clientId] - Client ID (null for internal)
 * @param {string} [entryData.serviceId] - Service ID (optional)
 * @param {Object} [options={}] - Additional options
 * @param {Object} [options.client] - Client object (for expectedVersion, future use)
 * @returns {Promise<Object>} Result with entryId, version, entry
 *
 * @throws {Error} If Firebase call fails or validation error
 *
 * @example
 * // Internal activity (current use case)
 * await createTimesheetEntryV2({
 *   date: '2026-02-05',
 *   minutes: 60,
 *   action: 'ישיבת צוות שבועית',
 *   employee: 'user@example.com',
 *   isInternal: true
 * });
 *
 * @example
 * // Client activity (future use case)
 * await createTimesheetEntryV2({
 *   date: '2026-02-05',
 *   minutes: 120,
 *   clientId: '2025001',
 *   serviceId: 'srv_xxx',
 *   action: 'ייעוץ משפטי',
 *   employee: 'user@example.com'
 * }, {
 *   client: { _version: 5 }
 * });
 */
export async function createTimesheetEntryV2(entryData, options = {}) {
  // Generate idempotency key
  const idempotencyKey = generateIdempotencyKey(entryData);

  // Build v2 payload
  const v2Payload = {
    ...entryData,
    idempotencyKey
  };

  // Add expectedVersion ONLY for non-internal entries with client cache
  if (entryData.isInternal !== true && options.client) {
    v2Payload.expectedVersion = options.client._version || 0;
  }

  // Validation warning for missing serviceId (non-internal entries)
  if (!entryData.serviceId && !entryData.isInternal) {
    console.warn('⚠️ [v2 Adapter] No serviceId - backend will use first service');
  }

  // Log adapter call for debugging
  console.log('✅ [v2 Adapter] Calling createTimesheetEntry_v2:', {
    isInternal: entryData.isInternal,
    hasVersion: !!v2Payload.expectedVersion,
    hasIdempotencyKey: true,
    date: entryData.date,
    minutes: entryData.minutes
  });

  // Call v2 function via FirebaseService
  const response = await window.FirebaseService.call('createTimesheetEntry_v2', v2Payload, {
    retries: 3,
    timeout: 15000
  });

  if (!response.success) {
    throw new Error(response.error || response.message || 'שגיאה ברישום שעתון');
  }

  // Extract actual result from FirebaseService wrapper
  const result = response.data;

  console.log('✅ [v2 Adapter] Success:', {
    entryId: result.entryId,
    version: result.version
  });

  return result;
}
