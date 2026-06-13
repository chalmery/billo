import { Box, Chip } from "@mui/material";

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
    if (key === "all") { onChange(["all"]); return; }
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected.filter((k) => k !== "all"), key];
    onChange(next.length === 0 ? ["all"] : next);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
      {options.map((opt) => (
        <Chip
          key={opt.key}
          label={opt.sublabel ? `${opt.label} ${opt.sublabel}` : opt.label}
          onClick={() => toggle(opt.key)}
          variant={selected.includes(opt.key) ? "filled" : "outlined"}
          color={selected.includes(opt.key) ? "primary" : "default"}
          size="small"
        />
      ))}
    </Box>
  );
}