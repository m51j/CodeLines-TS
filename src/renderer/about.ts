import type { AboutLink } from "../shared/about";
export { aboutLinks, copyrightLine, developer, type AboutLink } from "../shared/about";
/** The installed version as reported by the main process ("" outside the desktop window). */
export const appVersion = (): string => (typeof window !== "undefined" && window.codelines?.version) || "";
/** Opens a fixed About page in the default browser; failures go to the skin's error banner. */
export function openAboutLink(link: AboutLink, onError: (e: unknown) => void) {
  void window.codelines.openLink(link).catch(onError);
}
/*
 * "About CodeLines" from a palette: the Settings page scrolls to its About section, either when it
 * mounts (it was not open) or at once through the event (it already was).
 */
const aboutEvent = "codelines:show-about";
let aboutPending = false;
export function requestAbout() {
  aboutPending = true;
  window.dispatchEvent(new Event(aboutEvent));
}
/** Calls show() for a pending or future About request while the Settings page is mounted. */
export function onAboutRequest(show: () => void): () => void {
  const run = () => {
    if (!aboutPending) return;
    aboutPending = false;
    show();
  };
  // Let the page lay out (and its entry transition start) before scrolling.
  const raf = requestAnimationFrame(run);
  window.addEventListener(aboutEvent, run);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener(aboutEvent, run);
  };
}
