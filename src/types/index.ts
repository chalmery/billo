// ============================================================
// Billo - Shared Type Definitions (Frontend <-> Backend Contract)
// ============================================================

// --- Card ---
export interface Card {
  id: number
  name: string
  last_four: string
  bank: string
  created_at: string
  parser_profile: string
  color: string
  sync_method: string | null
  sync_config: string | null
}

export interface CreateCardInput {
  name: string
  last_four: string
}

// --- Daily Summary ---
export interface DailySummary {
  id: number
  card_id: number
  email_date: string
  available_credit: number | null
  points_balance: number | null
  email_uid: string
  fetched_at: string
}

// --- Transaction ---
export interface Transaction {
  id: number
  card_id: number
  daily_summary_id: number
  transaction_date: string
  transaction_time: string | null
  amount: number
  currency: string
  merchant: string
  payment_method: string | null
  category: string | null
  notes: string | null
}

export interface TransactionFilter {
  card_id?: number
  date_from?: string
  date_to?: string
  category?: string
  merchant?: string
  amount_min?: number
  amount_max?: number
  page?: number
  page_size?: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// --- Statistics ---
export interface MonthlySummary {
  month: string
  total: number
  avg_daily: number
  transaction_count: number
  card_name?: string
}

export interface CategoryBreakdown {
  category: string
  total: number
  count: number
}

export interface CreditTrend {
  date: string
  available_credit: number
  points_balance: number | null
  total_consumption: number
}

export interface YearOverYear {
  month: string
  current_year: number
  previous_year: number
}

// --- Gmail / Sync ---
export interface SyncStatus {
  is_connected: boolean
  last_sync_at: string | null
  message: string
}

export interface SyncResult {
  success: boolean
  new_summaries: number
  new_transactions: number
  errors: string[]
}

// --- Config ---
export interface AppConfig {
  gmail_token_path: string | null
  auto_sync_enabled: boolean
}

// --- Dashboard ---
export interface DashboardData {
  monthly_total: number
  monthly_change_pct: number | null
  yearly_total: number
  yearly_change_pct: number | null
  daily_average: number
  transaction_count: number
  max_single: number
  max_single_merchant: string
  heatmap_data: Record<string, HeatmapCell>
}

export interface HeatmapCell {
  amount: number
  count: number
  categories: string[]
}

// --- Common ---
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
