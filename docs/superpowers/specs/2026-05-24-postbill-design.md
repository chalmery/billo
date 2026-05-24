# Billo — 设计规格说明

> 2026-05-24 · MVP 阶段 · 纯本地化、Privacy-First

## 1. 项目概述

Billo 是一个纯本地运行的信用卡账单管理工具。用户配置邮箱后，自动抓取招商银行「每日信用管家」邮件，解析消费数据并逐日累积，提供直观的月度花销视图。所有数据存储于本地 SQLite，不上传任何信息。

### MVP 范围

- **银行**: 招商银行（信用卡）
- **邮件类型**: 仅「每日信用管家」日消费邮件
- **邮箱**: QQ 邮箱（IMAP 授权码）+ Gmail（OAuth）
- **平台**: Linux 桌面（Tauri + GTK/WebKitGTK）

---

## 2. 技术栈

| 层 | 技术 | 理由 |
|---|------|------|
| 桌面壳 | Tauri v2 | ~5MB 包体，GTK 原生嵌入，系统 WebView |
| 后端 | Rust | IMAP 原生 TCP、SQLite、加密，~500 行 |
| 前端框架 | Svelte 5 + TypeScript | 编译后零运行时，~2KB |
| 样式 | Tailwind CSS v4 | 组件少但一致，手写样式极少 |
| 数据库 | SQLite（rusqlite） | 单文件，零运维 |
| 邮件解析 | 内联 YAML 模板 + regex | 不改代码加银行 |
| 加密 | AES-256-GCM + 系统密钥环 | 保护邮箱凭证 |

### 为什么 Tauri 而非 Electron

- 包体 5MB vs 150MB
- 不用捆绑 Chromium
- Rust 核心代码可直接编 Android ARM `.so`（未来扩展）

---

## 3. 数据模型

### 3.1 `email_account` — 邮箱账号

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | UUID |
| `email` | TEXT UNIQUE | 完整邮箱地址 |
| `provider` | TEXT | `qq` / `gmail` / `163` / `other` |
| `imap_host` | TEXT | 如 `imap.qq.com` |
| `imap_port` | INTEGER | 993 (TLS) / 143 (STARTTLS) |
| `use_tls` | INTEGER | 0/1 |
| `auth_type` | TEXT | `app_password` / `oauth2` |
| `auth_data_encrypted` | BLOB | AES-256-GCM 加密的 JSON |
| `last_uid` | INTEGER | IMAP UID 游标，增量抓取 |
| `enabled` | INTEGER | 0/1，暂停抓取但不删数据 |
| `created_at` | INTEGER | Unix 秒 |

`auth_data_encrypted` 内容（解密后）：

```json
// auth_type = "app_password"
{ "username": "user@qq.com", "password": "abcdabcdabcdabcd" }

// auth_type = "oauth2"
{ "access_token": "ya29.xxx", "refresh_token": "1//xxx", "expires_at": 1716544200 }
```

### 3.2 `raw_email` — 原始邮件存档

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | UUID |
| `account_id` | TEXT FK | → email_account.id |
| `uid` | INTEGER | IMAP UID，唯一标识 |
| `subject` | TEXT | 邮件主题 |
| `from_addr` | TEXT | 发件人地址 |
| `received_at` | INTEGER | 邮件头 Date，Unix 秒 |
| `body_text` | TEXT | 纯文本正文 |
| `body_html` | TEXT | HTML 正文（quoted-printable 已解码） |
| `raw_size` | INTEGER | 原文字节数 |
| `bank_matched` | TEXT NULL | 匹配成功的模板名，如 `cmb_daily` |

### 3.3 `transaction` — 消费记录

| 列 | 类型 | 说明 |
|----|------|------|
| `id` | TEXT PK | UUID |
| `email_id` | TEXT FK | → raw_email.id |
| `account_id` | TEXT FK | 冗余外键 |
| `date` | INTEGER | 消费日期，Unix 秒 |
| `time` | TEXT NULL | 精确时间 `HH:MM:SS`，仅日邮件有 |
| `merchant` | TEXT | 商户原始描述 |
| `amount` | INTEGER | 金额（分），正=消费，负=退货 |
| `currency` | TEXT | `CNY` / `USD`，默认 CNY |
| `type` | TEXT | `消费` / `退货` |
| `bank` | TEXT | `cmb` 等 |
| `card_last4` | TEXT NULL | 卡号末 4 位 |
| `category` | TEXT NULL | 预留分类 |
| `deleted_at` | INTEGER NULL | 软删除 |
| `created_at` | INTEGER | Unix 秒 |

