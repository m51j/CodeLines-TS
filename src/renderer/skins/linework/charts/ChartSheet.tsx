/** A sheet whose chart can switch to an accessible table of the same numbers. */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { play } from "../../../motion/core";
import { Icon } from "../icons";
import { Seg } from "../ui/Choice";
import { Sheet } from "../ui/controls";

export function ChartSheet({
  title,
  sub,
  className = "",
  chart,
  table,
}: {
  title: string;
  sub?: ReactNode;
  className?: string;
  chart: ReactNode;
  /** Built only when the table is first shown. */
  table: () => ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const chartRef = useRef<HTMLDivElement>(null),
    tableRef = useRef<HTMLDivElement>(null),
    first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    play(view === "table" ? tableRef.current : chartRef.current, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  }, [view]);
  return (
    <Sheet
      title={title}
      sub={sub}
      className={"chart-sheet " + className}
      actions={
        <Seg
          label={title + " view"}
          className="seg-sm"
          value={view}
          onChange={setView}
          options={[
            { v: "chart", aria: "Chart view", l: (<><Icon name="bars" /><span>Chart</span></>) },
            { v: "table", aria: "Table view", l: (<><Icon name="table" /><span>Table</span></>) },
          ]}
        />
      }
    >
      <div className="cs-chart" ref={chartRef} hidden={view === "table"}>
        {chart}
      </div>
      <div className="cs-table" ref={tableRef} hidden={view === "chart"}>
        {view === "table" && table()}
      </div>
    </Sheet>
  );
}
