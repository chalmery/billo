import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCards, getAllDailySummaries, getRawEmail } from "@/lib/api";
import type { Card as CardType, DailySummary } from "@/types";
import { Mail, ChevronLeft, ChevronRight, Eye } from "lucide-react";

const PAGE_SIZE = 20;

export default function Emails() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rawHtml, setRawHtml] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<DailySummary | null>(null);

  useEffect(() => { loadData(); }, []);

  useEffect(() => { loadSummaries(); }, [page]);

  async function loadData() {
    try {
      setCards(await getCards());
    } catch (e) {
      console.error(e);
    }
  }

  async function loadSummaries() {
    setLoading(true);
    try {
      const result = await getAllDailySummaries(PAGE_SIZE, page * PAGE_SIZE);
      setSummaries(result.items);
      setTotal(result.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewHtml(summary: DailySummary) {
    setSelectedSummary(summary);
    setRawHtml(null);
    setHtmlLoading(true);
    try {
      const html = await getRawEmail(summary.id);
      setRawHtml(html);
    } catch (e) {
      console.error(e);
    } finally {
      setHtmlLoading(false);
    }
  }

  function getCardName(cardId: number): string {
    const card = cards.find((c) => c.id === cardId);
    return card ? `${card.name} (尾号${card.last_four})` : `卡片 #${cardId}`;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">邮件管理</h2>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          加载中...
        </div>
      ) : summaries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">还没有邮件</h3>
            <p className="text-sm text-muted-foreground mt-1">
              通过 Gmail 同步或手动导入邮件后，这里会显示所有已拉取的邮件。
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>邮件日期</TableHead>
                    <TableHead>所属卡片</TableHead>
                    <TableHead>可用额度</TableHead>
                    <TableHead>积分余额</TableHead>
                    <TableHead>拉取时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.email_date}</TableCell>
                      <TableCell>{getCardName(s.card_id)}</TableCell>
                      <TableCell>
                        {s.available_credit != null ? `¥${s.available_credit.toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>{s.points_balance ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{s.fetched_at}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewHtml(s)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          查看原文
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                共 {total} 封邮件，第 {page + 1}/{totalPages} 页
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={selectedSummary !== null} onOpenChange={(open) => { if (!open) { setSelectedSummary(null); setRawHtml(null); } }}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              邮件原文 - {selectedSummary?.email_date}
              {selectedSummary && <span className="text-sm font-normal text-muted-foreground ml-2">{getCardName(selectedSummary.card_id)}</span>}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-md bg-muted/30">
            {htmlLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                加载中...
              </div>
            ) : rawHtml === null ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">
                无法加载邮件内容
              </div>
            ) : (
              <pre className="p-4 text-xs whitespace-pre-wrap font-mono max-h-[60vh] overflow-auto">
                {rawHtml}
              </pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}