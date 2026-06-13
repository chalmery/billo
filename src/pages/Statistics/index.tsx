import { useEffect, useState } from "react";
import { ChipFilter } from "@/components/shared/ChipFilter";
import {
  getCards,
  getMonthlySummary,
  getCategoryBreakdown,
  getYearlyTotals,
  getPaymentMethodBreakdown,
} from "@/lib/api";
import type { Card as CardType, MonthlySummary, CategoryBreakdown } from "@/types";
import type { YearlyTotal, PaymentMethodBreakdown } from "@/lib/api";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const CAT_COLORS = ["#818cf8", "#e879f9", "#38bdf8", "#fb923c", "#4ade80", "#fbbf24", "#a78bfa", "#f87171"];
const PM_COLORS = ["#6366f1", "#f43f5e", "#0ea5e9", "#8b5cf6", "#64748b", "#10b981", "#f59e0b"];

export default function Statistics() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>(["all"]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]);
  const [prevMonthlyData, setPrevMonthlyData] = useState<MonthlySummary[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyTotal[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<PaymentMethodBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  const cardId = selectedCards.includes("all") ? null : Number(selectedCards[0]);

  useEffect(() => {
    getCards().then(setCards).catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedCards, year]);

  async function loadData() {
    setLoading(true);
    try {
      const now = new Date();
      const dateFrom = `${year}-01-01`;
      const dateTo = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const [monthly, prevMonthly, category, yearly, paymentMethod] = await Promise.all([
        getMonthlySummary(cardId, year),
        getMonthlySummary(cardId, year - 1),
        getCategoryBreakdown(cardId, dateFrom, dateTo),
        getYearlyTotals(cardId),
        getPaymentMethodBreakdown(cardId, dateFrom, dateTo),
      ]);

      setMonthlyData(monthly);
      setPrevMonthlyData(prevMonthly);
      setCategoryData(category);
      setYearlyData(yearly);
      setPaymentMethodData(paymentMethod);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const chipOptions = [
    { key: "all", label: "全部" },
    ...cards.map((c) => ({ key: String(c.id), label: c.name, sublabel: c.last_four })),
  ];

  // Merge monthly data for AreaChart overlay
  const mergedMonthly = Array.from({ length: 12 }, (_, i) => ({
    month: `${String(i + 1).padStart(2, "0")}月`,
    current: 0,
    previous: 0,
  }));
  monthlyData.forEach((m) => {
    const idx = parseInt(m.month.split("-")[1]) - 1;
    if (idx >= 0 && idx < 12) mergedMonthly[idx].current = m.total;
  });
  prevMonthlyData.forEach((m) => {
    const idx = parseInt(m.month.split("-")[1]) - 1;
    if (idx >= 0 && idx < 12) mergedMonthly[idx].previous = m.total;
  });

  const categoryPieData = categoryData.map((c) => ({ name: c.category, value: c.total }));
  const totalCategory = categoryData.reduce((s, c) => s + c.total, 0) || 1;

  const paymentPieData = paymentMethodData.map((p) => ({ name: p.method, value: p.total }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">加载中...</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">统计分析</h2>
        <ChipFilter options={chipOptions} selected={selectedCards} onChange={setSelectedCards} />
      </div>

      {/* 2×2 Chart Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Monthly Trend AreaChart */}
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium">月度消费趋势</h3>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border rounded-md px-2 py-1 text-xs bg-background"
            >
              {[2026, 2025, 2024, 2023].filter((y) => y <= new Date().getFullYear()).map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={mergedMonthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${v}`} />
              <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
              <Area type="monotone" dataKey="current" name={`${year}年`} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
              <Area type="monotone" dataKey="previous" name={`${year - 1}年`} stroke="#94a3b8" fill="none" strokeDasharray="5 5" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Yearly BarChart (horizontal) */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-medium mb-4">年度消费趋势</h3>
          {yearlyData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={yearlyData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${v}`} />
                <YAxis type="category" dataKey="year" tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
                <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {yearlyData.map((_entry, idx) => (
                    <Cell key={idx} fill={CAT_COLORS[idx % CAT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category PieChart */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-medium mb-4">消费分类占比</h3>
          {categoryPieData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {categoryPieData.map((_, idx) => (
                    <Cell key={idx} fill={CAT_COLORS[idx % CAT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {categoryPieData.map((d, idx) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CAT_COLORS[idx % CAT_COLORS.length] }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>

        {/* Payment Method PieChart */}
        <div className="bg-card border rounded-xl p-5">
          <h3 className="text-sm font-medium mb-4">支付方式占比</h3>
          {paymentPieData.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={paymentPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {paymentPieData.map((_, idx) => (
                    <Cell key={idx} fill={PM_COLORS[idx % PM_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {paymentPieData.map((d, idx) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PM_COLORS[idx % PM_COLORS.length] }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full-width Category Ranking Table */}
      <div className="bg-card border rounded-xl p-5">
        <h3 className="text-sm font-medium mb-4">分类排行</h3>
        {categoryData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">暂无数据</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 font-medium w-12">#</th>
                <th className="pb-2 font-medium">分类</th>
                <th className="pb-2 font-medium text-right">金额</th>
                <th className="pb-2 font-medium text-right w-20">占比</th>
                <th className="pb-2 font-medium text-right w-20">笔数</th>
                <th className="pb-2 font-medium w-48">分布</th>
              </tr>
            </thead>
            <tbody>
              {categoryData.map((cat, idx) => {
                const pct = ((cat.total / totalCategory) * 100).toFixed(1);
                const barWidth = Math.max((cat.total / totalCategory) * 100, 1);
                return (
                  <tr key={cat.category} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-3 text-sm text-muted-foreground">{idx + 1}</td>
                    <td className="py-3 text-sm">
                      <span className="inline-flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CAT_COLORS[idx % CAT_COLORS.length] }} />
                        {cat.category}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-right font-medium">
                      ¥{cat.total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 text-sm text-right text-muted-foreground">{pct}%</td>
                    <td className="py-3 text-sm text-right text-muted-foreground">{cat.count}</td>
                    <td className="py-3">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: CAT_COLORS[idx % CAT_COLORS.length],
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}