### 3.4 唯一性约束

日邮件去重：同一封邮件（`email_id`）不应重复解析。跨邮件去重由 IMAP `uid` + `account_id` 保证 `raw_email` 唯一。

---

## 4. 邮件模板系统

### 4.1 模板文件

```
templates/
  cmb_daily.yaml    # 招商银行日消费邮件
```

### 4.2 模板格式

```yaml
# 招商银行 - 每日信用管家
# 匹配主题: "每日信用管家"
bank: cmb
name: 招商银行日消费邮件
subject_match: "每日信用管家"
from_match: "ccsvc@message.cmbchina.com"
body_type: html_quoted_printable

# 提取日期：在 pure_text 中搜索 YYYY/MM/DD 格式
date_pattern: '(?P<year>\d{4})/(?P<month>\d{2})/(?P<day>\d{2})'

# 交易行正则（在 HTML 标签剥离后的纯文本上运行）
transaction_pattern: >
  (?P<time>\d{2}:\d{2}:\d{2})\s+
  (?P<currency>CNY|USD)\s+
  (?P<amount>[\d.]+)\s+
  尾号(?P<card>\d{4})\s+
  (?P<type>消费|退货)\s+
  (?P<merchant>.+?)(?=\s+\d{2}:\d{2}:\d{2}|\s*$)

# 金额符号处理
amount_sign:
  消费: +     # 正数
  退货: -     # 负数
```

### 4.3 解析流程

```
raw_email 入库
    │
    ▼
提取 subject → 遍历模板目录 subject_match
    ├── 匹配 → 按模板解析
    │          ├── 剥离 HTML 标签 → 纯文本
    │          ├── 提取日期 (date_pattern)
    │          ├── 逐行匹配 (transaction_pattern)
    │          ├── 根据 type 决定 amount 正负
    │          └── 写入 transaction 表
    │
    └── 不匹配 → bank_matched = NULL，标记「未识别」
```

---

## 5. Rust 后端模块

```
src-tauri/src/
  main.rs              # Tauri 入口，注册 commands
  db/
    mod.rs             # 数据库初始化 + 迁移
    models.rs          # struct 定义
    account.rs         # email_account CRUD
    email.rs           # raw_email CRUD
    transaction.rs     # transaction 查询/插入/软删除
  mail/
    mod.rs             # 邮件引擎入口
    fetch.rs           # IMAP 连接 + 增量抓取
    parse.rs           # 模板加载 + 邮件解析
  crypto/
    mod.rs             # AES-GCM 加解密 + 密钥环访问
  Cargo.toml
```

### 5.1 Tauri Commands（前后端 IPC）

| Command | 入参 | 返回值 | 说明 |
|---------|------|--------|------|
| `add_account` | `{ email, provider, host, port, tls, auth_type, auth_data }` | `Account` | 添加邮箱，加密存储凭证 |
| `update_account` | `Account` | `Account` | 编辑邮箱配置 |
| `delete_account` | `{ id }` | `()` | 删除邮箱及关联数据 |
| `test_connection` | `{ id }` | `bool` | 测试 IMAP 连接 + 认证 |
| `fetch_new_mails` | `{ account_id? }` | `FetchResult` | 增量抓取，返回新增邮件数+解析交易数 |
| `query_transactions` | `{ year_month?, type?, search?, page, page_size }` | `Page<Transaction>` | 分页查询 |
| `get_summary` | `{ year_month? }` | `Summary` | 当月消费总额/退款/笔数/日均 |
| `get_recent` | `()` | `Transaction?` | 最近一笔交易 |
| `get_sync_status` | `()` | `SyncStatus` | 各账号最后抓取时间+状态 |
| `export_csv` | `{ year_month? }` | `String` | 导出 CSV 文本 |
| `backup_db` | `{ path }` | `()` | 备份数据库文件 |
| `restore_db` | `{ path }` | `()` | 从备份恢复 |
| `reparse_all` | `()` | `ParseResult` | 重新解析所有已抓取邮件 |

