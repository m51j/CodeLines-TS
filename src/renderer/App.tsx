import { useState } from "react";
import { useAppearance } from "./appearance/useAppearance";
import { visiblePages, type Page } from "./pages";
import { loaders, shells } from "./skins";
import { appStyles } from "./skins/styles";
import { WorkspaceContext, useWorkspaceState, type Workspace } from "./workspace";
// Only pure domain helpers are imported by the renderer. No Node or filesystem modules enter this bundle.
export function App() {
  const workspace = useWorkspaceState();
  // The page lives here so switching skins keeps it.
  const [page, setPage] = useState<Page>("Dashboard");
  const draft = workspace.draft;
  useAppearance(
    draft ? { appearance: draft.appearance, theme: draft.theme } : null,
    appStyles,
  );
  if (!workspace.state || !draft) {
    const Loading = loaders[window.codelines.boot.appearance.skin];
    return <Loading error={workspace.error} />;
  }
  const ws = workspace as Workspace;
  const visible = visiblePages(draft);
  // A page hidden in Settings falls back to the dashboard.
  const current = visible.find((p) => p.name === page) ?? visible[0];
  const Shell = shells[draft.appearance.skin];
  return (
    <WorkspaceContext.Provider value={ws}>
      <Shell page={current} visible={visible} setPage={setPage} />
    </WorkspaceContext.Provider>
  );
}
