import {
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { FolderSearch } from "lucide-react";
import { number } from "./format";
export { number, signed, percent } from "./format";
export type Tone = "accent" | "success" | "danger";
/** Colors a signed delta: growth green, shrinkage red, zero neutral. */
export const deltaTone = (v: number | null | undefined): Tone | undefined =>
  !v ? undefined : v > 0 ? "success" : "danger";
export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"card " + className}>
      {title && (
        <header className="section-heading">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
export function Tiles({
  items,
}: {
  items: {
    label: string;
    value: ReactNode;
    detail?: ReactNode;
    tone?: Tone;
    title?: string;
  }[];
}) {
  return (
    <div className="tiles">
      {items.map((i) => (
        <div className={"tile" + (i.tone ? " tone-" + i.tone : "")} key={i.label}>
          <span>{i.label}</span>
          <strong title={i.title}>{i.value}</strong>
          {i.detail && <small>{i.detail}</small>}
        </div>
      ))}
    </div>
  );
}
export interface Column<T> {
  label: string;
  key: string;
  value: (row: T) => string | number | null | undefined;
  render?: (row: T) => ReactNode;
  path?: boolean;
}
export function Table<T>({
  label,
  rows,
  columns,
  onSelect,
  selected,
  rowKey,
}: {
  label: string;
  rows: T[];
  columns: Column<T>[];
  onSelect?: (row: T) => void;
  selected?: (row: T) => boolean;
  rowKey?: (row: T) => string;
}) {
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(
      null,
    ),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const needle = query.toLowerCase();
    const filtered = needle
      ? rows.filter((r) =>
          columns.some((c) =>
            String(c.value(r) ?? "")
              .toLowerCase()
              .includes(needle),
          ),
        )
      : [...rows];
    const c = sort && columns.find((c) => c.key === sort.key);
    if (sort && c) filtered.sort((a, b) => compareCells(c.value(a), c.value(b), sort.descending));
    return filtered;
  }, [rows, columns, query, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / 100)),
    current = Math.min(page, pages - 1);
  const columnClasses = useMemo(
    () =>
      columns.map((c) =>
        [
          c.path ? "path-column" : "",
          !c.path && rows.some((r) => typeof c.value(r) === "number")
            ? "numeric-column"
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      ),
    [columns, rows],
  );
  return (
    <div className="data-table">
      <div className="table-tools">
        <span>{number(sorted.length)} rows</span>
        {rows.length > 15 && (
          <input
            aria-label={"Search " + label}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Search rows…"
          />
        )}
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <table>
          <thead>
            <tr>
              {columns.map((c, j) => (
                <th
                  key={c.key}
                  className={columnClasses[j]}
                  aria-sort={
                    sort?.key === c.key
                      ? sort.descending
                        ? "descending"
                        : "ascending"
                      : "none"
                  }
                >
                  <button
                    onClick={() =>
                      setSort({
                        key: c.key,
                        descending:
                          sort?.key === c.key ? !sort.descending : false,
                      })
                    }
                  >
                    {c.label}
                    {sort?.key === c.key ? (sort.descending ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.slice(current * 100, (current + 1) * 100).map((r, i) => (
              <tr key={rowKey?.(r) ?? i} className={selected?.(r) ? "selected" : ""}>
                {columns.map((c, j) => (
                  <td className={columnClasses[j]} key={c.key}>
                    {onSelect && j === 0 ? (
                      <button
                        className="row-link"
                        title={String(c.value(r) ?? "")}
                        onClick={() => onSelect(r)}
                      >
                        {c.render ? c.render(r) : c.value(r)}
                      </button>
                    ) : c.render ? (
                      c.render(r)
                    ) : c.path ? (
                      <span
                        className="project-path"
                        title={String(c.value(r) ?? "")}
                      >
                        {c.value(r)}
                      </span>
                    ) : typeof c.value(r) === "number" ? (
                      number(c.value(r) as number)
                    ) : (
                      (c.value(r) ?? "—")
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!sorted.length && <p className="empty">No records to show.</p>}
      </div>
      {pages > 1 && (
        <div className="pagination">
          <button disabled={!current} onClick={() => setPage(current - 1)}>
            Previous
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
/** Missing values always sort last; numbers compare numerically, text naturally. */
export function compareCells(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  descending = false,
): number {
  const missingA = a === null || a === undefined || a === "",
    missingB = b === null || b === undefined || b === "";
  if (missingA || missingB) return Number(missingA) - Number(missingB);
  const order =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "en", { numeric: true });
  return descending ? -order : order;
}
export function tabKeys(event: KeyboardEvent<HTMLElement>) {
  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  );
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  if (index < 0) return;
  const next =
    event.key === "ArrowRight"
      ? (index + 1) % buttons.length
      : event.key === "ArrowLeft"
        ? (index + buttons.length - 1) % buttons.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : -1;
  if (next >= 0) {
    event.preventDefault();
    buttons[next].focus();
    buttons[next].click();
  }
}
export const col = <T,>(
  key: keyof T & string,
  label: string = key,
  path = false,
): Column<T> => ({
  key,
  label,
  path,
  value: (r) => r[key] as string | number | null | undefined,
});
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon" aria-hidden="true">
        <FolderSearch size={26} strokeWidth={1.75} />
      </div>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {help && <small>{help}</small>}
    </label>
  );
}
export const splitLines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
/**
 * A one-entry-per-line textarea. The raw text stays local so a new empty line
 * can be typed; the parsed list is reported on every change.
 */
export function LinesInput({
  value,
  onChange,
  ...props
}: {
  value: string[];
  onChange: (lines: string[]) => void;
  disabled?: boolean;
  rows?: number;
  className?: string;
  "aria-label"?: string;
}) {
  const [text, setText] = useState(() => value.join("\n"));
  const joined = value.join("\n");
  if (joined !== splitLines(text).join("\n")) setText(joined);
  return (
    <textarea
      {...props}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(splitLines(e.target.value));
      }}
    />
  );
}
