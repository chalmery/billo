import { useEffect, useState } from "react";
import { ChipFilter } from "@/components/shared/ChipFilter";
import { Pagination } from "@/components/shared/Pagination";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCards, getEnrichedDailySummaries, getRawEmail } from "@/lib/api";
import type { Card as CardType } from "@/types";
import type { EnrichedDailySummary } from "@/lib/api";
import { Mail, Eye } from "lucide-react";

export default function Emails() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [selectedCards, setSelectedCards] = useState<string[]>(["all"]);
  const [summaries, setSummaries] = useState<EnrichedDailySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">邮件管理</h2>
        <ChipFilter options={chipOptions} selected={selectedCards} onChange={setSelectedCards} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">加载中...</div>
      ) : summaries.length === 0 ? (
        <div className="bg-card border rounded-xl py-12 text-center">
          <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">还没有邮件</h3>
          <p className="text-sm text-muted-foreground mt-1">通过 Gmail 同步或手动导入邮件后，这里会显示所有已拉取的邮件。</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted border-b">
                  <th className="text-left px-4 py-3 text-sm font-medium">邮件日期</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">卡片</th>
                  <th className="text-right px-4 py-3 text-sm font-medium">交易笔数</th>
                  <th className="text-right px-4 py-3 text-sm font-medium">消费金额</th>
                  <th className="text-left px-4 py-3 text-sm font-medium">同步时间</th>
                  <th className="text-center px-4 py-3 text-sm font-medium w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{s.email_date}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">尾号{s.card_last_four}</td>
                    <td className="px-4 py-3 text-sm text-right">{s.transaction_count} 笔</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-destructive">
                      -¥{s.total_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{s.fetched_at}</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => handleViewHtml(s)}>
                        <Eye className="h-4 w-4 mr-1" />查看原文
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">共 {total} 封</span>
            <Pagination
              current={page} total={total} pageSize={pageSize}
              onPageChange={(p) => setPage(p)}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        </>
      )}

      <Dialog open={selectedSummary !== null} onOpenChange={(open) => { if (!open) { setSelectedSummary(null); setRawHtml(null); } }}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>邮件原文 - {selectedSummary?.email_date}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto border rounded-md bg-muted/30">
            {htmlLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">加载中...</div>
            ) : rawHtml === null ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground">无法加载邮件内容</div>
            ) : (
              <pre className="p-4 text-xs whitespace-pre-wrap font-mono max-h-[60vh] overflow-auto">{rawHtml}</pre>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
