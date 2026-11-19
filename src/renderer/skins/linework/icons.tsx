/** The Linework icon set: drawn on a 20×20 grid, 1.6 stroke, round joins (ported from the prototype's sprite). */
import type { ReactNode } from "react";

const paths = {
  dash: (
    <>
      <rect x="3" y="3" width="6" height="8" rx="1.6" />
      <rect x="11" y="3" width="6" height="5" rx="1.6" />
      <rect x="11" y="10" width="6" height="7" rx="1.6" />
      <rect x="3" y="13" width="6" height="4" rx="1.6" />
    </>
  ),
  folder: (
    <>
      <path d="M2.8 6.2V15a1.6 1.6 0 0 0 1.6 1.6h11.2a1.6 1.6 0 0 0 1.6-1.6V8.4a1.6 1.6 0 0 0-1.6-1.6H10L8.3 4.6a1.6 1.6 0 0 0-1.2-.6H4.4a1.6 1.6 0 0 0-1.6 1.6Z" />
      <path d="M2.8 9.4h14.4" />
    </>
  ),
  analysis: (
    <>
      <path d="M3 16.5h14" />
      <path d="M5.5 13.5v-3M9 13.5v-7M12.5 13.5v-5M16 13.5V4" />
      <path d="M4 7.5 8.5 4l3.5 2.5L16.5 3" />
    </>
  ),
  branch: (
    <>
      <circle cx="5.5" cy="4.5" r="1.9" />
      <circle cx="5.5" cy="15.5" r="1.9" />
      <circle cx="14.5" cy="7" r="1.9" />
      <path d="M5.5 6.4v7.2M14.5 8.9c0 3.2-3.4 3.6-6.8 4.6-1 .3-1.6.7-2 1.2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.2" width="14" height="12.6" rx="2" />
      <path d="M3 8.2h14M7 2.6v3M13 2.6v3" />
      <path d="M6.5 11.3h1.6M9.2 11.3h1.6M11.9 11.3h1.6M6.5 13.8h1.6M9.2 13.8h1.6" />
    </>
  ),
  spark: (
    <>
      <path d="M9 2.8 10.5 7a2 2 0 0 0 1.2 1.2L16 9.8l-4.3 1.5a2 2 0 0 0-1.2 1.2L9 16.8l-1.5-4.3a2 2 0 0 0-1.2-1.2L2 9.8l4.3-1.6A2 2 0 0 0 7.5 7Z" />
      <path d="M15.5 2.5v3M14 4h3M16 14.5v2.6M14.7 15.8h2.6" />
    </>
  ),
  gear: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
      <circle cx="10" cy="10" r="5.4" />
    </>
  ),
  play: <path d="M6.5 4.6v10.8a.9.9 0 0 0 1.4.8l8.2-5.4a.9.9 0 0 0 0-1.6L7.9 3.8a.9.9 0 0 0-1.4.8Z" />,
  refresh: (
    <>
      <path d="M16.2 9.2A6.3 6.3 0 0 0 4.9 6" />
      <path d="M3.8 10.8A6.3 6.3 0 0 0 15.1 14" />
      <path d="M4.4 2.8V6.2h3.4M15.6 17.2v-3.4h-3.4" />
    </>
  ),
  rescan: (
    <>
      <path d="M3 6.5V4.2c0-.7.5-1.2 1.2-1.2h2.3M13.5 3h2.3c.7 0 1.2.5 1.2 1.2v2.3M17 13.5v2.3c0 .7-.5 1.2-1.2 1.2h-2.3M6.5 17H4.2C3.5 17 3 16.5 3 15.8v-2.3" />
      <path d="M3 10h14" />
    </>
  ),
  download: (
    <>
      <path d="M10 3v9.5M6.2 8.8 10 12.6l3.8-3.8" />
      <path d="M3.5 13.5v1.8c0 .9.7 1.6 1.6 1.6h9.8c.9 0 1.6-.7 1.6-1.6v-1.8" />
    </>
  ),
  upload: (
    <>
      <path d="M10 13V3.5M6.2 7.2 10 3.4l3.8 3.8" />
      <path d="M3.5 13.5v1.8c0 .9.7 1.6 1.6 1.6h9.8c.9 0 1.6-.7 1.6-1.6v-1.8" />
    </>
  ),
  external: (
    <>
      <path d="M11.5 3.5H16.5v5M16.2 3.8 9.5 10.5" />
      <path d="M14 11.5v3.3c0 .9-.7 1.6-1.6 1.6H5.2c-.9 0-1.6-.7-1.6-1.6V7.6c0-.9.7-1.6 1.6-1.6h3.3" />
    </>
  ),
  plus: <path d="M10 4v12M4 10h12" />,
  x: <path d="M5 5l10 10M15 5 5 15" />,
  min: <path d="M5 10.5h10" />,
  max: <rect x="5" y="5" width="10" height="10" rx="1.2" />,
  restore: (
    <>
      <rect x="4.5" y="7" width="8.5" height="8.5" rx="1.2" />
      <path d="M7 7V5.8c0-.7.5-1.3 1.2-1.3h6c.7 0 1.3.6 1.3 1.3v6c0 .7-.6 1.2-1.3 1.2H13" />
    </>
  ),
  search: (
    <>
      <circle cx="8.8" cy="8.8" r="5.3" />
      <path d="m12.8 12.8 4 4" />
    </>
  ),
  sun: (
    <>
      <circle cx="10" cy="10" r="3.4" />
      <path d="M10 2.4v1.8M10 15.8v1.8M2.4 10h1.8M15.8 10h1.8M4.6 4.6l1.3 1.3M14.1 14.1l1.3 1.3M4.6 15.4l1.3-1.3M14.1 5.9l1.3-1.3" />
    </>
  ),
  moon: <path d="M16.2 12.4A6.6 6.6 0 0 1 7.6 3.8a6.6 6.6 0 1 0 8.6 8.6Z" />,
  monitor: (
    <>
      <rect x="2.8" y="3.6" width="14.4" height="10" rx="1.6" />
      <path d="M7.2 17h5.6M10 13.6V17" />
    </>
  ),
  shield: (
    <>
      <path d="M10 2.6 4 4.8v4.6c0 3.7 2.5 6.6 6 8 3.5-1.4 6-4.3 6-8V4.8Z" />
      <path d="m7.4 10 1.8 1.8 3.6-3.7" />
    </>
  ),
  chev: <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />,
  chevdown: <path d="m5 7.5 5 5 5-5" />,
  check: <path d="m4.5 10.5 3.5 3.5 7.5-8" />,
  alert: (
    <>
      <path d="M10 3.2 2.8 16h14.4Z" />
      <path d="M10 8v3.6M10 13.8v.1" />
    </>
  ),
  info: (
    <>
      <circle cx="10" cy="10" r="7.2" />
      <path d="M10 9.2v4.6M10 6.4v.1" />
    </>
  ),
  clock: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4.3l2.8 1.7" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="14" height="12" rx="1.6" />
      <path d="M3 8h14M3 12h14M8 8v8" />
    </>
  ),
  bars: (
    <>
      <path d="M4 16.5h12" />
      <rect x="5" y="9" width="2.4" height="5.5" rx=".6" />
      <rect x="8.8" y="5" width="2.4" height="9.5" rx=".6" />
      <rect x="12.6" y="7.5" width="2.4" height="7" rx=".6" />
    </>
  ),
  palette: (
    <>
      <path d="M10 2.8a7.2 7.2 0 0 0 0 14.4c1 0 1.6-.6 1.6-1.4 0-.9-.7-1.2-.7-2s.6-1.4 1.5-1.4h1.8a3 3 0 0 0 3-3c0-3.6-3.2-6.6-7.2-6.6Z" />
      <circle cx="6.6" cy="9" r=".9" />
      <circle cx="9" cy="6.2" r=".9" />
      <circle cx="12.6" cy="6.6" r=".9" />
    </>
  ),
  widget: (
    <>
      <rect x="2.8" y="5" width="14.4" height="10" rx="2.4" />
      <path d="M5.6 12.2h.1M8 12.2h.1M10.4 12.2h.1M5.6 9.8h.1M8 9.8h.1M12.8 9.8h.1M10.4 9.8h.1" />
    </>
  ),
  stop: <rect x="5.5" y="5.5" width="9" height="9" rx="1.6" />,
  sidebar: (
    <>
      <rect x="3" y="3.8" width="14" height="12.4" rx="2" />
      <path d="M8 3.8v12.4" />
    </>
  ),
  keyboard: (
    <>
      <rect x="2.5" y="5" width="15" height="10" rx="1.8" />
      <path d="M5.5 8h.1M8.2 8h.1M11 8h.1M13.8 8h.1M5.5 10.6h.1M14 10.6h.1M7.6 12.4h4.8" />
    </>
  ),
  motion: (
    <>
      <path d="M3 13c2.4 0 3.2-6 5.6-6s3 6 5.4 6c1.4 0 2.2-1.4 3-3" />
      <path d="M3 16.5h14" opacity=".5" />
    </>
  ),
  trash: <path d="M3.8 5.6h12.4M8 5.6V4c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v1.6M5.4 5.6l.8 10.2c0 .7.6 1.2 1.3 1.2h5c.7 0 1.3-.5 1.3-1.2l.8-10.2" />,
  dots: <path d="M5 10h.1M10 10h.1M15 10h.1" />,
  arrow: <path d="M4 10h11.5M11 5.5l4.5 4.5-4.5 4.5" />,
  up: <path d="M10 15.5V4.5M5.5 9 10 4.5 14.5 9" />,
  db: (
    <>
      <ellipse cx="10" cy="5" rx="6" ry="2.2" />
      <path d="M4 5v10c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V5M4 10c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2" />
    </>
  ),
  lines: <path d="M4 5.5h9M7 10h9M7 14.5h6" />,
  skin: (
    <>
      <rect x="3" y="3.5" width="14" height="13" rx="2" />
      <path d="M3 8h14M8 8v8.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof paths;

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg className={"ic " + className} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
