/** The prototype's hand-drawn icon set (24 px grid, 1.7 px round strokes), the line-mark logo and empty-state art. */
import { useLayoutEffect, useRef } from "react";
export const ICONS = {
    dashboard: '<rect x="3.5" y="3.5" width="7.5" height="9.5" rx="1.6"/><rect x="13" y="3.5" width="7.5" height="5.5" rx="1.6"/><rect x="13" y="11" width="7.5" height="9.5" rx="1.6"/><rect x="3.5" y="15" width="7.5" height="5.5" rx="1.6"/>',
    folder: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.9l2.1 2.4h7.6A2.2 2.2 0 0 1 21 9.6v7.2a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 16.8z"/>',
    analysis: '<path d="M3.500 20h17M6.500 20v-7.500M12 20V5M17.500 20v-4.500"/><path d="M4.500 8.500l4 2 5.500-6 5.500 4.500" opacity=".55"/>',
    branch: '<circle cx="6.500" cy="5.500" r="2.300"/><circle cx="6.500" cy="18.500" r="2.300"/><circle cx="17.500" cy="8" r="2.300"/><path d="M6.500 7.800v8.400M17.500 10.300c0 4.200-5.200 3.800-8.500 4.700"/>',
    calendar: '<rect x="3.500" y="5" width="17" height="15.500" rx="2.500"/><path d="M3.500 10h17M8 3v4M16 3v4"/><path d="M7.500 14h2M11 14h2M14.500 14h2M7.500 17h2M11 17h2" opacity=".6"/>',
    spark: '<path d="M11 3.500l1.900 5.600 5.600 1.900-5.600 1.900L11 18.500l-1.900-5.600L3.500 11l5.600-1.900z"/><path d="M18.500 15l.8 2.200 2.200.8-2.200.8-.8 2.200-.8-2.200-2.200-.8 2.200-.8z"/>',
    settings: '<path d="M4 7h8.500M17 7h3M4 17h3M11.500 17H20"/><circle cx="14.700" cy="7" r="2.300"/><circle cx="9.300" cy="17" r="2.300"/>',
    play: '<path d="M7.500 4.800v14.400L19 12z"/>',
    download: '<path d="M12 4v11M7 10.500l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 16V5M7 9.500l5-5 5 5M5 20h14"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.700-6M20 4v5h-5"/>',
    stop: '<rect x="6.500" y="6.500" width="11" height="11" rx="2"/>',
    shield: '<path d="M12 3l7 2.800v5.400c0 4.400-2.900 7.800-7 9.800-4.100-2-7-5.400-7-9.800V5.800z"/><path d="M9 12l2.200 2.200 4-4.200"/>',
    monitor: '<rect x="3" y="4.500" width="18" height="12" rx="2.200"/><path d="M8.500 20h7M12 16.500V20"/>',
    sun: '<circle cx="12" cy="12" r="3.800"/><path d="M12 2.500v2.200M12 19.300v2.200M2.500 12h2.200M19.300 12h2.200M5.300 5.300l1.500 1.500M17.200 17.200l1.500 1.500M5.300 18.700l1.500-1.500M17.200 6.800l1.500-1.500"/>',
    moon: '<path d="M20 14.300A8.500 8.500 0 0 1 9.700 4 8.500 8.500 0 1 0 20 14.300z"/>',
    min: '<path d="M6 12h12"/>',
    max: '<rect x="6.500" y="6.500" width="11" height="11" rx="1.600"/>',
    restore: '<rect x="5" y="8.500" width="10.500" height="10.500" rx="1.600"/><path d="M8.500 8.500V6.600A1.600 1.600 0 0 1 10.100 5h7.300A1.600 1.600 0 0 1 19 6.600v7.300a1.600 1.600 0 0 1-1.600 1.600h-1.900"/>',
    x: '<path d="M6.500 6.500l11 11M17.500 6.500l-11 11"/>',
    search: '<circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4.500 7h15M10 7V4.500h4V7M6.800 7l1 12.500h8.400l1-12.500M10.300 11v5M13.700 11v5"/>',
    check: '<path d="M5 12.500l4.500 4.500L19 7.500"/>',
    chevron: '<path d="M6.500 9.500l5.500 5.500 5.500-5.500"/>',
    columns: '<rect x="3.500" y="4.500" width="17" height="15" rx="2.200"/><path d="M9.500 4.500v15M14.500 4.500v15"/>',
    alert: '<path d="M12 4l9 15.500H3z"/><path d="M12 10v4.500M12 17.200v.2"/>',
    info: '<circle cx="12" cy="12" r="8.500"/><path d="M12 11v5.500M12 7.600v.3"/>',
    layers: '<path d="M12 4l8.500 4.500L12 13 3.500 8.500z"/><path d="M3.500 12.500L12 17l8.500-4.500M3.500 16.500L12 21l8.500-4.500" opacity=".6"/>',
    widget: '<rect x="3" y="5" width="18" height="14" rx="2.500"/><rect x="11.500" y="11.500" width="7" height="5" rx="1.200" fill="currentColor" stroke="none" opacity=".85"/>',
    palette: '<circle cx="12" cy="12" r="8.500"/><path d="M12 3.500v17"/><path d="M12 7.500h7.200M12 12h8.500M12 16.500h7.200" opacity=".7"/>',
    clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7v5.200l3.300 2"/>',
    flame: '<path d="M12 3c.6 3.600 5 5.300 5 10.200a5 5 0 0 1-10 0c0-2 .9-3.300 2-4.100.2 1.700 1 2.600 2 2.600-.2-3 -.500-5.700 1-8.700z"/>',
    file: '<path d="M7 3.500h7l4.500 4.500V19a1.500 1.500 0 0 1-1.500 1.500H7A1.500 1.500 0 0 1 5.500 19V5A1.500 1.500 0 0 1 7 3.500z"/><path d="M14 3.500V8h4.500"/>',
    external: '<path d="M14 4.500h5.500V10M19.500 4.500L11 13M18 14v4a1.500 1.500 0 0 1-1.500 1.500h-10A1.500 1.500 0 0 1 5 18V8a1.500 1.500 0 0 1 1.500-1.500h4"/>',
    save: '<path d="M5 5.500A1.500 1.500 0 0 1 6.500 4H16l4 4v10.500a1.500 1.500 0 0 1-1.500 1.500h-12A1.500 1.500 0 0 1 5 18.500z"/><path d="M8.500 4v4.500h6V4M8 20v-6h8v6"/>',
    undo: '<path d="M8.500 6.500L4 11l4.500 4.500M4 11h10a5 5 0 0 1 0 10h-2.500"/>',
    table: '<rect x="3.500" y="4.500" width="17" height="15" rx="2.200"/><path d="M3.500 9.500h17M3.500 14.500h17M9.500 9.500v10"/>',
    chart: '<path d="M5 20v-9M10 20V5M15 20v-6M20 20V8"/>',
    grip: '<path d="M19 9L9 19M19 14.500L14.500 19"/>',
    arrow: '<path d="M8 16l8-8M9.500 8H16v6.500"/>',
    bolt: '<path d="M13 3L5 13.500h6L10.500 21 19 10h-6z"/>',
    eye: '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="2.800"/>',
    code: '<path d="M8.500 7.500L4 12l4.500 4.500M15.500 7.500L20 12l-4.500 4.500M13.500 5l-3 14"/>',
    token: '<circle cx="12" cy="12" r="8.500"/><path d="M8.500 9.500h7M12 9.500V16"/>',
    keyboard: '<rect x="3" y="6" width="18" height="12" rx="2.200"/><path d="M7 10h.01M10.500 10h.01M14 10h.01M17 10h.01M8 14h8"/>',
    power: '<path d="M12 3.500v8M6.700 7a7.500 7.500 0 1 0 10.600 0"/>',
    pin: '<path d="M9 4h6l-.800 6 3.300 3.200H6.500L9.800 10z"/><path d="M12 13.200V20"/>',
    rows: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    wave: '<path d="M3 15c3 0 3-6 6-6s3 6 6 6 3-6 6-6"/>',
    notes: '<path d="M6 4.500h10.500a1.500 1.500 0 0 1 1.500 1.500v14H7.500A1.500 1.500 0 0 1 6 18.500z"/><path d="M9.500 9h5M9.500 12.500h5"/>',
    lines: '<path d="M4 7h10M4 12h16M4 17h7"/>',
    files: '<path d="M8 3.500h6.500L18.500 7.500V17a1.500 1.500 0 0 1-1.500 1.500H8A1.500 1.500 0 0 1 6.500 17V5A1.500 1.500 0 0 1 8 3.500z"/><path d="M4 8v11.500A1.500 1.500 0 0 0 5.500 21H14" opacity=".6"/>',
    target: '<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    drag: '<circle cx="9" cy="6" r="1.300" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.300" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.300" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.300" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.300" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.300" fill="currentColor" stroke="none"/>',
};
export type IconName = keyof typeof ICONS;
const svgIcon = (name: IconName, size: number, cls?: string) =>
  `<svg class="ico${cls ? " " + cls : ""}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] ?? ICONS.info}</svg>`;
