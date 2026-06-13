import { useState, useEffect } from 'react';
import { ChipFilter } from '@/components/shared/ChipFilter';
import { Heatmap } from '@/components/shared/Heatmap';
import { getDashboardData, getCards, getSyncState } from '@/lib/api';
import type { Card, DashboardData } from '@/types';

export default function Dashboard() {
  const [cards, setCards] = useState<Card[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>(['all']);
  const [data, setData] = useState<DashboardData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    getCards().then(setCards);
    getSyncState().then(s => setLastSync(s.last_sync_at));
  }, []);

  useEffect(() => {
    const ids = selectedCards.includes('all') ? [] : selectedCards.map(Number);
    getDashboardData(ids, year).then(setData);
  }, [selectedCards, year]);

  const chipOptions = [
    { key: 'all', label: '全部' },
    ...cards.map(c => ({ key: String(c.id), label: c.name, sublabel: c.last_four })),
  ];

  const heatmapThresholds = [10, 30, 50, 200];
  const heatmapColors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
  const availableYears = data ? Object.keys(data.heatmap_data)
    .map(k => parseInt(k.slice(0, 4)))
    .filter((y, i, a) => a.indexOf(y) === i && y <= new Date().getFullYear())
    .sort((a, b) => b - a) : [year];

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <KpiCard title="本月消费" value={`¥${data?.monthly_total.toLocaleString() ?? '---'}`}
          change={data?.monthly_change_pct} />
        <KpiCard title="本年消费" value={`¥${data?.yearly_total.toLocaleString() ?? '---'}`}
          change={data?.yearly_change_pct} />
        <KpiCard title="日均消费" value={data ? `¥${Math.round(data.daily_average)}` : '---'} />
        <KpiCard title="最大单笔" value={data ? `¥${data.max_single.toLocaleString()}` : '---'}
          sub={data?.max_single_merchant} />
      </div>

      {/* Heatmap */}
      <div className="bg-card border rounded-xl p-5 mb-4">
        <div className="flex justify-end mb-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>少</span>
            <div className="w-3 h-3 rounded-[2px]" style={{backgroundColor: heatmapColors[0]}} />
            <div className="w-3 h-3 rounded-[2px]" style={{backgroundColor: heatmapColors[1]}} />
            <div className="w-3 h-3 rounded-[2px]" style={{backgroundColor: heatmapColors[2]}} />
            <div className="w-3 h-3 rounded-[2px]" style={{backgroundColor: heatmapColors[3]}} />
            <div className="w-3 h-3 rounded-[2px]" style={{backgroundColor: heatmapColors[4]}} />
            <span>多</span>
          </div>
        </div>
        {data && availableYears.length > 0 && (
          <Heatmap
            data={data.heatmap_data}
            year={availableYears.includes(year) ? year : availableYears[0]}
            availableYears={availableYears}
            onYearChange={setYear}
            thresholds={heatmapThresholds}
            colors={heatmapColors}
          />
        )}
        <div className="flex justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            {lastSync ? `上次同步：${lastSync}` : ''}
          </span>
          <ChipFilter options={chipOptions} selected={selectedCards} onChange={setSelectedCards} />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, change, sub }: {
  title: string; value: string; change?: number | null; sub?: string;
}) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-sm text-muted-foreground mb-1">{title}</div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {change != null && (
        <div className={`text-xs mt-1 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% 较上月
        </div>
      )}
      {sub && <div className="text-xs text-muted-foreground mt-1 truncate">{sub}</div>}
    </div>
  );
}
