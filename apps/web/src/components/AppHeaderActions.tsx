import { GithubLink } from "./GithubLink";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { VersionBadge } from "./VersionBadge";

interface Props {
  historyLoading?: boolean;
  loadingLabel?: string;
}

/** Option A — unified toolbar: theme / language / GitHub + version pill. */
export function AppHeaderActions({ historyLoading, loadingLabel }: Props) {
  return (
    <div className="header-actions">
      <div className="header-actions-group" aria-label="Preferences">
        <ThemeSwitcher compact />
        <span className="header-actions-divider" aria-hidden="true" />
        <LanguageSwitcher compact />
        <span className="header-actions-divider" aria-hidden="true" />
        <GithubLink iconOnly />
      </div>
      <VersionBadge />
      {historyLoading && loadingLabel && <span className="badge">{loadingLabel}</span>}
    </div>
  );
}
