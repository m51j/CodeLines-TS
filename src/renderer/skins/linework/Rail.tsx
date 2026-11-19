/**
 * The line rail: one Git-style line with a station per page. A "train" slides to the
 * active station with a slight spring, the accent fill grows along the line and the
 * active node glows. Optional pages sit on branches that fold away when turned off.
 */
import type { CSSProperties } from "react";
import { pageDefs, type Page, type PageDef } from "../../pages";
import { useAppearanceControls } from "../../appearance/controls";
import { ThemeSeg } from "./Appearance";
import { Icon, type IconName } from "./icons";

export const pageIcons: Record<Page, IconName> = {
  Dashboard: "dash",
  Projects: "folder",
  Analysis: "analysis",
  "Code changes": "branch",
  "Daily log": "calendar",
  "AI usage": "spark",
  Settings: "gear",
};

export function Rail({
  page,
  visible,
  go,
  collapsed,
  onCollapse,
}: {
  page: PageDef;
  visible: PageDef[];
  go: (p: Page) => void;
  collapsed: boolean;
  onCollapse: () => void;
}) {
  const c = useAppearanceControls();
  const shown = new Set(visible.map((p) => p.name)),
    active = Math.max(0, visible.findIndex((p) => p.name === page.name));
  return (
    <nav className={"rail" + (collapsed ? " collapsed" : "")} aria-label="Main navigation">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
          <rect className="bm-bg" x="1" y="1" width="38" height="38" rx="11" />
          <path className="bm-l bm-1" d="M10 13h16" />
          <path className="bm-l bm-2" d="M15 20h15" />
          <path className="bm-l bm-3" d="M15 27h9" />
        </svg>
        <div className="brand-text">
          <strong>CodeLines</strong>
          <span>Project intelligence</span>
        </div>
      </div>
      <div className="stations" role="list" style={{ "--active": active, "--count": visible.length } as CSSProperties}>
        <span className="line-base" aria-hidden="true" />
        <span className="line-fill" aria-hidden="true" />
        <span className="train" aria-hidden="true" />
        {pageDefs.map((p) => {
          const on = shown.has(p.name),
            isActive = p.name === page.name,
            n = visible.findIndex((v) => v.name === p.name) + 1;
          return (
            <div
              role={on ? "listitem" : undefined}
              key={p.name}
              className={"st-item" + (p.optional ? " forked" : "") + (on ? "" : " gone")}
              aria-hidden={on ? undefined : true}
            >
              <button
                type="button"
                className={"station" + (isActive ? " active" : "")}
                aria-current={isActive ? "page" : undefined}
                title={n ? `${p.name} (Alt+${n})` : p.name}
                tabIndex={on ? 0 : -1}
                inert={!on}
                onClick={() => go(p.name)}
              >
                <span className="st-node" aria-hidden="true">
                  {p.optional && (
                    <svg className="st-branch" viewBox="0 0 24 44">
                      <path d="M6 0v44M6 6c0 9 12 7 12 16s-12 7-12 16" />
                    </svg>
                  )}
                  <i />
                </span>
                <Icon name={pageIcons[p.name]} className="st-ic" />
                <span className="st-label">{p.name}</span>
                <kbd className="st-key" aria-hidden="true">
                  {n ? "Alt " + n : ""}
                </kbd>
              </button>
            </div>
          );
        })}
      </div>
      <div className="rail-foot">
        <div className="privacy" tabIndex={0} title="Local by design — your source and usage stay on this computer.">
          <Icon name="shield" />
          <div>
            <strong>Local by design</strong>
            <p>Your source and usage stay on this computer.</p>
          </div>
        </div>
        <ThemeSeg c={c} labels={false} label="Appearance" className="theme-switch" />
        <button
          className="rail-collapse"
          type="button"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
          onClick={onCollapse}
        >
          <Icon name="sidebar" />
          <span>{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>
    </nav>
  );
}
