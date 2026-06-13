use regex::Regex;
use scraper::Html;
use serde::{Deserialize, Serialize};
use crate::db::ParserProfile;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParseResult {
    pub email_date: Option<String>,
    pub available_credit: Option<f64>,
    pub points_balance: Option<i64>,
    pub card_last_four: Option<String>,
    pub transactions: Vec<ParsedTransaction>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParsedTransaction {
    pub transaction_time: String,
    pub amount: f64,
    pub currency: String,
    pub merchant: String,
    pub payment_method: Option<String>,
}

// ===== Public API =====

/// Parse CMB daily bill HTML using ParserProfile regex patterns.
/// Falls back to legacy DOM-based extraction when profile regexes don't match.
pub fn parse_email_html(html: &str, profile: &ParserProfile) -> ParseResult {
    let document = Html::parse_document(html);
    let full_text = document.root_element().text().collect::<String>();

    // 1. Extract date: try profile regex first, fallback to old method
    let email_date = extract_date_with_profile(&full_text, profile)
        .or_else(|| extract_date_fallback(&document));

    // 2. Extract card last four: try profile regex first, fallback to old method
    let card_last_four = extract_card_last_four_with_profile(&full_text, profile)
        .or_else(|| extract_card_last_four_fallback(&document))
        .or_else(|| extract_card_from_transactions_fallback(&document));

    // 3. Extract transactions using profile regexes
    let transactions = extract_transactions(&full_text, profile);

    // 4. Available credit: DOM-based fallback (no credit regex in profile yet)
    let available_credit = extract_available_credit_fallback(&document);

    // 5. Points balance: DOM-based fallback (no points regex in profile yet)
    let points_balance = extract_points_balance_fallback(&document);

    ParseResult {
        email_date,
        available_credit,
        points_balance,
        card_last_four,
        transactions,
    }
}

/// Returns a default CMB ParserProfile for backward compatibility
#[allow(dead_code)]
fn default_cmb_profile() -> ParserProfile {
    ParserProfile {
        id: 0,
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

// ===== Profile-based extraction =====

fn extract_date_with_profile(text: &str, profile: &ParserProfile) -> Option<String> {
    let re = Regex::new(&profile.date_regex).ok()?;
    let cap = re.captures(text)?;
    let date = cap.get(0)?.as_str().to_string();
    // Convert YYYY/MM/DD to YYYY-MM-DD
    Some(date.replace('/', "-"))
}

fn extract_card_last_four_with_profile(text: &str, profile: &ParserProfile) -> Option<String> {
    let re = Regex::new(&profile.card_last_four_regex).ok()?;
    let cap = re.captures(text)?;
    cap.get(1).map(|m| m.as_str().to_string())
}

fn extract_transactions(text: &str, profile: &ParserProfile) -> Vec<ParsedTransaction> {
    let time_re = match Regex::new(&profile.time_regex) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };
    let amount_re = match Regex::new(&profile.amount_regex) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };
    let merchant_re = match Regex::new(&profile.merchant_regex) {
        Ok(r) => r,
        Err(_) => return Vec::new(),
    };

    let mut transactions = Vec::new();

    // Find all time matches as anchor points
    for time_match in time_re.find_iter(text) {
        let time = time_match.as_str().to_string();

        // Search for amount and merchant in the text after this time position
        let after = &text[time_match.end()..];

        let amount = amount_re
            .captures(after)
            .and_then(|cap| cap.get(1))
            .and_then(|m| m.as_str().replace(',', "").parse::<f64>().ok());

        let merchant_raw = merchant_re
            .captures(after)
            .and_then(|cap| cap.get(1))
            .map(|m| m.as_str().trim().to_string());

        if let (Some(amt), Some(merchant_text)) = (amount, merchant_raw) {
            let payment_method = extract_payment_method(&merchant_text);

            // Clean merchant name: remove payment method prefix if present
            let merchant = if let Some(ref pm) = payment_method {
                merchant_text
                    .strip_prefix(&format!("{}-", pm))
                    .or_else(|| merchant_text.strip_prefix(&format!("{}=", pm)))
                    .unwrap_or(&merchant_text)
                    .to_string()
            } else {
                merchant_text
            };

            transactions.push(ParsedTransaction {
                transaction_time: time,
                amount: amt,
                currency: "CNY".to_string(),
                merchant: merchant.trim().to_string(),
                payment_method,
            });
        }
    }

    transactions
}

fn extract_payment_method(merchant: &str) -> Option<String> {
    let methods = [
        "支付宝", "财付通", "微信支付", "银联", "云闪付",
        "Apple Pay", "美团支付", "京东支付",
    ];
    for m in &methods {
        if merchant.contains(m) {
            return Some(m.to_string());
        }
    }
    // Common patterns in merchant names
    if merchant.starts_with("支付宝-") {
        return Some("支付宝".to_string());
    }
    if merchant.starts_with("财付通-") || merchant.starts_with("微信-") {
        return Some("微信支付".to_string());
    }
    None
}

// ===== Legacy DOM-based fallback functions =====

fn extract_date_fallback(document: &Html) -> Option<String> {
    let selector = scraper::Selector::parse("font").ok()?;
    for font in document.select(&selector) {
        let text = font.text().collect::<String>();
        let re = Regex::new(r"(\d{4}/\d{2}/\d{2})").ok()?;
        if let Some(cap) = re.captures(&text) {
            let date = cap.get(1)?.as_str().to_string();
            return Some(date.replace('/', "-"));
        }
    }
    None
}

fn extract_available_credit_fallback(document: &Html) -> Option<f64> {
    let selector = scraper::Selector::parse("font").ok()?;
    for font in document.select(&selector) {
        let text = font.text().collect::<String>();
        let cleaned = text.trim();
        if cleaned.starts_with('\u{ffe5}') || cleaned.starts_with('\u{00a5}') || cleaned.starts_with("&#165;") {
            let re = Regex::new(r"[0-9,]+\.?[0-9]*").ok()?;
            if let Some(m) = re.find(cleaned) {
                let num_str = m.as_str().replace(',', "");
                return num_str.parse::<f64>().ok();
            }
        }
    }
    None
}

fn extract_points_balance_fallback(document: &Html) -> Option<i64> {
    let text = document.root_element().text().collect::<String>();
    let re = Regex::new(r"积分余额[\s\S]{0,100}?(\d{1,10})").ok()?;
    if let Some(cap) = re.captures(&text) {
        return cap.get(1)?.as_str().replace(',', "").parse::<i64>().ok();
    }
    None
}

fn extract_card_last_four_fallback(document: &Html) -> Option<String> {
    let text = document.root_element().text().collect::<String>();
    let re = Regex::new(r"尾号(\d{4})").ok()?;
    if let Some(cap) = re.captures(&text) {
        return Some(cap.get(1)?.as_str().to_string());
    }
    None
}

fn extract_card_from_transactions_fallback(document: &Html) -> Option<String> {
    let text = document.root_element().text().collect::<String>();
    let re = Regex::new(r"尾号(\d{4})\s*(消费|支出)").ok()?;
    if let Some(cap) = re.captures(&text) {
        return Some(cap.get(1)?.as_str().to_string());
    }
    None
}

// ===== Quoted-printable decoder (kept for future use) =====

#[allow(dead_code)]
fn decode_quoted_printable(text: &str) -> String {
    let mut result = String::new();
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'=' && i + 2 < bytes.len() {
            if bytes[i + 1] == b'\r' || bytes[i + 1] == b'\n' {
                i += 2;
                if i < bytes.len() && bytes[i] == b'\n' {
                    i += 1;
                }
                continue;
            }
            if let (Some(h1), Some(h2)) = (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                result.push((h1 << 4 | h2) as char);
                i += 3;
                continue;
            }
        }
        if bytes[i] == b'=' && i + 4 < bytes.len() && bytes[i + 1] == b'3' && bytes[i + 2] == b'D' {
            result.push('=');
            i += 3;
            continue;
        }
        result.push(bytes[i] as char);
        i += 1;
    }
    result
}

