import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [importing, setImporting] = useState(false);
  const [gmailMsg, setGmailMsg] = useState<StatusMsg | null>(null);
  const [importMsg, setImportMsg] = useState<StatusMsg | null>(null);

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [hasExistingConfig, setHasExistingConfig] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [selectedCardId, setSelectedCardId] = useState<string>("");

  const [savingConfig, setSavingConfig] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [submittingCode, setSubmittingCode] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncingIncremental, setSyncingIncremental] = useState(false);
  const [syncingFull, setSyncingFull] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const anyGmailLoading = savingConfig || authorizing || submittingCode || disconnecting || syncingIncremental || syncingFull;

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [cardList, state, config, authenticated] = await Promise.all([
        getCards(),
        getSyncState(),
        gmailGetConfig().catch(() => ({ configured: false })),
        gmailIsAuthenticated().catch(() => false),
      ]);
      setCards(cardList);
      setSyncInfo(state);
      setGmailConnected(authenticated);
      if (cardList.length > 0 && !selectedCardId) {
        setSelectedCardId(String(cardList[0].id));
      }
      if ("client_id" in config && config.client_id) {
        setClientId(config.client_id as string);
        setHasExistingConfig(true);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSaveConfig() {
    if (!clientId.trim() || !clientSecret.trim()) {
      setGmailMsg({ type: "error", text: "请填写 Client ID 和 Client Secret" });
      return;
    }
    setSavingConfig(true);
    setGmailMsg(null);
    try {
      await gmailSaveConfig(clientId.trim(), clientSecret.trim());
      setHasExistingConfig(true);
      setGmailMsg({ type: "success", text: "Gmail 配置已保存" });
    } catch (e) {
      setGmailMsg({ type: "error", text: `保存失败: ${String(e)}` });
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleAuthorize() {
    if (!clientId.trim() || (!clientSecret.trim() && !hasExistingConfig)) {
      setGmailMsg({ type: "error", text: "请先填写 Client ID 和 Client Secret 并保存" });
      return;
    }
    setAuthorizing(true);
    setGmailMsg(null);
    try {
      await gmailSaveConfig(clientId.trim(), clientSecret.trim());
      const url = await gmailGetAuthUrl();
      await openUrl(url);
      setGmailMsg({ type: "success", text: "已在浏览器中打开 Google 授权页面，完成授权后请在下方粘贴授权码" });
    } catch (e) {
      setGmailMsg({ type: "error", text: `授权失败: ${String(e)}` });
    } finally {
      setAuthorizing(false);
    }
  }

  async function handleSubmitCode() {
    if (!authCode.trim()) {
      setGmailMsg({ type: "error", text: "请输入授权码" });
      return;
    }
    setSubmittingCode(true);
    setGmailMsg(null);
    try {
      const result = await gmailExchangeCode(authCode.trim());
      if (result.success) {
        setGmailConnected(true);
        setAuthCode("");
        setGmailMsg({ type: "success", text: "Gmail 授权成功！" });
      }
    } catch (e) {
      setGmailMsg({ type: "error", text: `授权失败: ${String(e)}` });
    } finally {
      setSubmittingCode(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    setGmailMsg(null);
    try {
      await gmailDisconnect();
      setGmailConnected(false);
      setGmailMsg({ type: "success", text: "已断开 Gmail 连接" });
    } catch (e) {
      setGmailMsg({ type: "error", text: `断开失败: ${String(e)}` });
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleSyncIncremental() {
    if (!selectedCardId) {
      setGmailMsg({ type: "error", text: "请先选择要同步的卡片" });
      return;
    }
    setSyncingIncremental(true);
    setGmailMsg(null);
    try {
      const result = await gmailSyncIncremental(Number(selectedCardId));
      if (result.success) {
        setGmailMsg({
          type: "success",
          text: `增量同步成功！新增 ${result.new_summaries} 天汇总，${result.new_transactions} 笔交易。`,
        });
        loadData();
      } else {
        setGmailMsg({
          type: "error",
          text: `同步完成但有错误: ${result.errors.join("; ")}`,
        });
      }
    } catch (e) {
      setGmailMsg({ type: "error", text: `同步失败: ${String(e)}` });
    } finally {
      setSyncingIncremental(false);
    }
  }

  async function handleSyncFull() {
    if (!selectedCardId) {
      setGmailMsg({ type: "error", text: "请先选择要同步的卡片" });
      return;
    }
    setSyncingFull(true);
    setGmailMsg(null);
    try {
      const result = await gmailSyncFull(Number(selectedCardId));
      if (result.success) {
        setGmailMsg({
          type: "success",
          text: `全量同步成功！新增 ${result.new_summaries} 天汇总，${result.new_transactions} 笔交易。`,
        });
        loadData();
      } else {
        setGmailMsg({
          type: "error",
          text: `同步完成但有错误: ${result.errors.join("; ")}`,
        });
      }
    } catch (e) {
      setGmailMsg({ type: "error", text: `同步失败: ${String(e)}` });
    } finally {
      setSyncingFull(false);
    }
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const htmlContent = await file.text();
      const parsed = await parseEmailContent(htmlContent);
      const matchingCard = cards.find((c) => c.last_four === parsed.card_last_four);
      if (!matchingCard) {
        setImportMsg({
          type: "error",
          text: `未找到尾号 ${parsed.card_last_four} 的卡片，请先在卡片管理中添加。`,
        });
        return;
      }
      const result = await importEmail(matchingCard.id, htmlContent, `file-${Date.now()}`);
      setImportMsg({ type: "success", text: result });
      loadData();
    } catch (err: unknown) {
      setImportMsg({ type: "error", text: String(err) });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleExport() {
    setExporting(true);
    setImportMsg(null);
    try {
      const defaultPath = "~/billo-export.csv";
      await exportCsv(defaultPath);
      setImportMsg({ type: "success", text: `已导出到 ${defaultPath}` });
    } catch (err: unknown) {
      setImportMsg({ type: "error", text: `导出失败: ${String(err)}` });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">设置</h2>

      <Card>
        <CardHeader>
          <CardTitle>Gmail 同步</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {gmailConnected ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Gmail 已授权</p>
                  {syncInfo?.last_sync_at && (
                    <p className="text-xs text-muted-foreground">上次同步: {syncInfo.last_sync_at}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium">Gmail 尚未授权</p>
                  <p className="text-xs text-muted-foreground">配置 Google OAuth2 凭据后即可自动同步账单邮件</p>
                </div>
              </>
            )}
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="text-sm text-muted-foreground">
              前往 <span className="text-primary underline cursor-pointer" onClick={() => openUrl('https://console.cloud.google.com/apis/credentials')}>Google Cloud Console</span> 创建 OAuth2 凭据：
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>应用类型选 <strong>Web 应用</strong></li>
              <li>在 <strong>已授权的重定向 URI</strong> 中添加：<code className="bg-muted px-1 rounded">http://127.0.0.1:8401/callback</code></li>
              <li>在 <strong>测试用户</strong> 中添加你的 Gmail 地址</li>
            </ul>
            <div className="grid gap-3">
              <div>
                <label className="text-sm font-medium">Client ID</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  placeholder="xxxx.apps.googleusercontent.com"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  disabled={anyGmailLoading}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Client Secret</label>
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  type="password"
                  placeholder={hasExistingConfig ? "已保存，留空则保持不变" : "GOCSPX-xxxx"}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  disabled={anyGmailLoading}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig || anyGmailLoading}>
                  {savingConfig ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  {savingConfig ? "保存中..." : "保存配置"}
                </Button>
                {!gmailConnected && (
                  <Button size="sm" variant="outline" onClick={handleAuthorize} disabled={!clientId || (!clientSecret && !hasExistingConfig) || anyGmailLoading}>
                    {authorizing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                    {authorizing ? "授权中..." : "授权 Gmail"}
                  </Button>
                )}
                {gmailConnected && (
                  <Button size="sm" variant="outline" onClick={handleDisconnect} disabled={disconnecting || anyGmailLoading}>
                    {disconnecting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Unlink className="h-4 w-4 mr-1" />}
                    {disconnecting ? "断开中..." : "断开连接"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {!gmailConnected && clientId.trim() && (clientSecret.trim() || hasExistingConfig) && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">Step 2: 输入授权码</p>
              <p className="text-sm text-muted-foreground">
                点击上方「授权 Gmail」后，浏览器会打开 Google 授权页面。完成后地址栏会变成类似：
              </p>
              <code className="block bg-muted px-3 py-2 rounded text-xs break-all">
                http://127.0.0.1:8401/callback?code=4/0AXXXX...&scope=...
              </code>
              <p className="text-sm text-muted-foreground">
                复制 <code className="bg-muted px-1 rounded">code=</code> 后面到 <code className="bg-muted px-1 rounded">&amp;</code> 之间的那串字符，粘贴到下方：
              </p>
              <div className="flex gap-2">
                <input
                  className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="粘贴授权码 (code 参数值)"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  disabled={submittingCode}
                />
                <Button size="sm" onClick={handleSubmitCode} disabled={submittingCode}>
                  {submittingCode && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {submittingCode ? "验证中..." : "完成授权"}
                </Button>
              </div>
            </div>
          )}

          {gmailConnected && cards.length > 0 && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium">同步邮件到卡片</p>
              <div className="flex gap-2 items-center">
                <select
                  className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedCardId}
                  onChange={(e) => setSelectedCardId(e.target.value)}
                  disabled={syncingIncremental || syncingFull}
                >
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} (尾号{c.last_four})</option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={handleSyncIncremental} disabled={syncingIncremental || syncingFull}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncingIncremental ? "animate-spin" : ""}`} />
                  {syncingIncremental ? "同步中..." : "增量同步"}
                </Button>
                <Button size="sm" onClick={handleSyncFull} disabled={syncingIncremental || syncingFull}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncingFull ? "animate-spin" : ""}`} />
                  {syncingFull ? "同步中..." : "全量同步"}
                </Button>
              </div>
            </div>
          )}

          {gmailMsg && (
            <div className={`flex items-center gap-2 p-3 rounded-md text-sm ${gmailMsg.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {gmailMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {gmailMsg.text}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>手动导入邮件</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            从 Gmail 中导出招商银行「每日信用管家」邮件的 .html 文件，然后在此处导入。
            系统会自动解析邮件中的交易数据。
          </p>
          <div className="flex gap-3">
            <Button onClick={() => fileInputRef.current?.click()} disabled={importing}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? "导入中..." : "选择邮件文件"}
            </Button>
            <input ref={fileInputRef} type="file" accept=".html,.htm,.eml" className="hidden" onChange={handleFileImport} />
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {exporting ? "导出中..." : "导出 CSV"}
            </Button>
          </div>
          {importMsg && (
            <div className={`mt-4 flex items-center gap-2 p-3 rounded-md text-sm ${importMsg.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {importMsg.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {importMsg.text}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>关于</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>Billo v0.1.0</p>
            <p>招商银行信用卡账单统计分析工具</p>
            <p>所有数据存储在本地 SQLite 数据库中，不会上传到任何服务器。</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}