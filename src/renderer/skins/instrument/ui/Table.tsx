/**
 * Data table (the prototype's table.js): search, sortable columns, 100-row pages, row count, selection,
 * sticky header and first column, column visibility, in-cell bars, and rows that glide to their new
 * place on sort, search or new data (FLIP) while new rows fade in.
 */
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { reduced } from "../../../motion/core";
import { number } from "../../../format";
import { compareCells } from "../../../components";
import { Icon } from "../icons";
import { Check } from "./controls";
import { Popover, usePopover } from "./overlays";
import { useAfterPaint } from "./layout";
export interface Column<T> {
  key: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
  /** foot = the pinned totals row. */
  render?: (row: T, foot: boolean) => ReactNode;
  path?: boolean;
  /** An in-cell bar under numeric values: true for the accent, or a CSS colour. */
  bar?: true | string;
  hint?: string;
  title?: (row: T) => string;
  className?: string;
}
export interface TableProps<T> {
  label: string;
  rows: T[];
  columns: Column<T>[];
  rowKey?: (row: T) => string;
  onSelect?: (row: T) => void;
  selected?: (row: T) => boolean;
  total?: T | null;
  pageSize?: number;
  /** The search box appears above this many rows. */
  searchMin?: number;
  rowClass?: (row: T) => string;
  rowFocusSelect?: boolean;
  noRowLink?: boolean;
  className?: string;
  emptyText?: string;
  tools?: ReactNode;
}
type Meta = { numeric: Record<string, boolean>; max: Record<string, number> };
const pct = (v: number, max: number) => Math.max(1.5, (Math.abs(v) / max) * 100).toFixed(1) + "%";
const cls = <T,>(c: Column<T>, j: number, meta: Meta) =>
  [j === 0 ? "col-first" : "", c.path ? "col-path" : "", meta.numeric[c.key] ? "col-num" : "", c.className ?? ""].filter(Boolean).join(" ");
