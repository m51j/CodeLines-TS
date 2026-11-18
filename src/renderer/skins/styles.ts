import type { SkinStyles } from "../appearance/apply";
import base from "../appearance/base.css?inline";
import classic from "../styles.css?inline";
import classicWidget from "../widget/widget.css?inline";
import * as instrument from "./instrument/styles";
import * as linework from "./linework/styles";
/** The main window's stylesheet per skin; only the active one is in the page. */
export const appStyles: SkinStyles = {
  Classic: classic + base,
  Instrument: instrument.styles + base,
  Linework: linework.styles + base,
};
/** The desktop widget's stylesheet per skin. */
export const widgetSkinStyles: SkinStyles = {
  Classic: classic + classicWidget + base,
  Instrument: instrument.widgetStyles + base,
  Linework: linework.widgetStyles + base,
};
