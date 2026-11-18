/** AI usage: agent tabs, the sticky report controls, and the five report tabs. */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import type { AiResult } from "../../../../shared/contracts";
import { agentLabels } from "../../../../shared/agents";
import { tokens } from "../../../../ai/model";
import { reportModel, selectReport } from "../../../../reports/selectors";
import { compact, number } from "../../../format";
import { play, reduced } from "../../../motion/core";
import { useWorkspace } from "../../../workspace";
import { memo, useSkin, type AiSelection } from "../context";
import { agentColor, dateTime } from "../format";
import { Icon } from "../icons";
import { Button, Disclosure, Seg } from "../ui/controls";
import { Empty, SwapIn } from "../ui/layout";
import { tip } from "../overlay";
import { Sources, TABS, colorFor, type AiTab, type ReportCtx } from "./ai/common";
import { Models, Overview, ProjectsTab, Tables, Time } from "./ai/sections";
const DEF: AiSelection = { tab: "Overview", range: 0, group: "agent", since: "", until: "" };
const notScanned = Object.entries(agentLabels).map(([id, label]) => ({ id, label, state: "NotFound" as const, records: 0, elapsed: 0 }));
const BUILD: Record<AiTab, (p: { c: ReportCtx }) => JSX.Element> = { Overview, Models, Time, Tables, Projects: ProjectsTab };
export function AiUsage() {
  const { state, draft, busy, execute, aiOpened } = useWorkspace();
  const { enabled, autoRefreshOnOpen } = draft.aiUsage;
  useEffect(() => {
    if (enabled && autoRefreshOnOpen && !aiOpened.current && !busy) {
      aiOpened.current = true;
      void execute("ai");
    }
  }, [enabled, autoRefreshOnOpen, busy, execute, aiOpened]);
  const refresh = <Button label="Refresh now" primary icon="refresh" disabled={!!busy} onClick={() => void execute("ai")} />;
  if (!state.ai)
    return (
      <div className="ai">
        <Empty art="ai" title="A clearer picture of AI usage" text="Refresh to read local coding-agent usage. Cache reads and writes count toward real tokens." action={refresh} />
        <Sources statuses={notScanned} open={false} />
      </div>
    );
  if (!state.ai.combined)
    return (
      <div className="ai">
        <Empty art="ai" title="No local AI usage found" text="Refresh to read supported agents’ local files. Agent statuses appear below." action={refresh} />
        <Sources statuses={state.ai.agents} open />
      </div>
    );
  return <Report result={state.ai} />;
}
function Report({ result }: { result: AiResult }) {
  const combined = result.combined!;
  const skin = useSkin();
  const agent = skin.aiAgent === "all" || combined.agents[skin.aiAgent] ? skin.aiAgent : "all";
  const [sels, setSels] = useState<Record<string, AiSelection>>(() => ({ ...memo.aiSel }));
  const [motionDir, setMotionDir] = useState(1);
  const s = sels[agent] ?? DEF;
  const nav = useId(),
    mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
  }, []);
  /* All-time totals (agent tabs) and a stable model order per agent (series colours never change with the range). */
  const { allTime, rank } = useMemo(() => {
    const allTime: Record<string, number> = { all: 0 },
      perModel: Record<string, Record<string, number>> = {};
    for (const f of reportModel(result).facts) {
      const n = tokens(f.v);
      allTime.all += n;
      allTime[f.agent] = (allTime[f.agent] ?? 0) + n;
      const m = (perModel[f.agent] ??= {});
      m[f.model] = (m[f.model] ?? 0) + n;
    }
    if (result.claude && combined.agents.claude) allTime.claude = reportModel(result, "claude").facts.reduce((n, f) => n + tokens(f.v), 0);
    const rank: Record<string, string[]> = {};
    for (const [a, m] of Object.entries(perModel)) rank[a] = Object.keys(m).sort((x, y) => m[y] - m[x]);
    return { allTime, rank };
  }, [result, combined]);
  const model = useMemo(() => reportModel(result, agent), [result, agent]);
  const group = agent === "all" ? s.group : "model";
  const view = useMemo(() => selectReport(model, { range: s.range, since: s.since, until: s.until, group }), [model, s.range, s.since, s.until, group]);
  const invalid = !!(s.since && s.until && s.since > s.until),
    empty = !view.days.length;
  const update = (patch: Partial<AiSelection>, dir?: number) => {
    if (dir !== undefined) setMotionDir(dir);
    setSels((prev) => {
      const next = { ...prev, [agent]: { ...(prev[agent] ?? DEF), ...patch } };
      memo.aiSel = next;
      return next;
    });
  };
  const agentsList = useMemo(() => [{ id: "all", label: "All agents" }, ...Object.entries(combined.agents).map(([id, a]) => ({ id, label: a.label }))], [combined]);
  const strip = useRef<HTMLDivElement>(null);
  const setAgent = (id: string) => {
    if (id === agent) return;
    setMotionDir(Math.sign(agentsList.findIndex((a) => a.id === id) - agentsList.findIndex((a) => a.id === agent)) || 1);
    skin.setAiAgent(id);
    requestAnimationFrame(() =>
      strip.current?.querySelector(`[data-agent="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced() ? "auto" : "smooth" }),
    );
  };
  const c: ReportCtx = {
    s,
    agent,
    model,
    group,
    view,
    total: tokens(view.total),
    label: (k) =>
      k.includes("::") ? (agent === "all" ? (model.labels[k.split("::")[0]] ?? k.split("::")[0]) + " · " : "") + k.slice(k.indexOf("::") + 2) : (model.labels[k] ?? k),
    colorOf: colorFor(agent, rank),
    tzLabel: combined.meta.tzLabel,
    zoom: (a, b) => update({ since: a, until: b, range: 0 }),
    setAgent,
  };
  const notes = new Map<string, string[]>();
  for (const [id, src] of Object.entries(combined.agents)) {
    if (!src.note || (agent !== "all" && id !== agent)) continue;
    notes.set(src.note, [...(notes.get(src.note) ?? []), src.label]);
  }
  /* The date error slides in with a short shake. */
  const err = useRef<HTMLParagraphElement>(null),
    wasInvalid = useRef(invalid);
  useLayoutEffect(() => {
    if (wasInvalid.current === invalid) return;
    wasInvalid.current = invalid;
    if (invalid)
      play(err.current, [{ opacity: 0, transform: "translateX(-8px)" }, { opacity: 1, transform: "none" }, { transform: "translateX(5px)" }, { transform: "none" }], { duration: 380 });
  }, [invalid]);
  useLayoutEffect(() => tip.hide(), [agent, s.tab]);
  const errId = nav + "-date-error";
  const key = agent + "|" + s.tab + "|" + (invalid ? "invalid" : empty ? "empty" : "ok");
  const Section = BUILD[s.tab];
  const failed = result.agents.some((x) => x.state === "Failed");
  return (
    <div className="ai">
      <div
        ref={strip}
        className="agent-strip"
        role="tablist"
        aria-label="AI agent reports"
        onKeyDown={(e) => {
          const tabs = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')],
            i = tabs.indexOf((e.target as Element).closest('[role="tab"]') as HTMLButtonElement);
          if (i < 0) return;
          const to = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
          if (to >= 0) {
            e.preventDefault();
            tabs[to].focus();
            tabs[to].click();
          }
        }}
      >
        {agentsList.map((a) => (
          <button
            key={a.id}
            type="button"
            className="agent-tab"
            role="tab"
            data-agent={a.id}
            id={`${nav}-agent-${a.id}`}
            aria-controls={nav + "-panel"}
            aria-selected={a.id === agent}
            tabIndex={a.id === agent ? 0 : -1}
            onClick={() => setAgent(a.id)}
          >
            <i className={"dot" + (a.id === "all" ? " dot-all" : "")} style={a.id === "all" ? undefined : { background: agentColor(a.id) }} />
            <span className="agent-tab-name">{a.label}</span>
            <span className="agent-tab-total" title={`${number(allTime[a.id] ?? 0)} all-time tokens`}>
              {compact(allTime[a.id] ?? 0)}
            </span>
            <i className="agent-tab-meter" aria-hidden="true" style={{ "--p": (((allTime[a.id] ?? 0) / (allTime.all || 1)) * 100).toFixed(2) + "%" } as CSSProperties} />
          </button>
        ))}
      </div>
      <div className="ai-panel" role="tabpanel" id={nav + "-panel"} aria-labelledby={`${nav}-agent-${agent}`}>
        <div className="ai-heading">
          <h2 className="ai-title">
            {agent === "all" ? "All agents" : model.labels[agent]}
            <span>Real token usage</span>
          </h2>
          <p className="muted">{`Cache included · Local data · Updated ${dateTime(result.generatedAt)}`}</p>
        </div>
        <div className="ai-bar">
          <Seg<AiTab>
            label="AI report tabs"
            role="tablist"
            className="seg-tabs"
            value={s.tab}
            options={TABS.map((t) => ({ value: t, label: t, id: `${nav}-tab-${t}`, controls: nav + "-report" }))}
            onChange={(t) => update({ tab: t }, Math.sign(TABS.indexOf(t) - TABS.indexOf(s.tab)) || 1)}
          />
          <span className="spacer" />
          <Seg
            label="Group usage"
            value={s.group}
            hidden={agent !== "all"}
            options={[
              { value: "agent", label: "By agent" },
              { value: "model", label: "By model" },
            ]}
            onChange={(g) => update({ group: g })}
          />
          <Seg
            label="Report range"
            value={s.since || s.until ? null : s.range}
            options={[0, 90, 30, 7].map((n) => ({ value: n, label: n ? n + "d" : "All", tip: n ? `Last ${n} recorded days` : "Everything recorded" }))}
            onChange={(n) => update({ range: n, since: "", until: "" })}
          />
          <div className="ai-dates">
            <label>
              <span>From</span>
              <input
                type="date"
                aria-label="Report start date"
                aria-invalid={invalid}
                aria-describedby={invalid ? errId : undefined}
                value={s.since}
                onChange={(e) => update({ since: e.target.value, range: 0 })}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                aria-label="Report end date"
                aria-invalid={invalid}
                aria-describedby={invalid ? errId : undefined}
                value={s.until}
                onChange={(e) => update({ until: e.target.value, range: 0 })}
              />
            </label>
            {(s.since || s.until) && <Button label="Clear dates" small ghost icon="x" onClick={() => update({ since: "", until: "", range: 0 })} />}
          </div>
        </div>
        <p ref={err} className="field-error" role="alert" id={errId} hidden={!invalid}>
          <Icon name="alert" size={14} />
          Start date must be on or before end date.
        </p>
        <p className="muted ai-facts">{`${combined.meta.tzLabel} · ${model.facts.length.toLocaleString("en-US")} hourly facts · Equivalent API costs · * partial cost · ¹ Reasoning is included in output.`}</p>
        {notes.size > 0 && (
          <Disclosure key={agent} className="ai-notes" summary={`Data accuracy notes (${notes.size})`}>
            <ul>
              {Array.from(notes, ([note, labels]) => (
                <li key={note}>
                  <strong>{labels.join(", ")}</strong>: {note}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        <SwapIn key={key} skip={!mounted.current} className="ai-pane" dir={motionDir} distance={22} dur={300} role="tabpanel" id={nav + "-report"} aria-labelledby={`${nav}-tab-${s.tab}`}>
          {invalid ? (
            <div className="ai-void" />
          ) : empty ? (
            <Empty
              art="range"
              title="No usage in this range"
              text="Choose another period or clear the dates to see usage."
              action={<Button label="Clear dates" icon="x" onClick={() => update({ since: "", until: "", range: 0 })} />}
            />
          ) : (
            <Section c={c} />
          )}
        </SwapIn>
      </div>
      <Sources statuses={result.agents} open={failed || memo.aiSourcesOpen} />
    </div>
  );
}
