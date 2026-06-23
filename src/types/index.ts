export interface UserPortfolio {
  buys: EquityBuy[];
  sells: EquitySell[];
  funds: MutualFund[];
  alternatives: AlternativeInvestment[];
  cash: CashEntry[];
  watchlist: WatchlistEntry[];
  dividends: DividendEntry[];
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
  email?: string;
  profilePicture?: string; // base64 string
  portfolio?: UserPortfolio;
}

export interface EquityBuy {
  transactionId: string;         // UUID e.g., TRC-EQ-YYYYMMDD-XXXX
  date: string;                  // ISO date (YYYY-MM-DD)
  ticker: string;                // e.g. "RELIANCE.NS"
  stockName: string;             // Auto-fetched or user fallback
  industry: string;              // Auto-fetched or user fallback
  quantity: number;
  avgBuyPrice: number;           // INR
  fees: number;                  // Brokerage + STT + GST
  totalBuyValue: number;         // Computed: qty * avgBuyPrice + fees
  currentPrice: number;          // Live-fetched or stale fallback
  currentValue: number;          // Computed: qty * currentPrice
  targetPrice: number;           // User-defined target price
  pctToTarget: number;           // Computed: (targetPrice - currentPrice) / currentPrice * 100
  holdingDuration: string;       // User input e.g. "6 months", "2 years"
  opinion: string;               // Stock thesis
  subsequentPurchases: EquityBuy[]; // DCA additions
  currentPE: number;             // Live-fetched, summary PE
  contactNotes: string[];        // Array of PDF file base64 strings
  isPartialSold: boolean;
  manualPriceOverride?: number | null;
  lotSize?: number;
}

export interface EquitySell {
  transactionId: string;         // UUID
  linkedBuyId: string;           // Maps back to EquityBuy
  date: string;                  // ISO date
  ticker: string;
  quantity: number;
  avgSellPrice: number;
  fees: number;
  totalSellValue: number;        // Computed: qty * avgSellPrice - fees
  dividendsReceived: number;
  realizedPnL: number;           // Computed: totalSellValue - pro-rated totalBuyValue
  realizedPnLPct: number;        // Computed: (realizedPnL / pro-rated buy value) * 100
  sellPE: number;                // User-input
  isPartialSell: boolean;
  partialSellNotes: string;
  contactNotes: string[];        // Array of PDF base64 strings
}

export interface MutualFund {
  id: string;                    // User-defined identification ID
  schemeName: string;
  schemeCode: string;            // MFAPI scheme code
  dateOfBuy: string;             // ISO date
  buyNAV: number;
  units: number;
  aum: number;                   // Fetched from MFAPI
  currentNAV: number;            // Live-fetched
  currentValue: number;          // Computed: units * currentNAV
  investedValue: number;         // Computed: units * buyNAV
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  realizedPnL: number;           // If fully/partially redeemed
}

export interface AlternativeInvestment {
  id: string;
  name: string;
  category: string;              // e.g., "Gold", "Silver", "Real Estate", "Crypto", etc.
  investedAmount: number;
  currentValue: number;
  dateOfInvestment: string;
  notes: string;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
}

export interface CashEntry {
  id: string;
  date: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
}

export interface WatchlistEntry {
  ticker: string;
  stockName: string;
  currentPrice: number;
  currentPE: number;
  range52W: string; // e.g. "₹2,100 - ₹3,000"
  lastUpdated: string;
}

export interface DividendEntry {
  id: string;
  date: string;
  ticker: string;
  amount: number;
  description: string;
}
