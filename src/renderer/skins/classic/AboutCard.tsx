import { Bug, Download, ExternalLink, Github, Globe, RefreshCw, RotateCcw, ScrollText } from "lucide-react";
import { Card } from "../../components";
import { appVersion, copyrightLine, developer, openAboutLink, type AboutLink } from "../../about";
import { NexteLogo } from "../../ui/NexteLogo";
import { runUpdateAction, updateView, useUpdateState } from "../../update";
import { useWorkspace } from "../../workspace";
/** Classic's About card: version, the developer and the open-source project links. */
export function AboutCard() {
  const { setError, draft, setUpdates } = useWorkspace();
  const open = (link: AboutLink) => openAboutLink(link, setError);
  const update = updateView(useUpdateState());
  const UpdateIcon = { check: RefreshCw, restart: RotateCcw, download: Download }[update.action?.icon ?? "check"];
  return (
    <Card title="About" subtitle="Free, open-source software for understanding your code and AI usage">
      <div className="about-grid">
        <div className="about-block">
          <div className="about-app">
            <div className="brand-mark" aria-hidden="true">
              CL
            </div>
            <div>
              <strong>CodeLines</strong>
              <span>Version {appVersion()}</span>
            </div>
          </div>
          <p className="muted">Project intelligence, local by design: your source and usage stay on this computer.</p>
        </div>
        <div className="about-block">
          <span className="about-label">Developed by</span>
          <NexteLogo height={20} className="about-nexte" />
          <p>
            <strong>{developer.name}</strong> ·{" "}
            <span lang="ar" dir="rtl">
              {developer.nameAr}
            </span>
          </p>
          <p className="muted">{developer.tagline}</p>
          <div className="about-actions">
            <button type="button" onClick={() => open("website")}>
              <Globe size={15} aria-hidden="true" />
              {developer.site}
              <ExternalLink size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="about-block">
          <span className="about-label">Open source</span>
          <p className="muted">{copyrightLine}</p>
          <div className="about-actions">
            <button type="button" onClick={() => open("repo")}>
              <Github size={15} aria-hidden="true" />
              GitHub repository
            </button>
            <button type="button" onClick={() => open("issues")}>
              <Bug size={15} aria-hidden="true" />
              Report an issue
            </button>
            <button type="button" onClick={() => open("releases")}>
              <ScrollText size={15} aria-hidden="true" />
              Release notes
            </button>
          </div>
        </div>
        <div className="about-block">
          <span className="about-label">Updates</span>
          <p className="muted update-status" data-tone={update.tone}>
            {update.text}
          </p>
          {update.progress !== null && (
            <div className="ui-update-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(update.progress)}>
              <i style={{ width: `${update.progress}%` }} />
            </div>
          )}
          {update.action && (
            <div className="about-actions">
              <button type="button" disabled={update.action.disabled} onClick={() => runUpdateAction(update.action!.kind, setError)}>
                <UpdateIcon size={15} aria-hidden="true" />
                {update.action.label}
              </button>
            </div>
          )}
          {update.canAutoCheck && (
            <label className="check">
              <input type="checkbox" checked={draft.updates.autoCheck} onChange={(e) => void setUpdates({ autoCheck: e.target.checked })} />
              Check for updates automatically
            </label>
          )}
        </div>
      </div>
    </Card>
  );
}
