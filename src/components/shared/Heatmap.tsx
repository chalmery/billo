import { Box, Button } from "@mui/material";

interface HeatmapDataPoint {
  amount: number;
  count: number;
  categories: string[];
}

interface HeatmapProps {
  data: Record<string, HeatmapDataPoint>;
  year: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  thresholds: number[];
  colors: string[];
}

function getColor(amount: number, thresholds: number[], colors: string[]): string {
  if (amount <= 0) return colors[0];
  for (let i = 0; i < thresholds.length; i++) {
    if (amount <= thresholds[i]) return colors[i + 1];
  }
  return colors[colors.length - 1];
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateYearGrid(year: number): (Date | null)[][] {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const jan1Day = jan1.getDay();
  const jan1MonBased = jan1Day === 0 ? 6 : jan1Day - 1;
  const firstMonday = new Date(jan1);
  firstMonday.setDate(jan1.getDate() - jan1MonBased);

  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = Array(7).fill(null);
  const current = new Date(firstMonday);

  while (current <= dec31) {
    const jsDay = current.getDay();
    const monBased = jsDay === 0 ? 6 : jsDay - 1;
    if (monBased === 0 && current.getTime() !== firstMonday.getTime()) {
      weeks.push(currentWeek);
      currentWeek = Array(7).fill(null);
    }
    if (current.getFullYear() === year) {
      currentWeek[monBased] = new Date(current);
    }
    current.setDate(current.getDate() + 1);
  }
  weeks.push(currentWeek);
  return weeks;
}

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
const DAY_LABELS: (string | null)[] = ['一', null, '三', null, '五', null, '日'];

export function Heatmap({ data, year, availableYears, onYearChange, thresholds, colors }: HeatmapProps) {
  const weeks = generateYearGrid(year);
  const sortedYears = [...availableYears].sort((a, b) => b - a);
  const cellSize = 12;
  const gap = 3;

  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      <Box>
        <Box sx={{ display: "flex", mb: 0.25, pl: "28px" }}>
          {weeks.map((week, ci) => {
            const firstDate = week.find(d => d !== null);
            const month = firstDate?.getMonth();
            const prevFirstDate = ci > 0 ? weeks[ci - 1].find(d => d !== null) : null;
            const prevMonth = prevFirstDate?.getMonth();
            return (
              <Box key={ci} sx={{ width: cellSize + gap, fontSize: "0.7rem", color: "text.secondary", overflow: "visible", whiteSpace: "nowrap" }}>
                {month !== undefined && month !== prevMonth ? MONTH_NAMES[month] : ''}
              </Box>
            );
          })}
        </Box>
        <Box sx={{ display: "flex" }}>
          <Box sx={{ display: "flex", flexDirection: "column", mr: 0.5, gap: `${gap}px`, width: 24 }}>
            {DAY_LABELS.map((label, i) => (
              <Box key={i} sx={{ height: cellSize, display: "flex", alignItems: "center", fontSize: "0.7rem", color: "text.secondary" }}>
                {label ?? ''}
              </Box>
            ))}
          </Box>
          <Box sx={{ display: "flex", gap: `${gap}px` }}>
            {weeks.map((week, wi) => (
              <Box key={wi} sx={{ display: "flex", flexDirection: "column", gap: `${gap}px` }}>
                {week.map((date, di) => {
                  const key = date ? formatDate(date) : '';
                  const dp = date && key ? data[key] : null;
                  const amount = dp ? dp.amount : 0;
                  const bg = date ? getColor(amount, thresholds, colors) : 'transparent';
                  const isFuture = date && date > new Date();
                  const title = date && dp
                    ? `${key}: ¥${dp.amount.toFixed(2)} (${dp.count}笔)`
                    : date && !isFuture ? `${key}: 无数据`
                    : date ? key : '';
                  return (
                    <Box key={di} sx={{ width: cellSize, height: cellSize, backgroundColor: bg, borderRadius: "2px" }} title={title} />
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {sortedYears.map(y => (
          <Button
            key={y}
            onClick={() => onYearChange(y)}
            size="small"
            sx={{
              px: 1,
              py: 0,
              minWidth: 0,
              justifyContent: "flex-start",
              fontSize: "0.8rem",
              borderRadius: 0.5,
              textTransform: "none",
              color: y === year ? "primary.contrastText" : "text.secondary",
              bgcolor: y === year ? "primary.main" : "transparent",
              "&:hover": { bgcolor: y === year ? "primary.dark" : "action.hover" },
            }}
          >
            {y}
          </Button>
        ))}
      </Box>
    </Box>
  );
}