const fromString = (html: string) => {
  const t = document.createElement("template");
  t.innerHTML = html;
  return t.content.firstChild as SVGSVGElement;
};
/** An icon as a DOM node, for imperative code. */
export const iconEl = (name: IconName, size = 16, cls?: string) => fromString(svgIcon(name, size, cls));
/** An icon (its markup is a constant from this file). */
export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={"ico" + (className ? " " + className : "")}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] ?? ICONS.info }}
    />
  );
}
/** The CodeLines mark: three code lines of different length on a plate; the first one carries the accent. */
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg className={"logo" + (className ? " " + className : "")} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect className="logo-plate" x="1" y="1" width="30" height="30" rx="8.5" />
      <path className="logo-l1" d="M8 10.5h10" pathLength={1} />
      <path className="logo-l2" d="M12 16h12" pathLength={1} />
      <path className="logo-l3" d="M8 21.5h8" pathLength={1} />
      <circle className="logo-dot" cx="21.5" cy="21.5" r="1.7" />
    </svg>
  );
}
/** The mark as markup, for the boot loader that is built outside React. */
export const logoMarkup = (size: number, cls?: string) =>
  `<svg class="logo${cls ? " " + cls : ""}" width="${size}" height="${size}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect class="logo-plate" x="1" y="1" width="30" height="30" rx="8.5"/><path class="logo-l1" d="M8 10.5h10" pathLength="1"/><path class="logo-l2" d="M12 16h12" pathLength="1"/><path class="logo-l3" d="M8 21.5h8" pathLength="1"/><circle class="logo-dot" cx="21.5" cy="21.5" r="1.7"/></svg>`;
