import { useLocale } from "../i18n/context";
import {
  ESCPOS_CATEGORIES,
  ESCPOS_COMMANDS,
  lookupCommands,
  TSPL_CATEGORIES,
  TSPL_COMMANDS,
  type CommandCategory,
  type CommandEntry,
} from "../lib/command-reference";

interface Props {
  protocol: "tspl" | "escpos";
  onOpenChange?: (open: boolean) => void;
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

export function CommandReference({ protocol, onOpenChange }: Props) {
  const { t } = useLocale();
  const categories = protocol === "tspl" ? TSPL_CATEGORIES : ESCPOS_CATEGORIES;
  const source = protocol === "tspl" ? TSPL_COMMANDS : ESCPOS_COMMANDS;
  const title = protocol === "tspl" ? t.cmdRef.titleTspl : t.cmdRef.titleEscpos;

  return (
    <div className="cmd-ref">
      <details
        className="cmd-ref-root"
        onToggle={(e) => onOpenChange?.((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary>
          {title} ({source.length})
        </summary>
        <div className="cmd-ref-body">
          {categories.map((category) => (
            <CategoryGroup key={category.titleKey} category={category} source={source} protocol={protocol} />
          ))}
        </div>
      </details>
    </div>
  );
}
