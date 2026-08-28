/** Injected at build time from root package.json via vite.config.ts */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "dev";

export function formatAppVersion(version = APP_VERSION): string {
  return version.startsWith("v") ? version : `v${version}`;
}
