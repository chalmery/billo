use log::{error, info};
use reqwest::blocking::Client as HttpClient;
use serde::{Deserialize, Serialize};
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
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GmailMessageSnippet {
    pub id: String,
    pub subject: String,
    pub date: String,
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

    pub fn list_cmb_messages(&self, since_date: Option<&str>) -> Result<Vec<GmailMessageSnippet>, String> {
        let access_token = self.get_access_token()?;

        let mut query = format!("from:{}", "ccsvc@message.cmbchina.com");
        if let Some(date) = since_date {
            query.push_str(&format!(" after:{}", date));
        }
        let mut all_snippets: Vec<GmailMessageSnippet> = Vec::new();
        let mut page_token: Option<String> = None;

        loop {
            let mut url = format!(
                "https://gmail.googleapis.com/gmail/v1/users/me/messages?q={}&maxResults=100",
                urlencoding_encode(&query),
            );
            if let Some(ref token) = page_token {
                url.push_str(&format!("&pageToken={}", token));
            }

            info!("Gmail list request: {}", url);

            let response = self.http
                .get(&url)
                .bearer_auth(&access_token)
                .send()
                .map_err(|e| format!("Gmail API request failed: {}", e))?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response.text().unwrap_or_default();
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
            info!("Gmail list page returned {} messages", messages.len());

            for msg in &messages {
                match self.get_message_snippet(&access_token, &msg.id) {
                    Ok(s) => {
                        info!("Gmail message: id={}, subject={}", s.id, s.subject);
                        all_snippets.push(s);
                    }
                    Err(e) => error!("Failed to get message {}: {}", msg.id, e),
                }
            }

            match list_resp.next_page_token {
                Some(token) => page_token = Some(token),
                None => break,
            }
        }

        info!("Gmail total CMB messages found: {}", all_snippets.len());
        Ok(all_snippets)
    }

    pub fn get_message_html(&self, message_id: &str) -> Result<String, String> {
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
        extract_html_from_message(&full_msg)
    }

    fn get_message_snippet(&self, access_token: &str, message_id: &str) -> Result<GmailMessageSnippet, String> {
        let url = format!(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/{}?format=metadata&metadataHeaders=Subject&metadataHeaders=Date",
            message_id
        );
        let response = self.http
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("API error: {}", response.status()));
        }

        let msg: serde_json::Value = response.json().map_err(|e| format!("Parse: {}", e))?;
        let headers = msg.get("payload").and_then(|p| p.get("headers")).and_then(|h| h.as_array());
        let (mut subject, mut date) = (String::new(), String::new());
        if let Some(headers) = headers {
            for h in headers {
                let name = h.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let value = h.get("value").and_then(|v| v.as_str()).unwrap_or("");
                if name == "Subject" { subject = value.to_string(); }
                else if name == "Date" { date = value.to_string(); }
            }
        }
        Ok(GmailMessageSnippet { id: message_id.to_string(), subject, date })
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
    base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(data)
        .map_err(|e| format!("Base64 error: {}", e))
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