/** Who makes CodeLines and where it lives, shown in About sections, palettes and the tray menu. */
export const developer = {
  name: "NEXTE",
  nameAr: "نيكستي",
  tagline: "Electromechanical automation & industrial control",
  site: "nex-te.com",
} as const;
/**
 * The only pages CodeLines opens, in the default browser. The renderer asks by key, never by URL,
 * so a compromised page cannot open anything else.
 */
export const aboutLinks = {
  website: "https://nex-te.com/",
  repo: "https://github.com/m51j/CodeLines-TS",
  issues: "https://github.com/m51j/CodeLines-TS/issues",
  releases: "https://github.com/m51j/CodeLines-TS/releases",
} as const;
export type AboutLink = keyof typeof aboutLinks;
export const aboutLinkKeys = Object.keys(aboutLinks) as [AboutLink, ...AboutLink[]];
export const copyrightLine = "© 2026 m51j · MIT License";
