/**
 * The shared table: search (more than 15 rows) that widens on focus, sortable headers
 * whose arrow rotates, rows that slide to their new order (FLIP), 100-row pages, a row
 * count, optional row selection, sticky header and first column, path cells with
 * full-path tooltips, and Total rows pinned to the bottom.
 */
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { compareCells } from "../../../components";
import { reduced, useFlip } from "../../../motion/core";
import { Icon } from "../icons";
import { number } from "./fmt";

export interface Col<T> {
  key: string;
  label: string;
  value: (r: T) => string | number | null | undefined;
  render?: (r: T) => ReactNode;
  path?: boolean;
  num?: boolean;
  cls?: (r: T) => string;
  title?: string;
}

export function Table<T>({
  label,
  rows,
  columns,
  rowKey,
  onSelect,
  isSelected,
  isTotal,
  rowCls,
  searchMin = 15,
  emptyText = "No records to show.",
}: {
  label: string;
  rows: T[];
  columns: Col<T>[];
  rowKey?: (r: T) => string;
  onSelect?: (r: T) => void;
  isSelected?: (r: T) => boolean;
  isTotal?: (r: T) => boolean;
  rowCls?: (r: T) => string;
  searchMin?: number;
  emptyText?: string;
}) {
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(null),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0);
  const body = useRef<HTMLTableSectionElement>(null),
    scroll = useRef<HTMLDivElement>(null);
  const capture = useFlip(body, "tr", (el) => el.dataset.k, { maxItems: 160, dur: 260 });

  const numeric = useMemo(
    () => columns.map((c) => c.num ?? (!c.path && rows.some((r) => typeof c.value(r) === "number"))),
    [columns, rows],
  );
  const list = useMemo(() => {
    const needle = query.toLowerCase();
    let out = needle
      ? rows.filter((r) => columns.some((c) => String(c.value(r) ?? "").toLowerCase().includes(needle)))
      : [...rows];
    let pinned: T[] = [];
    if (isTotal) {
      pinned = out.filter(isTotal);
      out = out.filter((r) => !isTotal(r));
    }
    const c = sort && columns.find((x) => x.key === sort.key);
    if (sort && c) out.sort((a, b) => compareCells(c.value(a), c.value(b), sort.descending));
    return out.concat(pinned);
  }, [rows, columns, query, sort, isTotal]);

  const pages = Math.max(1, Math.ceil(list.length / 100)),
    current = Math.min(page, pages - 1),
    view = list.slice(current * 100, (current + 1) * 100);

  // Search results fade in.
  const lastQuery = useRef(query);
  useLayoutEffect(() => {
    if (lastQuery.current === query) return;
    lastQuery.current = query;
    if (!reduced()) body.current?.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 160 });
  }, [query]);

  const keyOf = (r: T, i: number) => (rowKey ? rowKey(r) : String(i));
  return (
    <div className="data-table">
      <div className="table-tools">
        <span className="table-count" aria-live="polite">
          {list.length === rows.length
            ? `${number(rows.length)} ${rows.length === 1 ? "row" : "rows"}`
            : `${number(list.length)} of ${number(rows.length)} rows`}
        </span>
        <span className="spacer" />
        {rows.length > searchMin && (
          <label className="table-search">
            <Icon name="search" />
            <input
              type="search"
              placeholder="Search rows…"
              aria-label={"Search " + label}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </label>
        )}
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={label} ref={scroll}>
        <table>
          <thead>
            <tr>
              {columns.map((c, j) => {
                const s = sort?.key === c.key ? (sort.descending ? "descending" : "ascending") : "none";
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={[numeric[j] ? "num" : "", c.path ? "path" : "", j === 0 ? "first" : ""].join(" ")}
                    aria-sort={s}
                    title={c.title}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        capture();
                        setSort({ key: c.key, descending: sort?.key === c.key ? !sort.descending : false });
                      }}
                    >
                      {c.label}
                      <svg className={"sort-ic s-" + s} viewBox="0 0 10 12" aria-hidden="true">
                        <path d="M5 1.5v9M1.8 7.5 5 10.6l3.2-3.1" />
                      </svg>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody ref={body}>
            {view.map((r, i) => {
              const rk = keyOf(r, i + current * 100),
                sel = isSelected?.(r),
                tot = isTotal?.(r);
              return (
                <tr
                  key={rk}
                  data-k={rk}
                  className={[sel ? "selected" : "", tot ? "total-row" : "", rowCls?.(r) ?? ""].join(" ")}
                  aria-selected={onSelect && !tot ? !!sel : undefined}
                  onClick={
                    onSelect && !tot
                      ? (e) => {
                          if (!(e.target as Element).closest("button,input,select,textarea,label,a")) onSelect(r);
                        }
                      : undefined
                  }
                >
                  {columns.map((c, j) => {
                    const v = c.value(r);
                    let inner: ReactNode = c.render ? (
                      c.render(r)
                    ) : c.path ? (
                      <span className="path-cell" title={String(v ?? "")}>
                        {v ?? "—"}
                      </span>
                    ) : typeof v === "number" ? (
                      number(v)
                    ) : (
                      (v ?? "—")
                    );
                    if (j === 0 && onSelect && !tot)
                      inner = (
                        <button type="button" className="row-link" title={String(v ?? "")} onClick={() => onSelect(r)}>
                          {inner}
                        </button>
                      );
                    return (
                      <td
                        key={c.key}
                        className={[numeric[j] ? "num" : "", c.path ? "path" : "", j === 0 ? "first" : "", c.cls?.(r) ?? ""].join(" ")}
                      >
                        {inner}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!list.length && <p className="empty-row">{emptyText}</p>}
      </div>
      {pages > 1 && (
        <div className="pagination">
          <button
            type="button"
            className="btn sm"
            disabled={!current}
            onClick={() => {
              setPage(current - 1);
              if (scroll.current) scroll.current.scrollTop = 0;
            }}
          >
            Previous
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            className="btn sm"
            disabled={current >= pages - 1}
            onClick={() => {
              setPage(current + 1);
              if (scroll.current) scroll.current.scrollTop = 0;
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

/** A tiny share bar with its percentage. */
export function ShareCell({ frac }: { frac: number }) {
  return (
    <span className="share-cell">
      <i style={{ ["--w" as string]: (frac * 100).toFixed(2) + "%" }} />
      {(frac * 100).toFixed(1)}%
    </span>
  );
}

/** A coloured Δ with an arrow. */
export function Delta({ v, text }: { v: number | null | undefined; text: string }) {
  return (
    <span className={"delta " + (v ? (v > 0 ? "up" : "down") : "")}>
      {v ? <Icon name="up" /> : null}
      {text}
    </span>
  );
}
