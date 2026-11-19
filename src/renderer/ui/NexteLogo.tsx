/**
 * The NEXTE wordmark, inlined from the brand kit (assets/logo/logo-primary.svg). The letters and
 * the chevron take the text colour, so it reads in light and dark themes; the arrow keeps the brand
 * yellow.
 */
const ink = [
  "90.25,90.25 90.25,289.57 0,289.57 0,0 135.76,0 298.99,201.68 298.99,0 393.16,0 393.16,289.57 253.47,289.57",
  "557.17,145.18 419.06,289.57 861.66,289.57 1003.7,145.18 869.5,0 419.06,0",
  "1031.95,0 965.24,65.92 1017.82,124.78 1148.88,0",
  "965.24,210.31 1034.3,278.59 1148.88,278.59 1024.1,152.24",
  "1176.34,0 1111.21,65.92 1293.27,65.92 1293.27,289.57 1385.87,289.57 1385.87,69.06 1509.86,69.84 1509.86,0",
  "1531.05,0 1745.29,0 1745.29,69.84 1622.08,69.84 1621.29,107.51 1745.29,107.51 1745.29,177.35 1618.94,177.35 1618.16,222.87 1745.29,226.01 1745.29,289.57 1531.05,289.57",
];
const arrow = "670.18,145.18 600.33,65.92 822.42,65.92 896.97,138.9 820.07,222.87 600.33,222.87";
export function NexteLogo({ height = 16, className }: { height?: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 1745.29 289.57" height={height} width={(height * 1745.29) / 289.57} role="img" aria-label="NEXTE">
      {ink.map((points) => (
        <polygon key={points} points={points} fill="currentColor" />
      ))}
      <polygon points={arrow} fill="#F5B800" />
    </svg>
  );
}
