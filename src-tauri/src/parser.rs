use regex::Regex;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParsedEmail {
    pub email_date: String,
    pub card_last_four: Option<String>,
    pub available_credit: Option<f64>,
    pub points_balance: Option<i64>,
    pub transactions: Vec<ParsedTransaction>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ParsedTransaction {
    pub time: String,
    pub amount: f64,
    pub currency: String,
    pub merchant: String,
    pub payment_method: Option<String>,
}

/// Parse a CMB daily bill HTML email and extract structured data
pub fn parse_email_html(html_body: &str) -> Option<ParsedEmail> {
    let document = Html::parse_document(html_body);

    // --- Extract date ---
    let date = extract_date(&document)?;

    // --- Extract available credit ---
    let available_credit = extract_available_credit(&document);

    // --- Extract points balance ---
    let points_balance = extract_points_balance(&document);

    // --- Extract card last four ---
    let card_last_four = extract_card_last_four(&document);

    // --- Extract transactions ---
    let transactions = extract_transactions(&document, &date);

    // --- Extract card tail number from transaction entries
    let card_last_four = card_last_four.or_else(|| extract_card_from_transactions(&document));

    Some(ParsedEmail {
        email_date: date,
        card_last_four,
        available_credit,
        points_balance,
        transactions,
    })
}

#[allow(dead_code)]
fn decode_quoted_printable(text: &str) -> String {
    // Handle quoted-printable encoded text
    // The =E6=B8=85... format
    let mut result = String::new();
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'=' && i + 2 < bytes.len() {
            if bytes[i + 1] == b'\r' || bytes[i + 1] == b'\n' {
                // Soft line break
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
            // =3D is the encoded '=' character
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

fn extract_date(document: &Html) -> Option<String> {
    let selector = Selector::parse("font").ok()?;
    for font in document.select(&selector) {
        let text = font.text().collect::<String>();
        // Pattern: "2026/05/21 您的消费明细如下："
        let re = Regex::new(r"(\d{4}/\d{2}/\d{2})").ok()?;
        if let Some(cap) = re.captures(&text) {
            let date = cap.get(1)?.as_str().to_string();
            // Convert to YYYY-MM-DD format
            return Some(date.replace('/', "-"));
        }
    }
    None
}

fn extract_available_credit(document: &Html) -> Option<f64> {
    // Look for the pattern ¥30,783.11 in the email
    let selector = Selector::parse("font").ok()?;
    for font in document.select(&selector) {
        let text = font.text().collect::<String>();
        let cleaned = text.trim();
        if cleaned.starts_with("￥") || cleaned.starts_with("¥") || cleaned.starts_with("&#165;") {
            // Parse numeric value like "￥30,783.11"
            let re = Regex::new(r"[0-9,]+\.?[0-9]*").ok()?;
            if let Some(m) = re.find(cleaned) {
                let num_str = m.as_str().replace(',', "");
                return num_str.parse::<f64>().ok();
            }
        }
    }
    None
}

fn extract_points_balance(document: &Html) -> Option<i64> {
    // The points balance is usually a plain number near "积分余额"
    let text = document.root_element().text().collect::<String>();
    // Find "积分余额" context
    let re = Regex::new(r"积分余额[\s\S]{0,100}?(\d{1,10})").ok()?;
    if let Some(cap) = re.captures(&text) {
        return cap.get(1)?.as_str().replace(',', "").parse::<i64>().ok();
    }
    None
}

fn extract_card_last_four(document: &Html) -> Option<String> {
    let text = document.root_element().text().collect::<String>();
    let re = Regex::new(r"尾号(\d{4})").ok()?;
    if let Some(cap) = re.captures(&text) {
        return Some(cap.get(1)?.as_str().to_string());
    }
    None
}

fn extract_card_from_transactions(document: &Html) -> Option<String> {
    let text = document.root_element().text().collect::<String>();
    let re = Regex::new(r"尾号(\d{4})\s*(消费|支出)").ok()?;
    if let Some(cap) = re.captures(&text) {
        return Some(cap.get(1)?.as_str().to_string());
    }
    None
}

fn extract_transactions(document: &Html, date: &str) -> Vec<ParsedTransaction> {
    let mut transactions = Vec::new();

    // Extract all font elements from the document
    let selector = Selector::parse("font").unwrap();
    let mut font_texts: Vec<String> = Vec::new();
    for font in document.select(&selector) {
        let text = font.text().collect::<String>().trim().to_string();
        if !text.is_empty() && text != "\u{a0}" {
            font_texts.push(text);
        }
    }

    // Look for time patterns followed by amounts and merchants
    let time_re = Regex::new(r"(\d{2}:\d{2}:\d{2})").unwrap();
    let amount_re = Regex::new(r"(?:CNY|RMB)\s*(\d+\.?\d*)").unwrap();
    let merchant_re = Regex::new(r"尾号\d+\s*(消费|支出|还款)\s*(.*)").unwrap();

    let mut i = 0;
    while i < font_texts.len() {
        let text = &font_texts[i];

        // Check if this font text contains a time
        if time_re.is_match(text) {
            let time = time_re
                .captures(text)
                .and_then(|c| c.get(1))
                .map(|m| m.as_str().to_string())
                .unwrap_or_default();

            // The amount might be in the same or next element
            let mut amount = None;
            let mut merchant = String::new();
            let mut payment_method: Option<String> = None;

            // Look ahead a few positions for amount and merchant
            let mut j = i + 1;
            while j < font_texts.len() && j <= i + 4 {
                let next = &font_texts[j];
                if amount.is_none() {
                    if let Some(cap) = amount_re.captures(next) {
                        amount = cap.get(1).and_then(|m| m.as_str().parse::<f64>().ok());
                    }
                }
                // Look for merchant info in the following texts
                if let Some(cap) = merchant_re.captures(next) {
                    let merchant_raw = cap.get(2).map(|m| m.as_str().trim()).unwrap_or("");
                    // Parse payment method from merchant text
                    if let Some(pm) = extract_payment_method(merchant_raw) {
                        payment_method = Some(pm.clone());
                        // Remove payment method prefix from merchant name
                        merchant = merchant_raw
                            .strip_prefix(&format!("{}-", pm))
                            .unwrap_or(merchant_raw)
                            .to_string();
                    } else {
                        merchant = merchant_raw.to_string();
                    }
                    break;
                }
                // Also check combined pattern in the same text
                if amount.is_none() && merchant.is_empty() {
                    if let Some(cap) = amount_re.captures(text) {
                        amount = cap.get(1).and_then(|m| m.as_str().parse::<f64>().ok());
                    }
                }
                j += 1;
            }

            if let Some(amt) = amount {
                transactions.push(ParsedTransaction {
                    time,
                    amount: amt,
                    currency: "CNY".to_string(),
                    merchant: merchant.clone(),
                    payment_method: payment_method.clone(),
                });
            }
        }
        i += 1;
    }

    // If no transactions found via structured parsing, try a more aggressive approach
    if transactions.is_empty() {
        transactions = extract_transactions_fallback(document, date);
    }

    transactions
}

fn extract_payment_method(text: &str) -> Option<String> {
    let methods = ["支付宝", "财付通", "微信支付", "银联", "云闪付", "Apple Pay"];
    for m in &methods {
        if text.contains(m) {
            return Some(m.to_string());
        }
    }
    // Common patterns in merchant names
    if text.starts_with("支付宝-") {
        return Some("支付宝".to_string());
    }
    if text.starts_with("财付通-") || text.starts_with("微信-") {
        return Some("微信支付".to_string());
    }
    None
}

fn extract_transactions_fallback(document: &Html, _date: &str) -> Vec<ParsedTransaction> {
    let mut transactions = Vec::new();
    let full_text = document.root_element().text().collect::<String>();

    // Split by common patterns and look for time + amount + merchant
    let re = Regex::new(r"(?s)(\d{2}:\d{2}:\d{2}).*?(?:CNY|RMB)\s*(\d+\.?\d*).*?尾号\d+\s*(?:消费|支出|还款)\s*(.*?)(?:\d{2}:\d{2}:\d{2}|\z)")
        .unwrap();

    for cap in re.captures_iter(&full_text) {
        let time = cap.get(1).map(|m| m.as_str()).unwrap_or("").to_string();
        let amount: f64 = cap
            .get(2)
            .and_then(|m| m.as_str().parse::<f64>().ok())
            .unwrap_or(0.0);
        let merchant_text = cap.get(3).map(|m| m.as_str().trim()).unwrap_or("").to_string();

        let pm = extract_payment_method(&merchant_text);
        let merchant = if let Some(ref method) = pm {
            merchant_text
                .strip_prefix(&format!("{}-", method))
                .or_else(|| merchant_text.strip_prefix(&format!("{}=", method)))
                .unwrap_or(&merchant_text)
                .to_string()
        } else {
            merchant_text.clone()
        };

        if amount > 0.0 {
            transactions.push(ParsedTransaction {
                time,
                amount,
                currency: "CNY".to_string(),
                merchant: merchant.trim_matches(|c: char| c.is_whitespace() || c == '\n').to_string(),
                payment_method: pm,
            });
        }
    }

    transactions
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_transaction_lines() {
        let html = r#"
        <html>
        <body>
            <font>2026/05/21 您的消费明细如下：</font>
            <font>¥30,783.11</font>
            <font>1,696</font>
            <font>09:10:46</font>
            <font>CNY 3.00</font>
            <font>尾号3740 消费 支付宝-北京礼信年年餐饮管理有限公司</font>
            <font>10:14:34</font>
            <font>CNY 16.00</font>
            <font>尾号3740 消费 支付宝-阿里巴巴（中国）有限公司</font>
        </body>
        </html>
        "#;

        let result = parse_email_html(html);
        assert!(result.is_some(), "Should parse successfully");
        let parsed = result.unwrap();
        assert_eq!(parsed.email_date, "2026-05-21");
        assert_eq!(parsed.transactions.len(), 2);
        assert_eq!(parsed.transactions[0].amount, 3.00);
        assert_eq!(parsed.transactions[1].amount, 16.00);
    }
}
