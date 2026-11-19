import { fileURLToPath } from "node:url";

/**
 * Whether a URL Chromium reports (a sender frame, a navigation target) is the trusted page.
 *
 * The trusted URL comes from Node's pathToFileURL, which percent-encodes characters Chromium
 * leaves as they are. "~" is the one that matters: the portable app runs from %TEMP%, which is
 * an 8.3 short path such as C:\Users\JOHNSM~1\... for many users, so the strings differ
 * ("%7E" against "~") for the very same file. File URLs therefore compare by their decoded path;
 * anything that does not decode to exactly the trusted file, or carries a query or fragment, is
 * still refused. Other URLs (the development server) must match exactly.
 */
export function isTrustedUrl(actual: string | undefined, trusted: string): boolean {
  if (!actual) return false;
  if (actual === trusted) return true;
  try {
    const a = new URL(actual),
      t = new URL(trusted);
    if (a.protocol !== "file:" || t.protocol !== "file:") return false;
    if (a.search || a.hash || a.host !== t.host) return false;
    return fileURLToPath(a) === fileURLToPath(t);
  } catch {
    // fileURLToPath throws on encoded separators and other paths that are not plain files.
    return false;
  }
}
