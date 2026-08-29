import { useMemo, useState } from "react";
import { parseEscPosInspector } from "@virt-printer/escpos";
import { parseTspl, isTsplPayload } from "@virt-printer/tspl";
import { useLocale } from "../i18n/context";
import { buildInspectorBlocks, type InspectorBlock } from "../lib/inspector-blocks";
import { localizeBlockTitle, localizeRowLabel } from "../lib/inspector-i18n";

interface Props {
  payload: Uint8Array;
  protocol: string;
  selectedBlockId?: string | null;
  onSelectBlock?: (block: InspectorBlock | null) => void;
}

export function InspectorPanel({
  payload,
  protocol,
  selectedBlockId = null,
  onSelectBlock,
}: Props) {
  const { t, format } = useLocale();
  const [filter, setFilter] = useState<"all" | "issues">("all");
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});

  const parsed = useMemo(() => {
    const tspl = protocol === "tspl" || isTsplPayload(payload);
    const blocks = buildInspectorBlocks(payload, protocol);
    const warnings = tspl ? parseTspl(payload).warnings : parseEscPosInspector(payload).warnings;
    const unsupportedBytes = tspl
      ? 0
      : parseEscPosInspector(payload).commands
          .filter((c) => c.category === "unsupported")
          .reduce((sum, c) => sum + c.span.length, 0);
    const rowCount = blocks.reduce((n, b) => n + b.rows.length, 0);
    const unsupportedCount = blocks
      .flatMap((b) => b.rows)
      .filter((r) => r.category === "unsupported").length;
    return { blocks, warnings, unsupportedBytes, rowCount, unsupportedCount };
  }, [payload, protocol]);

  const unsupportedRatio =
    payload.length > 0 ? Math.round((parsed.unsupportedBytes / payload.length) * 1000) / 10 : 0;

  const visibleBlocks =
    filter === "issues"
      ? parsed.blocks.filter((b) => b.rows.some((r) => r.category === "unsupported"))
      : parsed.blocks;

  if (parsed.blocks.length === 0) return null;

  function toggleExpanded(blockId: string) {
    setExpandedBlocks((prev) => ({ ...prev, [blockId]: !prev[blockId] }));
  }

  function handleSelect(block: InspectorBlock) {
    if (!block.previewable || !onSelectBlock) return;
    onSelectBlock(selectedBlockId === block.id ? null : block);
  }

  return (
    <details className="disclosure-block inspector-panel" open>
      <summary>
        {format(t.inspector.summary, {
          n: parsed.rowCount,
          unsupported: parsed.unsupportedCount,
        })}
      </summary>

      <div className="inspector-stats">
        <span>{format(t.inspector.payloadBytes, { n: payload.length })}</span>
        <span>{format(t.inspector.blockCount, { n: visibleBlocks.length })}</span>
        {parsed.unsupportedBytes > 0 && (
          <span className="inspector-stat-warn">
            {format(t.inspector.unsupportedBytes, {
              n: parsed.unsupportedBytes,
              pct: unsupportedRatio,
            })}
          </span>
        )}
        {parsed.warnings.length > 0 && (
          <span className="inspector-stat-warn">
            {format(t.inspector.warnings, { n: parsed.warnings.length })}
          </span>
        )}
      </div>

      {parsed.warnings.length > 0 && (
        <ul className="inspector-warnings">
          {parsed.warnings.map((w, i) => (
            <li key={`${i}-${w.slice(0, 20)}`}>{w}</li>
          ))}
        </ul>
      )}

      <div className="inspector-toolbar">
        <div className="segmented-toolbar segmented-toolbar--compact" role="group" aria-label={t.inspector.filterLabel}>
          <button
            type="button"
            className={`segmented-btn${filter === "all" ? " active" : ""}`}
            onClick={() => setFilter("all")}
          >
            {t.inspector.filterAll}
          </button>
          <button
            type="button"
            className={`segmented-btn${filter === "issues" ? " active" : ""}`}
            onClick={() => setFilter("issues")}
          >
            {t.inspector.filterIssues}
          </button>
        </div>
      </div>

      <div className="inspector-block-list" role="list">
        {visibleBlocks.map((block) => {
          const selected = selectedBlockId === block.id;
          const expanded = expandedBlocks[block.id] ?? false;
          const isSetup = block.kind === "setup";
          const isComposite = block.kind === "composite";
          const canExpand = (isSetup && block.rows.length > 1) || isComposite;

          return (
            <div
              key={block.id}
              role="listitem"
              className={[
                "inspector-block",
                `inspector-block--${block.kind}`,
                selected ? "inspector-block--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={`inspector-block-head${block.previewable ? " inspector-block-head--linkable" : ""}`}
                tabIndex={block.previewable ? 0 : undefined}
                aria-selected={selected || undefined}
                title={block.previewable ? t.inspector.linkRow : t.inspector.metaRow}
                onClick={() => handleSelect(block)}
                onKeyDown={(e) => {
                  if (!block.previewable) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(block);
                  }
                }}
              >
                <span className={`inspector-block-badge inspector-block-badge--${block.kind}`}>
                  {isSetup ? t.inspector.badgeSetup : isComposite ? t.inspector.badgeGroup : t.inspector.badgePreview}
                </span>
                <div className="inspector-block-main">
                  <div className="inspector-block-title">
                    {localizeBlockTitle(block, t.inspector, format)}
                  </div>
                  {block.detail ? <div className="inspector-block-detail">{block.detail}</div> : null}
                </div>
                {canExpand && (
                  <button
                    type="button"
                    className="inspector-block-expand"
                    aria-expanded={expanded}
                    aria-label={isComposite ? t.inspector.expandGroup : t.inspector.expandSetup}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(block.id);
                    }}
                  >
                    {expanded ? "−" : "+"}
                  </button>
                )}
                {isSetup && !canExpand && (
                  <span className="inspector-block-meta-count">{block.rows.length}</span>
                )}
              </div>

              {canExpand && expanded && (
                <ul className={`inspector-block-children${isSetup ? " inspector-block-children--muted" : ""}`}>
                  {block.rows.map((row) => (
                    <li key={row.commandId}>
                      <code>{localizeRowLabel(row.category, row.label, t.inspector)}</code>
                      {!isSetup && <span>{row.detail || row.category}</span>}
                      <span className="inspector-block-offset">{row.offset}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {onSelectBlock && <p className="inspector-link-hint">{t.inspector.linkHint}</p>}
    </details>
  );
}
