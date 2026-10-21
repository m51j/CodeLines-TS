import path from "node:path";
import fs from "node:fs";
export interface IgnoreRule {
  regex: RegExp;
  negated: boolean;
  directoryOnly: boolean;
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const slash = (s: string) => s.replaceAll("\\", "/");
export function within(root: string, file: string): boolean {
  const a = path.resolve(root).toLowerCase(),
    b = path.resolve(file).toLowerCase();
  return a === b || b.startsWith(a.endsWith(path.sep) ? a : a + path.sep);
}
export function parseRules(patterns: string[], base = ""): IgnoreRule[] {
  const result: IgnoreRule[] = [];
  for (let value of patterns.map((x) => x.trim())) {
    if (!value || value[0] === "#") continue;
    const negated = value[0] === "!";
    if (negated) value = value.slice(1);
    if (value.startsWith("\\#") || value.startsWith("\\!"))
      value = value.slice(1);
    const directoryOnly = value.endsWith("/");
    value = value.replace(/\/+$/, "");
    if (!value) continue;
    value = slash(value);
    const anchored = value.startsWith("/");
    value = value.replace(/^\/+/, "");
    const hasSlash = value.includes("/");
    let body = "";
    for (let i = 0; i < value.length; i++) {
      const c = value[i];
      if (c === "*") {
        if (value[i + 1] === "*") {
          while (value[i + 1] === "*") i++;
          if (value[i + 1] === "/") {
            i++;
            body += "(?:.*/)?";
          } else body += ".*";
        } else body += "[^/]*";
      } else if (c === "?") body += "[^/]";
      else body += escape(c);
    }
    const prefix = base ? escape(base.replace(/^\/+|\/+$/g, "")) + "/" : "";
    result.push({
      regex: new RegExp(
        (anchored || hasSlash ? "^" + prefix : "^" + prefix + "(?:.*/)?") +
          body +
          (directoryOnly ? "(?:/.*)?" : "") +
          "$",
        "i",
      ),
      negated,
      directoryOnly,
    });
  }
  return result;
}
export class IgnoreProvider {
  private cache = new Map<string, IgnoreRule[]>();
  ignored(
    root: string,
    file: string,
    isDirectory: boolean,
    global: string[],
    project: string[],
  ): boolean {
    if (!within(root, file)) return true;
    const relative = slash(path.relative(root, file));
    const dirs: string[] = [];
    let current =
      isDirectory && fs.existsSync(file) ? file : path.dirname(file);
    while (within(root, current)) {
      dirs.unshift(current);
      if (
        path.resolve(current).toLowerCase() === path.resolve(root).toLowerCase()
      )
        break;
      current = path.dirname(current);
    }
    const rules = parseRules(global);
    for (const d of dirs) {
      const f = path.join(d, ".gitignore");
      let list = this.cache.get(f);
      if (!list) {
        try {
          list = parseRules(
            fs.readFileSync(f, "utf8").split(/\r?\n/),
            slash(path.relative(root, d)),
          );
        } catch {
          list = [];
        }
        this.cache.set(f, list);
      }
      rules.push(...list);
    }
    rules.push(...parseRules(project));
    let ignored = false;
    for (const r of rules)
      if (
        (!r.directoryOnly || isDirectory || relative.includes("/")) &&
        r.regex.test(relative)
      )
        ignored = !r.negated;
    return ignored;
  }
}