### 5.2 关键 Crate 依赖

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
serde_yaml = "0.9"
async-imap = { version = "0.9", default-features = false, features = ["rustls"] }
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
chrono = "0.4"
aes-gcm = "0.10"
keyring = "3"
mailparse = "0.14"
regex = "1"
```

---

## 6. 前端设计

### 6.1 技术细节

- **框架**: Svelte 5 + TypeScript
- **样式**: Tailwind CSS v4（`@import "tailwindcss"`）
- **IPC**: `@tauri-apps/api` 的 `invoke()` 调用 Rust commands
- **状态**: Svelte 5 runes（`$state`, `$derived`, `$effect`）
- **图表**: 不引入（MVP 只做表格）

### 6.2 页面结构

```
┌ Sidebar ──────────────────────────────────────┐
│  Billo                                      │
│  ─────────────────────────────                 │
│  [账单浏览器]     ← 默认首页                    │
│  [邮箱管理]                                     │
│  ─────────────────────────────                 │
│  [设置]                                        │
│                                                │
│  ─────────────────────────────                 │
│  ● 招商银行 · 已同步                            │
│  5月真实花销 ¥14,397.65                          │
│  数据完全存储于本地                               │
└────────────────────────────────────────────────┘
```

### 6.3 页面 1：账单浏览器

#### 组件树

```
BillPage
├── SummaryCards        ← 3 卡：真实花销 / 最近一笔 / 数据状态
├── FilterBar           ← 月份下拉 + 类型下拉 + 搜索框 + 导出/抓取按钮
├── TransactionTable    ← 分页表格
│   └── TransactionRow  ← 单行：日期/时间/商户/金额/类型/卡号/来源邮件
└── Pagination          ← 分页条
```

#### 按钮与交互

| 组件 | 触发 | 行为 |
|------|------|------|
| 月份下拉 | change | `invoke("query_transactions", { year_month })` → 更新表格 + SummaryCards |
| 类型下拉 | change | `invoke("query_transactions", { type })` → 过滤表格（消费/退货/全部） |
| 搜索框 | input debounce 300ms | `invoke("query_transactions", { search })` → LIKE 模糊匹配商户名 |
| 导出 CSV | click | `invoke("export_csv", { year_month })` → 文件保存对话框 → 写文件 |
| 立即抓取 | click | `invoke("fetch_new_mails")` → 进度提示 → 更新 SummaryCards + 表格 |
| 分页按钮 | click | `invoke("query_transactions", { page })` → 翻页 |

#### SummaryCards 数据来源

```
invoke("get_summary", { year_month })
  → { total_spend: 1439765, txn_count: 85, daily_avg: 57600, refund_count: 5 }

invoke("get_recent")
  → { date, time, merchant, amount, card_last4 } | null

invoke("get_sync_status")
  → { last_fetch: timestamp, total_emails: 30, total_txns: 85, accounts_ok: 1, accounts_total: 1 }
```

### 6.4 页面 2：邮箱管理

#### 组件树

```
EmailPage
├── EmailCard          ← 每张卡片：头像/地址/服务器信息/统计/状态/操作按钮
│   ├── 编辑 → 打开 EditEmailModal
│   └── 抓取 → invoke("fetch_new_mails", { account_id })
├── AddEmailCard       ← 虚线占位 → 打开 AddEmailModal
├── AddEmailModal      ← 表单弹窗
│   ├── 输入 email → 自动识别 provider 预填 imap_host
│   ├── 认证类型切换 → app_password / oauth2
│   ├── 测试连接 → invoke("test_connection")
│   └── 保存 → invoke("add_account")
└── EditEmailModal     ← 同 AddEmailModal 结构，预填当前值
```

#### 按钮与交互

| 组件 | 触发 | 行为 |
|------|------|------|
| [+ 添加邮箱] | click | 打开 AddEmailModal |
| 编辑 | click | 打开 EditEmailModal，预填所有字段 |
| 立即抓取 | click | `invoke("fetch_new_mails", { account_id })` → 刷新该卡统计数字 |
| 测试连接 | click | `invoke("test_connection", { id })` → 显示成功/失败 |
| 保存 | click | `invoke("add_account" / "update_account")` → 关闭弹窗 → 刷新列表 |
| 授权码输入框 | — | 密码类型输入框，不可见 |

#### EmailCard 显示数据

```
invoke("get_accounts")
  → [{ id, email, provider, imap_host, imap_port, use_tls,
       auth_type, enabled, last_fetch_at, email_count, txn_count,
       match_rate, status }]
