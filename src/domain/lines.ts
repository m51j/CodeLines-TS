import type { Lines } from "../shared/contracts";
import type { Language } from "./languages";
export function analyzeLines(text: string, language: Language): Lines {
  const lines = text.length ? text.split(/\r\n|\r|\n/) : [];
  if (/[\r\n]$/.test(text)) lines.pop();
  const v: Lines = {
    physicalLines: lines.length,
    blankLines: 0,
    codeLines: 0,
    commentLines: 0,
    mixedLines: 0,
    contentLines: 0,
  };
  let active: string | null = null;
  for (const line of lines) {
    if (language.category === "DocumentationText") {
      if (!line.trim()) v.blankLines++;
      else v.contentLines++;
      continue;
    }
    if (!line.trim() && active === null) {
      v.blankLines++;
      continue;
    }
    let code = false,
      comment = false,
      quote: string | null = null,
      escaped = false;
    for (let i = 0; i < line.length;) {
      if (active !== null) {
        comment = true;
        const end = line.indexOf(active, i);
        if (end < 0) break;
        i = end + active.length;
        active = null;
        continue;
      }
      const ch = line[i];
      if (quote !== null) {
        code = true;
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === quote) quote = null;
        i++;
        continue;
      }
      // Comment markers are matched before quotes so a marker that is itself a
      // quote character (Visual Basic's ') starts a comment, and the longest
      // marker wins so a block opener (Lua's --[[) beats its line prefix (--).
      const lineMarker = language.comments.find(
          (m) =>
            line.startsWith(m, i) &&
            (m !== "REM " || i === 0 || /\s/.test(line[i - 1])),
        ),
        block = language.blocks.find((b) => line.startsWith(b[0], i));
      if (block && (!lineMarker || block[0].length > lineMarker.length)) {
        comment = true;
        active = block[1];
        i += block[0].length;
        continue;
      }
      if (lineMarker) {
        comment = true;
        break;
      }
      if (ch === "'" || ch === '"' || ch === "`") {
        code = true;
        quote = ch;
        i++;
        continue;
      }
      if (ch.trim()) code = true;
      i++;
    }
    if (code) {
      v.codeLines++;
      if (comment) v.mixedLines++;
    } else if (comment) v.commentLines++;
    else if (!line.trim()) v.blankLines++;
    else v.codeLines++;
  }
  return v;
}
