use crate::db::{Database, Card, CardDetail, CategoryRule, EnrichedDailySummary, Transaction, MonthlySummary, CategoryBreakdown, CreditTrend, DailySummary, PaginatedResult, SyncState, ParserProfile, DashboardData, YearlyTotal, PaymentMethodBreakdown};
use crate::gmail::{GmailConfig, GmailSyncResult};
use crate::parser::{parse_email_html, ParseResult};
use std::sync::Arc;
use std::sync::Mutex as StdMutex;

type GmailState = Arc<StdMutex<crate::gmail::GmailClient>>;

fn default_cmb_profile() -> ParserProfile {
    ParserProfile {
        id: 1,
        name: "招商银行每日信用管家".to_string(),
        is_builtin: true,
        sender_pattern: "ccsvc@message.cmbchina.com".to_string(),
        subject_pattern: "每日信用管家".to_string(),
        date_regex: r"\d{4}/\d{2}/\d{2}".to_string(),
        time_regex: r"\d{2}:\d{2}:\d{2}".to_string(),
        amount_regex: r"(?:CNY|RMB)\s*([\d,]+\.?\d*)".to_string(),
        card_last_four_regex: r"尾号(\d+)".to_string(),
        merchant_regex: r"尾号\d+\s*(?:消费|支出|还款)\s*(.+)".to_string(),
        created_at: String::new(),
    }
}