```

### 6.5 页面 3：设置

#### 组件树

```
SettingsPage
├── DataSection
│   ├── 数据库路径 + 大小（静态）
│   ├── [备份] → invoke("backup_db") → 文件保存对话框
│   └── [导入] → invoke("restore_db") → 文件打开对话框 → 确认覆盖
├── TemplateSection
│   ├── 模板 chips 列表（当前仅有 `cmb_daily`）
│   └── [重新解析] → invoke("reparse_all") → 确认弹窗 → 进度 → 刷新数据
├── FetchSection
│   └── 启动时自动抓取 toggle → 写入本地配置
└── AboutSection
    └── 版本号 + 技术栈简述
```

#### 按钮与交互

| 组件 | 触发 | 行为 |
|------|------|------|
| 备份数据库 | click | 系统文件保存对话框 → 复制 `data.db` 到目标路径 |
| 导入备份 | click | 系统文件打开对话框 → 确认覆盖当前数据 → 替换 → 重启应用 |
| 重新解析 | click | 确认弹窗 → 清空 transaction 表 → 遍历 raw_email 重新匹配模板 → 显示解析结果 |
| 自动抓取 toggle | click | 写入本地配置文件 `~/.billo/config.json` |

---

## 7. 数据流

### 7.1 启动流程

```
应用启动
  ├── Tauri 初始化窗口
  ├── Rust: 打开 SQLite，运行迁移
  ├── Rust: 从密钥环读取加密密钥
  ├── Rust: 读取配置 (auto_fetch)
  ├── 前端: 加载，调用 get_summary / get_recent / get_sync_status
  ├── 前端: 渲染 SummaryCards
  └── 若 auto_fetch = true → invoke("fetch_new_mails")
```

### 7.2 抓取流程

```
invoke("fetch_new_mails")
  │
  ▼ Rust
  遍历 enabled 的 email_account
    ├── 解密 auth_data_encrypted
    ├── IMAP 连接 (imap_host:imap_port TLS)
    ├── 认证 (app_password / oauth2)
    ├── SEARCH UID > last_uid
    ├── 对每封新邮件:
    │     ├── 存入 raw_email
    │     ├── 匹配模板 (subject + from)
    │     ├── 解析 → 写入 transaction
    │     └── 标记 raw_email.bank_matched
    ├── 更新 account.last_uid
    └── 断开连接
  ▼
  返回 FetchResult { new_emails, new_txns }
  ▼ 前端
  刷新 SummaryCards + TransactionTable
```

### 7.3 增量去重

每封邮件由 IMAP `UID` 唯一标识。抓取前查询 `SELECT MAX(uid) FROM raw_email WHERE account_id = ?` 得到游标，只抓 `UID > cursor` 的邮件。已入库的邮件不会重复抓取。

---

## 8. 安全

| 资产 | 保护方式 |
|------|---------|
| 邮箱授权码/Token | AES-256-GCM 加密存入 SQLite BLOB，密钥存系统密钥环（GNOME Keyring / KDE Wallet） |
| 消费数据 | SQLite 文件在用户本地磁盘，文件权限 600 |
| IMAP 通信 | TLS 加密（rustls） |
| 无网络依赖 | 仅 IMAP 端口出站，不连接任何 Billo 后端（不存在） |

---

## 9. MVP 不做的

- ❌ 月账单邮件解析（仅日消费邮件）
- ❌ 其他银行（仅招商银行）
- ❌ 图表（无柱状图、折线图）
- ❌ 消费分类/标签
- ❌ 定时后台抓取（仅启动时可选自动抓取）
- ❌ 多卡号区分
- ❌ Android / iOS（仅 Linux 桌面）
- ❌ CSV 导入
- ❌ 多语言（仅简体中文）
- ❌ 系统托盘常驻

---

## 10. 原型文件

可交互 HTML 原型位于 `prototype/index.html`，浏览器直接打开可预览三个页面的布局和交互节奏。
