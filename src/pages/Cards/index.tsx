import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Box,
  Typography,
  TextField,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import { getCards, createCard, deleteCard } from "@/lib/api";
import { bankAbbr } from "@/lib/bank";
import type { Card as CardType } from "@/types";

const CARD_GRADIENTS = [
  "linear-gradient(to bottom right, #1e293b, #0f172a)",
  "linear-gradient(to bottom right, #3730a3, #1e1b4b)",
  "linear-gradient(to bottom right, #065f46, #022c22)",
  "linear-gradient(to bottom right, #b45309, #78350f)",
  "linear-gradient(to bottom right, #9f1239, #4c0519)",
  "linear-gradient(to bottom right, #075985, #082f49)",
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: "-0.025em" }}>
          卡片管理
        </Typography>
        <Button variant="contained" size="small" onClick={() => setShowDialog(true)} startIcon={<AddIcon />}>
          添加卡片
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "text.secondary" }}>
          加载中...
        </Box>
      ) : cards.length === 0 ? (
        <Box sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2, py: 6, textAlign: "center" }}>
          <CreditCardIcon sx={{ mx: "auto", display: "block", fontSize: 48, color: "text.secondary", mb: 2 }} />
          <Typography variant="h6" sx={{ fontWeight: 500 }}>还没有卡片</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            添加你的招商银行信用卡，开始追踪消费。
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2 }}>
          {cards.map((card) => {
            const gradientIdx = CARD_COLORS.indexOf(card.color ?? "slate");
            const gradient = CARD_GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0];
            return (
              <Box
                key={card.id}
                onClick={() => navigate(`/cards/${card.id}`)}
                sx={{
                  position: "relative",
                  borderRadius: 2,
                  p: 2.5,
                  cursor: "pointer",
                  minHeight: 180,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: 3,
                  transition: "transform 0.2s",
                  "&:hover": { transform: "scale(1.02)" },
                }}
                style={{ background: gradient }}
              >
                <Typography
                  sx={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    color: "rgba(255,255,255,0.15)",
                    fontSize: "2.25rem",
                    fontWeight: 900,
                    userSelect: "none",
                  }}
                >
                  {bankAbbr(card.bank)}
                </Typography>
                <IconButton
                  onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                  size="small"
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    opacity: 0,
                    color: "rgba(255,255,255,0.7)",
                    transition: "opacity 0.2s",
                    ".group:hover &": { opacity: 1 },
                    "&:hover": { bgcolor: "rgba(255,255,255,0.1)" },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.75rem", fontWeight: 500 }}>
                    {card.name}
                  </Typography>
                  <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
                    {card.bank}
                  </Typography>
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ color: "#fff", fontSize: "1.875rem", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                    {card.last_four}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", mt: 2 }}>
                  <Box
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 0.75,
                      px: 1,
                      py: 0.25,
                      borderRadius: 10,
                      bgcolor: "rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.6)",
                      fontSize: "0.75rem",
                    }}
                  >
                    <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "success.main" }} />
                    Gmail
                  </Box>
                  <Typography sx={{ color: "rgba(255,255,255,0.3)", fontSize: "0.75rem" }}>
                    {card.created_at.slice(0, 10)}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加信用卡</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, py: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>卡片名称</Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="例如: 招商银行信用卡"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>卡号后四位</Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="例如: 3740"
                slotProps={{ htmlInput: { maxLength: 4 } }}
                value={newLastFour}
                onChange={(e) => setNewLastFour(e.target.value.replace(/\D/g, ""))}
              />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>卡片颜色</Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                {CARD_GRADIENTS.map((g, i) => (
                  <Box
                    key={i}
                    onClick={() => setNewColor(i)}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: 2,
                      borderColor: newColor === i ? "primary.main" : "transparent",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    style={{ background: g }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShowDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleAdd} disabled={!newName.trim() || newLastFour.length !== 4}>添加</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
