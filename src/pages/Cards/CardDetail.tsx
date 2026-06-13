import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, TextField, Select, MenuItem, FormControl,
  Divider, Alert, Card, CardContent, CircularProgress, Chip, IconButton,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Button,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import Link from "@mui/icons-material/Link";
import LinkOff from "@mui/icons-material/LinkOff";
import Refresh from "@mui/icons-material/Refresh";
import CheckCircle from "@mui/icons-material/CheckCircle";
import ErrorOutline from "@mui/icons-material/ErrorOutlineOutlined";
import Save from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  getCardDetail, deleteCard, updateCard,
  gmailSaveConfig, gmailGetConfig, gmailGetAuthUrl, gmailExchangeCode,
  gmailIsAuthenticated, gmailDisconnect, gmailSyncIncremental, gmailSyncFull,
  getSyncState, getParserProfiles,
} from "@/lib/api";
import type { CardDetail as CardDetailType, ParserProfile } from "@/lib/api";

type StatusMsg = { type: "success" | "error"; text: string };

const CARD_GRADIENTS = [
  "linear-gradient(to bottom right, #1e293b, #0f172a)",
  "linear-gradient(to bottom right, #3730a3, #1e1b4b)",
  "linear-gradient(to bottom right, #065f46, #022c22)",
  "linear-gradient(to bottom right, #b45309, #78350f)",
  "linear-gradient(to bottom right, #9f1239, #4c0519)",
  "linear-gradient(to bottom right, #075985, #082f49)",
];
const CARD_COLORS = ["slate", "indigo", "emerald", "amber", "rose", "sky"];

