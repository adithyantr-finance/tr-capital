import type { EquityBuy, EquitySell } from '../types';

// Format number as Indian currency ₹ Lakhs/Crores
export const formatINR = (value: number, includeSign = true): string => {
  try {
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    });
    let result = formatter.format(value);
    if (!includeSign) {
      result = result.replace('₹', '').trim();
    }
    return result;
  } catch (e) {
    return (includeSign ? '₹' : '') + value.toFixed(2);
  }
};

// Date formatter: ISO YYYY-MM-DD -> DD MMM YYYY
export const formatDate = (isoString: string): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return isoString;
  }
};

// Calculate holdings-specific information from buy and sell books
export interface ActiveHolding {
  ticker: string;
  stockName: string;
  industry: string;
  qty: number;
  avgBuyPrice: number;
  totalInvested: number;
  currentPrice: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPct: number;
  targetPrice: number;
  pctToTarget: number;
  currentPE: number;
  holdingDuration: string;
  opinion: string;
  contactNotes: string[];
  isPartialSold: boolean;
  subsequentPurchases: EquityBuy[];
  originalBuyId: string;
  manualPriceOverride?: number | null;
}

export const getActiveHoldings = (buys: EquityBuy[], sells: EquitySell[]): ActiveHolding[] => {
  const holdingsMap: { [buyId: string]: ActiveHolding } = {};

  buys.forEach(buy => {
    // Find all sells linked to this buy
    const linkedSells = sells.filter(s => s.linkedBuyId === buy.transactionId);
    const soldQty = linkedSells.reduce((sum, s) => sum + s.quantity, 0);
    const remainingQty = buy.quantity - soldQty;

    if (remainingQty > 0) {
      const proRatedFees = (remainingQty / buy.quantity) * buy.fees;
      const totalInvested = (remainingQty * buy.avgBuyPrice) + proRatedFees;
      const effectivePrice = buy.manualPriceOverride && buy.manualPriceOverride > 0
        ? buy.manualPriceOverride
        : buy.currentPrice;

      const currentValue = remainingQty * effectivePrice;
      const unrealizedPnL = currentValue - totalInvested;
      const unrealizedPnLPct = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;
      
      const pctToTarget = effectivePrice > 0 
        ? ((buy.targetPrice - effectivePrice) / effectivePrice) * 100 
        : 0;

      holdingsMap[buy.transactionId] = {
        ticker: buy.ticker,
        stockName: buy.stockName,
        industry: buy.industry,
        qty: remainingQty,
        avgBuyPrice: buy.avgBuyPrice,
        totalInvested,
        currentPrice: buy.currentPrice,
        currentValue,
        unrealizedPnL,
        unrealizedPnLPct,
        targetPrice: buy.targetPrice,
        pctToTarget,
        currentPE: buy.currentPE,
        holdingDuration: buy.holdingDuration,
        opinion: buy.opinion,
        contactNotes: buy.contactNotes || [],
        isPartialSold: soldQty > 0,
        subsequentPurchases: buy.subsequentPurchases || [],
        originalBuyId: buy.transactionId,
        manualPriceOverride: buy.manualPriceOverride
      };
    }
  });

  return Object.values(holdingsMap);
};

// Newton-Raphson XIRR Solver with Bisection Fallback
export interface CashFlow {
  amount: number;
  date: Date;
}

