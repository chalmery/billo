use chrono::Datelike;
use log::info;
use reqwest::blocking::Client as HttpClient;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

const GMAIL_READONLY_SCOPE: &str = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GmailConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_port: u16,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GmailTokens {
    pub access_token: String,
    pub refresh_token: String,
    pub token_expiry: i64,
    pub obtained_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailSyncResult {
    pub success: bool,
    pub new_summaries: i64,
    pub new_transactions: i64,
    pub total_found: i64,
    pub total_skipped: i64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct MessageContent {
    pub html: String,
    pub internal_date: Option<String>,
}

pub struct GmailClient {
    config: Mutex<Option<GmailConfig>>,
    tokens: Mutex<Option<GmailTokens>>,
    http: HttpClient,
    token_path: PathBuf,
    config_path: PathBuf,
}

impl GmailClient {
    pub fn new(app_data_dir: &PathBuf) -> Self {
        let token_path = app_data_dir.join("gmail_tokens.json");
        let config_path = app_data_dir.join("gmail_config.json");

        let tokens = fs::read_to_string(&token_path)
            .ok()
            .and_then(|s| serde_json::from_str::<GmailTokens>(&s).ok());

        let config = fs::read_to_string(&config_path)
            .ok()
            .and_then(|s| serde_json::from_str::<GmailConfig>(&s).ok());

        if tokens.is_some() {
            info!("Gmail tokens loaded from disk");
        }
        if config.is_some() {
            info!("Gmail config loaded from disk");
        }

        Self {
            config: Mutex::new(config),
            tokens: Mutex::new(tokens),
            http: HttpClient::new(),
            token_path,
            config_path,
        }
    }

    pub fn save_config(&self, config: GmailConfig) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        fs::write(&self.config_path, json).map_err(|e| e.to_string())?;
        *self.config.lock().unwrap() = Some(config);
        info!("Gmail config saved");
        Ok(())
    }

    pub fn get_config(&self) -> Option<GmailConfig> {
        self.config.lock().unwrap().clone()
    }

    #[allow(dead_code)]
pub fn is_configured(&self) -> bool {
        self.config.lock().unwrap().is_some()
    }

    pub fn get_auth_url(&self) -> Result<String, String> {
        let config = self.config.lock().unwrap()
            .clone()
            .ok_or("Gmail 未配置，请先设置 client_id 和 client_secret")?;

        let redirect_uri = format!("http://127.0.0.1:{}/callback", config.redirect_port);
        Ok(format!(
            "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
            GOOGLE_AUTH_URL,
            urlencoding_encode(&config.client_id),
            urlencoding_encode(&redirect_uri),
            urlencoding_encode(GMAIL_READONLY_SCOPE),
        ))
    }

    pub fn exchange_code(&self, code: &str) -> Result<GmailTokens, String> {
        let config = self.config.lock().unwrap()
            .clone()
            .ok_or("Gmail 未配置")?;

        let redirect_uri = format!("http://127.0.0.1:{}/callback", config.redirect_port);

        let resp = self.http
            .post(GOOGLE_TOKEN_URL)
            .form(&[
                ("code", code.to_string()),
                ("client_id", config.client_id.clone()),
                ("client_secret", config.client_secret.clone()),
                ("redirect_uri", redirect_uri),
                ("grant_type", "authorization_code".to_string()),
            ])
            .send()
            .map_err(|e| format!("Token request failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().unwrap_or_default();
            return Err(format!("Token exchange failed: {}", body));
        }

        #[derive(Deserialize)]
        struct TokenResponse {
            access_token: String,
            refresh_token: Option<String>,
            expires_in: Option<i64>,
        }

        let token_resp: TokenResponse = resp.json().map_err(|e| format!("Parse token response: {}", e))?;
        let now = chrono::Utc::now().timestamp();

        let tokens = GmailTokens {
            access_token: token_resp.access_token,
            refresh_token: token_resp.refresh_token.unwrap_or_default(),
            token_expiry: now + token_resp.expires_in.unwrap_or(3600),
            obtained_at: now,
        };

        self.save_tokens(&tokens)?;
        *self.tokens.lock().unwrap() = Some(tokens.clone());
        info!("Gmail OAuth2 tokens obtained");
        Ok(tokens)
    }

    pub fn get_access_token(&self) -> Result<String, String> {
        let mut tokens_guard = self.tokens.lock().unwrap();
        let tokens = tokens_guard.as_ref()
            .ok_or("未授权 Gmail，请先完成 OAuth 授权")?;

        let now = chrono::Utc::now().timestamp();
        if tokens.token_expiry > now + 300 {
            return Ok(tokens.access_token.clone());
        }

        if tokens.refresh_token.is_empty() {
            return Err("Access token expired and no refresh token. Please re-authorize.".to_string());
        }

        let config = self.config.lock().unwrap()
            .clone()
            .ok_or("Gmail 未配置")?;

        let resp = self.http
            .post(GOOGLE_TOKEN_URL)
            .form(&[
                ("refresh_token", tokens.refresh_token.clone()),
                ("client_id", config.client_id.clone()),
                ("client_secret", config.client_secret.clone()),
                ("grant_type", "refresh_token".to_string()),
            ])
            .send()
            .map_err(|e| format!("Refresh request failed: {}", e))?;

        if !resp.status().is_success() {
            let body = resp.text().unwrap_or_default();
            return Err(format!("Token refresh failed: {}", body));
        }

        #[derive(Deserialize)]
        struct RefreshResponse {
            access_token: String,
            expires_in: Option<i64>,
        }

        let refresh_resp: RefreshResponse = resp.json().map_err(|e| format!("Parse refresh: {}", e))?;

        let new_tokens = GmailTokens {
            access_token: refresh_resp.access_token.clone(),
            refresh_token: tokens.refresh_token.clone(),
            token_expiry: now + refresh_resp.expires_in.unwrap_or(3600),
            obtained_at: now,
        };

        let access_token = new_tokens.access_token.clone();
        self.save_tokens(&new_tokens)?;
        *tokens_guard = Some(new_tokens);
        info!("Gmail access token refreshed");
        Ok(access_token)
    }

    /// List CMB messages using time-range segmentation to bypass Gmail API's
    /// ~500 result limit on `q` parameter searches.
    ///
    /// The query is split into half-year windows so each segment returns <500
    /// results, and all segments are merged with deduplication.
    pub fn list_cmb_messages(&self, since_date: Option<&str>) -> Result<Vec<String>, String> {
        let access_token = self.get_access_token()?;

        // Build base query: from CMB + subject filter
        let base_query = format!(
            "from:{} subject:{}",
            "ccsvc@message.cmbchina.com",
            "每日信用管家"
        );

        // Determine date range for segmentation.
        // For incremental sync, extend start_date backwards by 7 days so we
        // catch any emails that were missed near the boundary (Gmail after: is
        // exclusive, and a previous sync may have skipped some messages).
        let start_date = if let Some(d) = since_date {
            let d = d.replace('-', "/");
            gmail_date_subtract_days(&d, 7)
        } else {
            "2015/01/01".to_string()
        };

        // Use local time +1 day so `before:` includes today's emails
        // (Gmail's before:date is exclusive; to include today we need tomorrow)
        let tomorrow = chrono::Local::now().date_naive() + chrono::TimeDelta::days(1);
        let end_date = format!(
            "{}/{:02}/{:02}",
            tomorrow.year(),
            tomorrow.month() as u32,
            tomorrow.day() as u32
        );

        // Generate half-year time segments to keep each query under 500 results
        let segments = generate_time_segments(&start_date, &end_date);

        let mut all_ids: Vec<String> = Vec::new();
        let mut seen_ids: HashSet<String> = HashSet::new();

        for segment in &segments {
            // Gmail's after: is exclusive, so shift back 1 day to include the
            // segment start date itself. This also prevents boundary dates from
            // falling between adjacent segments.
            let after_date = gmail_date_subtract_days(&segment.start, 1);
            let query = format!(
                "{} after:{} before:{}",
                base_query, after_date, segment.end
            );
            info!("Gmail list segment query: {}", query);

            let mut page_token: Option<String> = None;

            loop {
                let mut url = format!(
                    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q={}&maxResults=500",
                    urlencoding_encode(&query),
                );
                if let Some(ref token) = page_token {
                    url.push_str(&format!("&pageToken={}", token));
                }

                let response = self.http
                    .get(&url)
                    .bearer_auth(&access_token)
                    .send()
                    .map_err(|e| format!("Gmail API request failed: {}", e))?;

                if !response.status().is_success() {
                    let status = response.status();
                    let body = response.text().unwrap_or_default();
                    // Treat 4xx as "no results for this segment", continue to next
                    if status.as_u16() >= 400 && status.as_u16() < 500 {
                        info!("Gmail segment {} - {} returned {}, skipping", segment.start, segment.end, status);
                        break;
                    }
                    return Err(format!("Gmail API error {}: {}", status, body));
                }

                #[derive(Deserialize)]
                struct ListResponse {
                    messages: Option<Vec<MessageId>>,
                    #[serde(default)]
                    next_page_token: Option<String>,
                }
                #[derive(Deserialize)]
                struct MessageId {
                    id: String,
                }

                let list_resp: ListResponse = response.json().map_err(|e| format!("Parse Gmail list: {}", e))?;
                let messages = list_resp.messages.unwrap_or_default();
                let mut segment_count = 0;

                for msg in &messages {
                    if seen_ids.insert(msg.id.clone()) {
                        all_ids.push(msg.id.clone());
                        segment_count += 1;
                    }
                }

                info!("Gmail segment {} - {}: {} new messages (page had {})", segment.start, segment.end, segment_count, messages.len());

                match list_resp.next_page_token {
                    Some(token) => page_token = Some(token),
                    None => break,
                }
            }
        }

        info!("Gmail total CMB messages found across all segments: {}", all_ids.len());
        Ok(all_ids)
    }

    /// Fetch a single message's HTML content and internal date by ID.
    pub fn get_message(&self, message_id: &str) -> Result<MessageContent, String> {
        let access_token = self.get_access_token()?;
        let url = format!("https://gmail.googleapis.com/gmail/v1/users/me/messages/{}?format=full", message_id);

        let response = self.http
            .get(&url)
            .bearer_auth(&access_token)
            .send()
            .map_err(|e| format!("Gmail API request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Gmail API error: {}", response.status()));
        }

        let full_msg: serde_json::Value = response.json().map_err(|e| format!("Parse error: {}", e))?;

        let internal_date = parse_internal_date(&full_msg);

        let html = extract_html_from_message(&full_msg)?;
        Ok(MessageContent { html, internal_date })
    }

    /// Batch-fetch HTML content for multiple messages using Gmail's batch endpoint.
    /// Processes message IDs in chunks of 100 (Gmail batch limit).
    /// Returns a map of message_id -> html_content, plus a list of errors.
    pub fn batch_get_messages_html(
        &self,
        message_ids: &[String],
    ) -> (HashMap<String, MessageContent>, Vec<String>) {
        let mut results: HashMap<String, MessageContent> = HashMap::new();
        let mut errors: Vec<String> = Vec::new();

        // Gmail batch API allows up to 100 requests per batch
        const BATCH_SIZE: usize = 100;

        for chunk in message_ids.chunks(BATCH_SIZE) {
            match self.batch_get_chunk(chunk) {
                Ok(chunk_results) => {
                    for (id, content_result) in chunk_results {
                        match content_result {
                            Ok(content) => { results.insert(id, content); }
                            Err(e) => { errors.push(e); }
                        }
                    }
                }
                Err(e) => {
                    errors.push(format!("Batch request failed: {}", e));
                }
            }

            // Small delay between batches to respect rate limits
            if chunk.len() == BATCH_SIZE {
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        }

        (results, errors)
    }

    fn batch_get_chunk(
        &self,
        message_ids: &[String],
    ) -> Result<Vec<(String, Result<MessageContent, String>)>, String> {
        let access_token = self.get_access_token()?;

        // Build multipart/mixed batch request
        let boundary = "batch_boundary_gmail_sync";
        let mut body_parts = String::new();

        for msg_id in message_ids {
            body_parts.push_str(&format!(
                "--{}\r\nContent-Type: application/http\r\n\r\nGET /gmail/v1/users/me/messages/{}?format=full\r\n\r\n",
                boundary, msg_id
            ));
        }
        body_parts.push_str(&format!("--{}--\r\n", boundary));

        let url = "https://gmail.googleapis.com/batch/gmail/v1";
        let response = self.http
            .post(url)
            .header("Content-Type", format!("multipart/mixed; boundary={}", boundary))
            .bearer_auth(&access_token)
            .body(body_parts)
            .send()
            .map_err(|e| format!("Batch request failed: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            return Err(format!("Batch API error {}: {}", status, body));
        }

        let response_body = response.text().map_err(|e| format!("Read batch response: {}", e))?;
        parse_batch_response(message_ids, &response_body)
    }

    fn save_tokens(&self, tokens: &GmailTokens) -> Result<(), String> {
        let json = serde_json::to_string_pretty(tokens).map_err(|e| e.to_string())?;
        fs::write(&self.token_path, json).map_err(|e| e.to_string())
    }

    pub fn is_authenticated(&self) -> bool {
        self.tokens.lock().unwrap().is_some()
    }

    pub fn disconnect(&self) -> Result<(), String> {
        *self.tokens.lock().unwrap() = None;
        let _ = fs::remove_file(&self.token_path);
        info!("Gmail tokens removed");
        Ok(())
    }
}

/// Parse Gmail's `internalDate` (epoch milliseconds) into a YYYY-MM-DD string.
/// Gmail returns it as a JSON string (e.g. "1781529000000"), so `as_i64()`
/// alone always yields None — accept both string and numeric forms.
fn parse_internal_date(msg: &serde_json::Value) -> Option<String> {
    msg.get("internalDate")
        .and_then(|v| v.as_i64().or_else(|| v.as_str().and_then(|s| s.parse::<i64>().ok())))
        .and_then(chrono::DateTime::from_timestamp_millis)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
}

fn extract_html_from_message(msg: &serde_json::Value) -> Result<String, String> {
    let payload = msg.get("payload").ok_or("No payload")?;
    if let Some(html) = find_html_in_payload(payload) {
        return Ok(html);
    }
    let data = payload
        .get("body")
        .and_then(|b| b.get("data"))
        .and_then(|d| d.as_str());
    if let Some(data) = data {
        let decoded = base64_decode_urlsafe(data)?;
        if let Ok(s) = String::from_utf8(decoded) {
            if s.contains("<html") || s.contains("<!DOCTYPE") {
                return Ok(s);
            }
        }
    }
    Err("Could not find HTML content".to_string())
}

fn find_html_in_payload(payload: &serde_json::Value) -> Option<String> {
    let mime = payload.get("mimeType").and_then(|m| m.as_str()).unwrap_or("");
    if mime == "text/html" {
        let data = payload
            .get("body")
            .and_then(|b| b.get("data"))
            .and_then(|d| d.as_str());
        if let Some(data) = data {
            if let Ok(decoded) = base64_decode_urlsafe(data) {
                if let Ok(html) = String::from_utf8(decoded) {
                    return Some(html);
                }
            }
        }
    }
    if let Some(parts) = payload.get("parts").and_then(|p| p.as_array()) {
        for part in parts {
            if let Some(html) = find_html_in_payload(part) {
                return Some(html);
            }
        }
    }
    None
}

fn base64_decode_urlsafe(data: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    use base64::engine::{GeneralPurpose, GeneralPurposeConfig, DecodePaddingMode};
    // Gmail returns message body `data` as base64url, sometimes WITH `=`
    // padding and sometimes without. URL_SAFE_NO_PAD rejects padded input,
    // which silently dropped every email whose body length required padding.
    // Use an engine that is indifferent to padding so both forms decode.
    const ENGINE: GeneralPurpose = GeneralPurpose::new(
        &base64::alphabet::URL_SAFE,
        GeneralPurposeConfig::new().with_decode_padding_mode(DecodePaddingMode::Indifferent),
    );
    ENGINE.decode(data).map_err(|e| format!("Base64 error: {}", e))
}

fn urlencoding_encode(s: &str) -> String {
    let mut r = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => r.push(b as char),
            _ => r.push_str(&format!("%{:02X}", b)),
        }
    }
    r
}

/// Subtract `days` from a Gmail-format date string (YYYY/MM/DD).
/// Returns the result in the same format. Never goes before 2000/01/01.
fn gmail_date_subtract_days(date_str: &str, days: i64) -> String {
    let d = date_str.replace('/', "-");
    let parsed = chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::NaiveDate::from_ymd_opt(2020, 1, 1).unwrap());
    let adjusted = parsed - chrono::TimeDelta::days(days);
    let floor = chrono::NaiveDate::from_ymd_opt(2000, 1, 1).unwrap();
    let safe = if adjusted < floor { floor } else { adjusted };
    format!("{}/{:02}/{:02}", safe.year(), safe.month(), safe.day())
}

