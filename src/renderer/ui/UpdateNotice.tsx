import { useState } from "react";
import { noticeVersion, runUpdateAction, useUpdateState } from "../update";

/**
 * A small corner notice, in every skin, once an update has downloaded (or, in the portable app,
 * once a newer release exists). Dismissing it hides it for that version until the app restarts.
 */
export function UpdateNotice({ onError }: { onError: (e: unknown) => void }) {
  const state = useUpdateState();
  const [dismissed, setDismissed] = useState<string | null>(null);
  const version = noticeVersion(state);
  if (!version || dismissed === version) return null;
  const ready = state?.status === "ready";
  return (
    <div className="ui-update" role="status" aria-live="polite">
      <div className="ui-update-text">
        <strong>CodeLines {version}</strong>
        <span>{ready ? "is ready to install." : "is available to download."}</span>
      </div>
      <div className="ui-update-actions">
        <button type="button" className="ui-update-later" onClick={() => setDismissed(version)}>
          Later
        </button>
        <button type="button" className="ui-update-go" onClick={() => runUpdateAction("install", onError)}>
          {ready ? "Restart to update" : "Download"}
        </button>
      </div>
    </div>
  );
}
