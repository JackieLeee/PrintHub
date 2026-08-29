import { useLocale } from "../i18n/context";
import {
  ESCPOS_CATEGORIES,
  ESCPOS_COMMANDS,
  lookupCommands,
  TSPL_CATEGORIES,
  TSPL_COMMANDS,
  type CommandCategory,
  type CommandDialect,
  type CommandEntry,
} from "../lib/command-reference";

interface Props {
  protocol: "tspl" | "escpos";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Footer / workbench mode — no nested details toggle. */
  embedded?: boolean;
}

function DialectBadge({ dialect }: { dialect: CommandDialect }) {
  const { t } = useLocale();
  return (
    <span className={`cmd-ref-dialect cmd-ref-dialect--${dialect}`}>
      {t.cmdRef.dialects[dialect]}
    </span>
  );
}

function CommandTable({ rows, protocol }: { rows: CommandEntry[]; protocol: "tspl" | "escpos" }) {
  const { t } = useLocale();
  const desc = t.cmdRef.desc;
  const labels = t.cmdRef.labels;

  return (
    <table className="cmd-ref-table">
      <thead>
        <tr>
          <th>{t.cmdRef.colCommand}</th>
          <th>{t.cmdRef.colDialect}</th>
          <th>{t.cmdRef.colSyntax}</th>
          <th>{t.cmdRef.colDesc}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name}>
            <td>
              <code>{protocol === "tspl" ? row.name : (labels[row.name as keyof typeof labels] ?? row.name)}</code>
            </td>
            <td>
              <DialectBadge dialect={row.dialect} />
            </td>
            <td className="cmd-ref-syntax">{row.syntax}</td>
            <td>{desc[row.descriptionKey as keyof typeof desc] ?? row.descriptionKey}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoryGroup({
  category,
  source,
  protocol,
}: {
  category: CommandCategory;
  source: CommandEntry[];
  protocol: "tspl" | "escpos";
}) {
  const { t } = useLocale();
  const rows = lookupCommands(category.commandNames, source);
  if (rows.length === 0) return null;

  return (
    <details className="cmd-ref-group">
      <summary>
        {t.cmdRef.categories[category.titleKey as keyof typeof t.cmdRef.categories]} ({rows.length})
      </summary>
      <CommandTable rows={rows} protocol={protocol} />
    </details>
  );
}

export function CommandReference({ protocol, open, onOpenChange, embedded = false }: Props) {
  const { t } = useLocale();
  const categories = protocol === "tspl" ? TSPL_CATEGORIES : ESCPOS_CATEGORIES;
  const source = protocol === "tspl" ? TSPL_COMMANDS : ESCPOS_COMMANDS;
  const title = protocol === "tspl" ? t.cmdRef.titleTspl : t.cmdRef.titleEscpos;

  const body = (
    <div className="cmd-ref-body">
      {protocol === "escpos" && <p className="cmd-ref-dialect-note">{t.cmdRef.dialectNoteEscpos}</p>}
      {categories.map((category) => (
        <CategoryGroup key={category.titleKey} category={category} source={source} protocol={protocol} />
      ))}
    </div>
  );

  if (embedded) {
    return <div className="cmd-ref cmd-ref--embedded">{body}</div>;
  }

  return (
    <div className="cmd-ref">
      <details
        className="cmd-ref-root"
        open={open}
        onToggle={(e) => onOpenChange?.((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          {title} ({source.length})
        </summary>
        {body}
      </details>
    </div>
  );
}
