/**
 * ServiceCardModel — the PURE service-card view-model for the admin modal unification.
 * ─────────────────────────────────────────────────────────────────────────────
 * docs/PLAN-ADMIN-MODAL-UNIFICATION-2026-07.md — PR-U2.
 *
 * DEAD CODE for now: this module is NOT loaded by any page yet. U4/U5 wire the unified
 * renderer (UnifiedServiceCard) to it; until then it exists only so its correctness can
 * be pinned by tests before any live surface adopts it.
 *
 * SSOT = the client document's `services[]` array, and NOTHING else:
 *   - ONE card per service, keyed by `service.id` — there is no per-stage Map, so two
 *     legal procedures that each own a `stage_a` can never collide (kills the D2 bug
 *     where ClientReportModal.populateServiceCards keys a client-wide Map by the
 *     service-local `stage.id` and the second service overwrites the first).
 *   - Stored aggregates (`hoursUsed` / `hoursRemaining`) are read straight off the
 *     document — the model NEVER reads the timesheet ledger, so it can never fabricate
 *     the D1 phantom card (the ClientReportModal timesheet-fallback that invents a
 *     nameless `{total:0, used:N}` card for a ledger row that matches no service key).
 *
 * Purity contract (enforced by a static source guard in service-card-model.test.ts):
 *   NO DOM, NO ledger read (the timesheet entries are never consulted), NO clamping
 *   of a negative remainder, NO stage-id-keyed map. The only global it touches is the
 *   canonical `window.ClientTypeDisplay.isFixedService`, and even that has an identical
 *   inline fallback so the model is fully testable without any page globals loaded.
 *
 * Field-level legacy tolerance is preserved (service.hours / totalHours / allocatedHours
 * fallbacks, mirroring ClientReportModal.js:442-489 and ClientManagementModal stage
 * handling). What is NOT reconstructed: the removed passes A/B/E (client.stages /
 * client.hourlyPackage / the ledger phantom) — those were the source of the bugs.
 */
