import { useCallback, useEffect, useState } from "react";
import { DEFAULT_HTTP_PORT } from "@virt-printer/shared";
import { useLocale } from "../i18n/context";

interface DesktopSettingsView {
  lanHttpEnabled: boolean;
  httpPort: number;
  tcpPort: number;
}

export function DesktopLanSettings() {
  const { t, format } = useLocale();
  const api = window.printhubDesktop;
  const [settings, setSettings] = useState<DesktopSettingsView | null>(null);
  const [portInput, setPortInput] = useState(String(DEFAULT_HTTP_PORT));
  const [lanUrl, setLanUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!api) return;
    const next = await api.getSettings();
    setSettings(next);
    setPortInput(String(next.httpPort));
    setLanUrl(await api.getLanUrl());
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>) {
    if (!api) return;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!api || !settings) return null;

  return (
    <div className="network-desktop">
      <div className="network-setup-title">{t.network.desktopBridgeTitle}</div>
      <p className="network-setup-hint">{t.network.desktopBridgeHint}</p>
      <p className="network-setup-hint">{t.network.desktopTrayHint}</p>

      <label className="network-desktop-toggle">
        <input
          type="checkbox"
          checked={settings.lanHttpEnabled}
          disabled={busy}
          onChange={(e) =>
            void run(async () => {
              await api.setLanHttpEnabled(e.target.checked);
            })
          }
        />
        <span>{t.network.desktopLanHttpToggle}</span>
      </label>

      {settings.lanHttpEnabled && (
        <div className="network-setup-row">
          <label className="field-inline">
            <span>{t.network.desktopHttpPort}</span>
            <input
              type="number"
              min={1024}
              max={65535}
              value={portInput}
              disabled={busy}
              onChange={(e) => setPortInput(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api.setHttpPort(Number(portInput));
              })
            }
          >
            {t.network.desktopApplyPort}
          </button>
          <p className="network-setup-hint">{format(t.network.desktopDefaultHttpPort, { port: DEFAULT_HTTP_PORT })}</p>
        </div>
      )}

      <div className="network-setup-row">
        {lanUrl && (
          <button
            type="button"
            className="btn-sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api.copyLanUrl();
                setMessage(t.network.desktopCopiedLan);
              })
            }
          >
            {t.network.desktopCopyLan}
          </button>
        )}
        <button
          type="button"
          className="btn-sm"
          disabled={busy}
          onClick={() => void run(() => api.restartBridge())}
        >
          {t.network.desktopRestartBridge}
        </button>
      </div>

      {message && <div className="network-hint">{message}</div>}
    </div>
  );
}
