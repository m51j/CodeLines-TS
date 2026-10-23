import { useEffect } from "react";
import { Empty } from "../components";
import { AgentSources, Reports } from "../reports";
import { agentLabels } from "../../shared/agents";
import { useWorkspace } from "../workspace";
const notScanned = Object.entries(agentLabels).map(([id, label]) => ({
  id,
  label,
  state: "NotFound" as const,
  records: 0,
  elapsed: 0,
}));
export function AiUsage() {
  const { state, draft, busy, execute, aiOpened } = useWorkspace();
  const { enabled, autoRefreshOnOpen } = draft.aiUsage;
  useEffect(() => {
    if (enabled && autoRefreshOnOpen && !aiOpened.current && !busy) {
      aiOpened.current = true;
      void execute("ai");
    }
  }, [enabled, autoRefreshOnOpen, busy, execute, aiOpened]);
  if (state.ai) return <Reports result={state.ai} />;
  return (
    <>
      <Empty title="A clearer picture of AI usage">
        Refresh to read local coding-agent usage. Cache reads and writes count
        toward real tokens.
      </Empty>
      <AgentSources agents={notScanned} />
    </>
  );
}
