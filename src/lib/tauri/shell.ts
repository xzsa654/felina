import { open } from "@tauri-apps/plugin-shell";

/**
 * Open a filesystem path in the OS file manager (or a URL in the browser).
 * Thin wrapper over `tauri-plugin-shell`'s `open`, gated by the
 * `shell:allow-open` capability. Used by the raw repair editor and the
 * per-target "Open target folder" buttons to surface disk residue the app
 * data model cannot fully see.
 */
export function openPath(path: string): Promise<void> {
  return open(path);
}
