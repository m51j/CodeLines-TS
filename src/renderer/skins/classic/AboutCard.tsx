import { Bug, ExternalLink, Github, Globe, ScrollText } from "lucide-react";
import { Card } from "../../components";
import { appVersion, copyrightLine, developer, openAboutLink, type AboutLink } from "../../about";
import { NexteLogo } from "../../ui/NexteLogo";
import { useWorkspace } from "../../workspace";
/** Classic's About card: version, the developer and the open-source project links. */
export function AboutCard() {
  const { setError } = useWorkspace();
  const open = (link: AboutLink) => openAboutLink(link, setError);
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
      </div>
    </Card>
  );
}
