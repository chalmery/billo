mod commands;
mod db;
mod gmail;
mod parser;

use db::Database;
use gmail::GmailClient;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if std::env::var("XDG_SESSION_TYPE").unwrap_or_default() != "wayland" {
        std::env::set_var("GTK_CSD", "0");
    }

    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("billo.db");
            let db_path_str = db_path.to_string_lossy().to_string();

            log::info!("Database path: {}", db_path_str);

            let database = Database::new(&db_path_str).expect("Failed to initialize database");
            app.manage(Arc::new(database));

            let gmail_client = GmailClient::new(&app_dir);
            app.manage(Arc::new(std::sync::Mutex::new(gmail_client)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_cards,
            commands::create_card,
            commands::delete_card,
            commands::parse_email_content,
            commands::import_email,
            commands::get_transactions,
            commands::update_transaction_category,
            commands::get_monthly_summary,
            commands::get_category_breakdown,
            commands::get_credit_trend,
            commands::get_sync_state,
            commands::export_csv,
            commands::gmail_save_config,
            commands::gmail_get_config,
            commands::gmail_get_auth_url,
            commands::gmail_exchange_code,
            commands::gmail_is_authenticated,
            commands::gmail_disconnect,
            commands::gmail_sync_incremental,
            commands::gmail_sync_full,
            commands::get_all_daily_summaries,
            commands::get_raw_email,
            commands::get_parser_profiles,
            commands::create_parser_profile,
            commands::update_parser_profile,
            commands::delete_parser_profile,
            commands::get_dashboard_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
