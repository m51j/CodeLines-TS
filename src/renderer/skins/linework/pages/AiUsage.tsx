/**
 * AI usage: the agent strip (chips with all-time totals over a share ribbon), the report
 * heading, a sticky control deck (section tabs with an ink bar, range and grouping with
 * sliding thumbs, From/To dates), notes, the section, and the agent sources.
 * Each agent remembers its own tab, range, grouping and dates.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { agentLabels } from "../../../../shared/agents";
import type { AiResult } from "../../../../shared/contracts";
import { reportModel, selectReport } from "../../../../reports/selectors";
import { tokens } from "../../../../ai/model";
import { play } from "../../../motion/core";
import { useWorkspace } from "../../../workspace";
import { Ribbon } from "../charts/Ribbon";
import { Icon } from "../icons";
import { Seg, Tabs } from "../ui/Choice";
import { Disclosure, EmptyState } from "../ui/controls";
import { agentColor, compact, date, number, percent, seriesColor } from "../ui/fmt";
import { AgentSources, type Ctx, type Selection } from "./ai/shared";
import { Models, Overview, Projects, Tables, Time } from "./ai/Sections";

const notScanned = Object.entries(agentLabels).map(([id, label]) => ({ id, label, state: "NotFound" as const, records: 0, elapsed: 0 }));
const defaults: Selection = { tab: "Overview", range: 0, group: "agent", since: "", until: "" };
const sectionTabs: Selection["tab"][] = ["Overview", "Models", "Time", "Tables", "Projects"];

export function AiUsage() {
  const { state, draft, busy, execute, aiOpened } = useWorkspace();
  const { enabled, autoRefreshOnOpen } = draft.aiUsage;
  useEffect(() => {
    if (enabled && autoRefreshOnOpen && !aiOpened.current && !busy) {
      aiOpened.current = true;
      void execute("ai");
    }
  }, [enabled, autoRefreshOnOpen, busy, execute, aiOpened]);
  if (!state.ai)
    return (
      <>
        <EmptyState
          title="A clearer picture of AI usage"
          art="spark"
          action={
            <button className="btn primary" type="button" disabled={!!busy} onClick={() => void execute("ai")}>
              <Icon name="refresh" />
              Refresh
            </button>
          }
        >
          Refresh to read local coding-agent usage. Cache reads and writes count toward real tokens.
        </EmptyState>
        <AgentSources agents={notScanned} />
      </>
    );
  return <Reports result={state.ai} />;
}

function Reports({ result }: { result: AiResult }) {
  const [picked, setAgent] = useState("all"),
    [selections, setSelections] = useState<Record<string, Selection>>({});
  const combined = result.combined;
  const agent = picked === "all" || combined?.agents[picked] ? picked : "all",
    all = agent === "all";
  const sel = selections[agent] ?? defaults;
  const update = (patch: Partial<Selection>) => setSelections((p) => ({ ...p, [agent]: { ...(p[agent] ?? defaults), ...patch } }));
  const invalid = !!(sel.since && sel.until && sel.since > sel.until);

  const allTime = useMemo(() => {
    const t: Record<string, number> = { all: 0 };
    for (const f of reportModel(result).facts) {
      const n = tokens(f.v);
      t.all += n;
      t[f.agent] = (t[f.agent] ?? 0) + n;
    }
    if (result.claude && result.combined?.agents.claude) t.claude = reportModel(result, "claude").facts.reduce((n, f) => n + tokens(f.v), 0);
    return t;
  }, [result]);
  const model = useMemo(() => reportModel(result, agent), [result, agent]);
  const view = useMemo(
    () => (invalid ? null : selectReport(model, { range: sel.range, since: sel.since, until: sel.until, group: all ? sel.group : "model" })),
    [model, sel.range, sel.since, sel.until, sel.group, all, invalid],
  );
  const ctx = useMemo<Ctx | null>(() => {
    if (!view) return null;
    const label = (k: string) =>
      k.includes("::") ? (all ? (model.labels[k.split("::")[0]] ?? k.split("::")[0]) + " · " : "") + k.slice(k.indexOf("::") + 2) : (model.labels[k] ?? k);
    const byAgentGroup = all && sel.group === "agent";
    return {
      model,
      view,
      all,
      sel,
      total: tokens(view.total),
      label,
      byAgentGroup,
      groupColor: new Map(view.groups.map((g, i) => [g.key, byAgentGroup ? agentColor(g.key) : seriesColor(i)])),
      tzLabel: combined?.meta.tzLabel ?? "",
    };
  }, [view, model, all, sel, combined]);

  // The report name rises when the agent changes; the section rises in on a new tab or agent.
  const name = useRef<HTMLSpanElement>(null),
    section = useRef<HTMLDivElement>(null),
    seen = useRef({ agent, key: agent + sel.tab });
  useLayoutEffect(() => {
    const before = seen.current;
    seen.current = { agent, key: agent + sel.tab };
    if (before.agent !== agent) play(name.current, [{ opacity: 0, transform: "translateY(30%)" }, { opacity: 1, transform: "none" }], { duration: 260 });
    if (before.key !== agent + sel.tab)
      play(section.current, [{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 260 });
  }, [agent, sel.tab]);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    if (invalid) play(errorRef.current, [{ opacity: 0, transform: "translateY(-4px)" }, { opacity: 1, transform: "none" }], { duration: 200 });
  }, [invalid]);

  if (!combined)
    return (
      <>
        <EmptyState title="No local AI usage found" art="search">
          Refresh to read supported agents’ local files. Agent statuses appear below.
        </EmptyState>
        <AgentSources agents={result.agents} />
      </>
    );

  const agents = Object.entries(combined.agents);
  const strip = [{ id: "all", label: "All agents" }, ...agents.map(([id, a]) => ({ id, label: a.label }))];
  const notes = new Map<string, string[]>();
  for (const [id, source] of agents) {
    if (!source.note || (!all && id !== agent)) continue;
    notes.set(source.note, [...(notes.get(source.note) ?? []), source.label]);
  }
  const rangeValue = sel.since || sel.until ? "" : String(sel.range);
  const Section = { Overview, Models, Time, Tables, Projects }[sel.tab];
  return (
    <div className="ai">
      <div className="agent-strip-wrap">
        <div
          className="agent-strip"
          role="tablist"
          aria-label="AI agent reports"
          onKeyDown={(e) => {
            const list = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-a]")],
              i = list.indexOf(document.activeElement as HTMLButtonElement);
            if (i < 0) return;
            const n =
              e.key === "ArrowRight"
                ? (i + 1) % list.length
                : e.key === "ArrowLeft"
                  ? (i - 1 + list.length) % list.length
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? list.length - 1
                      : -1;
            if (n < 0) return;
            e.preventDefault();
            list[n].focus();
            setAgent(list[n].dataset.a!);
          }}
        >
          {strip.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              className="agent-chip"
              id={"lw-agent-" + a.id}
              data-a={a.id}
              aria-selected={a.id === agent}
              tabIndex={a.id === agent ? 0 : -1}
              aria-controls="lw-agent-panel"
              style={{ ["--c" as string]: a.id === "all" ? "var(--accent)" : agentColor(a.id) }}
              onClick={() => setAgent(a.id)}
            >
              <i aria-hidden="true" />
              <span className="ac-name">{a.label}</span>
              <span className="ac-tot" title={`${number(allTime[a.id] ?? 0)} all-time tokens`}>
                {compact(allTime[a.id] ?? 0)}
              </span>
            </button>
          ))}
        </div>
        <Ribbon
          className="agent-ribbon thin"
          segments={agents.map(([id, a]) => ({
            key: id,
            label: a.label,
            share: (allTime[id] ?? 0) / (allTime.all || 1),
            color: agentColor(id),
            detail: `All-time tokens: ${number(allTime[id] ?? 0)} · Share: ${percent((allTime[id] ?? 0) / (allTime.all || 1))}`,
          }))}
        />
      </div>
      <div role="tabpanel" id="lw-agent-panel" aria-labelledby={"lw-agent-" + agent}>
        <div className="report-heading">
          <h2>
            <span className="rh-name" ref={name}>
              {all ? "All agents" : (model.labels[agent] ?? agent)}
            </span>
            <span className="rh-tag">Real token usage</span>
          </h2>
          <p>Cache included · Local data · Updated {date(result.generatedAt)}</p>
        </div>
        <div className="deck">
          <Tabs
            label="AI report tabs"
            id="lw-ai"
            value={sel.tab}
            onChange={(tab) => update({ tab })}
            options={sectionTabs.map((t) => ({ v: t, l: t, controls: "lw-ai-section" }))}
          />
          <span className="deck-sep" aria-hidden="true" />
          <Seg
            label="Report range"
            value={rangeValue}
            onChange={(v) => update({ range: Number(v), since: "", until: "" })}
            options={["0", "90", "30", "7"].map((n) => ({ v: n, l: n === "0" ? "All" : n + "d" }))}
          />
          <Seg
            label="Group usage"
            hidden={!all}
            value={sel.group}
            onChange={(group) => update({ group })}
            options={[
              { v: "agent", l: "By agent" },
              { v: "model", l: "By model" },
            ]}
          />
          <div className="date-fields">
            <label>
              From{" "}
              <input
                type="date"
                aria-label="Report start date"
                aria-invalid={invalid}
                aria-describedby={invalid ? "lw-date-error" : undefined}
                value={sel.since}
                onChange={(e) => update({ since: e.target.value, range: 0 })}
              />
            </label>
            <label>
              To{" "}
              <input
                type="date"
                aria-label="Report end date"
                aria-invalid={invalid}
                aria-describedby={invalid ? "lw-date-error" : undefined}
                value={sel.until}
                onChange={(e) => update({ until: e.target.value, range: 0 })}
              />
            </label>
            {(sel.since || sel.until) && (
              <button type="button" className="btn sm ghost" onClick={() => update({ since: "", until: "", range: 0 })}>
                Clear dates
              </button>
            )}
          </div>
        </div>
        {invalid && (
          <p className="date-error" id="lw-date-error" role="alert" ref={errorRef}>
            <Icon name="alert" />
            Start date must be on or before end date.
          </p>
        )}
        <p className="footnote">
          <Icon name="clock" />
          <span>
            {combined.meta.tzLabel} · {model.facts.length.toLocaleString()} hourly facts · Equivalent API costs · * partial cost · ¹ Reasoning is
            included in output.
          </span>
        </p>
        {notes.size > 0 && (
          <Disclosure
            key={agent}
            className="accuracy"
            summary={
              <>
                Data accuracy notes <span className="badge">{notes.size}</span>
              </>
            }
          >
            <ul>
              {[...notes].map(([note, labels]) => (
                <li key={note}>
                  <strong>{labels.join(", ")}</strong>: {note}
                </li>
              ))}
            </ul>
          </Disclosure>
        )}
        <div role="tabpanel" className="ai-section" id="lw-ai-section" aria-labelledby={"lw-ai-t-" + sel.tab} ref={section}>
          {invalid || !ctx ? null : !ctx.view.days.length ? (
            <EmptyState title="No usage in this range" art="search">
              Choose another period or clear the dates to see usage.
            </EmptyState>
          ) : (
            <Section key={agent + sel.tab} c={ctx} />
          )}
        </div>
      </div>
      <AgentSources agents={result.agents} />
    </div>
  );
}
