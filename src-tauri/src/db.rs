use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Card {
    pub id: i64,
    pub name: String,
    pub last_four: String,
    pub bank: String,
    pub parser_profile: String,
    pub color: String,
    pub sync_method: Option<String>,
    pub sync_config: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParserProfile {
    pub id: i64,
    pub name: String,
    pub is_builtin: bool,
    pub sender_pattern: String,
    pub subject_pattern: String,
    pub date_regex: String,
    pub time_regex: String,
    pub amount_regex: String,
    pub card_last_four_regex: String,
    pub merchant_regex: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncLog {
    pub id: i64,
    pub card_id: i64,
    pub status: String,
    pub new_emails: i64,
    pub new_transactions: i64,
    pub message: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[allow(dead_code)]
pub struct DailySummary {
    pub id: i64,
    pub card_id: i64,
    pub email_date: String,
    pub available_credit: Option<f64>,
    pub points_balance: Option<i64>,
    pub email_uid: String,
    pub fetched_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Transaction {
    pub id: i64,
    pub card_id: i64,
    pub daily_summary_id: i64,
    pub transaction_date: String,
    pub transaction_time: Option<String>,
    pub amount: f64,
    pub currency: String,
    pub merchant: String,
    pub payment_method: Option<String>,
    pub category: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MonthlySummary {
    pub month: String,
    pub total: f64,
    pub avg_daily: f64,
    pub transaction_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CategoryBreakdown {
    pub category: String,
    pub total: f64,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResult<T: Serialize> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreditTrend {
    pub date: String,
    pub available_credit: f64,
    pub total_consumption: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncState {
    pub last_sync_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardData {
    pub monthly_total: f64,
    pub monthly_change_pct: Option<f64>,
    pub yearly_total: f64,
    pub yearly_change_pct: Option<f64>,
    pub daily_average: f64,
    pub max_single: f64,
    pub max_single_merchant: String,
    pub heatmap_data: std::collections::HashMap<String, HeatmapCell>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeatmapCell {
    pub amount: f64,
    pub count: i64,
    pub categories: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct YearlyTotal {
    pub year: i32,
    pub total: f64,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentMethodBreakdown {
    pub method: String,
    pub total: f64,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CardDetail {
    pub card: Card,
    pub email_count: i64,
    pub transaction_count: i64,
    pub sync_logs: Vec<SyncLog>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnrichedDailySummary {
    pub id: i64,
    pub card_id: i64,
    pub card_name: String,
    pub card_last_four: String,
    pub email_date: String,
    pub transaction_count: i64,
    pub total_amount: f64,
    pub fetched_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryRule {
    pub id: i64,
    pub pattern: String,
    pub category: String,
    pub created_at: String,
}

impl Database {
    pub fn new(db_path: &str) -> SqliteResult<Self> {
        let conn = Connection::open(db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                last_four TEXT NOT NULL,
                bank TEXT NOT NULL DEFAULT '招商银行',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS daily_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL REFERENCES cards(id),
                email_date TEXT NOT NULL,
                available_credit REAL,
                points_balance INTEGER,
                email_uid TEXT UNIQUE,
                raw_email TEXT,
                fetched_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL REFERENCES cards(id),
                daily_summary_id INTEGER REFERENCES daily_summaries(id),
                transaction_date TEXT NOT NULL,
                transaction_time TEXT,
                amount REAL NOT NULL,
                currency TEXT NOT NULL DEFAULT 'CNY',
                merchant TEXT NOT NULL,
                payment_method TEXT,
                category TEXT,
                notes TEXT
            );

            CREATE TABLE IF NOT EXISTS sync_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                last_sync_at TEXT
            );

            CREATE TABLE IF NOT EXISTS category_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern TEXT NOT NULL,
                category TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            -- Default category rules
            INSERT OR IGNORE INTO category_rules (pattern, category) VALUES
                ('餐饮|咖啡|奶茶|外卖|食堂|餐厅|烘焙|饭店|美食', '餐饮'),
                ('滴滴|地铁|公交|加油|停车|高速|打车|铁路|航空', '交通'),
                ('淘宝|京东|拼多多|超市|百货|便利店|商场|天猫', '购物'),
                ('游戏|影城|KTV|视频|音乐|直播|健身|运动', '娱乐'),
                ('水电|燃气|物业|话费|宽带|供暖', '生活缴费'),
                ('医院|药房|诊所|体检|医疗', '医疗健康'),
                ('美团|饿了么|外卖', '外卖'),
                ('瑞幸|星巴克|喜茶|奶茶|咖啡', '餐饮');

            INSERT OR IGNORE INTO sync_state (id, last_sync_at) VALUES (1, NULL);
            ",
        )?;

        // ALTER TABLE for new cards columns (SQLite doesn't support ADD COLUMN IF NOT EXISTS,
        // so we ignore errors if columns already exist)
        let _ = conn.execute(
            "ALTER TABLE cards ADD COLUMN parser_profile TEXT NOT NULL DEFAULT 'cmb'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE cards ADD COLUMN color TEXT NOT NULL DEFAULT 'slate'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE cards ADD COLUMN sync_method TEXT",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE cards ADD COLUMN sync_config TEXT",
            [],
        );

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS parser_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                is_builtin INTEGER NOT NULL DEFAULT 0,
                sender_pattern TEXT NOT NULL DEFAULT '',
                subject_pattern TEXT NOT NULL DEFAULT '',
                date_regex TEXT NOT NULL DEFAULT '',
                time_regex TEXT NOT NULL DEFAULT '',
                amount_regex TEXT NOT NULL DEFAULT '',
                card_last_four_regex TEXT NOT NULL DEFAULT '',
                merchant_regex TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            INSERT OR IGNORE INTO parser_profiles (id, name, is_builtin, sender_pattern, subject_pattern,
                date_regex, time_regex, amount_regex, card_last_four_regex, merchant_regex)
            VALUES (1, '招商银行每日信用管家', 1, 'ccsvc@message.cmbchina.com', '每日信用管家',
                '\\d{4}/\\d{2}/\\d{2}',
                '\\d{2}:\\d{2}:\\d{2}',
                '(?:CNY|RMB)\\s*([\\d,]+\\.?\\d*)',
                '尾号(\\d+)',
                '尾号\\d+\\s*(?:消费|支出|还款)\\s*(.+)'
            );

            CREATE TABLE IF NOT EXISTS sync_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL REFERENCES cards(id),
                status TEXT NOT NULL,
                new_emails INTEGER NOT NULL DEFAULT 0,
                new_transactions INTEGER NOT NULL DEFAULT 0,
                message TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            ",
        )?;
        Ok(())
    }

    // ===== Cards =====

    pub fn create_card(&self, name: &str, last_four: &str, color: &str) -> SqliteResult<Card> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO cards (name, last_four, color) VALUES (?1, ?2, ?3)",
            params![name, last_four, color],
        )?;
        let id = conn.last_insert_rowid();
        Ok(conn.query_row(
            "SELECT id, name, last_four, bank, parser_profile, color, sync_method, sync_config, created_at FROM cards WHERE id = ?1",
            params![id],
            |row| {
                Ok(Card {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    last_four: row.get(2)?,
                    bank: row.get(3)?,
                    parser_profile: row.get(4)?,
                    color: row.get(5)?,
                    sync_method: row.get(6)?,
                    sync_config: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )?)
    }

    pub fn get_cards(&self) -> SqliteResult<Vec<Card>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, last_four, bank, parser_profile, color, sync_method, sync_config, created_at FROM cards ORDER BY created_at ASC",
        )?;
        let cards = stmt
            .query_map([], |row| {
                Ok(Card {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    last_four: row.get(2)?,
                    bank: row.get(3)?,
                    parser_profile: row.get(4)?,
                    color: row.get(5)?,
                    sync_method: row.get(6)?,
                    sync_config: row.get(7)?,
                    created_at: row.get(8)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(cards)
    }

    pub fn get_card(&self, id: i64) -> SqliteResult<Option<Card>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, last_four, bank, parser_profile, color, sync_method, sync_config, created_at FROM cards WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Card {
                id: row.get(0)?,
                name: row.get(1)?,
                last_four: row.get(2)?,
                bank: row.get(3)?,
                parser_profile: row.get(4)?,
                color: row.get(5)?,
                sync_method: row.get(6)?,
                sync_config: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;
        Ok(rows.next().transpose()?)
    }

    pub fn delete_card(&self, id: i64) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM transactions WHERE card_id = ?1", params![id])?;
        conn.execute("DELETE FROM daily_summaries WHERE card_id = ?1", params![id])?;
        conn.execute("DELETE FROM cards WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ===== Daily Summaries =====

    pub fn upsert_daily_summary(
        &self,
        card_id: i64,
        email_date: &str,
        available_credit: Option<f64>,
        points_balance: Option<i64>,
        email_uid: &str,
        raw_email: Option<&str>,
    ) -> SqliteResult<i64> {
        let conn = self.conn.lock().unwrap();
        // Try to find existing by email_uid
        let existing: Option<i64> = conn
            .query_row(
                "SELECT id FROM daily_summaries WHERE email_uid = ?1",
                params![email_uid],
                |row| row.get(0),
            )
            .ok();

        if let Some(id) = existing {
            // Update
            conn.execute(
                "UPDATE daily_summaries SET available_credit = ?1, points_balance = ?2 WHERE id = ?3",
                params![available_credit, points_balance, id],
            )?;
            Ok(id)
        } else {
            conn.execute(
                "INSERT INTO daily_summaries (card_id, email_date, available_credit, points_balance, email_uid, raw_email) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![card_id, email_date, available_credit, points_balance, email_uid, raw_email],
            )?;
            Ok(conn.last_insert_rowid())
        }
    }

#[allow(dead_code)]
    pub fn get_daily_summaries(
        &self,
        card_id: Option<i64>,
        limit: i64,
        offset: i64,
    ) -> SqliteResult<PaginatedResult<DailySummary>> {
        let conn = self.conn.lock().unwrap();
        let (_where_clause, count_sql, query_sql) = if let Some(cid) = card_id {
            (
                format!("WHERE card_id = {}", cid),
                format!("SELECT COUNT(*) FROM daily_summaries WHERE card_id = {}", cid),
                format!("SELECT id, card_id, email_date, available_credit, points_balance, email_uid, fetched_at FROM daily_summaries WHERE card_id = {} ORDER BY email_date DESC LIMIT ?1 OFFSET ?2", cid),
            )
        } else {
            (
                "".to_string(),
                "SELECT COUNT(*) FROM daily_summaries".to_string(),
                "SELECT id, card_id, email_date, available_credit, points_balance, email_uid, fetched_at FROM daily_summaries ORDER BY email_date DESC LIMIT ?1 OFFSET ?2".to_string(),
            )
        };
        let total: i64 = conn.query_row(&count_sql, [], |row| row.get(0))?;
        let mut stmt = conn.prepare(&query_sql)?;
        let items = stmt
            .query_map(params![limit, offset], |row| {
                Ok(DailySummary {
                    id: row.get(0)?,
                    card_id: row.get(1)?,
                    email_date: row.get(2)?,
                    available_credit: row.get(3)?,
                    points_balance: row.get(4)?,
                    email_uid: row.get(5)?,
                    fetched_at: row.get(6)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(PaginatedResult {
            items,
            total,
            page: offset / limit + 1,
            page_size: limit,
        })
    }

    pub fn get_raw_email(&self, summary_id: i64) -> SqliteResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT raw_email FROM daily_summaries WHERE id = ?1"
        )?;
        let result = stmt.query_row(params![summary_id], |row| {
            row.get::<_, Option<String>>(0)
        });
        match result {
            Ok(html) => Ok(html),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    pub fn get_latest_summary_date(&self, card_id: i64) -> SqliteResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT email_date FROM daily_summaries WHERE card_id = ?1 ORDER BY email_date DESC LIMIT 1"
        )?;
        let result = stmt.query_row(params![card_id], |row| row.get::<_, String>(0));
        match result {
            Ok(date) => Ok(Some(date)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    // ===== Transactions =====

    pub fn insert_transaction(
        &self,
        card_id: i64,
        daily_summary_id: i64,
        transaction_date: &str,
        transaction_time: Option<&str>,
        amount: f64,
        currency: &str,
        merchant: &str,
        payment_method: Option<&str>,
    ) -> SqliteResult<i64> {
        let category = self.classify_merchant(merchant);
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO transactions (card_id, daily_summary_id, transaction_date, transaction_time, amount, currency, merchant, payment_method, category) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![card_id, daily_summary_id, transaction_date, transaction_time, amount, currency, merchant, payment_method, category],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_transactions(
        &self,
        card_id: Option<i64>,
        date_from: Option<&str>,
        date_to: Option<&str>,
        category: Option<&str>,
        payment_method: Option<&str>,
        merchant: Option<&str>,
        amount_min: Option<f64>,
        amount_max: Option<f64>,
        page: i64,
        page_size: i64,
    ) -> SqliteResult<PaginatedResult<Transaction>> {
        let conn = self.conn.lock().unwrap();
        let mut conditions: Vec<String> = Vec::new();
        let mut _param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(cid) = card_id {
            conditions.push(format!("t.card_id = {}", cid));
        }
        if let Some(d) = date_from {
            conditions.push(format!("t.transaction_date >= '{}'", d));
        }
        if let Some(d) = date_to {
            conditions.push(format!("t.transaction_date <= '{}'", d));
        }
        if let Some(c) = category {
            conditions.push(format!("t.category = '{}'", c));
        }
        if let Some(pm) = payment_method {
            conditions.push(format!("t.payment_method = '{}'", pm.replace('\'', "''")));
        }
        if let Some(m) = merchant {
            conditions.push(format!("t.merchant LIKE '%{}%'", m.replace('\'', "''")));
        }
        if let Some(amin) = amount_min {
            conditions.push(format!("t.amount >= {}", amin));
        }
        if let Some(amax) = amount_max {
            conditions.push(format!("t.amount <= {}", amax));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        let count_sql = format!("SELECT COUNT(*) FROM transactions t {}", where_clause);
        let total: i64 = conn.query_row(&count_sql, [], |row| row.get(0))?;

        let offset = (page - 1) * page_size;
        let query_sql = format!(
            "SELECT t.id, t.card_id, t.daily_summary_id, t.transaction_date, t.transaction_time, t.amount, t.currency, t.merchant, t.payment_method, t.category, t.notes FROM transactions t {} ORDER BY t.transaction_date DESC, t.transaction_time DESC LIMIT {} OFFSET {}",
            where_clause, page_size, offset
        );

        let mut stmt = conn.prepare(&query_sql)?;
        let items = stmt
            .query_map([], |row| {
                Ok(Transaction {
                    id: row.get(0)?,
                    card_id: row.get(1)?,
                    daily_summary_id: row.get(2)?,
                    transaction_date: row.get(3)?,
                    transaction_time: row.get(4)?,
                    amount: row.get(5)?,
                    currency: row.get(6)?,
                    merchant: row.get(7)?,
                    payment_method: row.get(8)?,
                    category: row.get(9)?,
                    notes: row.get(10)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(PaginatedResult {
            items,
            total,
            page,
            page_size,
        })
    }

    pub fn update_transaction_category(&self, id: i64, category: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE transactions SET category = ?1 WHERE id = ?2",
            params![category, id],
        )?;
        Ok(())
    }

    // ===== Statistics =====

    pub fn get_monthly_summary(
        &self,
        card_id: Option<i64>,
        year: i32,
    ) -> SqliteResult<Vec<MonthlySummary>> {
        let conn = self.conn.lock().unwrap();
        let card_filter = if let Some(cid) = card_id {
            format!("AND card_id = {}", cid)
        } else {
            String::new()
        };
        let sql = format!(
            "SELECT strftime('%Y-%m', transaction_date) as month,
                    SUM(amount) as total,
                    ROUND(SUM(amount) * 1.0 / COUNT(DISTINCT transaction_date), 2) as avg_daily,
                    COUNT(*) as transaction_count
             FROM transactions
             WHERE strftime('%Y', transaction_date) = '{}' {}
             GROUP BY month
             ORDER BY month ASC",
            year, card_filter
        );
        let mut stmt = conn.prepare(&sql)?;
        let results = stmt
            .query_map([], |row| {
                Ok(MonthlySummary {
                    month: row.get(0)?,
                    total: row.get(1)?,
                    avg_daily: row.get(2)?,
                    transaction_count: row.get(3)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(results)
    }

    pub fn get_category_breakdown(
        &self,
        card_id: Option<i64>,
        date_from: &str,
        date_to: &str,
    ) -> SqliteResult<Vec<CategoryBreakdown>> {
        let conn = self.conn.lock().unwrap();
        let card_filter = if let Some(cid) = card_id {
            format!("AND card_id = {}", cid)
        } else {
            String::new()
        };
        let sql = format!(
            "SELECT COALESCE(category, '未分类') as category,
                    SUM(amount) as total,
                    COUNT(*) as count
             FROM transactions
             WHERE transaction_date >= '{}' AND transaction_date <= '{}' {}
             GROUP BY category
             ORDER BY total DESC",
            date_from, date_to, card_filter
        );
        let mut stmt = conn.prepare(&sql)?;
        let results = stmt
            .query_map([], |row| {
                Ok(CategoryBreakdown {
                    category: row.get(0)?,
                    total: row.get(1)?,
                    count: row.get(2)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(results)
    }

    pub fn get_credit_trend(
        &self,
        card_id: Option<i64>,
        date_from: &str,
        date_to: &str,
    ) -> SqliteResult<Vec<CreditTrend>> {
        let conn = self.conn.lock().unwrap();
        let card_filter = if let Some(cid) = card_id {
            format!("AND ds.card_id = {}", cid)
        } else {
            String::new()
        };
        let sql = format!(
            "SELECT ds.email_date, ds.available_credit,
                    COALESCE(t.daily_total, 0) as total_consumption
             FROM daily_summaries ds
             LEFT JOIN (
                 SELECT daily_summary_id, SUM(amount) as daily_total
                 FROM transactions
                 GROUP BY daily_summary_id
             ) t ON ds.id = t.daily_summary_id
             WHERE ds.email_date >= '{}' AND ds.email_date <= '{}' {}
             ORDER BY ds.email_date ASC",
            date_from, date_to, card_filter
        );
        let mut stmt = conn.prepare(&sql)?;
        let results = stmt
            .query_map([], |row| {
                Ok(CreditTrend {
                    date: row.get(0)?,
                    available_credit: row.get::<_, Option<f64>>(1)?.unwrap_or(0.0),
                    total_consumption: row.get(2)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(results)
    }

    // ===== Sync State =====

    pub fn get_sync_state(&self) -> SqliteResult<SyncState> {
        let conn = self.conn.lock().unwrap();
        let state = conn.query_row(
            "SELECT last_sync_at FROM sync_state WHERE id = 1",
            [],
            |row| {
                Ok(SyncState {
                    last_sync_at: row.get(0)?,
                })
            },
        )?;
        Ok(state)
    }

    #[allow(dead_code)]
pub fn update_sync_state(&self) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE sync_state SET last_sync_at = datetime('now','localtime') WHERE id = 1",
            [],
        )?;
        Ok(())
    }

    // ===== Merchant Classification =====

    fn classify_merchant(&self, merchant: &str) -> Option<String> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT pattern, category FROM category_rules")
            .unwrap();
        let rules: Vec<(String, String)> = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        for (pattern, category) in rules {
            let re = regex::Regex::new(&pattern).unwrap();
            if re.is_match(merchant) {
                return Some(category);
            }
        }
        None
    }

    // ===== Export =====

    pub fn export_csv(&self, path: &str, card_id: Option<i64>) -> Result<(), String> {
        let mut wtr = csv::Writer::from_path(path).map_err(|e| e.to_string())?;
        wtr.write_record(&[
            "日期",
            "时间",
            "金额",
            "币种",
            "商户",
            "支付方式",
            "分类",
            "备注",
        ])
        .map_err(|e| e.to_string())?;

        let conn = self.conn.lock().unwrap();
        let card_filter = if let Some(cid) = card_id {
            format!("WHERE card_id = {}", cid)
        } else {
            String::new()
        };
        let sql = format!(
            "SELECT transaction_date, transaction_time, amount, currency, merchant, payment_method, category, notes FROM transactions {} ORDER BY transaction_date DESC, transaction_time DESC",
            card_filter
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, f64>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for row in rows {
            let (date, time, amount, currency, merchant, payment, category, notes) =
                row.map_err(|e| e.to_string())?;
            wtr.write_record([
                date,
                time.unwrap_or_default(),
                format!("{:.2}", amount),
                currency,
                merchant,
                payment.unwrap_or_default(),
                category.unwrap_or_default(),
                notes.unwrap_or_default(),
            ])
            .map_err(|e| e.to_string())?;
        }
        wtr.flush().map_err(|e| e.to_string())?;
        Ok(())
    }
}

impl Database {
    pub fn get_parser_profiles(&self) -> SqliteResult<Vec<ParserProfile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, is_builtin, sender_pattern, subject_pattern,
                    date_regex, time_regex, amount_regex, card_last_four_regex,
                    merchant_regex, created_at
             FROM parser_profiles ORDER BY is_builtin DESC, id ASC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(ParserProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                is_builtin: row.get::<_, i64>(2)? != 0,
                sender_pattern: row.get(3)?,
                subject_pattern: row.get(4)?,
                date_regex: row.get(5)?,
                time_regex: row.get(6)?,
                amount_regex: row.get(7)?,
                card_last_four_regex: row.get(8)?,
                merchant_regex: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_parser_profile_by_name(&self, name: &str) -> SqliteResult<Option<ParserProfile>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, is_builtin, sender_pattern, subject_pattern,
                    date_regex, time_regex, amount_regex, card_last_four_regex,
                    merchant_regex, created_at
             FROM parser_profiles WHERE name = ?1"
        )?;
        let mut rows = stmt.query_map(params![name], |row| {
            Ok(ParserProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                is_builtin: row.get::<_, i64>(2)? != 0,
                sender_pattern: row.get(3)?,
                subject_pattern: row.get(4)?,
                date_regex: row.get(5)?,
                time_regex: row.get(6)?,
                amount_regex: row.get(7)?,
                card_last_four_regex: row.get(8)?,
                merchant_regex: row.get(9)?,
                created_at: row.get(10)?,
            })
        })?;
        Ok(rows.next().transpose()?)
    }

    pub fn create_parser_profile(&self, p: &ParserProfile) -> SqliteResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO parser_profiles (name, is_builtin, sender_pattern, subject_pattern,
                 date_regex, time_regex, amount_regex, card_last_four_regex, merchant_regex)
             VALUES (?1, 0, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![p.name, p.sender_pattern, p.subject_pattern,
                p.date_regex, p.time_regex, p.amount_regex, p.card_last_four_regex, p.merchant_regex],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_parser_profile(&self, p: &ParserProfile) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE parser_profiles SET name=?1, sender_pattern=?2, subject_pattern=?3,
                 date_regex=?4, time_regex=?5, amount_regex=?6, card_last_four_regex=?7,
                 merchant_regex=?8 WHERE id=?9 AND is_builtin=0",
            rusqlite::params![p.name, p.sender_pattern, p.subject_pattern,
                p.date_regex, p.time_regex, p.amount_regex, p.card_last_four_regex,
                p.merchant_regex, p.id],
        )?;
        Ok(())
    }

    pub fn delete_parser_profile(&self, id: i64) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM parser_profiles WHERE id=?1 AND is_builtin=0",
            rusqlite::params![id],
        )?;
        Ok(())
    }

    // ===== Dashboard =====

    pub fn get_dashboard_data(&self, card_ids: &[i64], year: i32) -> SqliteResult<DashboardData> {
        use chrono::{Datelike, Local};
        let conn = self.conn.lock().unwrap();

        let today = Local::now();
        let current_ym = today.format("%Y-%m").to_string();

        // Previous month (handle January -> December of previous year)
        let prev_ym = if today.month() == 1 {
            format!("{}-12", today.year() - 1)
        } else {
            format!("{}-{:02}", today.year(), today.month() - 1)
        };

        let prev_year = year - 1;

        // Card filter clause (empty = all cards)
        let card_clause = if card_ids.is_empty() {
            String::new()
        } else {
            let ids: Vec<String> = card_ids.iter().map(|id| id.to_string()).collect();
            format!("AND card_id IN ({})", ids.join(","))
        };

        // Monthly total (current month)
        let monthly_total: f64 = conn
            .query_row(
                &format!(
                    "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE strftime('%Y-%m', transaction_date) = '{}' {}",
                    current_ym, card_clause
                ),
                [],
                |row| row.get(0),
            )?;

        // Previous month total (for month-over-month change)
        let prev_month_total: f64 = conn
            .query_row(
                &format!(
                    "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE strftime('%Y-%m', transaction_date) = '{}' {}",
                    prev_ym, card_clause
                ),
                [],
                |row| row.get(0),
            )?;

        let monthly_change_pct = if prev_month_total > 0.0 {
            Some(((monthly_total - prev_month_total) / prev_month_total) * 100.0)
        } else {
            None
        };

        // Yearly total (given year)
        let yearly_total: f64 = conn
            .query_row(
                &format!(
                    "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE strftime('%Y', transaction_date) = '{}' {}",
                    year, card_clause
                ),
                [],
                |row| row.get(0),
            )?;

        // Previous year total (year-over-year)
        let prev_year_total: f64 = conn
            .query_row(
                &format!(
                    "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE strftime('%Y', transaction_date) = '{}' {}",
                    prev_year, card_clause
                ),
                [],
                |row| row.get(0),
            )?;

        let yearly_change_pct = if prev_year_total > 0.0 {
            Some(((yearly_total - prev_year_total) / prev_year_total) * 100.0)
        } else {
            None
        };

        // Daily average: monthly total / days passed this month
        let days_passed = today.day() as f64;
        let daily_average = if days_passed > 0.0 {
            monthly_total / days_passed
        } else {
            0.0
        };

        // Max single transaction this month
        let (max_single, max_single_merchant): (f64, String) = conn
            .query_row(
                &format!(
                    "SELECT amount, merchant FROM transactions WHERE strftime('%Y-%m', transaction_date) = '{}' {} ORDER BY amount DESC LIMIT 1",
                    current_ym, card_clause
                ),
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap_or((0.0, String::new()));

        // Heatmap data: group by date for the given year
        let mut heatmap_data: std::collections::HashMap<String, HeatmapCell> =
            std::collections::HashMap::new();

        let heatmap_sql = format!(
            "SELECT transaction_date, SUM(amount) as total, COUNT(*) as cnt,
                    GROUP_CONCAT(DISTINCT COALESCE(category, '未分类')) as cats
             FROM transactions
             WHERE strftime('%Y', transaction_date) = '{}' {}
             GROUP BY transaction_date
             ORDER BY transaction_date",
            year, card_clause
        );

        let mut stmt = conn.prepare(&heatmap_sql)?;
        let rows = stmt.query_map([], |row| {
            let date: String = row.get(0)?;
            let amount: f64 = row.get(1)?;
            let count: i64 = row.get(2)?;
            let cats_str: String = row.get(3)?;
            let categories: Vec<String> = cats_str
                .split(',')
                .map(|s| s.to_string())
                .collect();
            Ok((date, HeatmapCell { amount, count, categories }))
        })?;

        for row in rows {
            let (date, cell) = row?;
            heatmap_data.insert(date, cell);
        }

        Ok(DashboardData {
            monthly_total,
            monthly_change_pct,
            yearly_total,
            yearly_change_pct,
            daily_average,
            max_single,
            max_single_merchant,
            heatmap_data,
        })
    }

    pub fn get_yearly_totals(&self, card_id: Option<i64>) -> SqliteResult<Vec<YearlyTotal>> {
        let conn = self.conn.lock().unwrap();
        let card_filter = if let Some(cid) = card_id {
            format!("WHERE card_id = {}", cid)
        } else {
            String::new()
        };
        let sql = format!(
            "SELECT CAST(strftime('%Y', transaction_date) AS INTEGER) as year,
                    SUM(amount) as total, COUNT(*) as count
             FROM transactions {}
             GROUP BY year ORDER BY year DESC",
            card_filter
        );
        let mut stmt = conn.prepare(&sql)?;
        let results = stmt
            .query_map([], |row| {
                Ok(YearlyTotal {
                    year: row.get(0)?,
                    total: row.get(1)?,
                    count: row.get(2)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(results)
    }

    pub fn get_payment_method_breakdown(
        &self,
        card_id: Option<i64>,
        date_from: &str,
        date_to: &str,
    ) -> SqliteResult<Vec<PaymentMethodBreakdown>> {
        let conn = self.conn.lock().unwrap();
        let card_filter = if let Some(cid) = card_id {
            format!("AND card_id = {}", cid)
        } else {
            String::new()
        };
        let sql = format!(
            "SELECT COALESCE(payment_method, '其他') as method,
                    SUM(amount) as total, COUNT(*) as count
             FROM transactions
             WHERE transaction_date >= '{}' AND transaction_date <= '{}' {}
             GROUP BY method ORDER BY total DESC",
            date_from, date_to, card_filter
        );
        let mut stmt = conn.prepare(&sql)?;
        let results = stmt
            .query_map([], |row| {
                Ok(PaymentMethodBreakdown {
                    method: row.get(0)?,
                    total: row.get(1)?,
                    count: row.get(2)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(results)
    }

    pub fn get_card_detail(&self, card_id: i64) -> SqliteResult<Option<CardDetail>> {
        let conn = self.conn.lock().unwrap();
        // Inline card fetch to avoid deadlock (conn is already locked, can't call self.get_card)
        let card = conn.query_row(
            "SELECT id, name, last_four, bank, parser_profile, color, sync_method, sync_config, created_at FROM cards WHERE id = ?1",
            params![card_id],
            |row| {
                Ok(Card {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    last_four: row.get(2)?,
                    bank: row.get(3)?,
                    parser_profile: row.get(4)?,
                    color: row.get(5)?,
                    sync_method: row.get(6)?,
                    sync_config: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        );
        let card = match card {
            Ok(c) => c,
            Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
            Err(e) => return Err(e),
        };

        let email_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM daily_summaries WHERE card_id = ?1",
            params![card_id],
            |row| row.get(0),
        )?;

        let transaction_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transactions WHERE card_id = ?1",
            params![card_id],
            |row| row.get(0),
        )?;

        let mut stmt = conn.prepare(
            "SELECT id, card_id, status, new_emails, new_transactions, message, created_at
             FROM sync_logs WHERE card_id = ?1 ORDER BY created_at DESC LIMIT 50"
        )?;
        let sync_logs = stmt
            .query_map(params![card_id], |row| {
                Ok(SyncLog {
                    id: row.get(0)?,
                    card_id: row.get(1)?,
                    status: row.get(2)?,
                    new_emails: row.get(3)?,
                    new_transactions: row.get(4)?,
                    message: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(Some(CardDetail {
            card,
            email_count,
            transaction_count,
            sync_logs,
        }))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update_card(
        &self,
        id: i64,
        name: &str,
        last_four: &str,
        bank: &str,
        parser_profile: &str,
        color: &str,
        sync_method: Option<&str>,
        sync_config: Option<&str>,
    ) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE cards SET name=?1, last_four=?2, bank=?3, parser_profile=?4, color=?5, sync_method=?6, sync_config=?7 WHERE id=?8",
            params![name, last_four, bank, parser_profile, color, sync_method, sync_config, id],
        )?;
        Ok(())
    }

    pub fn get_enriched_daily_summaries(
        &self,
        card_id: Option<i64>,
        page: i64,
        page_size: i64,
    ) -> SqliteResult<PaginatedResult<EnrichedDailySummary>> {
        let conn = self.conn.lock().unwrap();
        let card_filter = if let Some(cid) = card_id {
            format!("AND ds.card_id = {}", cid)
        } else {
            String::new()
        };

        let count_sql = format!(
            "SELECT COUNT(*) FROM daily_summaries ds WHERE 1=1 {}",
            card_filter
        );
        let total: i64 = conn.query_row(&count_sql, [], |row| row.get(0))?;

        let offset = (page - 1) * page_size;
        let query_sql = format!(
            "SELECT ds.id, ds.card_id, c.name, c.last_four, ds.email_date,
                    COALESCE(t.tx_count, 0) as tx_count,
                    COALESCE(t.total_amount, 0) as total_amount,
                    ds.fetched_at
             FROM daily_summaries ds
             JOIN cards c ON ds.card_id = c.id
             LEFT JOIN (
                 SELECT daily_summary_id, COUNT(*) as tx_count, SUM(amount) as total_amount
                 FROM transactions
                 GROUP BY daily_summary_id
             ) t ON ds.id = t.daily_summary_id
             WHERE 1=1 {}
             ORDER BY ds.email_date DESC
             LIMIT {} OFFSET {}",
            card_filter, page_size, offset
        );

        let mut stmt = conn.prepare(&query_sql)?;
        let items = stmt
            .query_map([], |row| {
                Ok(EnrichedDailySummary {
                    id: row.get(0)?,
                    card_id: row.get(1)?,
                    card_name: row.get(2)?,
                    card_last_four: row.get(3)?,
                    email_date: row.get(4)?,
                    transaction_count: row.get(5)?,
                    total_amount: row.get(6)?,
                    fetched_at: row.get(7)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(PaginatedResult { items, total, page, page_size })
    }

    pub fn get_category_rules(&self) -> SqliteResult<Vec<CategoryRule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, pattern, category, created_at FROM category_rules ORDER BY id ASC"
        )?;
        let rules = stmt
            .query_map([], |row| {
                Ok(CategoryRule {
                    id: row.get(0)?,
                    pattern: row.get(1)?,
                    category: row.get(2)?,
                    created_at: row.get(3)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(rules)
    }

    pub fn add_category_rule(&self, pattern: &str, category: &str) -> SqliteResult<CategoryRule> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO category_rules (pattern, category) VALUES (?1, ?2)",
            params![pattern, category],
        )?;
        let id = conn.last_insert_rowid();
        Ok(CategoryRule {
            id,
            pattern: pattern.to_string(),
            category: category.to_string(),
            created_at: String::new(),
        })
    }

    pub fn update_category_rule(&self, id: i64, pattern: &str, category: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE category_rules SET pattern=?1, category=?2 WHERE id=?3",
            params![pattern, category, id],
        )?;
        Ok(())
    }

    pub fn delete_category_rule(&self, id: i64) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM category_rules WHERE id=?1", params![id])?;
        Ok(())
    }
}
