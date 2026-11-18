import { z } from "zod";
/**
 * Visual skins. Every skin renders the same workspace with its own shell, pages,
 * tokens and motion; Classic is the original design.
 */
export const skins = ["Classic", "Instrument", "Linework"] as const;
export type Skin = (typeof skins)[number];
export type Scheme = "light" | "dark";
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const appearanceSchema = z.object({
  skin: z.enum(skins).catch("Classic"),
  /** The accent each skin uses; a missing entry means the skin's own default. */
  accents: z
    .object({
      Classic: hex.optional().catch(undefined),
      Instrument: hex.optional().catch(undefined),
      Linework: hex.optional().catch(undefined),
    })
    .catch({}),
  motion: z.enum(["System", "Reduce", "Full"]).catch("System"),
  density: z.enum(["Comfortable", "Compact"]).catch("Comfortable"),
});
export type Appearance = z.infer<typeof appearanceSchema>;
export const defaultAppearance = (): Appearance => ({
  skin: "Classic",
  accents: {},
  motion: "System",
  density: "Comfortable",
});
export interface AccentPreset {
  name: string;
  hex: string;
}
export interface SkinInfo {
  id: Skin;
  name: string;
  tagline: string;
  /** null keeps the skin's hand-tuned accent tokens. */
  defaultAccent: string | null;
  presets: AccentPreset[];
  /** Window background before the first paint, per scheme. */
  window: Record<Scheme, string>;
}
export const skinInfo: Record<Skin, SkinInfo> = {
  Classic: {
    id: "Classic",
    name: "Classic",
    tagline: "The original CodeLines look",
    defaultAccent: null,
    presets: [
      { name: "Indigo", hex: "#405bdc" },
      { name: "Teal", hex: "#0f9488" },
      { name: "Violet", hex: "#7c4ddb" },
      { name: "Rose", hex: "#d6336c" },
      { name: "Amber", hex: "#d18a00" },
      { name: "Slate", hex: "#5b6b82" },
    ],
    window: { light: "#f4f7fb", dark: "#0b1120" },
  },
  Instrument: {
    id: "Instrument",
    name: "Instrument",
    tagline: "A measuring instrument: readouts, rulers and lamps",
    defaultAccent: "#f0602b",
    presets: [
      { name: "Signal", hex: "#f0602b" },
      { name: "Amber", hex: "#e8a013" },
      { name: "Jade", hex: "#1fa37a" },
      { name: "Teal", hex: "#12a3b4" },
      { name: "Azure", hex: "#2e86f0" },
      { name: "Iris", hex: "#6c63f0" },
      { name: "Orchid", hex: "#d4459b" },
      { name: "Graphite", hex: "#7a808c" },
    ],
    window: { light: "#efece7", dark: "#07080c" },
  },
  Linework: {
    id: "Linework",
    name: "Linework",
    tagline: "Built from lines: a git rail, ruled paper and readouts",
    defaultAccent: "#f2683c",
    presets: [
      { name: "Ember", hex: "#f2683c" },
      { name: "Iris", hex: "#7c6cf2" },
      { name: "Lagoon", hex: "#14b8a6" },
      { name: "Cobalt", hex: "#2f7bf6" },
      { name: "Citron", hex: "#b5d334" },
      { name: "Rose", hex: "#ec4f8a" },
      { name: "Saffron", hex: "#f0a020" },
    ],
    window: { light: "#f4f1ea", dark: "#0e1117" },
  },
};
export const accentOf = (a: Appearance, skin: Skin = a.skin) =>
  a.accents[skin] ?? skinInfo[skin].defaultAccent;
/** What a window needs to paint itself before React runs. */
export interface AppearanceBoot {
  appearance: Appearance;
  theme: "System" | "Light" | "Dark";
}
