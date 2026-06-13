import { invoke } from "@tauri-apps/api/core";
import type {
  Card,
  Transaction,
  DailySummary,
  PaginatedResult,
  MonthlySummary,
  CategoryBreakdown,
  CreditTrend,
  SyncStatus,
  DashboardData,
} from "@/types";

// ===== Cards =====
export async function getCards(): Promise<Card[]> {
  return invoke("get_cards");
}

export async function createCard(name: string, lastFour: string, color: string): Promise<Card> {
  return invoke("create_card", { name, lastFour, color });
}

export async function deleteCard(cardId: number): Promise<void> {
  return invoke("delete_card", { cardId });
}

// ===== Email parsing & import =====
export interface ParsedEmail {
  email_date: string;
  card_last_four: string | null;
  available_credit: number | null;
  points_balance: number | null;
  transactions: {
    time: string;
    amount: number;
    currency: string;
    merchant: string;
    payment_method: string | null;
  }[];
}

export async function parseEmailContent(htmlContent: string): Promise<ParsedEmail> {
  return invoke("parse_email_content", { htmlContent });
}

export async function importEmail(
  cardId: number,
  htmlContent: string,
  emailUid: string
): Promise<string> {
  return invoke("import_email", { cardId, htmlContent, emailUid });
}

// ===== Transactions =====
export async function getTransactions(params: {
  cardId?: number;
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  paymentMethod?: string;
  merchant?: string;
  amountMin?: number;
  amountMax?: number;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<Transaction>> {
  return invoke("get_transactions", {
    cardId: params.cardId ?? null,
    dateFrom: params.dateFrom ?? null,
    dateTo: params.dateTo ?? null,
    category: params.category ?? null,
    paymentMethod: params.paymentMethod ?? null,
    merchant: params.merchant ?? null,
    amountMin: params.amountMin ?? null,
    amountMax: params.amountMax ?? null,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 50,
  });
}

export async function updateTransactionCategory(
  transactionId: number,
  category: string
): Promise<void> {
  return invoke("update_transaction_category", { transactionId, category });
}

// ===== Statistics =====
export async function getMonthlySummary(cardId: number | null, year: number): Promise<MonthlySummary[]> {
  return invoke("get_monthly_summary", { cardId, year });
}

export async function getCategoryBreakdown(
  cardId: number | null,
  dateFrom: string,
  dateTo: string
): Promise<CategoryBreakdown[]> {
  return invoke("get_category_breakdown", { cardId, dateFrom, dateTo });
}

export async function getCreditTrend(
  cardId: number | null,
  dateFrom: string,
  dateTo: string
): Promise<CreditTrend[]> {
  return invoke("get_credit_trend", { cardId, dateFrom, dateTo });
}

export async function getDashboardData(cardIds: number[], year: number): Promise<DashboardData> {
  return invoke("get_dashboard_data", { cardIds, year });
}

// ===== Sync & Export =====
export async function getSyncState(): Promise<SyncStatus> {
  return invoke("get_sync_state");
}

export async function exportCsv(path: string, cardId?: number): Promise<void> {
  return invoke("export_csv", { path, cardId: cardId ?? null });
}

// ===== Gmail Integration =====
export interface GmailSyncResult {
  success: boolean;
  new_summaries: number;
  new_transactions: number;
  errors: string[];
}

export async function gmailSaveConfig(clientId: string, clientSecret: string, redirectPort?: number): Promise<void> {
  return invoke("gmail_save_config", { clientId, clientSecret, redirectPort: redirectPort ?? null });
}

export async function gmailGetConfig(): Promise<{ configured: boolean; client_id?: string; redirect_port?: number }> {
  return invoke("gmail_get_config");
}

export async function gmailGetAuthUrl(): Promise<string> {
  return invoke("gmail_get_auth_url");
}

export async function gmailExchangeCode(code: string): Promise<{ success: boolean; has_refresh_token: boolean }> {
  return invoke("gmail_exchange_code", { code });
}

export async function gmailIsAuthenticated(): Promise<boolean> {
  return invoke("gmail_is_authenticated");
}

export async function gmailDisconnect(): Promise<void> {
  return invoke("gmail_disconnect");
}

export async function gmailSyncIncremental(cardId: number): Promise<GmailSyncResult> {
  return invoke("gmail_sync_incremental", { cardId });
}

export async function gmailSyncFull(cardId: number): Promise<GmailSyncResult> {
  return invoke("gmail_sync_full", { cardId });
}

export async function getAllDailySummaries(limit?: number, offset?: number): Promise<PaginatedResult<DailySummary>> {
  return invoke("get_all_daily_summaries", { limit: limit ?? null, offset: offset ?? null });
}

export async function getRawEmail(summaryId: number): Promise<string | null> {
  return invoke("get_raw_email", { summaryId });
}

// ===== Statistics Charts =====

export interface YearlyTotal {
  year: number;
  total: number;
  count: number;
}

export interface PaymentMethodBreakdown {
  method: string;
  total: number;
  count: number;
}

export async function getYearlyTotals(cardId: number | null): Promise<YearlyTotal[]> {
  return invoke("get_yearly_totals", { cardId });
}

export async function getPaymentMethodBreakdown(
  cardId: number | null,
  dateFrom: string,
  dateTo: string
): Promise<PaymentMethodBreakdown[]> {
  return invoke("get_payment_method_breakdown", { cardId, dateFrom, dateTo });
}

// ===== Card Detail =====

export interface CardDetail {
  card: Card;
  email_count: number;
  transaction_count: number;
  sync_logs: SyncLogEntry[];
}

export interface SyncLogEntry {
  id: number;
  card_id: number;
  status: string;
  new_emails: number;
  new_transactions: number;
  message: string | null;
  created_at: string;
}

export async function getCardDetail(cardId: number): Promise<CardDetail | null> {
  return invoke("get_card_detail", { cardId });
}

export async function updateCard(params: {
  id: number;
  name: string;
  last_four: string;
  bank: string;
  parser_profile: string;
  color: string;
  sync_method?: string;
  sync_config?: string;
}): Promise<void> {
  return invoke("update_card", {
    id: params.id,
    name: params.name,
    lastFour: params.last_four,
    bank: params.bank,
    parserProfile: params.parser_profile,
    color: params.color,
    syncMethod: params.sync_method ?? null,
    syncConfig: params.sync_config ?? null,
  });
}

// ===== Enriched Daily Summaries =====

export interface EnrichedDailySummary {
  id: number;
  card_id: number;
  card_name: string;
  card_last_four: string;
  email_date: string;
  transaction_count: number;
  total_amount: number;
  fetched_at: string;
}

export async function getEnrichedDailySummaries(
  cardId: number | null,
  page?: number,
  pageSize?: number
): Promise<PaginatedResult<EnrichedDailySummary>> {
  return invoke("get_enriched_daily_summaries", {
    cardId,
    page: page ?? 1,
    pageSize: pageSize ?? 20,
  });
}

// ===== Category Rules =====

export interface CategoryRule {
  id: number;
  pattern: string;
  category: string;
  created_at: string;
}

export async function getCategoryRules(): Promise<CategoryRule[]> {
  return invoke("get_category_rules");
}

export async function addCategoryRule(pattern: string, category: string): Promise<CategoryRule> {
  return invoke("add_category_rule", { pattern, category });
}

export async function updateCategoryRule(id: number, pattern: string, category: string): Promise<void> {
  return invoke("update_category_rule", { id, pattern, category });
}

export async function deleteCategoryRule(id: number): Promise<void> {
  return invoke("delete_category_rule", { id });
}

// ===== Parser Profiles =====

export interface ParserProfile {
  id: number;
  name: string;
  is_builtin: boolean;
  sender_pattern: string;
  subject_pattern: string;
  date_regex: string;
  time_regex: string;
  amount_regex: string;
  card_last_four_regex: string;
  merchant_regex: string;
  created_at: string;
}

export async function getParserProfiles(): Promise<ParserProfile[]> {
  return invoke("get_parser_profiles");
}

export async function createParserProfile(profile: Omit<ParserProfile, "id" | "created_at">): Promise<number> {
  return invoke("create_parser_profile", { profile });
}

export async function updateParserProfile(profile: ParserProfile): Promise<void> {
  return invoke("update_parser_profile", { profile });
}

export async function deleteParserProfile(id: number): Promise<void> {
  return invoke("delete_parser_profile", { id });
}