/** Line-drawn illustrations for empty states. */
const ART = {
    codebase: '<rect x="18" y="26" width="124" height="84" rx="10"/><path d="M18 46h124"/><circle cx="30" cy="36" r="2.500"/><circle cx="40" cy="36" r="2.500"/><circle cx="50" cy="36" r="2.500"/><path class="hl" d="M34 62h38"/><path d="M46 74h62M46 86h44M34 98h26"/><path class="hl" d="M112 98h14"/>',
    folder: '<path d="M22 44a8 8 0 0 1 8-8h26l10 11h64a8 8 0 0 1 8 8v44a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8z"/><path class="hl" d="M80 62v30M65 77h30"/>',
    story: '<path d="M26 104V34M26 104h112"/><path d="M40 92V74M58 92V58M76 92V66M94 92V44M112 92V52M130 92V70" /><path class="hl" d="M40 66l18-16 18 8 18-22 18 8 18-10"/>',
    timeline: '<path d="M22 70h116"/><circle cx="38" cy="70" r="5"/><circle cx="72" cy="70" r="5"/><circle class="hl" cx="106" cy="70" r="7"/><path d="M38 58V42h28M72 82v16h26"/><path class="hl" d="M106 56V38"/>',
    ai: '<path class="hl" d="M80 28l7 21 21 7-21 7-7 21-7-21-21-7 21-7z"/><path d="M122 80l3 9 9 3-9 3-3 9-3-9-9-3 9-3zM38 86l2.500 7 7 2.500-7 2.500-2.500 7-2.500-7-7-2.500 7-2.500z"/><path d="M26 112h108" opacity=".5"/>',
    range: '<rect x="22" y="34" width="116" height="74" rx="10"/><path d="M22 54h116M48 26v16M112 26v16"/><path class="hl" d="M64 76l32 16M96 76L64 92"/>',
};
export type ArtName = keyof typeof ART;
/** An empty-state illustration whose strokes draw themselves one after another. */
export function Art({ name }: { name: ArtName }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    ref.current?.querySelectorAll("path,rect,circle").forEach((p, i) => {
      p.setAttribute("pathLength", "1");
      (p as SVGElement).style.setProperty("--i", String(i));
    });
  }, [name]);
  return (
    <svg
      ref={ref}
      className="art"
      width="160"
      height="136"
      viewBox="0 0 160 136"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ART[name] }}
    />
  );
}
