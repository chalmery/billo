import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
} from "@mui/material";
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
  const [monthlyData, setMonthlyData] = useState<MonthlySummary[]>([]);
  const [prevMonthlyData, setPrevMonthlyData] = useState<MonthlySummary[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyTotal[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<PaymentMethodBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  const cardId = selectedCards.includes("all") ? null : Number(selectedCards[0]);
  const year = new Date().getFullYear();

  useEffect(() => {
    getCards().then(setCards).catch(console.error);
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedCards]);

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
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          统计分析
        </Typography>
        <ChipFilter options={chipOptions} selected={selectedCards} onChange={setSelectedCards} />
      </Box>

      {/* 2×2 Chart Grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2 }}>
        {/* Monthly Trend AreaChart */}
        <Card>
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                月度消费趋势
              </Typography>
            </Box>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={mergedMonthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${v}`} />
                <Tooltip formatter={(value) => `¥${Number(value).toFixed(2)}`} />
                <Area type="monotone" dataKey="current" name={`${year}年`} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="previous" name={`${year - 1}年`} stroke="#94a3b8" fill="none" strokeDasharray="5 5" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Yearly BarChart (horizontal) */}
        <Card>
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>
              年度消费趋势
            </Typography>
            {yearlyData.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="body2" color="text.secondary">
                  暂无数据
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={yearlyData} layout="vertical" margin={{ left: 40, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
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
          </CardContent>
        </Card>

        {/* Category PieChart */}
        <Card>
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>
              消费分类占比
            </Typography>
            {categoryPieData.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="body2" color="text.secondary">
                  暂无数据
                </Typography>
              </Box>
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
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 1, justifyContent: "center" }}>
              {categoryPieData.map((d, idx) => (
                <Box key={d.name} sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: "0.75rem", color: "text.secondary" }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: CAT_COLORS[idx % CAT_COLORS.length] }} />
                  {d.name}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        {/* Payment Method PieChart */}
        <Card>
          <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>
              支付方式占比
            </Typography>
            {paymentPieData.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 8 }}>
                <Typography variant="body2" color="text.secondary">
                  暂无数据
                </Typography>
              </Box>
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
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mt: 1, justifyContent: "center" }}>
              {paymentPieData.map((d, idx) => (
                <Box key={d.name} sx={{ display: "flex", alignItems: "center", gap: 0.75, fontSize: "0.75rem", color: "text.secondary" }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: PM_COLORS[idx % PM_COLORS.length] }} />
                  {d.name}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Full-width Category Ranking Table */}
      <Card>
        <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>
            分类排行
          </Typography>
          {categoryData.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <Typography variant="body2" color="text.secondary">
                暂无数据
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 48, fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>分类</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>金额</TableCell>
                    <TableCell align="right" sx={{ width: 80, fontWeight: 600 }}>占比</TableCell>
                    <TableCell align="right" sx={{ width: 80, fontWeight: 600 }}>笔数</TableCell>
                    <TableCell sx={{ width: 192, fontWeight: 600 }}>分布</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categoryData.map((cat, idx) => {
                    const pct = ((cat.total / totalCategory) * 100).toFixed(1);
                    const barWidth = Math.max((cat.total / totalCategory) * 100, 1);
                    return (
                      <TableRow key={cat.category} hover>
                        <TableCell sx={{ color: "text.secondary" }}>{idx + 1}</TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: CAT_COLORS[idx % CAT_COLORS.length] }} />
                            {cat.category}
                          </Box>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          ¥{cat.total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>{pct}%</TableCell>
                        <TableCell align="right" sx={{ color: "text.secondary" }}>{cat.count}</TableCell>
                        <TableCell>
                          <Box sx={{ height: 8, borderRadius: 4, backgroundColor: "divider", overflow: "hidden" }}>
                            <Box
                              sx={{
                                height: "100%",
                                borderRadius: 4,
                                width: `${barWidth}%`,
                                backgroundColor: CAT_COLORS[idx % CAT_COLORS.length],
                              }}
                            />
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