function Cell<T>({ c, r, j, meta, foot, link, onSelect, ready }: { c: Column<T>; r: T; j: number; meta: Meta; foot: boolean; link: boolean; onSelect?: (r: T) => void; ready: boolean }) {
  const v = c.value(r);
  let content: ReactNode;
  if (link && onSelect)
    content = (
      <button
        type="button"
        className="row-link"
        title={String(v ?? "")}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(r);
        }}
      >
        {c.render ? c.render(r, false) : v}
      </button>
    );
  else if (c.render) content = c.render(r, foot);
  else if (c.path)
    content = (
      <span className="cell-path" title={String(v ?? "")}>
        {v ?? "—"}
      </span>
    );
  else content = typeof v === "number" ? number(v) : (v ?? "—");
  const bar = c.bar && !foot && typeof v === "number" && meta.max[c.key] > 0;
  const style = bar
    ? ({ "--p": ready || reduced() ? pct(v as number, meta.max[c.key]) : "0%", ...(typeof c.bar === "string" ? { "--bar": c.bar } : {}) } as CSSProperties)
    : undefined;
  return (
    <td className={cls(c, j, meta) + (bar ? " has-bar" : "")} style={style} title={c.title ? c.title(r) : undefined}>
      {content}
    </td>
  );
}
function Row<T>({
  r,
  k,
  columns,
  meta,
  p,
}: {
  r: T;
  k: string;
  columns: Column<T>[];
  meta: Meta;
  p: TableProps<T>;
}) {
  const ready = useAfterPaint();
  const on = !!p.selected?.(r);
  return (
    <tr
      data-k={k}
      className={[on ? "is-selected" : "", p.rowClass?.(r) ?? ""].join(" ").trim() || undefined}
      aria-selected={p.onSelect ? on : undefined}
      tabIndex={p.rowFocusSelect ? 0 : undefined}
      onClick={
        p.onSelect
          ? (e) => {
              if (!(e.target as Element).closest("button,input,select,textarea,label,a")) p.onSelect?.(r);
            }
          : undefined
      }
      onFocus={
        p.rowFocusSelect
          ? () => {
              if (!p.selected?.(r)) p.onSelect?.(r);
            }
          : undefined
      }
      onKeyDown={
        p.rowFocusSelect
          ? (e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                p.onSelect?.(r);
              }
            }
          : undefined
      }
    >
      {columns.map((c, j) => (
        <Cell key={c.key} c={c} r={r} j={j} meta={meta} foot={false} link={j === 0 && !!p.onSelect && !p.noRowLink} onSelect={p.onSelect} ready={ready} />
      ))}
    </tr>
  );
}
export function DataTable<T>(p: TableProps<T>) {
  const { rows, columns: allColumns, label } = p,
    size = p.pageSize ?? 100;
  const [sort, setSort] = useState<{ key: string; descending: boolean } | null>(null),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const cols = useMemo(() => allColumns.filter((c) => !hidden.has(c.key)), [allColumns, hidden]);
  const view = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = needle ? rows.filter((r) => allColumns.some((c) => String(c.value(r) ?? "").toLowerCase().includes(needle))) : [...rows];
    const c = sort && allColumns.find((x) => x.key === sort.key);
    if (sort && c) list.sort((a, b) => compareCells(c.value(a), c.value(b), sort.descending));
    return list;
  }, [rows, allColumns, query, sort]);
  const meta = useMemo<Meta>(() => {
    const numeric: Record<string, boolean> = {},
      max: Record<string, number> = {};
    for (const c of allColumns) {
      numeric[c.key] = !c.path && (rows.some((r) => typeof c.value(r) === "number") || (!!p.total && typeof c.value(p.total) === "number"));
      if (c.bar) max[c.key] = rows.reduce((m, r) => Math.max(m, Math.abs(Number(c.value(r)) || 0)), 0);
    }
    return { numeric, max };
  }, [allColumns, rows, p.total]);
  const pages = Math.max(1, Math.ceil(view.length / size)),
    current = Math.min(page, pages - 1),
    slice = useMemo(() => view.slice(current * size, (current + 1) * size), [view, current, size]);
  // Stable keys: rowKey, or the row's position in the source list for keyless tables.
  const keyOf = useMemo(() => {
    if (p.rowKey) return p.rowKey;
    const ids = new Map<T, string>();
    rows.forEach((r, i) => ids.set(r, "r" + i));
    return (r: T) => ids.get(r) ?? "x";
  }, [p.rowKey, rows]);
  /* FLIP: rows keep their identity; moved rows glide, new rows fade in. Measured only when the order changes. */
  const order = useMemo(() => slice.map(keyOf).join("\n"), [slice, keyOf]);
  const tbody = useRef<HTMLTableSectionElement>(null),
    tops = useRef<Map<string, number> | null>(null);
  useLayoutEffect(() => {
    const tb = tbody.current;
    if (!tb) return;
    const trs = [...tb.children] as HTMLElement[],
      next = new Map<string, number>();
    for (const tr of trs) next.set(tr.dataset.k ?? "", tr.offsetTop);
    const prev = tops.current;
    tops.current = next;
    if (reduced()) return;
    let fresh = 0;
    trs.forEach((tr, i) => {
      const before = prev?.get(tr.dataset.k ?? "");
      if (before === undefined) {
        if (fresh++ < 40)
          tr.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: Math.min(i, 18) * 12, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" });
        return;
      }
      const dy = before - (next.get(tr.dataset.k ?? "") ?? before);
      if (Math.abs(dy) > 1 && Math.abs(dy) < 1400 && trs.length <= 110)
        tr.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 320, easing: "cubic-bezier(.22,1,.36,1)" });
    });
  }, [order]);
  const scroll = useRef<HTMLDivElement>(null);
  const cols$ = usePopover();
  const n = view.length;
  return (
    <div className={"dt" + (p.className ? " " + p.className : "")}>
      <div className="dt-tools">
        <span className="dt-count" aria-live="polite">
          {number(n) + (n === 1 ? " row" : " rows") + (query.trim() ? " of " + number(rows.length) : "")}
        </span>
        <span className="spacer" />
        {p.tools}
        <label className="dt-searchbox" hidden={rows.length <= (p.searchMin ?? 8)}>
          <Icon name="search" size={14} />
          <input
            className="dt-search"
            type="search"
            placeholder="Search rows…"
            aria-label={"Search " + label}
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
          <kbd>/</kbd>
        </label>
        <button
          type="button"
          className="btn btn-ghost btn-icon dt-colsbtn"
          data-tip="Show or hide columns"
          aria-label={"Show or hide columns of " + label}
          aria-haspopup="dialog"
          onClick={(e) => cols$.toggle(e.currentTarget)}
        >
          <Icon name="columns" size={15} />
        </button>
        <Popover anchor={cols$.anchor} onClose={cols$.close} placement="bottom-end" label={"Columns of " + label} className="pop-cols">
          <div className="pop-pad">
            <strong className="pop-title">Columns</strong>
            {allColumns.map((c, j) => (
              <Check
                key={c.key}
                label={c.label}
                checked={!hidden.has(c.key)}
                disabled={j === 0}
                onChange={(on) =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (on) next.delete(c.key);
                    else next.add(c.key);
                    return next;
                  })
                }
              />
            ))}
          </div>
        </Popover>
      </div>
      <div
        ref={scroll}
        className="dt-scroll"
        role="region"
        tabIndex={0}
        aria-label={label}
        onScroll={(e) => {
          const el = e.currentTarget;
          el.classList.toggle("is-x", el.scrollLeft > 2);
          el.classList.toggle("is-y", el.scrollTop > 2);
        }}
      >
        <table aria-label={label}>
          <thead>
            <tr>
              {cols.map((c, j) => {
                const on = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" className={cls(c, j, meta)} aria-sort={on ? (sort.descending ? "descending" : "ascending") : "none"}>
                    <button
                      type="button"
                      className="th-btn"
                      data-tip={c.hint}
                      onClick={() => setSort({ key: c.key, descending: on ? !sort.descending : false })}
                    >
                      <span>{c.label}</span>
                      <i className={"th-arrow" + (on ? (sort.descending ? " is-desc" : " is-asc") : "")} aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            ref={tbody}
            onKeyDown={(e) => {
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
              const link = (e.target as Element).closest(".row-link");
              if (!link) return;
              const links = [...e.currentTarget.querySelectorAll<HTMLElement>(".row-link")],
                i = links.indexOf(link as HTMLElement) + (e.key === "ArrowDown" ? 1 : -1);
              if (links[i]) {
                e.preventDefault();
                links[i].focus();
              }
            }}
          >
            {slice.map((r) => {
              const k = keyOf(r);
              return <Row key={k} k={k} r={r} columns={cols} meta={meta} p={p} />;
            })}
          </tbody>
          {p.total && (
            <tfoot>
              <tr className="dt-total">
                {cols.map((c, j) => (
                  <Cell key={c.key} c={c} r={p.total as T} j={j} meta={meta} foot link={false} ready />
                ))}
              </tr>
            </tfoot>
          )}
        </table>
        {n === 0 && <p className="dt-empty">{p.emptyText ?? "No records to show."}</p>}
      </div>
      {pages > 1 && (
        <div className="dt-pager">
          <span className="dt-range">{`${number(current * size + 1)}–${number(Math.min(n, (current + 1) * size))}`}</span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={!current}
            onClick={() => {
              setPage(current - 1);
              if (scroll.current) scroll.current.scrollTop = 0;
            }}
          >
            Previous
          </button>
          <span className="dt-page">{`${current + 1} / ${pages}`}</span>
          <button
            type="button"
            className="btn btn-sm"
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