export function calculateXIRR(cashFlows: CashFlow[]): number {
  if (cashFlows.length < 2) return 0;

  // Filter out zero amount flows
  const flows = cashFlows.filter(cf => Math.abs(cf.amount) > 0.01);
  if (flows.length < 2) return 0;

  // Check signs: must have at least one negative (cash out) and one positive (cash in)
  let hasPositive = false;
  let hasNegative = false;
  for (const cf of flows) {
    if (cf.amount > 0) hasPositive = true;
    if (cf.amount < 0) hasNegative = true;
  }
  if (!hasPositive || !hasNegative) return 0;

  // Sort chronologically
  flows.sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = flows[0].date.getTime();

  // e_i = (d_i - d_1) / 365.25
  const years = flows.map(cf => (cf.date.getTime() - firstDate) / (1000 * 60 * 60 * 24 * 365.25));
  const amounts = flows.map(cf => cf.amount);

  const f = (rate: number) => {
    let sum = 0;
    for (let i = 0; i < flows.length; i++) {
      sum += amounts[i] / Math.pow(1 + rate, years[i]);
    }
    return sum;
  };

  const df = (rate: number) => {
    let sum = 0;
    for (let i = 0; i < flows.length; i++) {
      sum -= years[i] * amounts[i] / Math.pow(1 + rate, years[i] + 1);
    }
    return sum;
  };

  // 1. Try Newton-Raphson Method
  let rate = 0.1; // initial guess
  const maxIterations = 100;
  const precision = 1e-6;

  for (let iter = 0; iter < maxIterations; iter++) {
    const fVal = f(rate);
    const dfVal = df(rate);
    
    if (Math.abs(dfVal) < 1e-12) {
      break; // Division by zero guard
    }

    const nextRate = rate - fVal / dfVal;
    
    if (Math.abs(nextRate - rate) < precision) {
      if (isNaN(nextRate) || !isFinite(nextRate)) break;
      return nextRate * 100;
    }
    rate = nextRate;
  }

  // 2. Fallback to Bisection Method (highly robust, solves bounded root search)
  let low = -0.999;
  let high = 5.0; // support up to 500% IRR
  
  // Find signs at endpoints
  let fLow = f(low);
  let fHigh = f(high);

  if (fLow * fHigh > 0) {
    // If root is not bracketed between -99.9% and 500%, return simple IRR guess
    return rate * 100;
  }

  for (let iter = 0; iter < 100; iter++) {
    rate = (low + high) / 2;
    const fVal = f(rate);
    
    if (Math.abs(fVal) < precision) {
      return rate * 100;
    }
    
    if (fLow * fVal < 0) {
      high = rate;
      fHigh = fVal;
    } else {
      low = rate;
      fLow = fVal;
    }
  }

  return rate * 100;
}

// Calculate Portfolio Health Score (1-100)
export function calculateHealthScore(params: {
  categoriesCount: number;         // number of non-zero asset categories (max 4: Equity, MF, Alt, Cash)
  maxHoldingPct: number;           // highest holding size percentage (e.g. 20% -> 20)
  cashDragPct: number;             // cash percentage in portfolio
  winRate: number;                 // closed trade win rate percentage (0-100)
  hasClosedTrades: boolean;
}): number {
  let score = 0;

  // 1. Asset Diversification (Max 25 pts)
  if (params.categoriesCount >= 4) score += 25;
  else if (params.categoriesCount === 3) score += 20;
  else if (params.categoriesCount === 2) score += 12;
  else score += 5;

  // 2. Single Stock Concentration Risk (Max 25 pts)
  // Lower percentage means lower risk
  if (params.maxHoldingPct <= 15) score += 25;
  else if (params.maxHoldingPct <= 25) score += 18;
  else if (params.maxHoldingPct <= 40) score += 10;
  else score += 4;

  // 3. Cash Drag Buffer (Max 25 pts)
  // Ideal cash drag is between 2% and 15% (for dry powder/liquidity)
  if (params.cashDragPct >= 2 && params.cashDragPct <= 15) score += 25;
  else if (params.cashDragPct < 2 || (params.cashDragPct > 15 && params.cashDragPct <= 20)) score += 18;
  else score += 6; // Cash drag > 20% represents high drag

  // 4. Closed Trade Win Rate (Max 25 pts)
  if (!params.hasClosedTrades) {
    score += 15; // default moderate score
  } else {
    if (params.winRate >= 70) score += 25;
    else if (params.winRate >= 50) score += 20;
    else if (params.winRate >= 35) score += 12;
    else score += 5;
  }

  return Math.min(100, Math.max(1, Math.round(score)));
}