export default function CardDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<CardDetailType | null>(null);
  const [loading, setLoading] = useState(true);

  // Inline editing state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLastFour, setEditLastFour] = useState("");
  const [editBank, setEditBank] = useState("");
  const [editColor, setEditColor] = useState("slate");
  const [editParserProfile, setEditParserProfile] = useState("cmb");
  const [editSyncMethod, setEditSyncMethod] = useState("gmail");

  // Gmail sync state
  const [gmailMsg, setGmailMsg] = useState<StatusMsg | null>(null);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingIncremental, setSyncingIncremental] = useState(false);
  const [syncingFull, setSyncingFull] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ last_sync_at: string | null } | null>(null);
  const anyGmailLoading = savingConfig || authorizing || submittingCode || disconnecting || syncingIncremental || syncingFull;

  // Email sync placeholder state
  const [emailHost, setEmailHost] = useState("");
  const [emailPort, setEmailPort] = useState("");
  const [emailUser, setEmailUser] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  // Parser profiles for binding
  const [profiles, setProfiles] = useState<ParserProfile[]>([]);

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [cardDetail, state, config, authenticated, profileList] = await Promise.all([
        getCardDetail(Number(id)),
        getSyncState().catch(() => null),
        gmailGetConfig().catch(() => ({ configured: false })),
        gmailIsAuthenticated().catch(() => false),
        getParserProfiles().catch(() => []),
      ]);
      setDetail(cardDetail);
      setSyncInfo(state);
      setGmailConnected(authenticated);
      setProfiles(profileList);
      if (cardDetail) {
        setEditName(cardDetail.card.name);
        setEditLastFour(cardDetail.card.last_four);
        setEditBank(cardDetail.card.bank);
        setEditColor(cardDetail.card.color ?? "slate");
        setEditParserProfile(cardDetail.card.parser_profile ?? "cmb");
        setEditSyncMethod(cardDetail.card.sync_method ?? "gmail");
      }
      if ("client_id" in config && config.client_id) {
        setClientId(config.client_id as string);
        setHasExistingConfig(true);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  function startEdit() {
    if (!detail) return;
    setEditName(detail.card.name);
    setEditLastFour(detail.card.last_four);
    setEditBank(detail.card.bank);
    setEditColor(detail.card.color ?? "slate");
    setEditParserProfile(detail.card.parser_profile ?? "cmb");
    setEditSyncMethod(detail.card.sync_method ?? "gmail");
    setEditing(true);
  }

  async function saveEdit() {
    if (!id) return;
    try {
      await updateCard({
        id: Number(id),
        name: editName,
        last_four: editLastFour,
        bank: editBank,
        parser_profile: editParserProfile,
        color: editColor,
        sync_method: editSyncMethod,
      });
      setEditing(false);
      loadData();
    } catch (e) { console.error(e); }
  }

  function cancelEdit() {
    setEditing(false);
    if (detail) {
      setEditName(detail.card.name);
      setEditLastFour(detail.card.last_four);
      setEditBank(detail.card.bank);
      setEditColor(detail.card.color ?? "slate");
      setEditParserProfile(detail.card.parser_profile ?? "cmb");
      setEditSyncMethod(detail.card.sync_method ?? "gmail");
    }
  }

  async function handleDelete() {
    if (!id || !confirm("确定删除此卡片及其所有交易记录？")) return;
    try { await deleteCard(Number(id)); navigate("/cards"); } catch (e) { console.error(e); }
  }

  // === Gmail handlers ===
  async function handleSaveConfig() {
    if (!clientId.trim() || !clientSecret.trim()) { setGmailMsg({ type: "error", text: "请填写 Client ID 和 Client Secret" }); return; }
    setSavingConfig(true); setGmailMsg(null);
    try { await gmailSaveConfig(clientId.trim(), clientSecret.trim()); setHasExistingConfig(true); setGmailMsg({ type: "success", text: "Gmail 配置已保存" }); }
    catch (e) { setGmailMsg({ type: "error", text: `保存失败: ${String(e)}` }); }
    finally { setSavingConfig(false); }
  }

  async function handleAuthorize() {
    if (!clientId.trim() || (!clientSecret.trim() && !hasExistingConfig)) { setGmailMsg({ type: "error", text: "请先填写并保存 Gmail 配置" }); return; }
    setAuthorizing(true); setGmailMsg(null);
    try { await gmailSaveConfig(clientId.trim(), clientSecret.trim()); const url = await gmailGetAuthUrl(); await openUrl(url); setGmailMsg({ type: "success", text: "请在浏览器中完成授权，然后粘贴授权码" }); }
    catch (e) { setGmailMsg({ type: "error", text: `授权失败: ${String(e)}` }); }
    finally { setAuthorizing(false); }
  }

  async function handleSubmitCode() {
    if (!authCode.trim()) { setGmailMsg({ type: "error", text: "请输入授权码" }); return; }
    setSubmittingCode(true); setGmailMsg(null);
    try { const result = await gmailExchangeCode(authCode.trim()); if (result.success) { setGmailConnected(true); setAuthCode(""); setGmailMsg({ type: "success", text: "授权成功" }); } }
    catch (e) { setGmailMsg({ type: "error", text: `授权失败: ${String(e)}` }); }
    finally { setSubmittingCode(false); }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try { await gmailDisconnect(); setGmailConnected(false); setGmailMsg({ type: "success", text: "已断开" }); }
    catch (e) { setGmailMsg({ type: "error", text: `断开失败: ${String(e)}` }); }
    finally { setDisconnecting(false); }
  }

  async function handleSyncIncremental() {
    if (!id) return; setSyncingIncremental(true);
    try { const r = await gmailSyncIncremental(Number(id)); setGmailMsg({ type: r.success ? "success" : "error", text: r.success ? `增量同步: +${r.new_summaries} 天, +${r.new_transactions} 笔` : r.errors.join("; ") }); loadData(); }
    catch (e) { setGmailMsg({ type: "error", text: `同步失败: ${String(e)}` }); }
    finally { setSyncingIncremental(false); }
  }

  async function handleSyncFull() {
    if (!id) return; setSyncingFull(true);
    try { const r = await gmailSyncFull(Number(id)); setGmailMsg({ type: r.success ? "success" : "error", text: r.success ? `全量同步: +${r.new_summaries} 天, +${r.new_transactions} 笔` : r.errors.join("; ") }); loadData(); }
    catch (e) { setGmailMsg({ type: "error", text: `同步失败: ${String(e)}` }); }
    finally { setSyncingFull(false); }
  }

  if (loading) return <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "text.secondary" }}>加载中...</Box>;
  if (!detail) return <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 256, color: "text.secondary" }}>卡片不存在</Box>;

  const card = detail.card;
  const gradientIdx = CARD_COLORS.indexOf(card.color ?? "slate");
  const gradient = CARD_GRADIENTS[gradientIdx >= 0 ? gradientIdx : 0];
  const currentProfileDisplay = profiles.find(p => p.name === card.parser_profile)?.name ?? card.parser_profile ?? "招商银行每日信用管家";
  const syncMethod = card.sync_method ?? "gmail";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pb: 6, maxWidth: 900 }}>
      <Button variant="text" size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate("/cards")} sx={{ justifyContent: "flex-start", px: 0, color: "text.secondary", "&:hover": { color: "text.primary" } }}>
        返回卡片列表
      </Button>

      {/* Card Preview Card */}
      <Box sx={{ borderRadius: 2, p: 3, minHeight: 180, display: "flex", flexDirection: "column", justifyContent: "space-between", boxShadow: 3, overflow: "hidden", position: "relative" }} style={{ background: gradient }}>
        <Typography sx={{ position: "absolute", top: 12, right: 12, color: "rgba(255,255,255,0.15)", fontSize: "3rem", fontWeight: 900 }}>
          {card.bank.slice(0, 2)}
        </Typography>
        <Box>
          <Typography sx={{ color: "rgba(255,255,255,0.7)", fontSize: "0.875rem", fontWeight: 500 }}>{card.name}</Typography>
          <Typography sx={{ color: "#fff", fontSize: "2.25rem", fontFamily: "monospace", letterSpacing: "0.1em", mt: 2 }}>**** {card.last_four}</Typography>
        </Box>
        <Typography sx={{ color: "rgba(255,255,255,0.5)", fontSize: "0.75rem" }}>{card.bank}</Typography>
      </Box>

      {/* Info + Editing Section */}
      <Section title="卡片信息" action={!editing ? <IconButton size="small" onClick={startEdit}><EditIcon fontSize="small" /></IconButton> : null}>
        {editing ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>卡片名称</Typography>
                <TextField size="small" fullWidth value={editName} onChange={(e) => setEditName(e.target.value)} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>卡号后四位</Typography>
                <TextField size="small" fullWidth slotProps={{ htmlInput: { maxLength: 4 } }} value={editLastFour} onChange={(e) => setEditLastFour(e.target.value.replace(/\D/g, ""))} />
              </Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>银行</Typography>
                <TextField size="small" fullWidth value={editBank} onChange={(e) => setEditBank(e.target.value)} />
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>邮件模板</Typography>
                <FormControl size="small" fullWidth>
                  <Select value={editParserProfile} onChange={(e) => setEditParserProfile(e.target.value)}>
                    {profiles.map((p) => (
                      <MenuItem key={p.name} value={p.name}>{p.name}{p.is_builtin ? " (内置)" : ""}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>同步方式</Typography>
                <FormControl size="small" fullWidth>
                  <Select value={editSyncMethod} onChange={(e) => setEditSyncMethod(e.target.value)}>
                    <MenuItem value="gmail">Gmail</MenuItem>
                    <MenuItem value="email">邮箱 (IMAP)</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>卡片颜色</Typography>
                <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                  {CARD_GRADIENTS.map((g, i) => (
                    <Box key={i} onClick={() => setEditColor(CARD_COLORS[i])} sx={{ width: 28, height: 28, borderRadius: "50%", border: 2, borderColor: editColor === CARD_COLORS[i] ? "primary.main" : "transparent", cursor: "pointer", transition: "all 0.2s" }} style={{ background: g }} />
                  ))}
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button size="small" variant="outlined" onClick={cancelEdit} startIcon={<CloseIcon fontSize="small" />}>取消</Button>
              <Button size="small" variant="contained" onClick={saveEdit} disabled={!editName.trim() || editLastFour.length !== 4} startIcon={<CheckIcon fontSize="small" />}>保存</Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <InfoItem label="卡片名称" value={card.name} />
            <InfoItem label="卡号后四位" value={card.last_four} />
            <InfoItem label="银行" value={card.bank} />
            <InfoItem label="邮件模板" value={<Chip label={currentProfileDisplay} size="small" variant="outlined" />} />
            <InfoItem label="同步方式" value={<Chip label={syncMethod === "email" ? "邮箱 (IMAP)" : "Gmail"} size="small" color={syncMethod === "gmail" ? "success" : "default"} />} />
            <InfoItem label="邮件数" value={String(detail.email_count)} />
            <InfoItem label="交易数" value={String(detail.transaction_count)} />
          </Box>
        )}
      </Section>

      {/* Sync Config Section - conditionally rendered based on sync method */}
      {syncMethod === "gmail" ? (
        <Section title="Gmail 同步配置">
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            {gmailConnected ? <CheckCircle color="success" sx={{ fontSize: 20 }} /> : <ErrorOutline color="warning" sx={{ fontSize: 20 }} />}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{gmailConnected ? "Gmail 已授权" : "Gmail 尚未授权"}</Typography>
              {syncInfo?.last_sync_at && <Typography variant="caption" color="text.secondary">上次同步: {syncInfo.last_sync_at}</Typography>}
            </Box>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              前往 <Typography component="span" color="primary" sx={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => openUrl('https://console.cloud.google.com/apis/credentials')}>Google Cloud Console</Typography> 创建 OAuth2 Web 应用凭据，重定向 URI 为 http://127.0.0.1:8401/callback
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <TextField size="small" fullWidth label="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={anyGmailLoading} />
              <TextField size="small" fullWidth type="password" label={hasExistingConfig ? "Client Secret (留空保持不变)" : "Client Secret"} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} disabled={anyGmailLoading} />
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button size="small" onClick={handleSaveConfig} disabled={savingConfig || anyGmailLoading} startIcon={savingConfig ? <CircularProgress size={16} /> : <Save fontSize="small" />}>保存</Button>
              {!gmailConnected && <Button size="small" variant="outlined" onClick={handleAuthorize} disabled={!clientId || (!clientSecret && !hasExistingConfig) || anyGmailLoading} startIcon={authorizing ? <CircularProgress size={16} /> : <Link fontSize="small" />}>授权</Button>}
              {gmailConnected && <Button size="small" variant="outlined" onClick={handleDisconnect} disabled={disconnecting} startIcon={<LinkOff fontSize="small" />}>断开</Button>}
            </Box>
          </Box>
          {!gmailConnected && clientId.trim() && (clientSecret.trim() || hasExistingConfig) && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>输入授权码</Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField size="small" fullWidth placeholder="粘贴 code 参数值" value={authCode} onChange={(e) => setAuthCode(e.target.value)} />
                  <Button size="small" onClick={handleSubmitCode} disabled={submittingCode} startIcon={submittingCode ? <CircularProgress size={16} /> : undefined}>完成</Button>
                </Box>
              </Box>
            </>
          )}
          {gmailConnected && (
            <>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button size="small" variant="outlined" onClick={handleSyncIncremental} disabled={syncingIncremental} startIcon={syncingIncremental ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}>增量同步</Button>
                <Button size="small" variant="outlined" onClick={handleSyncFull} disabled={syncingFull} startIcon={syncingFull ? <CircularProgress size={16} /> : <Refresh fontSize="small" />}>全量同步</Button>
              </Box>
            </>
          )}
          {gmailMsg && <Box sx={{ mt: 2 }}><Alert severity={gmailMsg.type}>{gmailMsg.text}</Alert></Box>}
        </Section>
      ) : (
        <Section title="邮箱同步配置 (IMAP)">
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            通过 IMAP 协议直接连接邮箱拉取账单邮件，功能开发中。
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 2 }}>
              <TextField size="small" fullWidth label="IMAP 服务器" placeholder="例如: imap.qq.com" value={emailHost} onChange={(e) => setEmailHost(e.target.value)} disabled />
              <TextField size="small" fullWidth label="端口" placeholder="993" value={emailPort} onChange={(e) => setEmailPort(e.target.value)} disabled />
            </Box>
            <TextField size="small" fullWidth label="邮箱账号" placeholder="your@email.com" value={emailUser} onChange={(e) => setEmailUser(e.target.value)} disabled />
            <TextField size="small" fullWidth type="password" label="授权码 / 密码" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} disabled />
            <Button size="small" variant="outlined" disabled>连接测试 (开发中)</Button>
          </Box>
        </Section>
      )}

      {/* Sync Logs */}
      <Section title="同步日志">
        {detail.sync_logs.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 4, color: "text.secondary", fontSize: "0.875rem" }}>暂无同步记录</Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>状态</TableCell>
                  <TableCell>时间</TableCell>
                  <TableCell>邮件</TableCell>
                  <TableCell>交易</TableCell>
                  <TableCell>消息</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {detail.sync_logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell><Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: log.status === "success" ? "success.main" : log.status === "error" ? "error.main" : "warning.main" }} /></TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{log.created_at}</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{log.new_emails} 封</TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{log.new_transactions} 笔</TableCell>
                    <TableCell sx={{ color: "text.secondary", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Section>

      {/* Danger Zone */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
        <Button size="small" variant="outlined" color="error" onClick={handleDelete} startIcon={<DeleteIcon fontSize="small" />}>删除卡片</Button>
      </Box>
    </Box>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}