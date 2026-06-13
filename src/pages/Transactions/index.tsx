import { useState, useEffect } from "react";
import {
  Box, Typography, TextField, Select, MenuItem, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper, CircularProgress, FormControl,
} from "@mui/material";
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
  }, [page, pageSize, cardFilter, categoryFilter, paymentMethodFilter, search, amountMin, amountMax]);

  async function loadTransactions() {
    setLoading(true);
    try {
      const result = await getTransactions({
        cardId: cardFilter ? Number(cardFilter) : undefined,
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        交易明细
      </Typography>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="搜索商户"
          value={search}
          onChange={e => { setSearch(e.target.value); resetFilters(); }}
          sx={{ width: 176 }}
        />
        <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
          <Select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); resetFilters(); }}
            displayEmpty
          >
            <MenuItem value="">全部分类</MenuItem>
            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
          <Select
            value={paymentMethodFilter}
            onChange={e => { setPaymentMethodFilter(e.target.value); resetFilters(); }}
            displayEmpty
          >
            <MenuItem value="">全部支付方式</MenuItem>
            {PAYMENT_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120, flex: 1 }}>
          <Select
            value={cardFilter}
            onChange={e => { setCardFilter(e.target.value); resetFilters(); }}
            displayEmpty
          >
            <MenuItem value="">全部卡片</MenuItem>
            {cards.map(c => <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField
          size="small"
          type="number"
          placeholder="¥起"
          value={amountMin}
          onChange={e => { setAmountMin(e.target.value); resetFilters(); }}
          sx={{ width: 80 }}
        />
        <TextField
          size="small"
          type="number"
          placeholder="¥止"
          value={amountMax}
          onChange={e => { setAmountMax(e.target.value); resetFilters(); }}
          sx={{ width: 80 }}
        />
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "action.hover" }}>
              <TableCell sx={{ fontSize: "0.75rem", fontWeight: 500, color: "text.secondary" }}>日期</TableCell>
              <TableCell sx={{ fontSize: "0.75rem", fontWeight: 500, color: "text.secondary" }}>时间</TableCell>
              <TableCell sx={{ fontSize: "0.75rem", fontWeight: 500, color: "text.secondary" }}>卡片</TableCell>
              <TableCell sx={{ fontSize: "0.75rem", fontWeight: 500, color: "text.secondary" }}>商户</TableCell>
              <TableCell sx={{ fontSize: "0.75rem", fontWeight: 500, color: "text.secondary" }}>支付方式</TableCell>
              <TableCell sx={{ fontSize: "0.75rem", fontWeight: 500, color: "text.secondary", width: 80 }}>分类</TableCell>
              <TableCell sx={{ fontSize: "0.75rem", fontWeight: 500, color: "text.secondary" }} align="right">金额</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  <CircularProgress size={24} sx={{ mr: 1 }} />
                  加载中...
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>
                  暂无交易记录，请先在设置中导入邮件。
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TableRow
                  key={tx.id}
                  hover
                  sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                >
                  <TableCell sx={{ fontSize: "0.875rem", whiteSpace: "nowrap" }}>{tx.transaction_date}</TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                    {tx.transaction_time?.slice(0, 5) ?? "-"}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                    {getCardLastFour(tx.card_id)}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tx.merchant}
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", color: "text.secondary" }}>
                    {tx.payment_method ?? "-"}
                  </TableCell>
                  <TableCell>
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={tx.category ?? "其他"}
                        onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                      >
                        {CATEGORIES.map((cat) => (
                          <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </TableCell>
                  <TableCell sx={{ fontSize: "0.875rem", textAlign: "right", fontFamily: "monospace" }}>
                    -¥{tx.amount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {total > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary">
            共 {total} 条
          </Typography>
          <Pagination
            current={page}
            total={total}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
          />
        </Box>
      )}
    </Box>
  );
}
