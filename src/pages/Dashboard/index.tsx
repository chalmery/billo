import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getCards,
  getTransactions,
  getMonthlySummary,
  getCategoryBreakdown,
  getSyncState,
} from "@/lib/api";
import type { Card as CardType, MonthlySummary, CategoryBreakdown, SyncStatus } from "@/types";
import { TrendingUp, CreditCard, Flame, Star } from "lucide-react";

export default function Dashboard() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [todayTotal, setTodayTotal] = useState<number>(0);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [cardList, summary, catBreakdown, state] = await Promise.all([
          getCards(),
          getMonthlySummary(null, new Date().getFullYear()),
          getCategoryBreakdown(null, getMonthStart(), getMonthEnd()),
          getSyncState(),
        ]);
        setCards(cardList);
        setSyncStatus(state);

        // Current month total
        const currentMonth = new Date().toISOString().slice(0, 7);
        const currentMonthData = summary.find((s: MonthlySummary) => s.month === currentMonth);
        setMonthlyTotal(currentMonthData?.total ?? 0);

        // Today's transactions
        const today = new Date().toISOString().slice(0, 10);
        const todayTx = await getTransactions({ dateFrom: today, dateTo: today, pageSize: 100 });
        const todaySum = todayTx.items.reduce((acc, t) => acc + t.amount, 0);
        setTodayTotal(todaySum);

        setCategories(catBreakdown.slice(0, 5));
      } catch (e) {
        console.error("Failed to load dashboard data:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getMonthStart(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }

  function getMonthEnd(): string {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${lastDay}`;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">加载中...</div>;
  }

  const topCategory = categories[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">账单概览</h2>
        {syncStatus?.last_sync_at && (
          <p className="text-xs text-muted-foreground">
            上次同步: {syncStatus.last_sync_at}
          </p>
        )}
      </div>

      {cards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">还没有卡片</h3>
            <p className="text-sm text-muted-foreground mt-1">
              请先在「卡片管理」中添加信用卡，然后导入账单邮件。
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">本月消费</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">¥{monthlyTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">今日消费</CardTitle>
                <Flame className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">¥{todayTotal.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">消费最多的类别</CardTitle>
                <Star className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {topCategory ? topCategory.category : "暂无数据"}
                </div>
                {topCategory && (
                  <p className="text-xs text-muted-foreground">
                    ¥{topCategory.total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">已关联卡片</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{cards.length}</div>
              </CardContent>
            </Card>
          </div>

          {/* Category Breakdown */}
          {categories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>消费类别排行 (本月)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {categories.map((cat) => {
                    const maxTotal = categories[0].total;
                    const widthPct = maxTotal > 0 ? (cat.total / maxTotal) * 100 : 0;
                    return (
                      <div key={cat.category} className="flex items-center gap-3">
                        <div className="w-20 text-sm font-medium truncate">{cat.category}</div>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <div className="w-28 text-sm text-right">
                          ¥{cat.total.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                          <span className="text-muted-foreground ml-1">({cat.count}笔)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}