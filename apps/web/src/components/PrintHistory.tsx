import type { StoredJob } from "../App";

interface Props {
  jobs: StoredJob[];
  selectedId: string | null;
  hubId: string;
  onSelect: (id: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (isToday) {
    return d.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function jobTitle(job: StoredJob): string {
  if (job.protocol === "tspl") return job.labelSize ? `标签 ${job.labelSize}` : "标签";
  if (job.byteLength >= 4096) return "小票（含图片）";
  return "小票";
}

export function PrintHistory({ jobs, selectedId, hubId, onSelect }: Props) {
  if (jobs.length === 0) {
    return (
      <div className="empty">
        当前 Hub 暂无打印记录
        <br />
        <span className="empty-hint">向 Bridge TCP 9100 发送数据即可</span>
      </div>
    );
  }

  return (
    <ul className="history-list">
      {jobs.map((job) => (
        <li key={job.id}>
          <button
            type="button"
            className={`history-item ${job.id === selectedId ? "active" : ""}`}
            onClick={() => onSelect(job.id)}
          >
            <div className="history-head">
              <span className={`tag ${job.protocol}`}>{job.protocol.toUpperCase()}</span>
              <span className="history-time">{formatTime(job.receivedAt)}</span>
            </div>
            <div className="history-title">{jobTitle(job)}</div>
            <div className="history-foot">
              <span className="history-size">{formatSize(job.byteLength)}</span>
              <span className="history-ip">{job.sourceIp}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
