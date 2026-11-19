import type { ComponentType } from "react";
import type { Skin } from "../../shared/appearance";
import type { ShellProps } from "../pages";
import { ClassicLoading, ClassicShell } from "./classic/ClassicShell";
import * as instrument from "./instrument";
import * as linework from "./linework";
/** Each skin's shell: its frame, navigation and pages around the shared workspace. */
export const shells: Record<Skin, ComponentType<ShellProps>> = {
  Classic: ClassicShell,
  Instrument: instrument.Shell,
  Linework: linework.Shell,
};
/** Shown while the workspace opens, in the saved skin. */
export const loaders: Record<Skin, ComponentType<{ error: string }>> = {
  Classic: ClassicLoading,
  Instrument: instrument.Loading,
  Linework: linework.Loading,
};
