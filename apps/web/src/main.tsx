import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LocaleProvider } from "./i18n/context";
import { applyUiTheme, loadUiThemeId } from "./lib/ui-theme-preference";
import { installOverlayScrollbars, shouldUseOverlayScrollbars } from "./lib/overlay-scrollbars";
import "./styles.css";

applyUiTheme(loadUiThemeId());

if (shouldUseOverlayScrollbars()) {
  document.documentElement.classList.add("overlay-scrollbars");
  installOverlayScrollbars();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
);
