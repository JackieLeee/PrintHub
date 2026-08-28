import { isDesktopApp } from "../lib/is-desktop";
import { useLocale } from "../i18n/context";

function usesTrafficLightChrome(): boolean {
  return isDesktopApp() && window.printhubDesktop?.windowChrome === "traffic-lights";
}

export function DesktopTrafficLights() {
  const { t } = useLocale();

  if (!usesTrafficLightChrome()) return null;

  const api = window.printhubDesktop!;

  return (
    <div className="desktop-traffic-lights" aria-label={t.desktopChrome.windowControls}>
      <button
        type="button"
        className="traffic-light traffic-light--close"
        title={t.desktopChrome.close}
        aria-label={t.desktopChrome.close}
        onClick={() => void api.windowClose()}
      >
        <span className="traffic-light-glyph traffic-light-glyph--close" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="traffic-light traffic-light--minimize"
        title={t.desktopChrome.minimize}
        aria-label={t.desktopChrome.minimize}
        onClick={() => void api.windowMinimize()}
      >
        <span className="traffic-light-glyph traffic-light-glyph--minimize" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="traffic-light traffic-light--maximize"
        title={t.desktopChrome.maximize}
        aria-label={t.desktopChrome.maximize}
        onClick={() => void api.windowToggleMaximize()}
      >
        <span className="traffic-light-glyph traffic-light-glyph--maximize" aria-hidden="true" />
      </button>
    </div>
  );
}
