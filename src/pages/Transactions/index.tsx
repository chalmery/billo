import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCards, getTransactions, updateTransactionCategory } from "@/lib/api";
import type { Card as CardType, Transaction } from "@/types";
import { Download as _Download, ChevronLeft, ChevronRight } from "lucide-react";

const CATEGORIES = ["餐饮", "交通", "购物", "娱乐", "外卖", "生活缴费", "医疗健康", "其他"];

export default function Transactions() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  useEffect(() => {
    getCards().then(setCards).catch(console.error);
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [page, selectedCard]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const cardId = selectedCard === "all" ? undefined : Number(selectedCard);
      const result = await getTransactions({
        cardId,
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

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">交易明细</h2>
        <div className="flex gap-2 items-center">
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
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">加载中...</div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              暂无交易记录，请先在设置中导入邮件。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>时间</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>商户</TableHead>
                  <TableHead>支付方式</TableHead>
                  <TableHead>分类</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{tx.transaction_date}</TableCell>
                    <TableCell>{tx.transaction_time ?? "-"}</TableCell>
                    <TableCell className="font-medium text-destructive">
                      -¥{tx.amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{tx.merchant}</TableCell>
                    <TableCell>{tx.payment_method ?? "-"}</TableCell>
                    <TableCell>
                      <Select
                        value={tx.category ?? "其他"}
                        onValueChange={(v) => handleCategoryChange(tx.id, v)}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            共 {total} 条记录，第 {page}/{totalPages} 页
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}