import { useMemo, useState, type ReactNode } from "react";
import { FolderSearch } from "lucide-react";
export const number = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : Math.round(v).toLocaleString("en-US");
export const signed = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : (v > 0 ? "+" : "") + number(v);
export const percent = (v: number) => `${(v * 100).toFixed(1)}%`;
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
  items: { label: string; value: ReactNode; detail?: ReactNode }[];
}) {
  return (
    <div className="tiles">
      {items.map((i) => (
        <div className="tile" key={i.label}>
          <span>{i.label}</span>
          <strong>{i.value}</strong>
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
}: {
  label: string;
  rows: T[];
  columns: Column<T>[];
  onSelect?: (row: T) => void;
  selected?: (row: T) => boolean;
}) {
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(
      null,
    ),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const sorted = useMemo(() => {
    const filtered = query
      ? rows.filter((r) =>
          columns.some((c) =>
            String(c.value(r) ?? "")
              .toLowerCase()
              .includes(query.toLowerCase()),
          ),
        )
      : [...rows];
    if (sort) {
      const c = columns.find((c) => c.key === sort.key);
      if (c)
        filtered.sort((a, b) => {
          const av = c.value(a) ?? "",
            bv = c.value(b) ?? "";
          return (
            (typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv))) *
            (sort.descending ? -1 : 1)
          );
        });
    }
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
              <tr key={i} className={selected?.(r) ? "selected" : ""}>
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
