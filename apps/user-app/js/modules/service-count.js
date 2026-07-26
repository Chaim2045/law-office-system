/**
 * ═══════════════════════════════════════════════════════════════
 * service-count.js — active-service counter (wrong-service-prevention §4.3/§4.4)
 * ═══════════════════════════════════════════════════════════════
 *
 * Pure, DOM-free, Firebase-free helper. Answers ONE question: how many
 * selectable services/stages are ACTIVE on a client's case doc right now?
 *
 * This is the SAME question `ClientCaseSelector.renderServiceCards`
 * (client-case-selector.js) answers when it decides whether to auto-select
 * (exactly 1 active service/stage) or force a conscious choice (>=2). The
 * task-open confirmation in main.js (`addBudgetTask`, spec §4.4) reuses this
 * EXACT count so the confirmation fires under precisely the same condition
 * that skipped auto-selection — never a duplicated, drifting count.
 *
 * Extracted out of main.js (previously a private class method,
 * `_countActiveServicesOnClient`, unreachable from a test) so the
 * billing-critical gating logic — whether the wrong-service confirmation
 * fires — has direct unit coverage. main.js now delegates to this function;
 * behaviour is unchanged.
 *
 * Classification: routes through the house `window.BUSINESS_RULES`
 * predicates (isHourlyService / isFixedService / isLegalProcedureService,
 * mirroring shared/business-rules/service-classification.js) when
 * available, per the house `no-restricted-syntax` rule against inline
 * service-type classification.
 *
 * FALLBACK NOTE: `window.BUSINESS_RULES` is NOT currently wired into the
 * User App's index.html — `apps/user-app/js/shared/business-rules-adapter.js`
 * exists (a byte-identical sibling of the admin-panel adapter) but no
 * `<script>` tag loads it in any User App HTML page (verified 2026-07-26 via
 * grep across apps/user-app/*.html). So `window.BUSINESS_RULES` can be
 * `undefined` at runtime today. The inline fallback below is deliberately
 * `eslint-disable`d with this exact reason — not a silent rule violation —
 * and is byte-behavior-identical to the predicates it mirrors, so swapping
 * in the real adapter later (wiring the missing `<script>` tag) changes
 * nothing observable.
 */

export function countSelectableServices(caseData) {
  if (!caseData) {
    return 0;
  }

  const services = Array.isArray(caseData.services) ? caseData.services : [];
  const legacyStages = Array.isArray(caseData.stages) ? caseData.stages : [];

  // Legacy case (no services array, no top-level stages) = a single implicit
  // service — mirrors the isLegacyCase auto-select branch in renderServiceCards.
  if (services.length === 0 && legacyStages.length === 0) {
    return 1;
  }

  const rules = (typeof window !== 'undefined') ? window.BUSINESS_RULES : undefined;
  let count = 0;

  services.forEach((service) => {
    const status = (service && service.status) || 'active';
    if (status !== 'active') {
      return;
    }

    // Fallback path only: window.BUSINESS_RULES is not wired into the User App
    // runtime (see the module docblock above). Byte-identical to
    // shared/business-rules/service-classification.js's isLegalProcedureService.
    const isLegalProcedure = rules
      ? rules.isLegalProcedureService(service)
      // eslint-disable-next-line no-restricted-syntax -- see comment above
      : Boolean(service) && service.type === 'legal_procedure';

    if (isLegalProcedure) {
      if (Array.isArray(service.stages)) {
        count += service.stages.filter((s) => s && s.status === 'active').length;
      }
      return;
    }

    const isFlatCountable = rules
      ? (rules.isHourlyService(service) || rules.isFixedService(service))
      // eslint-disable-next-line no-restricted-syntax -- fallback path only, see reason above.
      : Boolean(service) && (service.type === 'hours' || service.type === 'fixed');

    if (isFlatCountable) {
      count += 1;
    }
  });

  // LEGACY SUPPORT: top-level `stages` array, gated the SAME way
  // renderServiceCards gates it — only when procedureType === 'legal_procedure'.
  if (caseData.procedureType === 'legal_procedure' && legacyStages.length > 0) {
    count += legacyStages.filter((s) => s && s.status === 'active').length;
  }

  return count;
}

// ─────────────────────────────────────────────────────────────────
// Window mirror — for any non-module (classic <script>) consumer, mirroring
// the israeli-id.js / budget-status.js / budget-crossing.js dual-export pattern.
// ─────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.ServiceCount = { countSelectableServices };
}
