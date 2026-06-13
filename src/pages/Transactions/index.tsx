import { useState, useEffect } from "react";
import { Pagination } from "@/components/shared/Pagination";
import { getCards, getTransactions, updateTransactionCategory } from "@/lib/api";
import type { Card } from "@/types";
import type { Transaction } from "@/types";

const CATEGORIES = ['餐饮','交通','购物','娱乐','生活缴费','医疗','其他'];
const PAYMENT_METHODS = ['支付宝','微信支付','财付通','银联','云闪付','Apple Pay'];

export default function Transactions() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [cardFilter, setCardFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCards().then(setCards).catch(console.error);
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [page, pageSize, cardFilter, categoryFilter, paymentMethodFilter, search, dateFrom, dateTo, amountMin, amountMax]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const result = await getTransactions({
        cardId: cardFilter ? Number(cardFilter) : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        category: categoryFilter || undefined,
        paymentMethod: paymentMethodFilter || undefined,
        merchant: search || undefined,
        amountMin: amountMin ? Number(amountMin) : undefined,
        amountMax: amountMax ? Number(amountMax) : undefined,
        page,
        pageSize,
      });
      setTransactions(result.items);
      setTotal(result.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCategoryChange(txId: number, category: string) {
    try {
      await updateTransactionCategory(txId, category);
      setTransactions((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, category } : t))
      );
    } catch (e) {
      console.error(e);
    }
  }

  function getCardLastFour(cardId: number): string {
    const card = cards.find(c => c.id === cardId);
    return card ? `尾号${card.last_four}` : `卡${cardId}`;
  }

  function resetFilters() { setPage(1); }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold tracking-tight">交易明细</h2>

      <div className="flex gap-2">
        <input type="text" placeholder="搜索商户" value={search}
          onChange={e => { setSearch(e.target.value); resetFilters(); }}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background" />
        <select value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); resetFilters(); }}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">全部分类</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={paymentMethodFilter}
          onChange={e => { setPaymentMethodFilter(e.target.value); resetFilters(); }}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">全部支付方式</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={cardFilter}
          onChange={e => { setCardFilter(e.target.value); resetFilters(); }}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background">
          <option value="">全部卡片</option>
          {cards.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
        </select>
        <input type="date" value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); resetFilters(); }}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background" />
        <input type="date" value={dateTo}
          onChange={e => { setDateTo(e.target.value); resetFilters(); }}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background" />
        <input type="number" placeholder="最低金额" value={amountMin}
          onChange={e => { setAmountMin(e.target.value); resetFilters(); }}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background" />
        <input type="number" placeholder="最高金额" value={amountMax}
          onChange={e => { setAmountMax(e.target.value); resetFilters(); }}
          className="flex-1 border rounded-md px-3 py-2 text-sm bg-background" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted border-b">
              <th className="text-left px-4 py-3 text-sm font-medium">日期</th>
              <th className="text-left px-4 py-3 text-sm font-medium">时间</th>
              <th className="text-left px-4 py-3 text-sm font-medium">卡片</th>
              <th className="text-left px-4 py-3 text-sm font-medium">商户</th>
              <th className="text-left px-4 py-3 text-sm font-medium">支付方式</th>
              <th className="text-left px-4 py-3 text-sm font-medium">分类</th>
              <th className="text-right px-4 py-3 text-sm font-medium">金额</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">加载中...</td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  暂无交易记录，请先在设置中导入邮件。
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-sm">{tx.transaction_date}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{tx.transaction_time ?? "-"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {getCardLastFour(tx.card_id)}
                  </td>
                  <td className="px-4 py-3 text-sm">{tx.merchant}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{tx.payment_method ?? "-"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={tx.category ?? "其他"}
                      onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                      className="border rounded-md px-2 py-1 text-xs bg-background"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-destructive">
                    -¥{tx.amount.toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">共 {total} 条</span>
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </div>
      )}
    </div>
  );
}
