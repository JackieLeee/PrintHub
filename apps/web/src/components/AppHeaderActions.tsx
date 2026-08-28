import { GithubLink } from "./GithubLink";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { VersionBadge } from "./VersionBadge";

interface Props {
  historyLoading?: boolean;
  loadingLabel?: string;
  /** Desktop title bar — hide version pill, tighter toolbar. */
  compact?: boolean;
}

/** Option A — unified toolbar: theme / language / GitHub + version pill. */
export function AppHeaderActions({ historyLoading, loadingLabel, compact = false }: Props) {
  return (
    <div className={`header-actions${compact ? " header-actions--compact" : ""}`}>
      <div className="header-actions-group" aria-label="Preferences">
        <ThemeSwitcher compact />
        <span className="header-actions-divider" aria-hidden="true" />
        <LanguageSwitcher compact />
        <span className="header-actions-divider" aria-hidden="true" />
        <GithubLink iconOnly />
      </div>
      {!compact && <VersionBadge />}
      {historyLoading && loadingLabel && <span className="badge">{loadingLabel}</span>}
    </div>
  );
}