#[allow(dead_code)]
fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'A'..=b'F' => Some(b - b'A' + 10),
        b'a'..=b'f' => Some(b - b'a' + 10),
        _ => None,
    }
}

// ===== Tests =====

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_with_profile() {
        let html = r#"
        <html>
        <body>
            <font>2026/05/21 您的消费明细如下：</font>
            <font>￥30,783.11</font>
            <font>积分余额 1,696</font>
            <font>09:10:46</font>
            <font>CNY 3.00</font>
            <font>尾号3740 消费 支付宝-北京礼信年年餐饮管理有限公司</font>
            <font>10:14:34</font>
            <font>CNY 16.00</font>
            <font>尾号3740 消费 支付宝-阿里巴巴（中国）有限公司</font>
        </body>
        </html>
        "#;

        let profile = default_cmb_profile();
        let result = parse_email_html(html, &profile);

        assert_eq!(result.email_date.as_deref(), Some("2026-05-21"));
        assert!(result.available_credit.is_some());
        assert_eq!(result.transactions.len(), 2);
        assert_eq!(result.transactions[0].amount, 3.00);
        assert_eq!(result.transactions[0].transaction_time, "09:10:46");
        assert_eq!(result.transactions[1].amount, 16.00);
        assert_eq!(result.transactions[1].transaction_time, "10:14:34");
    }

    #[test]
    fn test_extract_payment_method() {
        assert_eq!(extract_payment_method("支付宝-北京礼信年年餐饮管理有限公司"), Some("支付宝".to_string()));
        assert_eq!(extract_payment_method("财付通-深圳腾讯"), Some("财付通".to_string()));
        assert_eq!(extract_payment_method("微信-某某商户"), Some("微信支付".to_string()));
        assert_eq!(extract_payment_method("美团支付-外卖"), Some("美团支付".to_string()));
        assert_eq!(extract_payment_method("京东支付-商城"), Some("京东支付".to_string()));
        assert_eq!(extract_payment_method("普通商户"), None);
    }
}
