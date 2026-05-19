import path from "node:path";

export interface WorkspaceRepositoryPaths {
  root: string;
  assets: string;
  imports: string;
  exports: string;
}

export function buildWorkspaceRepositoryPaths(baseDirectory: string, workspaceId: string): WorkspaceRepositoryPaths {
  const root = path.join(baseDirectory, workspaceId);

  return {
    root,
    assets: path.join(root, "assets"),
    imports: path.join(root, "imports"),
    exports: path.join(root, "exports")
  };
}
