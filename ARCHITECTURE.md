# Billo - 招商银行信用卡账单统计软件

## 项目概述

本地桌面账单统计软件，自动拉取 Gmail 中招商银行信用卡每日账单邮件，解析交易数据并存入本地 SQLite，提供多维度统计分析和可视化。

## 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 桌面框架 | Tauri v2 | Rust 后端 + Web 前端，体积小，性能好 |
| 前端 | React 18 + TypeScript + Vite | 数据密集型应用，生态丰富 |
| UI 组件库 | shadcn/ui + Tailwind CSS | 现代、可魔改、组件源码在手，配合重绘图标 |
| 图表 | Recharts | 与 shadcn/ui 官方 chart 组件集成，React 原生图表 |
| 本地数据库 | SQLite (rusqlite) | 单文件，零配置，Tauri 标配 |
| Gmail 集成 | Google Gmail API + OAuth2 | 官方支持，refresh token 自动续期 |
| 邮件解析 | scraper (Rust) | CSS 选择器解析 HTML 邮件 |
| 定时任务 | tokio-cron-scheduler | 每日凌晨自动同步 |

## 功能清单

### 已确认功能

| 功能 | 说明 |
|---|---|
| ✅ 多卡管理 | 支持添加多张招商银行信用卡 |
| ✅ Gmail 自动拉取 | OAuth2 授权，按发件人/主题过滤搜索 |
| ✅ 每日消费明细列表 | 按日期排列，支持搜索/筛选 |
| ✅ 月度汇总统计 | 月总支出、日均消费、月度趋势图 |
| ✅ 商户分类统计 | 自动归类（餐饮/交通/购物/娱乐等），饼图展示 |
| ✅ 额度与积分追踪 | 每日可用额度变化曲线，积分累计趋势 |
| ✅ 同比环比对比 | 本月 vs 上月 |
| ✅ 导出报表 | CSV / Excel 导出 |
| ✅ 自动同步 + 手动触发 | 默认每日自动同步，支持手动刷新 |

## 邮件数据格式

邮件来源：招商银行「每日信用管家」`ccsvc@message.cmbchina.com`

原始格式：HTML (multipart/mixed, quoted-printable 编码)

### 可提取字段

| 字段 | 示例 | 说明 |
|---|---|---|
| 日期 | 2026/05/21 | 邮件对应账单日期 |
| 可用额度 | ¥30,783.11 | 信用卡当前可用额度 |
| 积分余额 | 1,696 | 信用卡积分 |
| 卡片尾号 | 3740 | 交易卡片后四位 |

### 交易明细字段

| 字段 | 示例 | 说明 |
|---|---|---|
| 交易时间 | 09:10:46 | 具体时间 |
| 金额 | CNY 3.00 | 交易金额 |
| 商户名称 | 支付宝-北京礼信年年餐饮管理有限公司 | 支付方式-商户名 |
| 支付渠道 | 支付宝 / 财付通 / 微信支付 | 从商户名中提取 |
| 商户分类 | 餐饮 | 自动归类 |

## 数据库设计

```sql
-- 卡片
CREATE TABLE cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    last_four TEXT NOT NULL,
    bank TEXT NOT NULL DEFAULT '招商银行',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 每日汇总（按卡、按天唯一）
CREATE TABLE daily_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL REFERENCES cards(id),
    email_date TEXT NOT NULL,
    available_credit REAL,
    points_balance INTEGER,
    email_uid TEXT UNIQUE,
    raw_email TEXT,
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 交易明细
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id INTEGER NOT NULL REFERENCES cards(id),
    daily_summary_id INTEGER REFERENCES daily_summaries(id),
    transaction_time TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CNY',
    merchant TEXT NOT NULL,
    payment_method TEXT,
    category TEXT,
    notes TEXT
);

-- 同步状态
CREATE TABLE sync_state (
    id INTEGER PRIMARY KEY,
    last_sync_at TEXT,
    last_history_id TEXT
);

-- 分类规则
CREATE TABLE category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 商户自动分类策略

邮件中商户名格式：`支付方式-商户名`

分类逻辑：
1. 先匹配用户自定义的 category_rules
2. 再按内置关键词匹配：

| 分类 | 关键词 |
|---|---|
| 餐饮 | 餐饮、咖啡、奶茶、外卖、食堂、餐厅、烘焙、饭店、美食 |
| 交通 | 滴滴、地铁、公交、加油、停车、高速、打车、铁路、航空 |
| 购物 | 淘宝、京东、拼多多、超市、百货、便利店、商场 |
| 娱乐 | 游戏、影城、KTV、视频、音乐、直播、健身、运动 |
| 生活缴费 | 水电、燃气、物业、话费、宽带、供暖 |
| 医疗 | 医院、药房、诊所、体检 |
| 其他 | 无法匹配的默认归类 |

3. 用户可手动修改分类，修改后自动写入 category_rules

## Gmail 集成流程

```
首次启动:
  → 打开 OAuth 授权页面（浏览器）
  → 用户登录 Google 账号并授权 Gmail 只读权限
  → 回调获取 authorization code
  → 换取 access_token + refresh_token
  → refresh_token 加密存储到本地文件

