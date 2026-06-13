import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { getCards, createCard, deleteCard } from "@/lib/api";
import type { Card as CardType } from "@/types";
import { Plus, Trash2, CreditCard } from "lucide-react";

const CARD_GRADIENTS = [
  "from-slate-800 to-slate-900",
  "from-indigo-800 to-indigo-950",
  "from-emerald-800 to-emerald-950",
  "from-amber-700 to-amber-900",
  "from-rose-800 to-rose-950",
  "from-sky-800 to-sky-950",
];

const CARD_COLORS = ["slate", "indigo", "emerald", "amber", "rose", "sky"];

export default function Cards() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLastFour, setNewLastFour] = useState("");
  const [newColor, setNewColor] = useState(0);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadCards(); }, []);

  async function loadCards() {
    setLoading(true);
    try { setCards(await getCards()); } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!newName.trim() || !newLastFour.trim()) return;
    try {
      await createCard(newName.trim(), newLastFour.trim(), CARD_COLORS[newColor]);
      setNewName(""); setNewLastFour(""); setNewColor(0); setShowDialog(false);
      loadCards();
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除此卡片及其所有交易记录？")) return;
    try { await deleteCard(id); loadCards(); } catch (e) { console.error(e); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">卡片管理</h2>
        <Button onClick={() => setShowDialog(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" />添加卡片
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">加载中...</div>
      ) : cards.length === 0 ? (
        <div className="bg-card border rounded-xl py-12 text-center">
          <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">还没有卡片</h3>
          <p className="text-sm text-muted-foreground mt-1">添加你的招商银行信用卡，开始追踪消费。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((card) => {
            const gradientIdx = CARD_COLORS.indexOf(card.color ?? "slate");
            const gradient = CARD_GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0];
            return (
              <div
                key={card.id}
                onClick={() => navigate(`/cards/${card.id}`)}
                className={`relative bg-gradient-to-br ${gradient} rounded-2xl p-5 cursor-pointer hover:scale-[1.02] transition-transform shadow-lg min-h-[180px] flex flex-col justify-between group`}
              >
                <div className="absolute top-3 right-3 text-white/15 text-4xl font-black select-none">
                  {card.bank.slice(0, 2)}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/10"
                >
                  <Trash2 className="h-4 w-4 text-white/70" />
                </button>
                <div className="flex justify-between items-start">
                  <span className="text-white/70 text-xs font-medium">{card.name}</span>
                  <span className="text-white/30 text-xs">{card.bank}</span>
                </div>
                <div className="mt-4">
                  <span className="text-white text-3xl font-mono tracking-widest">
                    **** {card.last_four}
                  </span>
                </div>
                <div className="flex justify-between items-end mt-4">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/10 text-white/60 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />Gmail
                  </span>
                  <span className="text-white/30 text-xs">{card.created_at.slice(0, 10)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加信用卡</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">卡片名称</label>
              <input className="flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-background" placeholder="例如: 招商银行信用卡" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">卡号后四位</label>
              <input className="flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-background" placeholder="例如: 3740" maxLength={4} value={newLastFour} onChange={(e) => setNewLastFour(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">卡片颜色</label>
              <div className="flex gap-2">
                {CARD_GRADIENTS.map((g, i) => (
                  <button key={i} onClick={() => setNewColor(i)}
                    className={`w-8 h-8 rounded-full bg-gradient-to-br ${g} border-2 ${newColor === i ? "border-primary" : "border-transparent"} transition-all`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild><Button variant="outline">取消</Button></DialogClose>
            <Button onClick={handleAdd} disabled={!newName.trim() || newLastFour.length !== 4}>添加</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
