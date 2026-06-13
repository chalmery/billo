import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  getCards, parseEmailContent, importEmail, exportCsv, getSyncState,
  gmailSaveConfig, gmailGetConfig, gmailGetAuthUrl, gmailExchangeCode,
  gmailIsAuthenticated, gmailDisconnect, gmailSyncIncremental, gmailSyncFull,
} from "@/lib/api";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Card as CardType, SyncStatus } from "@/types";
import { Upload, Download, RefreshCw, CheckCircle2, AlertCircle, Link2, Unlink, Loader2, Save } from "lucide-react";

type StatusMsg = { type: "success" | "error"; text: string };

export default function Settings() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [syncInfo, setSyncInfo] = useState<SyncStatus | null>(null);
  const [importMsg, setImportMsg] = useState<StatusMsg | null>(null);
  const [gmailMsg, setGmailMsg] = useState<StatusMsg | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  // Gmail state
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingIncremental, setSyncingIncremental] = useState(false);
  const [syncingFull, setSyncingFull] = useState(false);
  const anyGmailLoading = savingConfig || authorizing || submittingCode || disconnecting || syncingIncremental || syncingFull;

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
    try {
      const [cardList, state, config, authenticated] = await Promise.all([
        getCards(), getSyncState(),
        gmailGetConfig().catch(() => ({ configured: false })),
        gmailIsAuthenticated().catch(() => false),
      ]);
      setCards(cardList); setSyncInfo(state); setGmailConnected(authenticated);
      if (cardList.length > 0 && !selectedCardId) setSelectedCardId(String(cardList[0].id));
      if ("client_id" in config && config.client_id) { setClientId(config.client_id as string); setHasExistingConfig(true); }
    } catch (e) { console.error(e); }
  }

  // === Gmail handlers ===
  async function handleSaveConfig() {
    if (!clientId.trim() || !clientSecret.trim()) { setGmailMsg({ type: "error", text: "请填写 Client ID 和 Client Secret" }); return; }
    setSavingConfig(true); setGmailMsg(null);
    try { await gmailSaveConfig(clientId.trim(), clientSecret.trim()); setHasExistingConfig(true); setGmailMsg({ type: "success", text: "Gmail 配置已保存" }); } catch (e) { setGmailMsg({ type: "error", text: `保存失败: ${String(e)}` }); } finally { setSavingConfig(false); }
  }

  async function handleAuthorize() {
    if (!clientId.trim() || (!clientSecret.trim() && !hasExistingConfig)) { setGmailMsg({ type: "error", text: "请先填写并保存 Gmail 配置" }); return; }
    setAuthorizing(true); setGmailMsg(null);
    try { await gmailSaveConfig(clientId.trim(), clientSecret.trim()); const url = await gmailGetAuthUrl(); await openUrl(url); setGmailMsg({ type: "success", text: "请在浏览器中完成授权，然后粘贴授权码" }); } catch (e) { setGmailMsg({ type: "error", text: `授权失败: ${String(e)}` }); } finally { setAuthorizing(false); }
  }

  async function handleSubmitCode() {
    if (!authCode.trim()) { setGmailMsg({ type: "error", text: "请输入授权码" }); return; }
    setSubmittingCode(true); setGmailMsg(null);
    try { const result = await gmailExchangeCode(authCode.trim()); if (result.success) { setGmailConnected(true); setAuthCode(""); setGmailMsg({ type: "success", text: "授权成功" }); } } catch (e) { setGmailMsg({ type: "error", text: `授权失败: ${String(e)}` }); } finally { setSubmittingCode(false); }
  }

  async function handleDisconnect() { setDisconnecting(true); try { await gmailDisconnect(); setGmailConnected(false); setGmailMsg({ type: "success", text: "已断开" }); } catch (e) { setGmailMsg({ type: "error", text: `断开失败: ${String(e)}` }); } finally { setDisconnecting(false); } }

  async function handleSyncIncremental() {
    if (!selectedCardId) return; setSyncingIncremental(true);
    try { const r = await gmailSyncIncremental(Number(selectedCardId)); setGmailMsg({ type: r.success ? "success" : "error", text: r.success ? `增量同步: +${r.new_summaries} 天, +${r.new_transactions} 笔` : r.errors.join("; ") }); loadData(); } catch (e) { setGmailMsg({ type: "error", text: `同步失败: ${String(e)}` }); } finally { setSyncingIncremental(false); }
  }

  async function handleSyncFull() {
    if (!selectedCardId) return; setSyncingFull(true);
    try { const r = await gmailSyncFull(Number(selectedCardId)); setGmailMsg({ type: r.success ? "success" : "error", text: r.success ? `全量同步: +${r.new_summaries} 天, +${r.new_transactions} 笔` : r.errors.join("; ") }); loadData(); } catch (e) { setGmailMsg({ type: "error", text: `同步失败: ${String(e)}` }); } finally { setSyncingFull(false); }
  }

  // === Manual import/export ===
  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportMsg(null);
    try { const html = await file.text(); const parsed = await parseEmailContent(html); const mc = cards.find((c) => c.last_four === parsed.card_last_four); if (!mc) { setImportMsg({ type: "error", text: `未找到尾号 ${parsed.card_last_four} 的卡片` }); return; } const result = await importEmail(mc.id, html, `file-${Date.now()}`); setImportMsg({ type: "success", text: result }); loadData(); } catch (err: unknown) { setImportMsg({ type: "error", text: String(err) }); } finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function handleExport() { setExporting(true); try { await exportCsv("~/billo-export.csv"); setImportMsg({ type: "success", text: "已导出到 ~/billo-export.csv" }); } catch (e) { setImportMsg({ type: "error", text: `导出失败: ${String(e)}` }); } finally { setExporting(false); } }

  return (
    <div className="space-y-6 pb-12 max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">设置</h2>

      {/* 1. 外观 */}
      <Section title="外观">
        <div className="text-sm text-muted-foreground">主题切换和语言设置将在后续版本中实现。</div>
      </Section>

      {/* 2. 同步设置 */}
      <Section title="同步设置">
        <div className="flex items-center gap-3 mb-4">
          {gmailConnected ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-yellow-500" />}
          <div><p className="text-sm font-medium">{gmailConnected ? "Gmail 已授权" : "Gmail 尚未授权"}</p>
            {syncInfo?.last_sync_at && <p className="text-xs text-muted-foreground">上次同步: {syncInfo.last_sync_at}</p>}
          </div>
        </div>

        <div className="space-y-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">前往 <span className="text-primary underline cursor-pointer" onClick={() => openUrl('https://console.cloud.google.com/apis/credentials')}>Google Cloud Console</span> 创建 OAuth2 Web 应用凭据，重定向 URI 为 http://127.0.0.1:8401/callback</p>
          <div className="space-y-2">
            <input className="flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-background" placeholder="Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={anyGmailLoading} />
            <input className="flex h-10 w-full rounded-md border px-3 py-2 text-sm bg-background" type="password" placeholder={hasExistingConfig ? "Client Secret (留空保持不变)" : "Client Secret"} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} disabled={anyGmailLoading} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig || anyGmailLoading}>{savingConfig ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}保存</Button>
            {!gmailConnected && <Button size="sm" variant="outline" onClick={handleAuthorize} disabled={!clientId || (!clientSecret && !hasExistingConfig) || anyGmailLoading}>{authorizing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}授权</Button>}
            {gmailConnected && <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={disconnecting}><Unlink className="h-4 w-4 mr-1" />断开</Button>}
          </div>
        </div>

        {!gmailConnected && clientId.trim() && (clientSecret.trim() || hasExistingConfig) && (
          <div className="border-t pt-4 space-y-3 mt-4">
            <p className="text-sm font-medium">输入授权码</p>
            <div className="flex gap-2">
              <input className="flex h-10 flex-1 rounded-md border px-3 py-2 text-sm bg-background" placeholder="粘贴 code 参数值" value={authCode} onChange={(e) => setAuthCode(e.target.value)} />
              <Button size="sm" onClick={handleSubmitCode} disabled={submittingCode}>{submittingCode ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}完成</Button>
            </div>
          </div>
        )}

        {gmailConnected && cards.length > 0 && (
          <div className="border-t pt-4 space-y-3 mt-4">
            <div className="flex gap-2">
              <select className="flex h-10 rounded-md border px-3 py-2 text-sm bg-background" value={selectedCardId} onChange={(e) => setSelectedCardId(e.target.value)}>
                {cards.map((c) => <option key={c.id} value={c.id}>{c.name} (尾号{c.last_four})</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={handleSyncIncremental} disabled={syncingIncremental}><RefreshCw className={`h-4 w-4 mr-1 ${syncingIncremental ? "animate-spin" : ""}`} />增量同步</Button>
              <Button size="sm" onClick={handleSyncFull} disabled={syncingFull}><RefreshCw className={`h-4 w-4 mr-1 ${syncingFull ? "animate-spin" : ""}`} />全量同步</Button>
            </div>
          </div>
        )}

        {gmailMsg && <MsgBox msg={gmailMsg} />}
      </Section>

      {/* 3. 热力图档位 */}
      <Section title="热力图档位">
        <div className="grid grid-cols-5 gap-2 mb-3">
          {thresholds.map((t, i) => (
            <div key={i}>
              <label className="text-xs text-muted-foreground">档位 {i + 1}</label>
              <input type="number" className="flex h-9 w-full rounded-md border px-2 py-1 text-sm bg-background [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value={t}
                onChange={(e) => { const next = [...thresholds]; next[i] = Number(e.target.value) || 0; setThresholds(next); heatmapSaved(); }} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>0</span>
          <div className="h-3 w-3 rounded-[2px] bg-[#ebedf0]" />
          <div className="h-3 w-3 rounded-[2px] bg-[#9be9a8]" />
          <div className="h-3 w-3 rounded-[2px] bg-[#40c463]" />
          <div className="h-3 w-3 rounded-[2px] bg-[#30a14e]" />
          <div className="h-3 w-3 rounded-[2px] bg-[#216e39]" />
          <span>{thresholds[3]}+</span>
        </div>
      </Section>

      {/* 4. 邮件模板管理 */}
      <Section title="邮件模板管理">
        <div className="text-sm text-muted-foreground">
          邮件模板管理功能将在后续版本中实现，支持添加自定义解析模板和编辑正则规则。
        </div>
      </Section>

      {/* 5. 数据导出 */}
      <Section title="数据导出">
        <p className="text-sm text-muted-foreground mb-4">导出所有交易数据为 CSV 文件，保存在用户主目录下。</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}><Upload className="h-4 w-4 mr-1" />{importing ? "导入中..." : "手动导入"}</Button>
          <input ref={fileInputRef} type="file" accept=".html,.htm,.eml" className="hidden" onChange={handleFileImport} />
          <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>{exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}导出 CSV</Button>
        </div>
        {importMsg && <div className="mt-4"><MsgBox msg={importMsg} /></div>}
      </Section>

      {/* 6. 关于 */}
      <Section title="关于">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>Billo v0.1.0</p>
          <p>Tauri v2 · React 19 · TypeScript · Tailwind v4 · Recharts · SQLite</p>
          <p>所有数据存储在本地，不上传至任何服务器。</p>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl p-5">
      <h3 className="text-sm font-medium mb-4">{title}</h3>
      {children}
    </div>
  );
}

function MsgBox({ msg }: { msg: StatusMsg }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${msg.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
      {msg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      {msg.text}
    </div>
  );
}
