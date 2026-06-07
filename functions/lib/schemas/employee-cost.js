"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPLOYEE_COSTS_COLLECTION = exports.getEmployeeCostInputSchema = exports.setEmployeeCostInputSchema = exports.COST_SOURCES = exports.EMPLOYEE_COST_SCHEMA_VERSION = void 0;
/**
 * employee-cost schema — Pre-H.0.0.G (single-doc model)
 * ─────────────────────────────────────────────────────────────────────────────
 * Zod schemas + types for the `employee_costs/{email}` collection: per-employee
 * cost-per-hour, sourced from the external accountant. SENSITIVE FINANCIAL PII.
 *
 * ─── Data model: SINGLE-DOC (Haim approved at Pre-H.0.0.G checkpoint) ────────
 * One document per employee, keyed by lowercased email: `employee_costs/{email}`.
 * The doc holds the CURRENT cost. Cost-CHANGE history lives in `audit_log`
 * (every SET_EMPLOYEE_COST records previousCost + newCost).
 *
 * Why single-doc and NOT a subcollection-with-history:
 *   MASTER_PLAN §1.3.7 + §10 lock the rule "costPerHourAtEntry is snapshot at
 *   timesheet-WRITE time and NEVER re-derived." So the application NEVER queries
 *   "cost as of a past date" — each timesheet entry immortalizes its own cost.
 *   A historical-lookup subcollection would be YAGNI. Three Opus agents
 *   (security / backend / completeness) converged on single-doc; completeness
 *   returned NEEDS-CONTRACTION against the subcollection variant.
 *
 * ─── PII discipline (G7 / §2.8) ──────────────────────────────────────────────
 * - The collection is CF-only (`allow read, write: if false` in firestore.rules).
 *   Admins read via the `getEmployeeCost` callable, never the client SDK.
 * - Cost figures are FORBIDDEN in `logger.*` (Cloud Logging is world-discoverable
 *   on a PUBLIC repo's project). They ARE recorded in `audit_log` (admin-read
 *   only) because a financial audit trail is useless without the values.
 *   ⚠️ Consequence: `audit_log` is now a salary-adjacent-PII surface. The H.8
 *   BigQuery export (MASTER_PLAN §8.11) MUST redact/mask `SET_EMPLOYEE_COST`
 *   audit details. (devils-advocate Pre-H.0.0.G Attack #3.)
 * - `updatedBy` is the admin's UID, never email.
 * - Test fixtures use fake costs + `*@example.com` emails.
 */
const zod_1 = require("zod");
/**
 * Cost bounds. min(1): a 0 cost would silently zero out H.3 profitability math.
 * max(20000): a typo-guard against agorot-vs-shekel unit errors (×100). Raised
 * from 10000 to 20000 per devils-advocate Attack #4 — a wrongful rejection of a
 * legitimate fully-burdened senior-partner figure is a worse failure mode than
 * accepting an implausibly high one (the latter is visible on the dashboard; the
 * former silently blocks the accountant's monthly update).
 */
const COST_MIN = 1;
const COST_MAX = 20000;
/** Current schema version of a stored employee_cost doc. Bump on field changes. */
exports.EMPLOYEE_COST_SCHEMA_VERSION = 1;
/** Allowed provenance of a cost figure. Closed set — no free-text injection. */
exports.COST_SOURCES = ['accountant', 'manual', 'import'];
/**
 * Input schema for the `setEmployeeCost` callable (what the client may send).
 * `.strict()` rejects unknown fields. Server-stamped fields (updatedBy,
 * updatedAt, validUntil, schemaVersion) are NOT accepted from the client.
 */
exports.setEmployeeCostInputSchema = zod_1.z.object({
    // Lowercased to match the `employees/{email}` doc-id convention (Firebase Auth
    // emails are already lowercase; .toLowerCase() also guards manual typos).
    email: zod_1.z.string().email().toLowerCase(),
    costPerHour: zod_1.z.number().positive().min(COST_MIN).max(COST_MAX),
    currency: zod_1.z.literal('ILS').default('ILS'),
    // ISO-8601 string from the client → converted to a Firestore Timestamp
    // server-side. Under the single-doc model `validFrom` is INFORMATIONAL audit
    // metadata ("this rate effective since X") — it is NOT a selector (there is
    // only one doc per employee). devils-advocate Attack #5 bonus.
    validFrom: zod_1.z.string().datetime().optional(),
    source: zod_1.z.enum(exports.COST_SOURCES).default('manual')
}).strict();
/**
 * Input schema for the `getEmployeeCost` callable. Admin-gated read; NO self-read
 * carve-out (an employee may not read their own cost — security Attack/req #4).
 */
exports.getEmployeeCostInputSchema = zod_1.z.object({
    email: zod_1.z.string().email().toLowerCase()
}).strict();
/** Collection name — hardcoded (public in firestore.rules). */
exports.EMPLOYEE_COSTS_COLLECTION = 'employee_costs';
//# sourceMappingURL=employee-cost.js.map