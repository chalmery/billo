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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
    if (current.getFullYear() === year && current <= today) {
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
    <div className="flex gap-4">
      <div>
        <div className="flex mb-1" style={{ paddingLeft: '28px' }}>
          {weeks.map((week, ci) => {
            const firstDate = week.find(d => d !== null);
            const month = firstDate?.getMonth();
            const prevFirstDate = ci > 0 ? weeks[ci - 1].find(d => d !== null) : null;
            const prevMonth = prevFirstDate?.getMonth();
            return (
              <div key={ci} style={{ width: `${cellSize + gap}px` }} className="text-xs text-muted-foreground overflow-visible whitespace-nowrap">
                {month !== undefined && month !== prevMonth ? MONTH_NAMES[month] : ''}
              </div>
            );
          })}
        </div>
        <div className="flex">
          <div className="flex flex-col mr-1" style={{ gap: `${gap}px`, width: '24px' }}>
            {DAY_LABELS.map((label, i) => (
              <div key={i} style={{ height: `${cellSize}px` }} className="flex items-center text-xs text-muted-foreground">
                {label ?? ''}
              </div>
            ))}
          </div>
          <div className="flex" style={{ gap: `${gap}px` }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: `${gap}px` }}>
                {week.map((date, di) => {
                  const key = date ? formatDate(date) : '';
                  const dp = date && key ? data[key] : null;
                  const amount = dp ? dp.amount : 0;
                  const bg = date ? getColor(amount, thresholds, colors) : 'transparent';
                  const title = date && dp
                    ? `${key}: ¥${dp.amount.toFixed(2)} (${dp.count}笔)`
                    : date ? `${key}: 无数据` : '';
                  return (
                    <div key={di} style={{ width: `${cellSize}px`, height: `${cellSize}px`, backgroundColor: bg, borderRadius: '2px' }} title={title} />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 mt-2" style={{ paddingLeft: '28px' }}>
          <span className="text-xs text-muted-foreground">少</span>
          {colors.map((color, i) => (
            <div key={i} style={{ width: `${cellSize}px`, height: `${cellSize}px`, backgroundColor: color, borderRadius: '2px' }} />
          ))}
          <span className="text-xs text-muted-foreground">多</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {sortedYears.map(y => (
          <button
            key={y}
            onClick={() => onYearChange(y)}
            className={`text-sm px-2 py-0.5 rounded text-left ${y === year ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}
