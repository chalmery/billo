interface ChipOption {
  key: string;
  label: string;
  sublabel?: string;
}

interface ChipFilterProps {
  options: ChipOption[];
  selected: string[];
  onChange: (keys: string[]) => void;
}

export function ChipFilter({ options, selected, onChange }: ChipFilterProps) {
  const toggle = (key: string) => {
    if (key === 'all') { onChange(['all']); return; }
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected.filter(k => k !== 'all'), key];
    onChange(next.length === 0 ? ['all'] : next);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {options.map(opt => (
        <button key={opt.key} onClick={() => toggle(opt.key)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
            ${selected.includes(opt.key)
              ? 'bg-primary text-primary-foreground'
              : 'border bg-background text-foreground hover:bg-muted'}`}>
          {opt.label}
          {opt.sublabel && (
            <span className={selected.includes(opt.key) ? 'opacity-60' : 'opacity-40'}>
              {opt.sublabel}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
