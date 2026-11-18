/**
 * The Instrument skin's stylesheets, ported from the "Instrument" prototype. Kept free of
 * React so the widget bundle can import it; only the active skin's CSS is in the page.
 */
import tokens from "./css/tokens.css?inline";
import app from "./css/app.css?inline";
import pages from "./css/pages.css?inline";
import electron from "./css/electron.css?inline";
import widget from "./css/widget.css?inline";
/** The main window. */
export const styles = tokens + app + pages + electron;
/** The desktop widget window: tokens (theme, accent, motion) plus the widget's own rules. */
export const widgetStyles = tokens + widget;
