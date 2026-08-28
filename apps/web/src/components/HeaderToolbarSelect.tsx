interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  ariaLabel: string;
  options: Option[];
  onChange: (value: string) => void;
}

/** macOS Electron renders native <select> as a gray stipple over text — hide it and show a label layer. */
export function HeaderToolbarSelect({ value, ariaLabel, options, onChange }: Props) {
  const current = options.find((o) => o.value === value)?.label ?? value;

  return (
    <span className="header-toolbar-select-wrap">
      <span className="header-toolbar-select-label" aria-hidden="true">
        {current}
      </span>
      <select
        className="header-toolbar-select-native"
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
