import { obj, num, str, parseTimestamp, type ClaudeRecord } from "./model";
import { normalizeClaude } from "./pricing";
export function parseClaudeLine(line: string): ClaudeRecord | null {
  if (
    line.length < 80 ||
    !line.includes('"usage"') ||
    !line.includes('"type":"assistant"')
  )
    return null;
  let d: Record<string, unknown>;
  try {
    d = obj(JSON.parse(line));
  } catch {
    return null;
  }
  if (d.type !== "assistant") return null;
  const msg = obj(d.message);
  if (!msg.usage || typeof msg.usage !== "object" || Array.isArray(msg.usage))
    return null;
  const u = obj(msg.usage),
    model = str(msg.model),
    ts = parseTimestamp(d.timestamp);
  if (!model || model.startsWith("<") || ts === null) return null;
  const c = obj(u.cache_creation);
  let cw5 = num(c.ephemeral_5m_input_tokens);
  const cw1 = num(c.ephemeral_1h_input_tokens),
    total = num(u.cache_creation_input_tokens);
  if (cw5 + cw1 !== total)
    cw5 = cw5 + cw1 === 0 ? total : Math.max(0, total - cw1);
  return {
    ts,
    model: normalizeClaude(model),
    input: num(u.input_tokens),
    cacheWrite5m: cw5,
    cacheWrite1h: cw1,
    cacheRead: num(u.cache_read_input_tokens),
    output: num(u.output_tokens),
    thinking: num(obj(u.output_tokens_details).thinking_tokens),
    session: str(d.sessionId),
    request: str(d.requestId) || str(msg.id),
    cwd: str(d.cwd),
    branch: str(d.gitBranch),
  };
}
