import { useEffect, useState } from "react";
import {
  Box, Typography, Button, TextField, Paper, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Card, CardContent,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopy from "@mui/icons-material/ContentCopy";
import {
  getParserProfiles, createParserProfile, updateParserProfile, deleteParserProfile,
} from "@/lib/api";
import type { ParserProfile } from "@/lib/api";

const EMPTY_FORM = {
  name: "", sender_pattern: "", subject_pattern: "",
  date_regex: "", time_regex: "", amount_regex: "",
  card_last_four_regex: "", merchant_regex: "",
};

export default function Templates() {
  const [profiles, setProfiles] = useState<ParserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ParserProfile | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try { setProfiles(await getParserProfiles()); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function openNew() {
    setEditingProfile(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  }

  function openEdit(p: ParserProfile) {
    setEditingProfile(p);
    setForm({
      name: p.name, sender_pattern: p.sender_pattern, subject_pattern: p.subject_pattern,
      date_regex: p.date_regex, time_regex: p.time_regex, amount_regex: p.amount_regex,
      card_last_four_regex: p.card_last_four_regex, merchant_regex: p.merchant_regex,
    });
    setShowDialog(true);
  }

  function duplicateProfile(p: ParserProfile) {
    setEditingProfile(null);
    setForm({
      name: p.name + " (副本)", sender_pattern: p.sender_pattern, subject_pattern: p.subject_pattern,
      date_regex: p.date_regex, time_regex: p.time_regex, amount_regex: p.amount_regex,
      card_last_four_regex: p.card_last_four_regex, merchant_regex: p.merchant_regex,
    });
    setShowDialog(true);
  }

  async function handleSave() {
    try {
      if (editingProfile) {
        await updateParserProfile({ ...editingProfile, ...form });
      } else {
        await createParserProfile({ is_builtin: false, ...form });
      }
      setShowDialog(false);
      loadData();
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除此模板？删除后无法恢复。")) return;
    try { await deleteParserProfile(id); loadData(); } catch (e) { console.error(e); }
  }

  const REGEX_FIELDS: { key: keyof typeof EMPTY_FORM; label: string; placeholder: string }[] = [
    { key: "sender_pattern", label: "发件人匹配", placeholder: "ccsvc@message.cmbchina.com" },
    { key: "subject_pattern", label: "主题匹配", placeholder: "每日信用管家" },
    { key: "date_regex", label: "日期正则", placeholder: "\\d{4}/\\d{2}/\\d{2}" },
    { key: "time_regex", label: "时间正则", placeholder: "\\d{2}:\\d{2}:\\d{2}" },
    { key: "amount_regex", label: "金额正则", placeholder: "(?:CNY|RMB)\\s*([\\d,]+\\.?\\d*)" },
    { key: "card_last_four_regex", label: "卡号后四位正则", placeholder: "尾号(\\d+)" },
    { key: "merchant_regex", label: "商户名正则", placeholder: "尾号\\d+\\s*(?:消费|支出)\\s*(.+)" },
  ];

  if (loading) {
    return <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "text.secondary" }}>加载中...</Box>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>邮件模板</Typography>
        <Button variant="contained" size="small" onClick={openNew} startIcon={<AddIcon />}>添加模板</Button>
      </Box>

      <Typography variant="body2" color="text.secondary">
        邮件模板定义了如何从不同格式的银行邮件中提取交易数据。内置模板不可编辑，自定义模板可以自由修改。
      </Typography>

      {profiles.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 6 }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>还没有自定义模板</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              点击上方按钮创建你的第一个邮件解析模板。
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {profiles.map((p) => (
            <Paper key={p.id} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                  {p.is_builtin && (
                    <Typography variant="caption" sx={{ px: 0.75, py: 0.25, borderRadius: 1, bgcolor: "primary.main", color: "primary.contrastText", fontWeight: 500 }}>
                      内置
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <IconButton size="small" onClick={() => duplicateProfile(p)} title="复制创建副本">
                    <ContentCopy fontSize="small" />
                  </IconButton>
                  {!p.is_builtin && (
                    <>
                      <IconButton size="small" onClick={() => openEdit(p)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDelete(p.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </>
                  )}
                </Box>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 0.75 }}>
                <InfoRow label="发件人" value={p.sender_pattern || "—"} />
                <InfoRow label="主题" value={p.subject_pattern || "—"} />
                <InfoRow label="日期" value={p.date_regex} mono />
                <InfoRow label="时间" value={p.time_regex} mono />
                <InfoRow label="金额" value={p.amount_regex} mono />
                <InfoRow label="卡号" value={p.card_last_four_regex} mono />
                <InfoRow label="商户" value={p.merchant_regex} mono fullWidth />
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      <Dialog open={showDialog} onClose={() => setShowDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingProfile ? "编辑模板" : "添加模板"}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, py: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>模板名称</Typography>
              <TextField size="small" fullWidth placeholder="例如: 招商银行信用卡" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Box>
            {REGEX_FIELDS.map(({ key, label, placeholder }) => (
              <Box key={key}>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>{label}</Typography>
                <TextField size="small" fullWidth placeholder={placeholder} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShowDialog(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name.trim()}>保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function InfoRow({ label, value, mono, fullWidth }: { label: string; value: string; mono?: boolean; fullWidth?: boolean }) {
  return (
    <Box sx={{ gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontFamily: mono ? "monospace" : "inherit", fontSize: "0.8rem", wordBreak: "break-all" }}>{value}</Typography>
    </Box>
  );
}