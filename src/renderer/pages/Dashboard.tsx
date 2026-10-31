import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Card, Empty, Table, Tiles } from "../components";
import { number, percent, palette, tileNumber } from "../format";
import { payloadTotals } from "../../ai/aggregate";
import { dayParts, tokens } from "../../ai/model";
import { useWorkspace } from "../workspace";
import { projectColumns } from "./columns";
export function Dashboard() {
  const { state, draft, busy, act, selected, setSelected } = useWorkspace();
  const snapshot = state.settings.lastSnapshot,
    results = snapshot?.projects ?? [],
    selectedResult =
      results.find((p) => p.projectId === selected) ?? results[0];
  const combined = state.ai?.combined;
  const ai30 = useMemo(() => {
    if (!combined) return null;
    const cut = dayParts(Date.now() - 30 * 86400000, false).day;
    return tokens(payloadTotals(combined, (d) => d > cut));
  }, [combined]);
  if (!results.length)
    return (
      <Empty title="Meet your codebase">
        Add your project folders, then scan to see files, languages, lines, and
        tokens.
        <button
          className="primary"
          disabled={!!busy}
          onClick={() =>
            void act(() => window.codelines.addProject(), "Project added")
          }
        >
          <Plus size={16} />
          Add your first project
        </button>
      </Empty>
    );
  return (
    <>
      <Tiles
        items={[
          {
            label: "Projects",
            value: number(results.length),
            detail: `${draft.projects.filter((p) => p.isEnabled).length} enabled`,
          },
          { label: "Files", value: number(snapshot?.fileCount) },
          {
            label: "Physical lines",
            value: tileNumber(snapshot?.physicalLines),
            title: number(snapshot?.physicalLines),
          },
          {
            label: "Code lines",
            value: tileNumber(snapshot?.codeLines),
            title: number(snapshot?.codeLines),
            tone: "success",
          },
          {
            label: "Source tokens",
            value: tileNumber(snapshot?.totalTokens),
            title: number(snapshot?.totalTokens),
            detail: snapshot?.tokenizerEncoding,
          },
          {
            label: "AI tokens · 30 days",
            value: tileNumber(ai30),
            title: number(ai30),
            detail: "Cache included · all agents",
            tone: "accent",
          },
        ]}
      />
      <div className="dashboard-grid">
        <Card
          title="Project overview"
          subtitle="Latest scan · select a project to explore its languages"
        >
          <Table
            label="Project overview"
            rows={results}
            columns={projectColumns}
            rowKey={(r) => r.projectId}
            onSelect={(r) => setSelected(r.projectId)}
            selected={(r) => r.projectId === selectedResult?.projectId}
          />
        </Card>
        <Card title="Language share" subtitle={selectedResult?.projectName}>
          <div
            className="language-list"
            key={selectedResult?.projectId}
            role="region"
            aria-label="Language share"
            tabIndex={0}
          >
            {!selectedResult?.languages.length && (
              <p className="muted">No language data for this project.</p>
            )}
            {selectedResult?.languages.map((l, i) => {
              const share = percent(
                l.physicalLines / (selectedResult.physicalLines || 1),
              );
              return (
                <div className="language-share" key={l.language}>
                  <div>
                    <span>
                      <i style={{ background: palette[i % palette.length] }} />
                      {l.language}
                    </span>
                    <strong>{share}</strong>
                  </div>
                  <div className="share-track">
                    <div
                      style={{
                        width: share,
                        background: palette[i % palette.length],
                      }}
                    />
                  </div>
                  <small>
                    {number(l.files)} {l.files === 1 ? "file" : "files"} ·{" "}
                    {number(l.physicalLines)} lines · {number(l.tokens)} tokens
                  </small>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
