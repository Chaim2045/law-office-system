/**
 * Approval Helper Functions
 * פונקציות עזר למערכת אישור תקציבים
 */

export function formatRelativeTime(date) {
  if (!date) return '';

  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return 'לפני רגע';
  if (minutes < 60) return `לפני ${minutes} דקות`;
  if (hours < 24) return `לפני ${hours} שעות`;
  if (days < 7) return `לפני ${days} ימים`;

  return date.toLocaleDateString('he-IL');
}

export function formatMinutesToHoursText(minutes) {
  if (!minutes) return '0 דקות';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) return `${mins} דקות`;
  if (mins === 0) return `${hours} שעה${hours > 1 ? '' : ''}`;
  return `${hours} שעה ${mins} דקות`;
}

export function getStatusColor(status) {
  switch (status) {
    case 'pending': return '#f59e0b';
    case 'approved': return '#10b981';
    case 'modified': return '#3b82f6';
    case 'rejected': return '#ef4444';
    default: return '#6b7280';
  }
}

export function getStatusText(status) {
  switch (status) {
    case 'pending': return 'ממתין';
    case 'approved': return 'אושר';
    case 'modified': return 'אושר עם שינוי';
    case 'rejected': return 'נדחה';
    default: return status;
  }
}

export function getStatusIcon(status) {
  switch (status) {
    case 'pending': return 'fa-clock';
    case 'approved': return 'fa-check-circle';
    case 'modified': return 'fa-edit';
    case 'rejected': return 'fa-times-circle';
    default: return 'fa-question-circle';
  }
}

export function validateApproval(minutes, adminEmail) {
  if (!minutes || minutes <= 0) {
    return 'תקציב חייב להיות גדול מ-0';
  }
  if (minutes > 480) {
    return 'תקציב לא יכול לעלות על 8 שעות';
  }
  return null;
}

export function validateRejection(reason) {
  if (!reason || reason.trim().length === 0) {
    return 'נדרשת סיבת דחייה';
  }
  if (reason.length < 10) {
    return 'נדרשת סיבת דחייה מפורטת יותר (לפחות 10 תווים)';
  }
  return null;
}

export function calculateBudgetChange(requested, approved) {
  if (!requested || !approved) return 0;
  return Math.round(((approved - requested) / requested) * 100);
}

export function filterApprovalsBySearch(approvals, searchTerm) {
  if (!searchTerm) return approvals;

  const term = searchTerm.toLowerCase();
  return approvals.filter(approval => {
    return (
      approval.requestedByName?.toLowerCase().includes(term) ||
      approval.taskData.clientName?.toLowerCase().includes(term) ||
      approval.taskData.description?.toLowerCase().includes(term)
    );
  });
}

export function sortApprovals(approvals, sortBy) {
  const sorted = [...approvals];

  switch (sortBy) {
    case 'date-desc':
      return sorted.sort((a, b) => b.requestedAt - a.requestedAt);
    case 'date-asc':
      return sorted.sort((a, b) => a.requestedAt - b.requestedAt);
    case 'employee':
      return sorted.sort((a, b) => (a.requestedByName || '').localeCompare(b.requestedByName || '', 'he'));
    case 'budget-high':
      return sorted.sort((a, b) => (b.taskData?.estimatedMinutes || 0) - (a.taskData?.estimatedMinutes || 0));
    case 'budget-low':
      return sorted.sort((a, b) => (a.taskData?.estimatedMinutes || 0) - (b.taskData?.estimatedMinutes || 0));
    default:
      return sorted;
  }
}
