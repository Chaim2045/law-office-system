/**
 * shared/business-rules/service-classification.js
 *
 * CANONICAL source-of-truth for service-type classification predicates.
 *
 * Three mirrors exist (kept in sync via tests/unit/shared/business-rules.sync.test.ts):
 *   - functions/shared/business-rules/service-classification.js  (CommonJS, deployed with Cloud Functions)
 *   - apps/admin-panel/js/shared/business-rules-adapter.js       (IIFE → window.BUSINESS_RULES)
 *   - apps/user-app/js/shared/business-rules-adapter.js          (IIFE sibling, byte-identical to admin)
 *
 * Naming-collision warning:
 *   types/services.ts:164 exports a function ALSO named `isFixedService`. That is a
 *   TYPESCRIPT TYPE GUARD with NARROWER semantics — it only checks `s.type === 'fixed'`
 *   and does NOT cover `legal_procedure + pricingType === 'fixed'`. Use THIS module
 *   for business logic. The TS guard will be renamed to `isStrictlyFixedShape` in PR-2.1.1b.
 *
 * The 4 production service shapes:
 *   1. type='hours'              — hourly billing, packages[], blockable
 *   2. type='fixed'              — flat fee, work{}, NOT blockable
 *   3. type='legal_procedure' + pricingType='hourly' — stages[]→packages[], blockable
 *   4. type='legal_procedure' + pricingType='fixed'  — stages[], NOT blockable
 *
 * Truth table (predicate × shape):
 *                                  | hours | fixed | LP-hourly | LP-fixed | null/undefined |
 *   isFixedService                 |   F   |   T   |     F     |    T     |       F        |
 *   isHourlyService                |   T   |   F   |     T     |    F     |       F        |
 *   isLegalProcedureService        |   F   |   F   |     T     |    T     |       F        |
 */

function isFixedService(svc) {
  if (!svc || typeof svc !== 'object' || !svc.type) {
    return false;
  }
  return svc.type === 'fixed' ||
    (svc.type === 'legal_procedure' && svc.pricingType === 'fixed');
}

function isHourlyService(svc) {
  if (!svc || typeof svc !== 'object' || !svc.type) {
    return false;
  }
  return svc.type === 'hours' ||
    (svc.type === 'legal_procedure' && svc.pricingType === 'hourly');
}

function isLegalProcedureService(svc) {
  if (!svc || typeof svc !== 'object' || !svc.type) {
    return false;
  }
  return svc.type === 'legal_procedure';
}

module.exports = {
  isFixedService,
  isHourlyService,
  isLegalProcedureService
};
