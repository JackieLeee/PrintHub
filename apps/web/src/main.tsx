import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LocaleProvider } from "./i18n/context";
import { applyUiTheme, loadUiThemeId } from "./lib/ui-theme-preference";
import "./styles.css";

applyUiTheme(loadUiThemeId());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
);
