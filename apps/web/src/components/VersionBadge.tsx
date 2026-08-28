import { formatAppVersion } from "../lib/app-version";

export function VersionBadge() {
  return (
    <span className="version-badge" title="PrintHub version">
      {formatAppVersion()}
    </span>
  );
}
