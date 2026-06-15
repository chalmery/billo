import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography,
} from "@mui/material";
import { ChipFilter } from '@/components/shared/ChipFilter';
import { Heatmap } from '@/components/shared/Heatmap';
import { getDashboardData, getCards, getSyncState } from '@/lib/api';
import type { Card as CardType, DashboardData } from '@/types';

export default function Dashboard() {
  const [cards, setCards] = useState<CardType[]>([]);
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
  const availableYears = data && data.available_years.length > 0
    ? [...data.available_years].sort((a, b) => b - a)
    : [year];

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(year)) {
      setYear(availableYears[0]);
    }
  }, [availableYears, year]);

  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, mb: 3 }}>
        <KpiCard title="本月消费" value={`¥${(data?.monthly_total ?? 0).toLocaleString()}`}
          change={data?.monthly_change_pct} />
        <KpiCard title="本年消费" value={`¥${(data?.yearly_total ?? 0).toLocaleString()}`}
          change={data?.yearly_change_pct} />
        <KpiCard title="日均消费" value={data ? `¥${Math.round(data.daily_average)}` : '---'} />
        <KpiCard title="最大单笔" value={data ? `¥${data.max_single.toLocaleString()}` : '---'}
          sub={data?.max_single_merchant} />
      </Box>

      <Card>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          {data && availableYears.length > 0 ? (
            <>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "0.7rem", color: "text.secondary" }}>
                  <span>少</span>
                  {heatmapColors.map((c, i) => (
                    <Box key={i} sx={{ width: 12, height: 12, backgroundColor: c, borderRadius: "2px" }} />
                  ))}
                  <span>多</span>
                </Box>
              </Box>
              <Heatmap
                data={data.heatmap_data}
                year={year}
                availableYears={availableYears}
                onYearChange={setYear}
                thresholds={heatmapThresholds}
                colors={heatmapColors}
              />
            </>
          ) : (
            <Box sx={{ textAlign: "center", py: 8, color: "text.secondary" }}>
              <Typography variant="h6" sx={{ mb: 1 }}>暂无消费数据</Typography>
              <Typography variant="body2">同步 Gmail 邮件或手动导入数据后，热力图将显示在这里</Typography>
            </Box>
          )}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {lastSync ? `上次同步：${lastSync}` : ''}
            </Typography>
            <ChipFilter options={chipOptions} selected={selectedCards} onChange={setSelectedCards} />
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

function KpiCard({ title, value, change, sub }: {
  title: string; value: string; change?: number | null; sub?: string;
}) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {title}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        {change != null && (
          <Typography variant="caption" sx={{ mt: 0.5, color: change >= 0 ? "success.main" : "error.main", display: "block" }}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% 较上月
          </Typography>
        )}
        {sub && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