每次同步:
  → 检查 refresh_token 是否有效
  → 换取 access_token
  → 调用 Gmail API: users.messages.list（搜索发件人/主题）
  → 逐封拉取邮件正文
  → 解析 HTML → 提取交易数据
  → 按 message_id 去重入库
  → 更新 sync_state

错误处理:
  → access_token 过期 → 自动用 refresh_token 续期
  → refresh_token 失效 → 提示用户重新授权
  → 网络错误 → 静默跳过，下次重试
```

### Gmail API 搜索查询

```
from:ccsvc@message.cmbchina.com subject:每日信用管家
```

## 项目结构

```
billo/
├── src/                        # React 前端
│   ├── components/             # 通用组件
│   │   ├── Layout/
│   │   ├── TransactionTable/
│   │   └── StatCard/
│   ├── pages/                  # 页面
│   │   ├── Dashboard/          # 首页仪表盘
│   │   ├── Transactions/       # 交易明细
│   │   ├── Statistics/         # 统计分析
│   │   ├── Cards/              # 卡片管理
│   │   └── Settings/           # 设置
│   ├── hooks/                  # 自定义 hooks
│   ├── store/                  # zustand 状态管理
│   ├── types/                  # TypeScript 类型定义
│   ├── utils/                  # 工具函数
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── main.rs             # Tauri 入口
│   │   ├── db.rs               # SQLite 数据库操作
│   │   ├── gmail.rs            # Gmail API 客户端
│   │   ├── parser.rs           # 招商银行邮件解析
│   │   ├── commands.rs         # Tauri IPC commands
│   │   └── scheduler.rs        # 定时同步调度
│   ├── Cargo.toml
│   └── tauri.conf.json
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 前端页面设计

### 1. 首页仪表盘 (Dashboard)

- 本月消费总额卡片
- 日均消费卡片
- 当前可用额度卡片
- 积分余额卡片
- 最近 7 天/30 天消费趋势折线图
- 消费分类占比饼图
- 最近 5 笔交易列表

### 2. 交易明细 (Transactions)

- Ant Design Table，支持：
  - 日期范围筛选
  - 金额范围筛选
  - 商户名称搜索
  - 分类筛选
  - 卡片筛选
  - 分页、排序
- 支持修改交易分类（下拉选择）

### 3. 统计分析 (Statistics)

- 月度消费趋势柱状图（含环比）
- 年度月度对比图（同比）
- 分类消费排行
- 可用额度变化曲线
- 积分变化曲线

### 4. 卡片管理 (Cards)

- 卡片列表
- 添加/删除卡片
- 按卡查看统计

### 5. 设置 (Settings)

- Gmail 连接状态
- 同步按钮（手动触发）
- 上次同步时间
- 导出数据（CSV / Excel）
- 自动同步开关

## 安全考虑

- refresh_token 存储在 Tauri app data 目录，用操作系统级文件权限保护
- 本地不存储 access_token，仅加密存储 refresh_token
- Gmail 权限最小化：仅申请 `gmail.readonly` scope
- 邮件原始内容可选存储（用户可配置是否保留原始邮件）
- 无网络请求到第三方服务器（仅 Google API 官方端点）
