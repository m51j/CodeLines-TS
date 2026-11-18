/**
 * The Linework skin's stylesheets, ported from the Linework prototype (tokens.css,
 * app.css, widget.css). Kept apart from the shell, with no React imports, so the
 * widget bundle stays small.
 */
import tokens from "./css/tokens.css?inline";
import app from "./css/app.css?inline";
import extra from "./css/extra.css?inline";
import widget from "./css/widget.css?inline";
import widgetWindow from "./css/widget-window.css?inline";

/** The main window: tokens, layout and components, plus the widget card for the Settings preview. */
export const styles = tokens + app + extra + widget;
/** The desktop widget window. */
export const widgetStyles = tokens + widget + widgetWindow;
