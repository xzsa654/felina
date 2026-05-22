import { useState, useEffect } from "react";
import { Download, X, RefreshCw } from "lucide-react";

export default function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateVersion, setUpdateVersion] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (update) {
          setUpdateAvailable(true);
          setUpdateVersion(update.version);
        }
      } catch {
        // Updater not configured or no update — silent
      }
    })();
  }, []);

  async function installUpdate() {
    setDownloading(true);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (update) {
        await update.downloadAndInstall();
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
      }
    } catch (e) {
      console.error("Update failed:", e);
      setDownloading(false);
    }
  }

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-accent/10 border-b border-accent/20 shrink-0">
      <div className="flex items-center gap-2 text-xs">
        <Download size={14} className="text-accent" />
        <span className="text-text-primary">
          Felina <strong>{updateVersion}</strong> is available
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="flex items-center gap-1 px-3 py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded-md transition-colors disabled:opacity-50"
          onClick={installUpdate}
          disabled={downloading}
        >
          {downloading ? (
            <>
              <RefreshCw size={12} className="animate-spin" />
              Updating...
            </>
          ) : (
            "Update Now"
          )}
        </button>
        <button
          className="p-1 text-text-muted hover:text-text-primary"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