struct TimeSegment {
    start: String,
    end: String,
}

fn generate_time_segments(start_date: &str, end_date: &str) -> Vec<TimeSegment> {
    let parse_date = |d: &str| -> Option<chrono::NaiveDate> {
        let d = d.replace('/', "-");
        chrono::NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok()
    };

    let mut start = parse_date(start_date).unwrap_or_else(|| chrono::NaiveDate::from_ymd_opt(2015, 1, 1).unwrap());
    let end = parse_date(end_date).unwrap_or_else(|| chrono::Utc::now().naive_utc().date());

    let mut segments = Vec::new();

    while start < end {
        let seg_end_month = if start.month() <= 6 {
            start.month() + 6
        } else {
            start.month() - 6
        };
        let seg_end_year = if start.month() <= 6 {
            start.year()
        } else {
            start.year() + 1
        };

        let seg_end = chrono::NaiveDate::from_ymd_opt(seg_end_year, seg_end_month, 1)
            .unwrap_or(end)
            .min(end);

        segments.push(TimeSegment {
            start: format!("{}/{:02}/{:02}", start.year(), start.month(), start.day()),
            end: format!("{}/{:02}/{:02}", seg_end.year(), seg_end.month(), seg_end.day()),
        });

        let next_start = chrono::NaiveDate::from_ymd_opt(seg_end_year, seg_end_month, 1)
            .unwrap_or(end);
        if next_start <= start {
            break;
        }
        start = next_start;
        if start >= end {
            break;
        }
    }

    segments
}

