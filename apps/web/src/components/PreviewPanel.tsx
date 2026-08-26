import { useEffect, useRef } from "react";
import type { StoredJob } from "../App";

interface Props {
  job: StoredJob | null;
  canvas: HTMLCanvasElement | null;
  warnings?: string[];
}

export function PreviewPanel({ job, canvas, warnings = [] }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    mount.innerHTML = "";
    if (canvas) {
      canvas.className = "preview-canvas";
      mount.appendChild(canvas);
    }
  }, [canvas]);

  if (!job) {
    return <div className="empty">选择一条打印记录以预览小票/标签</div>;
  }

  return (
    <div className="preview-wrap">
      <div className="preview-meta">
        <span className={`tag ${job.protocol}`}>{job.protocol.toUpperCase()}</span>
        <span>{job.sourceIp}</span>
        <span>{job.byteLength} bytes</span>
      </div>
      {warnings.length > 0 && (
        <details className="parse-warnings">
          <summary>{warnings.length} 条解析提示</summary>
          <ul>
            {warnings.map((w, i) => (
              <li key={`${i}-${w.slice(0, 24)}`}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      <div ref={mountRef} className="preview-mount" />
    </div>
  );
}
