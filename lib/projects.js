export function serializeProject(project) {
  return {
    id: String(project._id),
    name: project.name,
    description: project.description,
    status: project.status,
    createdBy: String(project.createdBy),
    memberIds: (project.memberIds || []).map(String),
    labels: (project.labels || []).map((l) => ({ id: l.id, name: l.name, color: l.color })),
    startAt: project.startAt,
    dueAt: project.dueAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
