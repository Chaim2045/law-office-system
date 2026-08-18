/**
 * Task Approval Dialog — RETIRED (H.4 PR-a, 2026-06-15)
 * ─────────────────────────────────────────────────────
 * The approve/reject budget gate this dialog drove is DEAD: it called the Cloud
 * Functions `approveTaskBudget`/`rejectTaskBudget`, which DO NOT EXIST. Tasks
 * auto-activate at creation (createBudgetTask hardcodes status:'פעיל'), so there
 * was never a gate to approve. Budget enforcement is now VISIBILITY via the
 * "חריגות תקציב" side panel ("Model A: smart budget meter"), not an approval gate.
 *
 * This module is kept as a minimal inert stub ONLY because two admin pages still
 * `import { TaskApprovalDialog }` globally (index.html / clients.html). It no
 * longer renders approve/reject actions and no longer calls any Cloud Function.
 * Removing the import lines is the follow-up; the stub prevents a broken import
 * in the meantime.
 */

export class TaskApprovalDialog {
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * No-op. The approve/reject gate was removed in H.4 PR-a. Kept so legacy
   * callers (if any) do not throw; logs a clear notice for developers.
   */
  show() {
    console.warn(
      'ℹ️ TaskApprovalDialog is retired (H.4 PR-a). Budget enforcement is now ' +
      'visibility via the "חריגות תקציב" panel — there is no approve/reject gate.'
    );
  }

  hide() {
    // no-op — nothing is rendered.
  }
}
