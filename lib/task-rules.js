// Pure rules (safe to import in both server and client code).
// isManager = owner, or has "projects.manage" / "tasks.manage".
export function canEditTask({ isManager, userId }, task) {
  if (isManager) return true;
  return String(task.createdBy) === userId || (task.assigneeId && String(task.assigneeId) === userId);
}

export function canDeleteTask({ isManager, userId }, task) {
  return isManager || String(task.createdBy) === userId;
}

export function canDeleteComment({ isManager, userId }, comment) {
  return isManager || String(comment.authorId) === userId;
}
