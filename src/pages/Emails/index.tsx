import { useEffect, useState } from "react";
import {
  Box, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  TableContainer, Paper, Button, Dialog, DialogTitle, DialogContent,
  CircularProgress, Card, CardContent,
} from "@mui/material";
import MailOutlined from "@mui/icons-material/MailOutlined";
import Visibility from "@mui/icons-material/Visibility";
import { ChipFilter } from "@/components/shared/ChipFilter";
import { Pagination } from "@/components/shared/Pagination";
import { getCards, getEnrichedDailySummaries, getRawEmail } from "@/lib/api";
import type { Card as CardType } from "@/types";
import type { EnrichedDailySummary } from "@/lib/api";

export default function Emails() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>(["all"]);
  const [summaries, setSummaries] = useState<EnrichedDailySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [rawHtml, setRawHtml] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<EnrichedDailySummary | null>(null);

  useEffect(() => { getCards().then(setCards).catch(console.error); }, []);
  useEffect(() => { loadSummaries(); }, [selectedCards, page, pageSize]);

  const cardId = selectedCards.includes("all") ? null : Number(selectedCards[0]);

  async function loadSummaries() {
    setLoading(true);
    try {
      const result = await getEnrichedDailySummaries(cardId, page, pageSize);
      setSummaries(result.items);
      setTotal(result.total);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleViewHtml(summary: EnrichedDailySummary) {
    setSelectedSummary(summary);
    setRawHtml(null);
    setHtmlLoading(true);
    try { setRawHtml(await getRawEmail(summary.id)); } catch (e) { console.error(e); } finally { setHtmlLoading(false); }
  }

  const chipOptions = [
    { key: "all", label: "全部" },
    ...cards.map((c) => ({ key: String(c.id), label: c.name, sublabel: c.last_four })),
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>邮件管理</Typography>
        <ChipFilter options={chipOptions} selected={selectedCards} onChange={setSelectedCards} />
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256 }}>
          <CircularProgress />
        </Box>
      ) : summaries.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <MailOutlined sx={{ fontSize: 48, color: "text.secondary", mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 500 }}>还没有邮件</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              通过 Gmail 同步或手动导入邮件后，这里会显示所有已拉取的邮件。
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <TableContainer component={Paper} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "action.hover" }}>
                  <TableCell>邮件日期</TableCell>
                  <TableCell>卡片</TableCell>
                  <TableCell align="right">交易笔数</TableCell>
                  <TableCell align="right">消费金额</TableCell>
                  <TableCell>同步时间</TableCell>
                  <TableCell align="center" sx={{ width: 80 }}>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summaries.map((s) => (
                  <TableRow
                    key={s.id}
                    sx={{ "&:hover": { backgroundColor: "action.hover" } }}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>{s.email_date}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>尾号{s.card_last_four}</TableCell>
                    <TableCell align="right">{s.transaction_count} 笔</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500, color: "error.main" }}>
                      -¥{s.total_amount.toFixed(2)}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{s.fetched_at}</TableCell>
                    <TableCell align="center">
                      <Button
                        variant="text"
                        size="small"
                        startIcon={<Visibility />}
                        onClick={() => handleViewHtml(s)}
                      >
                        查看
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">共 {total} 封</Typography>
            <Pagination
              current={page} total={total} pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </Box>
        </>
      )}

      <Dialog
        open={selectedSummary !== null}
        onClose={() => { setSelectedSummary(null); setRawHtml(null); }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>邮件原文 - {selectedSummary?.email_date}</DialogTitle>
        <DialogContent sx={{ maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
          <Box sx={{ flex: 1, overflow: "auto", borderRadius: 1, border: 1, borderColor: "divider", backgroundColor: "action.hover" }}>
            {htmlLoading ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
                <CircularProgress />
              </Box>
            ) : rawHtml === null ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160 }}>
                <Typography color="text.secondary">无法加载邮件内容</Typography>
              </Box>
            ) : (
              <Box
                component="pre"
                sx={{
                  p: 2,
                  fontSize: "0.75rem",
                  whiteSpace: "pre-wrap",
                  fontFamily: "monospace",
                  maxHeight: "60vh",
                  overflow: "auto",
                }}
              >
                {rawHtml}
              </Box>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