fn parse_batch_response(
    message_ids: &[String],
    body: &str,
) -> Result<Vec<(String, Result<MessageContent, String>)>, String> {
    let mut results = Vec::new();
    let mut remaining_ids: Vec<String> = message_ids.to_vec();

    let mut depth = 0;
    let mut json_starts: Vec<usize> = Vec::new();

    for (i, ch) in body.char_indices() {
        match ch {
            '{' => {
                if depth == 0 {
                    json_starts.push(i);
                }
                depth += 1;
            }
            '}' => {
                depth -= 1;
                if depth == 0 && !json_starts.is_empty() {
                    let start = json_starts.pop().unwrap();
                    let json_str = &body[start..=i];
                    if json_str.len() < 50 {
                        continue;
                    }
                    if let Ok(msg) = serde_json::from_str::<serde_json::Value>(json_str) {
                        let msg_id = msg.get("id")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        if msg.get("payload").is_some() {
                            let html_result = extract_html_from_message(&msg);
                            let internal_date = parse_internal_date(&msg);
                            if let Some(id) = msg_id {
                                let content = html_result.map(|html| MessageContent { html, internal_date }).map_err(|e| e.to_string());
                                results.push((id.clone(), content));
                                remaining_ids.retain(|rid| rid != &id);
                            }
                        }
                    }
                }
            }
            _ => {}
        }
    }

    for id in remaining_ids {
        results.push((id, Err("No data found for message in batch response".to_string())));
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_time_segments_cover_full_range() {
        let segments = generate_time_segments("2015/01/01", "2026/06/14");
        assert!(!segments.is_empty(), "Should generate segments");

        let first_start = &segments[0].start;
        assert!(first_start.starts_with("2015"), "First segment should start from 2015");

        let last = segments.last().unwrap();
        assert!(last.end.contains("2026"), "Last segment should reach 2026");
    }

    #[test]
    fn test_time_segments_since_date() {
        let segments = generate_time_segments("2025/01/01", "2026/06/14");
        assert!(segments.len() <= 4, "Short range should have few segments");

        let first = &segments[0];
        assert!(first.start.contains("2025"), "Should start from since_date");
    }

    #[test]
    fn test_gmail_date_subtract_days() {
        assert_eq!(gmail_date_subtract_days("2026/06/09", 1), "2026/06/08");
        assert_eq!(gmail_date_subtract_days("2026/06/09", 7), "2026/06/02");
        assert_eq!(gmail_date_subtract_days("2026/01/01", 1), "2025/12/31");
        assert_eq!(gmail_date_subtract_days("2026/03/01", 1), "2026/02/28");
        // Leap year 2024
        assert_eq!(gmail_date_subtract_days("2024/03/01", 1), "2024/02/29");
        // Floor at 2000/01/01
        let early = gmail_date_subtract_days("2000/01/01", 365);
        assert!(early.starts_with("2000/01/01") || early.as_str() >= "2000/01/01");
    }

    #[test]
    fn test_segments_no_boundary_gaps() {
        // After applying the -1 day fix to after:, segment boundary dates
        // should be covered by adjacent segments.
        let segments = generate_time_segments("2024/06/15", "2026/06/16");
        assert!(!segments.is_empty());

        let first_start = chrono::NaiveDate::parse_from_str(
            &segments[0].start.replace('/', "-"), "%Y-%m-%d"
        ).unwrap();
        let last_end = chrono::NaiveDate::parse_from_str(
            &segments.last().unwrap().end.replace('/', "-"), "%Y-%m-%d"
        ).unwrap();

        let mut covered = std::collections::HashSet::new();
        for seg in &segments {
            let after_date = gmail_date_subtract_days(&seg.start, 1);
            let seg_start = chrono::NaiveDate::parse_from_str(
                &after_date.replace('/', "-"), "%Y-%m-%d"
            ).unwrap();
            let seg_end = chrono::NaiveDate::parse_from_str(
                &seg.end.replace('/', "-"), "%Y-%m-%d"
            ).unwrap();
            let mut d = seg_start + chrono::TimeDelta::days(1);
            while d < seg_end {
                covered.insert(d);
                d += chrono::TimeDelta::days(1);
            }
        }

        let mut gaps = Vec::new();
        let mut d = first_start + chrono::TimeDelta::days(1);
        while d < last_end {
            if !covered.contains(&d) {
                gaps.push(d);
            }
            d += chrono::TimeDelta::days(1);
        }

        assert!(gaps.is_empty(), "Found {} uncovered boundary dates: {:?}", gaps.len(), gaps);
    }

    #[test]
    fn test_incremental_sync_covers_boundary_date() {
        // Simulate incremental sync with since_date="2026-06-09"
        let since = Some("2026-06-09");
        let start_date = if let Some(d) = since {
            let d = d.replace('-', "/");
            gmail_date_subtract_days(&d, 7)
        } else {
            "2015/01/01".to_string()
        };
        // end_date = "2026/06/16" (tomorrow)
        let segments = generate_time_segments(&start_date, "2026/06/16");

        // Check June 5-9 coverage (the user's scenario)
        for day in 5..=9 {
            let date = chrono::NaiveDate::from_ymd_opt(2026, 6, day).unwrap();
            let covered = segments.iter().any(|seg| {
                let after_date = gmail_date_subtract_days(&seg.start, 1);
                let seg_start = chrono::NaiveDate::parse_from_str(
                    &after_date.replace('/', "-"), "%Y-%m-%d"
                ).unwrap();
                let seg_end = chrono::NaiveDate::parse_from_str(
                    &seg.end.replace('/', "-"), "%Y-%m-%d"
                ).unwrap();
                let cs = seg_start + chrono::TimeDelta::days(1);
                let ce = seg_end - chrono::TimeDelta::days(1);
                date >= cs && date <= ce
            });
            assert!(covered, "Date {} should be covered by incremental sync", date);
        }
    }

    #[test]
    fn test_base64_decode_handles_padding() {
        use base64::Engine;
        // Padded base64url (length needs `=`) must decode — this is what was
        // silently failing before, dropping ~2/3 of CMB daily emails.
        let padded = base64::engine::general_purpose::URL_SAFE.encode(b"<html>x</html>");
        assert!(padded.ends_with('='), "test input should be padded");
        let decoded = base64_decode_urlsafe(&padded).expect("padded must decode");
        assert_eq!(decoded, b"<html>x</html>");
        // Unpadded form must still work too.
        let unpadded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(b"hello");
        assert_eq!(base64_decode_urlsafe(&unpadded).unwrap(), b"hello");
    }

    #[test]
    fn test_parse_internal_date_string_form() {
        // Gmail sends internalDate as a JSON string of epoch millis.
        let msg = serde_json::json!({ "internalDate": "1781529000000" });
        assert_eq!(parse_internal_date(&msg).as_deref(), Some("2026-06-15"));
        // Numeric form should also work.
        let msg2 = serde_json::json!({ "internalDate": 1781529000000i64 });
        assert_eq!(parse_internal_date(&msg2).as_deref(), Some("2026-06-15"));
    }

    #[test]
    fn test_urlencoding_encode() {
        assert_eq!(urlencoding_encode("hello world"), "hello%20world");
        assert_eq!(urlencoding_encode("a@b.com"), "a%40b.com");
        assert_eq!(urlencoding_encode("abc123-_."), "abc123-_.");
    }

    #[test]
    fn test_extract_html_simple() {
        use base64::Engine;
        let msg = serde_json::json!({
            "payload": {
                "mimeType": "text/html",
                "body": {
                    "data": base64::engine::general_purpose::URL_SAFE_NO_PAD.encode("<html><body>Hello</body></html>".as_bytes())
                }
            }
        });
        let result = extract_html_from_message(&msg);
        assert!(result.is_ok());
        assert!(result.unwrap().contains("Hello"));
    }
}