import { useEffect, useState, useRef } from "react";
import {
  Box, Typography, Button, TextField, Card, CardContent, Alert, CircularProgress,
} from "@mui/material";
import Upload from "@mui/icons-material/Upload";
import Download from "@mui/icons-material/Download";
import { getCards, parseEmailContent, importEmail, exportCsv } from "@/lib/api";
import type { Card as CardType } from "@/types";

type StatusMsg = { type: "success" | "error"; text: string };

export default function Settings() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [importMsg, setImportMsg] = useState<StatusMsg | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Heatmap thresholds
  const [thresholds, setThresholds] = useState([10, 30, 50, 200]);
  const heatmapSaved = () => localStorage.setItem("billo-heatmap-thresholds", JSON.stringify(thresholds));

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    const saved = localStorage.getItem("billo-heatmap-thresholds");
    if (saved) try { setThresholds(JSON.parse(saved)); } catch {}
  }, []);

  async function loadData() {
    try { setCards(await getCards()); } catch (e) { console.error(e); }
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportMsg(null);
    try {
      const html = await file.text();
      const parsed = await parseEmailContent(html);
      const mc = cards.find((c) => c.last_four === parsed.card_last_four);
      if (!mc) { setImportMsg({ type: "error", text: `未找到尾号 ${parsed.card_last_four} 的卡片` }); return; }
      const result = await importEmail(mc.id, html, `file-${Date.now()}`);
      setImportMsg({ type: "success", text: result }); loadData();
    } catch (err: unknown) { setImportMsg({ type: "error", text: String(err) }); }
    finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function handleExport() {
    setExporting(true);
    try { await exportCsv("~/billo-export.csv"); setImportMsg({ type: "success", text: "已导出到 ~/billo-export.csv" }); }
    catch (e) { setImportMsg({ type: "error", text: `导出失败: ${String(e)}` }); }
    finally { setExporting(false); }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 6, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>设置</Typography>

      {/* 1. 外观 */}
      <Section title="外观">
        <Typography variant="body2" color="text.secondary">主题切换和语言设置将在后续版本中实现。</Typography>
      </Section>

      {/* 2. 热力图档位 */}
      <Section title="热力图档位">
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, mb: 1.5 }}>
          {thresholds.map((t, i) => (
            <Box key={i}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>档位 {i + 1}</Typography>
              <TextField type="number" size="small" fullWidth value={t}
                onChange={(e) => { const next = [...thresholds]; next[i] = Number(e.target.value) || 0; setThresholds(next); heatmapSaved(); }} />
            </Box>
          ))}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary">0</Typography>
          <Box sx={{ width: 12, height: 12, borderRadius: "2px", bgcolor: "#ebedf0" }} />
          <Box sx={{ width: 12, height: 12, borderRadius: "2px", bgcolor: "#9be9a8" }} />
          <Box sx={{ width: 12, height: 12, borderRadius: "2px", bgcolor: "#40c463" }} />
          <Box sx={{ width: 12, height: 12, borderRadius: "2px", bgcolor: "#30a14e" }} />
          <Box sx={{ width: 12, height: 12, borderRadius: "2px", bgcolor: "#216e39" }} />
          <Typography variant="caption" color="text.secondary">{thresholds[3]}+</Typography>
        </Box>
      </Section>

      {/* 3. 数据导出 */}
      <Section title="数据导出">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>导出所有交易数据为 CSV 文件，保存在用户主目录下。</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button size="small" onClick={() => fileInputRef.current?.click()} disabled={importing} startIcon={<Upload fontSize="small" />}>{importing ? "导入中..." : "手动导入"}</Button>
          <input ref={fileInputRef} type="file" accept=".html,.htm,.eml" style={{ display: "none" }} onChange={handleFileImport} />
          <Button size="small" variant="outlined" onClick={handleExport} disabled={exporting} startIcon={exporting ? <CircularProgress size={16} /> : <Download fontSize="small" />}>导出 CSV</Button>
        </Box>
        {importMsg && <Box sx={{ mt: 2 }}><MsgBox msg={importMsg} /></Box>}
      </Section>

      {/* 4. 关于 */}
      <Section title="关于">
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">Billo v0.1.0</Typography>
          <Typography variant="body2" color="text.secondary">Tauri v2 · React 19 · TypeScript · MUI · Recharts · SQLite</Typography>
          <Typography variant="body2" color="text.secondary">所有数据存储在本地，不上传至任何服务器。</Typography>
        </Box>
      </Section>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>{title}</Typography>
        {children}
      </CardContent>
    </Card>
  );
}

function MsgBox({ msg }: { msg: StatusMsg }) {
  return (
    <Alert severity={msg.type}>{msg.text}</Alert>
  );
}