import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCards,
  getMonthlySummary,
  getCategoryBreakdown,
  getCreditTrend,
} from "@/lib/api";
import type { Card as CardType, MonthlySummary, CategoryBreakdown, CreditTrend } from "@/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const COLORS = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export default function Statistics() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>("all");
  const [year] = useState(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([]);
  const [creditTrend, setCreditTrend] = useState<CreditTrend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCards().then(setCards).catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedCard]);

  async function loadData() {
    setLoading(true);
    try {
      const cardId = selectedCard === "all" ? null : Number(selectedCard);
      const now = new Date();
      const dateFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dateTo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${lastDay}`;

      const [monthly, category, trend] = await Promise.all([
        getMonthlySummary(cardId, year),
        getCategoryBreakdown(cardId, dateFrom, dateTo),
        getCreditTrend(cardId, dateFrom, dateTo),
      ]);

      setMonthlyData(monthly);
      setCategoryData(category);
      setCreditTrend(trend);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">加载中...</div>;
  }

  const pieData = categoryData.map((c) => ({
    name: c.category,
    value: c.total,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">统计分析</h2>
        <Select value={selectedCard} onValueChange={setSelectedCard}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="选择卡片" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部卡片</SelectItem>
            {cards.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name} (尾号{c.last_four})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">月度趋势</TabsTrigger>
          <TabsTrigger value="category">消费分类</TabsTrigger>
          <TabsTrigger value="credit">额度变化</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>{year}年 月度消费趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">暂无数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: unknown) => `¥${Number(value).toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="total" name="消费总额" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="category">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>本月消费分类占比</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">暂无数据</p>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: { name?: string; percent?: number }) =>
                          `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
<Tooltip formatter={(value: unknown) => `¥${Number(value).toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>分类明细</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categoryData.map((cat, i) => (
                    <div key={cat.category} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        <span className="text-sm">{cat.category}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">
                          ¥{cat.total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-muted-foreground ml-2">({cat.count}笔)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="credit">
          <Card>
            <CardHeader>
              <CardTitle>本月可用额度变化</CardTitle>
            </CardHeader>
            <CardContent>
              {creditTrend.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">暂无数据</p>
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={creditTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: unknown) => `¥${Number(value).toFixed(2)}`} />
                    <Legend />
                    <Line type="monotone" dataKey="available_credit" name="可用额度" stroke="#3b82f6" strokeWidth={2} />
                    <Line type="monotone" dataKey="total_consumption" name="当日消费" stroke="#ef4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}