(function () {
    'use strict';

    /**
     * Legacy `||`-chain semantics for an hours FIELD: pick the first truthy finite value
     * (0 / NaN / undefined skip to the next candidate), else 0. Coerces numeric strings.
     * Mirrors `service.hours || service.totalHours || ... || 0` in the current renderers.
     */
    function pickHours() {
        for (let i = 0; i < arguments.length; i++) {
            const raw = arguments[i];
            const n = typeof raw === 'string' ? parseFloat(raw) : raw;
            if (Number.isFinite(n) && n) {
                return n;
            }
        }
        return 0;
    }

    /**
     * Canonical isFixed (client-type-display.js:37-43) with a byte-identical inline
     * fallback so the model resolves correctly in tests that don't load the SSOT.
     */
    function isFixedService(svc) {
        const ctd = (typeof window !== 'undefined') ? window.ClientTypeDisplay : null;
        if (ctd && typeof ctd.isFixedService === 'function') {
            return ctd.isFixedService(svc);
        }
        if (!svc) {
            return false;
        }
        // Same-predicate mirror of the canonical client-type-display.js:41-42 (identical
        // `type === 'fixed'` / `legal_procedure + pricingType === 'fixed'` tests, expressed
        // as an early return). The plan (PR-U2) mandates this inline fallback so the model
        // resolves the fixed/hourly distinction even when the SSOT global isn't loaded
        // (unit tests). A sanctioned mirror of the canonical rule, not a new classification.
        /* eslint-disable no-restricted-syntax */
        if (svc.type === 'fixed') {
            return true;
        }
        return svc.type === 'legal_procedure' && svc.pricingType === 'fixed';
        /* eslint-enable no-restricted-syntax */
    }

    /**
     * Resolve the used/remaining pair from the STORED aggregates (Number.isFinite so a
     * real stored 0 is respected — same rule U1 applied to the management modal). Prefer
     * the stored value; else derive from the complement; if both are absent, fall to the
     * creation defaults (used 0, remaining = total). A negative remainder is NEVER
     * clamped — an overdrawn service must read as overdrawn.
     */
    function resolveHours(svc, totalHours) {
        let used = Number.isFinite(svc.hoursUsed) ? svc.hoursUsed : null;
        let remaining = Number.isFinite(svc.hoursRemaining) ? svc.hoursRemaining : null;
        if (used === null && remaining !== null) {
            used = totalHours - remaining;
        }
        if (remaining === null && used !== null) {
            remaining = totalHours - used;
        }
        if (used === null && remaining === null) {
            used = 0;
            remaining = totalHours;
        }
        return { hoursUsed: used, hoursRemaining: remaining };
    }

    /**
     * One stage of a legal-procedure service → a stage view-model. Carries BOTH the
     * hourly aggregate (`hoursUsed`) and the fixed-price counter (`totalHoursWorked`)
     * raw, so the renderer picks per pricingType (ClientReportModal.js:378-380) without
     * the model deciding. Legacy total fallback mirrors the management stage branch.
     */
    function buildStage(stage, getStageName) {
        const totalHours = pickHours(
            stage.totalHours, stage.hours, stage.allocatedHours, stage.estimatedHours
        );
        const hoursUsed = Number.isFinite(stage.hoursUsed) ? stage.hoursUsed : 0;
        const totalHoursWorked = Number.isFinite(stage.totalHoursWorked) ? stage.totalHoursWorked : 0;
        const hoursRemaining = Number.isFinite(stage.hoursRemaining)
            ? stage.hoursRemaining
            : (totalHours - hoursUsed);
        const name = stage.name
            || (typeof getStageName === 'function' ? getStageName(stage.id) : null)
            || stage.description
            || 'שלב';
        return {
            id: stage.id,
            name: name,
            status: stage.status || 'pending',
            totalHours: totalHours,
            hoursUsed: hoursUsed,
            hoursRemaining: hoursRemaining,
            totalHoursWorked: totalHoursWorked
        };
    }

    /**
     * One `services[]` element → a service-card view-model. Identity is `service.id`.
     */
    function buildCard(service, client, getStageName) {
        const totalHours = pickHours(
            service.totalHours, service.hours, service.packageHours, service.allocatedHours
        );
        const resolved = resolveHours(service, totalHours);
        const status = service.status || 'active';
        const stages = Array.isArray(service.stages)
            ? service.stages.map(function (s) {
                return buildStage(s, getStageName);
            })
            : [];
        return {
            serviceId: service.id,
            name: service.name || '',
            type: service.type || 'hours',
            pricingType: service.pricingType || client.pricingType || null,
            status: status,
            // Parity with NON_AGGREGATING_STATUSES — the renderer shows the "בארכיון" badge,
            // exactly as both current modals do; an archived service still gets a card.
            nonAggregating: status === 'archived',
            isFixed: isFixedService(service),
            totalHours: totalHours,
            hoursUsed: resolved.hoursUsed,
            hoursRemaining: resolved.hoursRemaining,
            overdraftResolved: service.overdraftResolved || null,
            packages: Array.isArray(service.packages) ? service.packages : [],
            // U5 manage-mode fields — carried raw for UnifiedServiceCard mode 'manage-detail'
            // (the report-select mode ignores them). overrideApprovedAt stays the raw Firestore
            // Timestamp shape ({seconds}) the renderer reads.
            startedAt: service.startedAt || null,
            createdAt: service.createdAt || null,
            fixedPrice: service.fixedPrice || 0,
            overrideActive: !!service.overrideActive,
            overrideApprovedAt: service.overrideApprovedAt || null,
            overrideApprovedBy: service.overrideApprovedBy || '',
            overrideNote: service.overrideNote || '',
            stages: stages
        };
    }

    /**
     * build(client, { getStageName }) → { cards, meta }.
     * @param {Object} client - the full client document.
     * @param {Object} [options]
     * @param {Function} [options.getStageName] - (stageId) => display name; injected so the
     *        model stays pure/testable (no window.SystemConstantsHelpers dependency).
     */
    function build(client, options) {
        const opts = options || {};
        const getStageName = opts.getStageName;
        const services = (client && Array.isArray(client.services)) ? client.services : [];
        const cards = services.map(function (svc) {
            return buildCard(svc, client || {}, getStageName);
        });
        return {
            cards: cards,
            meta: {
                serviceCount: cards.length,
                // Non-selection "שעות ללא שיוך" info-row — the D1-phantom REPLACEMENT
                // (docs plan §8.2 / §539). The pure model has no ledger access, so U4 (the
                // report tab, which loads the entries) computes and attaches the value.
                // Declared here as a stable seam so the shape doesn't change under U4.
                unassignedHours: null
            }
        };
    }

    const api = { build: build };

    if (typeof window !== 'undefined') {
        window.ServiceCardModel = api;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})();
