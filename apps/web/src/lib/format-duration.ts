/** Human-readable duration from milliseconds (< 1s → ms, ≥ 1s → s, ≥ 60s → m s / h). */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) {
    const s = ms / 1000;
    return s >= 10 || Number.isInteger(s) ? `${Math.round(s)} s` : `${s.toFixed(1)} s`;
  }
  if (ms < 3_600_000) {
    const totalSec = Math.round(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return sec > 0 ? `${min} m ${sec} s` : `${min} m`;
  }
  const h = Math.floor(ms / 3_600_000);
  const remMin = Math.round((ms % 3_600_000) / 60_000);
  return remMin > 0 ? `${h} h ${remMin} m` : `${h} h`;
}