#[tauri::command]
pub async fn get_cards(db: tauri::State<'_, Arc<Database>>) -> Result<Vec<Card>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_cards().map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_card(db: tauri::State<'_, Arc<Database>>, name: String, last_four: String) -> Result<Card, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.create_card(&name, &last_four).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn delete_card(db: tauri::State<'_, Arc<Database>>, card_id: i64) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.delete_card(card_id).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn parse_email_content(html_content: String) -> Result<ParseResult, String> {
    tokio::task::spawn_blocking(move || {
        let profile = default_cmb_profile();
        let result = parse_email_html(&html_content, &profile);
        if result.email_date.is_none() && result.transactions.is_empty() {
            Err("无法解析邮件内容，请确认是招商银行每日信用管家邮件".to_string())
        } else {
            Ok(result)
        }
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn import_email(
    db: tauri::State<'_, Arc<Database>>,
    card_id: i64,
    html_content: String,
    email_uid: String,
) -> Result<String, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        // Look up card's parser_profile, fall back to default CMB
        let profile = db.get_card(card_id)
            .map_err(|e| e.to_string())?
            .and_then(|card| db.get_parser_profile_by_name(&card.parser_profile).ok().flatten())
            .unwrap_or_else(default_cmb_profile);

        let parsed = parse_email_html(&html_content, &profile);

        let email_date = parsed.email_date
            .ok_or_else(|| "无法解析邮件日期，请确认是招商银行每日信用管家邮件".to_string())?;

        let summary_id = db.upsert_daily_summary(
            card_id,
            &email_date,
            parsed.available_credit,
            parsed.points_balance,
            &email_uid,
            Some(&html_content),
        ).map_err(|e| e.to_string())?;

        let mut tx_count = 0;
        for tx in &parsed.transactions {
            db.insert_transaction(
                card_id,
                summary_id,
                &email_date,
                Some(&tx.transaction_time),
                tx.amount,
                &tx.currency,
                &tx.merchant,
                tx.payment_method.as_deref(),
            ).map_err(|e| e.to_string())?;
            tx_count += 1;
        }

        Ok(format!("成功导入 {} 的交易: 日汇总 + {} 笔交易", email_date, tx_count))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_transactions(
    db: tauri::State<'_, Arc<Database>>,
    card_id: Option<i64>,
    date_from: Option<String>,
    date_to: Option<String>,
    category: Option<String>,
    payment_method: Option<String>,
    merchant: Option<String>,
    amount_min: Option<f64>,
    amount_max: Option<f64>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedResult<Transaction>, String> {
    let db = db.inner().clone();
    let p = page.unwrap_or(1);
    let ps = page_size.unwrap_or(50);
    tokio::task::spawn_blocking(move || {
        db.get_transactions(card_id, date_from.as_deref(), date_to.as_deref(), category.as_deref(), payment_method.as_deref(), merchant.as_deref(), amount_min, amount_max, p, ps)
            .map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn update_transaction_category(
    db: tauri::State<'_, Arc<Database>>,
    transaction_id: i64,
    category: String,
) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.update_transaction_category(transaction_id, &category)
            .map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_monthly_summary(
    db: tauri::State<'_, Arc<Database>>,
    card_id: Option<i64>,
    year: i32,
) -> Result<Vec<MonthlySummary>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_monthly_summary(card_id, year).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_category_breakdown(
    db: tauri::State<'_, Arc<Database>>,
    card_id: Option<i64>,
    date_from: String,
    date_to: String,
) -> Result<Vec<CategoryBreakdown>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_category_breakdown(card_id, &date_from, &date_to).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_credit_trend(
    db: tauri::State<'_, Arc<Database>>,
    card_id: Option<i64>,
    date_from: String,
    date_to: String,
) -> Result<Vec<CreditTrend>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_credit_trend(card_id, &date_from, &date_to).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_sync_state(db: tauri::State<'_, Arc<Database>>) -> Result<SyncState, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_sync_state().map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn export_csv(
    db: tauri::State<'_, Arc<Database>>,
    path: String,
    card_id: Option<i64>,
) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.export_csv(&path, card_id)
    }).await.map_err(|e| e.to_string())?
}

// ===== Gmail Commands =====

#[tauri::command]
pub async fn gmail_save_config(
    gmail: tauri::State<'_, GmailState>,
    client_id: String,
    client_secret: String,
    redirect_port: Option<u16>,
) -> Result<(), String> {
    let gmail = gmail.inner().clone();
    tokio::task::spawn_blocking(move || {
        let client = gmail.lock().map_err(|e| e.to_string())?;
        let secret = if client_secret.is_empty() {
            let existing = client.get_config()
                .ok_or("No existing config found. Please provide Client Secret.")?;
            existing.client_secret
        } else {
            client_secret
        };
        let config = GmailConfig {
            client_id,
            client_secret: secret,
            redirect_port: redirect_port.unwrap_or(8401),
        };
        client.save_config(config)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gmail_get_config(
    gmail: tauri::State<'_, GmailState>,
) -> Result<serde_json::Value, String> {
    let gmail = gmail.inner().clone();
    tokio::task::spawn_blocking(move || {
        let client = gmail.lock().map_err(|e| e.to_string())?;
        match client.get_config() {
            Some(config) => Ok(serde_json::json!({
                "client_id": config.client_id,
                "redirect_port": config.redirect_port,
                "configured": true,
            })),
            None => Ok(serde_json::json!({ "configured": false })),
        }
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gmail_get_auth_url(
    gmail: tauri::State<'_, GmailState>,
) -> Result<String, String> {
    let gmail = gmail.inner().clone();
    tokio::task::spawn_blocking(move || {
        let client = gmail.lock().map_err(|e| e.to_string())?;
        client.get_auth_url()
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gmail_exchange_code(
    gmail: tauri::State<'_, GmailState>,
    code: String,
) -> Result<serde_json::Value, String> {
    let gmail = gmail.inner().clone();
    tokio::task::spawn_blocking(move || {
        let client = gmail.lock().map_err(|e| e.to_string())?;
        let tokens = client.exchange_code(&code)?;
        Ok(serde_json::json!({
            "success": true,
            "has_refresh_token": !tokens.refresh_token.is_empty(),
        }))
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gmail_is_authenticated(
    gmail: tauri::State<'_, GmailState>,
) -> Result<bool, String> {
    let gmail = gmail.inner().clone();
    tokio::task::spawn_blocking(move || {
        let client = gmail.lock().map_err(|e| e.to_string())?;
        Ok(client.is_authenticated())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gmail_disconnect(
    gmail: tauri::State<'_, GmailState>,
) -> Result<(), String> {
    let gmail = gmail.inner().clone();
    tokio::task::spawn_blocking(move || {
        let client = gmail.lock().map_err(|e| e.to_string())?;
        client.disconnect()
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gmail_sync_incremental(
    db: tauri::State<'_, Arc<Database>>,
    gmail: tauri::State<'_, GmailState>,
    card_id: i64,
) -> Result<GmailSyncResult, String> {
    let db = db.inner().clone();
    let gmail = gmail.inner().clone();
    tokio::task::spawn_blocking(move || {
        let latest = db.get_latest_summary_date(card_id).map_err(|e| e.to_string())?;
        sync_emails(&db, &gmail, card_id, latest.as_deref(), true)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn gmail_sync_full(
    db: tauri::State<'_, Arc<Database>>,
    gmail: tauri::State<'_, GmailState>,
    card_id: i64,
) -> Result<GmailSyncResult, String> {
    let db = db.inner().clone();
    let gmail = gmail.inner().clone();
    tokio::task::spawn_blocking(move || {
        sync_emails(&db, &gmail, card_id, None, true)
    }).await.map_err(|e| e.to_string())?
}

fn sync_emails(
    db: &Database,
    gmail: &GmailState,
    card_id: i64,
    since_date: Option<&str>,
    skip_existing: bool,
) -> Result<GmailSyncResult, String> {
    let client = gmail.lock().map_err(|e| e.to_string())?;

    let mut result = GmailSyncResult {
        success: true,
        new_summaries: 0,
        new_transactions: 0,
        errors: Vec::new(),
    };

    let messages = match client.list_cmb_messages(since_date) {
        Ok(msgs) => msgs,
        Err(e) => {
            return Err(format!("Failed to list Gmail messages: {}", e));
        }
    };

    if messages.is_empty() {
        let msg = if since_date.is_some() {
            "没有新的招商银行邮件需要同步。"
        } else {
            "未在 Gmail 中找到招商银行的邮件。请确认您的 Gmail 收件箱中有来自 ccsvc@message.cmbchina.com 的邮件。"
        };
        return Err(msg.to_string());
    }

    // Look up card's parser_profile once for all messages
    let profile = db.get_card(card_id)
        .map_err(|e| e.to_string())?
        .and_then(|card| db.get_parser_profile_by_name(&card.parser_profile).ok().flatten())
        .unwrap_or_else(default_cmb_profile);

    for msg in &messages {
        let html = match client.get_message_html(&msg.id) {
            Ok(h) => h,
            Err(e) => {
                result.errors.push(format!("Failed to get message {}: {}", msg.id, e));
                continue;
            }
        };

        let parsed = parse_email_html(&html, &profile);

        let email_date = match parsed.email_date {
            Some(d) => d,
            None => {
                result.errors.push(format!("Failed to parse date from message {}", msg.id));
                continue;
            }
        };

        if skip_existing
            && db.get_daily_summaries(None, 1, 1000)
                .map(|r| r.items.iter().any(|s| s.email_uid == msg.id))
                .unwrap_or(false)
        {
            continue;
        }

        let summary_id = match db.upsert_daily_summary(
            card_id,
            &email_date,
            parsed.available_credit,
            parsed.points_balance,
            &msg.id,
            Some(&html),
        ) {
            Ok(id) => id,
            Err(e) => {
                result.errors.push(format!("DB error for {}: {}", msg.id, e));
                continue;
            }
        };

        result.new_summaries += 1;

        for tx in &parsed.transactions {
            if let Err(e) = db.insert_transaction(
                card_id,
                summary_id,
                &email_date,
                Some(&tx.transaction_time),
                tx.amount,
                &tx.currency,
                &tx.merchant,
                tx.payment_method.as_deref(),
            ) {
                result.errors.push(format!("DB error for transaction: {}", e));
            } else {
                result.new_transactions += 1;
            }
        }
    }

    if let Err(e) = db.update_sync_state() {
        result.errors.push(format!("Failed to update sync state: {}", e));
    }

    Ok(result)
}

// ===== Email Management =====

#[tauri::command]
pub async fn get_all_daily_summaries(
    db: tauri::State<'_, Arc<Database>>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<PaginatedResult<DailySummary>, String> {
    let db = db.inner().clone();
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    tokio::task::spawn_blocking(move || {
        db.get_daily_summaries(None, limit, offset).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_raw_email(
    db: tauri::State<'_, Arc<Database>>,
    summary_id: i64,
) -> Result<Option<String>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_raw_email(summary_id).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

// ===== Parser Profiles =====

#[tauri::command]
pub fn get_parser_profiles(
    db: tauri::State<'_, Arc<Database>>,
) -> Result<Vec<ParserProfile>, String> {
    db.get_parser_profiles().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_parser_profile(
    db: tauri::State<'_, Arc<Database>>,
    profile: ParserProfile,
) -> Result<i64, String> {
    db.create_parser_profile(&profile).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_parser_profile(
    db: tauri::State<'_, Arc<Database>>,
    profile: ParserProfile,
) -> Result<(), String> {
    db.update_parser_profile(&profile).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_parser_profile(
    db: tauri::State<'_, Arc<Database>>,
    id: i64,
) -> Result<(), String> {
    db.delete_parser_profile(id).map_err(|e| e.to_string())
}

// ===== Dashboard =====

#[tauri::command]
pub async fn get_dashboard_data(
    db: tauri::State<'_, Arc<Database>>,
    card_ids: Vec<i64>,
    year: i32,
) -> Result<DashboardData, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_dashboard_data(&card_ids, year).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

// ===== Statistics =====

#[tauri::command]
pub async fn get_yearly_totals(
    db: tauri::State<'_, Arc<Database>>,
    card_id: Option<i64>,
) -> Result<Vec<YearlyTotal>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_yearly_totals(card_id).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_payment_method_breakdown(
    db: tauri::State<'_, Arc<Database>>,
    card_id: Option<i64>,
    date_from: String,
    date_to: String,
) -> Result<Vec<PaymentMethodBreakdown>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_payment_method_breakdown(card_id, &date_from, &date_to).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

// ===== Card Detail =====

#[tauri::command]
pub async fn get_card_detail(
    db: tauri::State<'_, Arc<Database>>,
    card_id: i64,
) -> Result<Option<CardDetail>, String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.get_card_detail(card_id).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn update_card(
    db: tauri::State<'_, Arc<Database>>,
    id: i64,
    name: String,
    last_four: String,
    bank: String,
    parser_profile: String,
    color: String,
    sync_method: Option<String>,
    sync_config: Option<String>,
) -> Result<(), String> {
    let db = db.inner().clone();
    tokio::task::spawn_blocking(move || {
        db.update_card(id, &name, &last_four, &bank, &parser_profile, &color, sync_method.as_deref(), sync_config.as_deref())
            .map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

// ===== Enriched Daily Summaries =====

#[tauri::command]
pub async fn get_enriched_daily_summaries(
    db: tauri::State<'_, Arc<Database>>,
    card_id: Option<i64>,
    page: Option<i64>,
    page_size: Option<i64>,
) -> Result<PaginatedResult<EnrichedDailySummary>, String> {
    let db = db.inner().clone();
    let p = page.unwrap_or(1);
    let ps = page_size.unwrap_or(20);
    tokio::task::spawn_blocking(move || {
        db.get_enriched_daily_summaries(card_id, p, ps).map_err(|e| e.to_string())
    }).await.map_err(|e| e.to_string())?
}

// ===== Category Rules =====

#[tauri::command]
pub fn get_category_rules(
    db: tauri::State<'_, Arc<Database>>,
) -> Result<Vec<CategoryRule>, String> {
    db.get_category_rules().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_category_rule(
    db: tauri::State<'_, Arc<Database>>,
    pattern: String,
    category: String,
) -> Result<CategoryRule, String> {
    db.add_category_rule(&pattern, &category).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_category_rule(
    db: tauri::State<'_, Arc<Database>>,
    id: i64,
    pattern: String,
    category: String,
) -> Result<(), String> {
    db.update_category_rule(id, &pattern, &category).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_category_rule(
    db: tauri::State<'_, Arc<Database>>,
    id: i64,
) -> Result<(), String> {
    db.delete_category_rule(id).map_err(|e| e.to_string())
}
