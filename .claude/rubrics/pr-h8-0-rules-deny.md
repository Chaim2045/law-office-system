# Rubric: H.8.0 PR4 — firestore.rules + indexes retirement + deny-suite

**PR scope:** Remove `match /user_messages/{messageId}` + `match /replies/{replyId}` from
`firestore.rules`; remove 5 `user_messages` index entries from `firestore.indexes.json`;
add `tests/rules/userMessages.test.ts` (16-scenario deny-suite); extend the rules
drift-guard with 2 negative assertions.

**Scope lock:** Backend-only (rules + indexes + tests). No frontend. No Cloud Functions.

---

## MUST criteria (all required — any FAIL = grader FAIL)

| # | Criterion | How to verify |
|---|-----------|---------------|
| M1 | `match /user_messages/{messageId}` block absent from `firestore.rules` | `grep -c "match /user_messages/" firestore.rules` → 0 |
| M2 | `match /replies/{replyId}` subcollection absent from `firestore.rules` | `grep -c "match /replies/" firestore.rules` → 0 |
| M3 | 5 `user_messages` collectionGroup entries removed from `firestore.indexes.json` | `grep -c "user_messages" firestore.indexes.json` → 0 |
| M4 | `tests/rules/userMessages.test.ts` exists with ≥16 deny scenarios (4 contexts × {msg read, msg write, reply read, reply write}) | count `it(` calls in the file |
| M5 | Drift-guard has negative assertion `expect(prodSource).not.toContain('match /user_messages/')` | grep `rules-drift-guard.test.ts` |
| M6 | Drift-guard has negative assertion `expect(prodSource).not.toContain('match /replies/')` | grep `rules-drift-guard.test.ts` |
| M7 | `npx vitest run` from worktree root passes (≥808 tests) | run and check exit code |
| M8 | Zero `user_messages` references remain anywhere in `firestore.rules` and `firestore.indexes.json` | grep both files |
| M9 | `getParentMessage` and `isRecipient` helper functions absent from `firestore.rules` | grep `firestore.rules` |

## SHOULD criteria (warnings only — do not block)

| # | Criterion |
|---|-----------|
| S1 | Deny-suite header documents it runs against `firestore.rules.test` (not the production file) |
| S2 | PR body includes grep output as evidence (not just assertions) |

---

## PRODUCT-GRADE GATES

| Gate | Status | Reason |
|------|--------|--------|
| G1 | N/A | No customer-facing UI strings changed |
| G2 | PASS | Rollback = `git revert <commit>` + `firebase deploy --only firestore:rules,firestore:indexes` |
| G3 | N/A | No data mutations — rules + indexes are access-control only |
| G4 | PASS | 16-scenario deny-suite in `tests/rules/userMessages.test.ts` + 2 negative drift-guard assertions |
| G5 | N/A | No Hebrew UI strings |
| G6 | PASS | No breaking change for live consumers — the collection was already dead (zero code paths reach it post-PR3) |
| G7 | PASS | Security rule change → devils-advocate reviewed; verdict GO-WITH-CHANGES; all 3 required changes folded in |
