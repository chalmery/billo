import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCardDetail, deleteCard, updateCard } from "@/lib/api";
import type { CardDetail as CardDetailType } from "@/lib/api";
import { ArrowLeft, Trash2, Edit3 } from "lucide-react";

const CARD_GRADIENTS = [
  "from-slate-800 to-slate-900",
  "from-indigo-800 to-indigo-950",
  "from-emerald-800 to-emerald-950",
  "from-amber-700 to-amber-900",
  "from-rose-800 to-rose-950",
  "from-sky-800 to-sky-950",
];

const CARD_COLORS = ["slate", "indigo", "emerald", "amber", "rose", "sky"];

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CardDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLastFour, setEditLastFour] = useState("");
  const [editBank, setEditBank] = useState("");
  const [editColor, setEditColor] = useState("slate");

  useEffect(() => {
    if (id) loadDetail(Number(id));
  }, [id]);

  async function loadDetail(cardId: number) {
    setLoading(true);
    try { setDetail(await getCardDetail(cardId)); } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleDelete() {
    if (!id || !confirm("确定删除此卡片及其所有交易记录？")) return;
    try { await deleteCard(Number(id)); navigate("/cards"); } catch (e) { console.error(e); }
  }

  function openEdit() {
    if (!detail) return;
    setEditName(detail.card.name);
    setEditLastFour(detail.card.last_four);
    setEditBank(detail.card.bank);
    setEditColor(detail.card.color ?? "slate");
    setShowEdit(true);
  }

  async function handleSaveEdit() {
    if (!id || !detail) return;
    try {
      await updateCard({
        id: Number(id),
        name: editName,
        last_four: editLastFour,
        bank: editBank,
        parser_profile: detail.card.parser_profile ?? "cmb",
        color: editColor,
      });
      setShowEdit(false);
      loadDetail(Number(id));
    } catch (e) { console.error(e); }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">加载中...</div>;
  if (!detail) return <div className="flex items-center justify-center h-64 text-muted-foreground">卡片不存在</div>;

  const card = detail.card;
  const gradientIdx = CARD_COLORS.indexOf(card.color ?? "slate");
  const gradient = CARD_GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0];

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/cards")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />返回卡片列表
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Card preview + info */}
        <div className="lg:col-span-1 space-y-4">
          <div className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 min-h-[200px] flex flex-col justify-between shadow-lg`}>
            <div className="absolute top-3 right-3 text-white/15 text-5xl font-black">{card.bank.slice(0, 2)}</div>
            <div>
              <div className="text-white/70 text-sm font-medium">{card.name}</div>
              <div className="text-white text-4xl font-mono tracking-widest mt-4">**** {card.last_four}</div>
            </div>
            <div>
              <div className="text-white/50 text-xs">{card.bank}</div>
            </div>
          </div>

          <div className="bg-card border rounded-xl p-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">邮件模板</span><span>{card.parser_profile ?? "招商银行"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">同步方式</span><span>{card.sync_method ?? "Gmail"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">邮件数</span><span>{detail.email_count}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">交易数</span><span>{detail.transaction_count}</span></div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openEdit}><Edit3 className="h-4 w-4 mr-1" />编辑</Button>
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive"><Trash2 className="h-4 w-4 mr-1" />删除</Button>
          </div>
        </div>

        {/* Right: Sync logs */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-5">
          <h3 className="text-sm font-medium mb-4">同步日志</h3>
          {detail.sync_logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">暂无同步记录</div>
          ) : (
            <div className="space-y-2">
              {detail.sync_logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${log.status === "success" ? "bg-green-500" : log.status === "error" ? "bg-red-500" : "bg-yellow-500"}`} />
                    <span className="text-muted-foreground">{log.created_at}</span>
                  </div>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{log.new_emails} 封邮件</span>
                    <span>{log.new_transactions} 笔交易</span>
                  </div>
                  {log.message && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{log.message}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑卡片</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">卡片名称</label>
              <input className="flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-background" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">卡号后四位</label>
              <input className="flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-background" maxLength={4} value={editLastFour} onChange={(e) => setEditLastFour(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">银行</label>
              <input className="flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-background" value={editBank} onChange={(e) => setEditBank(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">卡片颜色</label>
              <div className="flex gap-2">
                {CARD_GRADIENTS.map((g, i) => (
                  <button key={i} onClick={() => setEditColor(CARD_COLORS[i])}
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} border-2 ${editColor === CARD_COLORS[i] ? "border-primary" : "border-transparent"} transition-all`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowEdit(false)}>取消</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || editLastFour.length !== 4}>保存</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
