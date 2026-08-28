import { GithubLink } from "./GithubLink";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { VersionBadge } from "./VersionBadge";

interface Props {
  historyLoading?: boolean;
  loadingLabel?: string;
}

/** Top-right header controls (version + preferences). Layout may change per design pick. */
export function AppHeaderActions({ historyLoading, loadingLabel }: Props) {
  return (
    <div className="header-actions">
      <div className="header-actions-group" aria-label="Preferences">
        <ThemeSwitcher />
        <LanguageSwitcher />
        <GithubLink iconOnly />
      </div>
      <VersionBadge />
      {historyLoading && loadingLabel && <span className="badge">{loadingLabel}</span>}
    </div>
  );
}
