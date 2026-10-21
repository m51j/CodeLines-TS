import type {
  GitProject,
  GitTotals,
  HistoryOptions,
} from "../shared/contracts";
export function gitTotals(
  projects: GitProject[],
  mode: HistoryOptions["mode"],
): GitTotals {
  return {
    added: projects.reduce((n, p) => n + p.added, 0),
    deleted: projects.reduce((n, p) => n + p.deleted, 0),
    modifiedEstimate: projects.reduce((n, p) => n + p.modifiedEstimate, 0),
    net: projects.reduce((n, p) => n + p.net, 0),
    changedFiles: projects.reduce((n, p) => n + p.changedFiles, 0),
    binaryFiles: projects.reduce((n, p) => n + p.binaryFiles, 0),
    commits:
      mode === "Activity"
        ? projects.reduce((n, p) => n + (p.commits ?? 0), 0)
        : null,
    projects: projects.length,
    incompleteProjects: projects.filter((p) => p.isIncomplete).length,
  };
}
export function finishGit(p: GitProject): GitProject {
  p.added = p.files.reduce((n, f) => n + f.added, 0);
  p.deleted = p.files.reduce((n, f) => n + f.deleted, 0);
  p.modifiedEstimate = p.files.reduce((n, f) => n + f.modifiedEstimate, 0);
  p.net = p.added - p.deleted;
  p.changedFiles = p.files.length;
  p.binaryFiles = p.files.filter((f) => f.binary).length;
  return p;
}
