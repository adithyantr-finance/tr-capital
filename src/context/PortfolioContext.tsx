import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useReducer } from 'react';
import { useAuth } from './AuthContext';
import type { EquityBuy, EquitySell, MutualFund, AlternativeInvestment, CashEntry, WatchlistEntry, DividendEntry } from '../types';
import { useStockData } from '../hooks/useStockData';
import { useMFData } from '../hooks/useMFData';

interface PortfolioState {
  buys: EquityBuy[];
  sells: EquitySell[];
  funds: MutualFund[];
  alternatives: AlternativeInvestment[];
  cash: CashEntry[];
  watchlist: WatchlistEntry[];
  dividends: DividendEntry[];
}

const initialPortfolioState: PortfolioState = {
  buys: [],
  sells: [],
  funds: [],
  alternatives: [],
  cash: [],
  watchlist: [],
  dividends: []
};

type PortfolioAction =
  | { type: 'SET_PORTFOLIO'; payload: PortfolioState }
  | { type: 'ADD_BUY'; payload: EquityBuy }
  | { type: 'UPDATE_BUY'; payload: { id: string; fields: Partial<EquityBuy> } }
  | { type: 'DELETE_BUY'; payload: string }
  | { type: 'ADD_SUBSEQUENT_PURCHASE'; payload: { parentId: string; sub: EquityBuy } }
  | { type: 'ADD_SELL'; payload: EquitySell }
  | { type: 'UPDATE_SELL'; payload: { id: string; fields: Partial<EquitySell> } }
  | { type: 'DELETE_SELL'; payload: string }
  | { type: 'ADD_FUND'; payload: MutualFund }
  | { type: 'UPDATE_FUND'; payload: { id: string; fields: Partial<MutualFund> } }
  | { type: 'DELETE_FUND'; payload: string }
  | { type: 'REDEEM_FUND'; payload: { id: string; units: number; nav: number } }
  | { type: 'ADD_ALTERNATIVE'; payload: AlternativeInvestment }
  | { type: 'UPDATE_ALTERNATIVE'; payload: { id: string; fields: Partial<AlternativeInvestment> } }
  | { type: 'DELETE_ALTERNATIVE'; payload: string }
  | { type: 'ADD_CASH'; payload: CashEntry }
  | { type: 'DELETE_CASH'; payload: string }
  | { type: 'SET_WATCHLIST'; payload: WatchlistEntry[] }
  | { type: 'ADD_TO_WATCHLIST'; payload: WatchlistEntry }
  | { type: 'REMOVE_FROM_WATCHLIST'; payload: string }
  | { type: 'ADD_DIVIDEND'; payload: DividendEntry }
  | { type: 'DELETE_DIVIDEND'; payload: string }
  | { type: 'BULK_IMPORT_EQUITIES'; payload: EquityBuy[] }
  | { type: 'BULK_IMPORT_SELLS'; payload: EquitySell[] }
  | { type: 'BULK_IMPORT_MF'; payload: MutualFund[] }
  | { type: 'BULK_IMPORT_ALT'; payload: AlternativeInvestment[] }
  | { type: 'BULK_IMPORT_CASH'; payload: CashEntry[] }
  | { type: 'UPDATE_PRICES'; payload: { buys: EquityBuy[]; watchlist: WatchlistEntry[]; funds: MutualFund[] } };

function portfolioReducer(state: PortfolioState, action: PortfolioAction): PortfolioState {
  switch (action.type) {
    case 'SET_PORTFOLIO':
      return action.payload;

    case 'ADD_BUY':
      return {
        ...state,
        buys: [action.payload, ...state.buys]
      };

    case 'UPDATE_BUY':
      return {
        ...state,
        buys: state.buys.map(b => b.transactionId === action.payload.id ? { ...b, ...action.payload.fields } : b)
      };

    case 'DELETE_BUY':
      return {
        ...state,
        buys: state.buys.filter(b => b.transactionId !== action.payload)
      };

    case 'ADD_SUBSEQUENT_PURCHASE': {
      const { parentId, sub } = action.payload;
      return {
        ...state,
        buys: state.buys.map(b => {
          if (b.transactionId !== parentId) return b;
          const subList = b.subsequentPurchases ? [...b.subsequentPurchases, sub] : [sub];
          const newParentQty = b.quantity + sub.quantity;
          const newParentFees = b.fees + sub.fees;
          
          const totalCostExclFees = (b.quantity * b.avgBuyPrice) + (sub.quantity * sub.avgBuyPrice);
          const newParentAvgPrice = newParentQty > 0 ? (totalCostExclFees / newParentQty) : b.avgBuyPrice;
          const newParentTotalBuyValue = (newParentQty * newParentAvgPrice) + newParentFees;
          const newParentCurrentValue = newParentQty * b.currentPrice;

          return {
            ...b,
            quantity: newParentQty,
            avgBuyPrice: newParentAvgPrice,
            fees: newParentFees,
            totalBuyValue: newParentTotalBuyValue,
            currentValue: newParentCurrentValue,
            subsequentPurchases: subList
          };
        })
      };
    }

    case 'ADD_SELL':
      return {
        ...state,
        sells: [action.payload, ...state.sells],
        buys: state.buys.map(b => b.transactionId === action.payload.linkedBuyId ? { ...b, isPartialSold: true } : b)
      };

    case 'UPDATE_SELL':
      return {
        ...state,
        sells: state.sells.map(s => s.transactionId === action.payload.id ? { ...s, ...action.payload.fields } : s)
      };

    case 'DELETE_SELL': {
      const sellId = action.payload;
      const sellToRemove = state.sells.find(s => s.transactionId === sellId);
      const updatedSells = state.sells.filter(s => s.transactionId !== sellId);
      const linkedBuyId = sellToRemove ? sellToRemove.linkedBuyId : '';
      
      return {
        ...state,
        sells: updatedSells,
        buys: state.buys.map(b => {
          if (b.transactionId === linkedBuyId) {
            const hasMoreSells = updatedSells.some(s => s.linkedBuyId === linkedBuyId);
            return { ...b, isPartialSold: hasMoreSells };
          }
          return b;
        })
      };
    }

    case 'ADD_FUND':
      return {
        ...state,
        funds: [action.payload, ...state.funds]
      };

    case 'UPDATE_FUND':
      return {
        ...state,
        funds: state.funds.map(f => f.id === action.payload.id ? { ...f, ...action.payload.fields } : f)
      };

    case 'DELETE_FUND':
      return {
        ...state,
        funds: state.funds.filter(f => f.id !== action.payload)
      };

    case 'REDEEM_FUND': {
      const { id, units, nav } = action.payload;
      return {
        ...state,
        funds: state.funds.map(f => {
          if (f.id !== id) return f;
          if (units > f.units) return f;
          
          const remainingUnits = f.units - units;
          const redeemedValue = units * nav;
          const proRatedCost = units * f.buyNAV;
          const newRealized = (f.realizedPnL || 0) + (redeemedValue - proRatedCost);
          
          const investedValue = remainingUnits * f.buyNAV;
          const currentValue = remainingUnits * f.currentNAV;
          const unrealizedPnL = currentValue - investedValue;
          const unrealizedPnLPct = investedValue > 0 ? (unrealizedPnL / investedValue) * 100 : 0;

          return {
            ...f,
            units: remainingUnits,
            investedValue,
            currentValue,
            unrealizedPnL,
            unrealizedPnLPct,
            realizedPnL: newRealized
          };
        }).filter(f => f.units > 0 || (f.realizedPnL !== 0 && f.units > 0))
      };
    }

    case 'ADD_ALTERNATIVE':
      return {
        ...state,
        alternatives: [action.payload, ...state.alternatives]
      };

    case 'UPDATE_ALTERNATIVE':
      return {
        ...state,
        alternatives: state.alternatives.map(a => a.id === action.payload.id ? { ...a, ...action.payload.fields } : a)
      };

    case 'DELETE_ALTERNATIVE':
      return {
        ...state,
        alternatives: state.alternatives.filter(a => a.id !== action.payload)
      };

    case 'ADD_CASH':
      return {
        ...state,
        cash: [action.payload, ...state.cash]
      };

    case 'DELETE_CASH':
      return {
        ...state,
        cash: state.cash.filter(c => c.id !== action.payload)
      };

    case 'SET_WATCHLIST':
      return {
        ...state,
        watchlist: action.payload
      };

    case 'ADD_TO_WATCHLIST':
      return {
        ...state,
        watchlist: [...state.watchlist, action.payload]
      };

    case 'REMOVE_FROM_WATCHLIST':
      return {
        ...state,
        watchlist: state.watchlist.filter(w => w.ticker !== action.payload)
      };

    case 'ADD_DIVIDEND':
      return {
        ...state,
        dividends: [action.payload, ...state.dividends]
      };

    case 'DELETE_DIVIDEND':
      return {
        ...state,
        dividends: state.dividends.filter(d => d.id !== action.payload)
      };

    case 'BULK_IMPORT_EQUITIES':
      return {
        ...state,
        buys: [...state.buys, ...action.payload].filter(
          (b, idx, self) => self.findIndex(x => x.transactionId === b.transactionId) === idx
        )
      };

    case 'BULK_IMPORT_SELLS':
      return {
        ...state,
        sells: [...state.sells, ...action.payload].filter(
          (s, idx, self) => self.findIndex(x => x.transactionId === s.transactionId) === idx
        )
      };

    case 'BULK_IMPORT_MF':
      return {
        ...state,
        funds: [...state.funds, ...action.payload].filter(
          (f, idx, self) => self.findIndex(x => x.id === f.id) === idx
        )
      };

    case 'BULK_IMPORT_ALT':
      return {
        ...state,
        alternatives: [...state.alternatives, ...action.payload].filter(
          (a, idx, self) => self.findIndex(x => x.id === a.id) === idx
        )
      };

    case 'BULK_IMPORT_CASH':
      return {
        ...state,
        cash: [...state.cash, ...action.payload].filter(
          (c, idx, self) => self.findIndex(x => x.id === c.id) === idx
        )
      };

    case 'UPDATE_PRICES':
      return {
        ...state,
        buys: action.payload.buys,
        watchlist: action.payload.watchlist,
        funds: action.payload.funds
      };

    default:
      return state;
  }
}

interface PortfolioContextType {
  buys: EquityBuy[];
  sells: EquitySell[];
  funds: MutualFund[];
  alternatives: AlternativeInvestment[];
  cash: CashEntry[];
  watchlist: WatchlistEntry[];
  dividends: DividendEntry[];
  
  dispatch: React.Dispatch<PortfolioAction>;

  // Equity Mutators
  addBuy: (buy: Omit<EquityBuy, 'totalBuyValue' | 'currentValue' | 'pctToTarget' | 'currentPE' | 'isPartialSold'>) => void;
  updateBuy: (id: string, buy: Partial<EquityBuy>) => void;
  deleteBuy: (id: string) => void;
  addSubsequentPurchase: (parentBuyId: string, purchase: Omit<EquityBuy, 'totalBuyValue' | 'currentValue' | 'pctToTarget' | 'currentPE' | 'isPartialSold'>) => void;
  
  addSell: (sell: Omit<EquitySell, 'totalSellValue' | 'realizedPnL' | 'realizedPnLPct'>) => void;
  updateSell: (id: string, sell: Partial<EquitySell>) => void;
  deleteSell: (id: string) => void;

  // MF Mutators
  addFund: (fund: Omit<MutualFund, 'currentValue' | 'investedValue' | 'unrealizedPnL' | 'unrealizedPnLPct' | 'realizedPnL'>) => void;
  updateFund: (id: string, fund: Partial<MutualFund>) => void;
  deleteFund: (id: string) => void;
  redeemFund: (id: string, unitsToRedeem: number, redeemNAV: number) => void;

  // Alternative Mutators
  addAlternative: (alt: Omit<AlternativeInvestment, 'unrealizedPnL' | 'unrealizedPnLPct'>) => void;
  updateAlternative: (id: string, alt: Partial<AlternativeInvestment>) => void;
  deleteAlternative: (id: string) => void;

  // Cash Mutators
  addCash: (entry: CashEntry) => void;
  deleteCash: (id: string) => void;

  // Watchlist Mutators
  addToWatchlist: (ticker: string) => Promise<boolean>;
  removeFromWatchlist: (ticker: string) => void;

  // Dividend Mutators
  addDividend: (dividend: DividendEntry) => void;
  deleteDividend: (id: string) => void;

  // Actions
  refreshAllData: () => Promise<void>;
  
  loadingPrices: boolean;
  lastUpdated: Date | null;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, updateUserPortfolio } = useAuth();
  const { fetchStock } = useStockData();
  const { fetchMFDetails } = useMFData();

  const [state, dispatch] = useReducer(portfolioReducer, initialPortfolioState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const username = currentUser?.username || '';
  const refreshIntervalRef = useRef<any>(null);

  // Helper to construct local storage keys
  const getStorageKey = (key: string) => `trcapital_user_${username}_${key}`;

  // Load user-namespaced data when user changes
  useEffect(() => {
    if (!username) {
      dispatch({ type: 'SET_PORTFOLIO', payload: initialPortfolioState });
      setIsLoaded(false);
      setLastUpdated(null);
      return;
    }

    try {
      if (currentUser?.portfolio) {
        dispatch({
          type: 'SET_PORTFOLIO',
          payload: {
            buys: currentUser.portfolio.buys || [],
            sells: currentUser.portfolio.sells || [],
            funds: currentUser.portfolio.funds || [],
            alternatives: currentUser.portfolio.alternatives || [],
            cash: currentUser.portfolio.cash || [],
            watchlist: currentUser.portfolio.watchlist || [],
            dividends: currentUser.portfolio.dividends || []
          }
        });
      } else {
        const storedBuys = localStorage.getItem(getStorageKey('buys'));
        const storedSells = localStorage.getItem(getStorageKey('sells'));
        const storedFunds = localStorage.getItem(getStorageKey('funds'));
        const storedAlts = localStorage.getItem(getStorageKey('alternatives'));
        const storedCash = localStorage.getItem(getStorageKey('cash'));
        const storedWatchlist = localStorage.getItem(getStorageKey('watchlist'));
        const storedDivs = localStorage.getItem(getStorageKey('dividends'));

        dispatch({
          type: 'SET_PORTFOLIO',
          payload: {
            buys: storedBuys ? JSON.parse(storedBuys) : [],
            sells: storedSells ? JSON.parse(storedSells) : [],
            funds: storedFunds ? JSON.parse(storedFunds) : [],
            alternatives: storedAlts ? JSON.parse(storedAlts) : [],
            cash: storedCash ? JSON.parse(storedCash) : [],
            watchlist: storedWatchlist ? JSON.parse(storedWatchlist) : [],
            dividends: storedDivs ? JSON.parse(storedDivs) : []
          }
        });
      }
      
      const storedTime = localStorage.getItem(getStorageKey('last_updated'));
      setLastUpdated(storedTime ? new Date(storedTime) : null);
      setIsLoaded(true);
    } catch (e) {
      console.error('Failed to load namespaced portfolio data', e);
    }
  }, [username]);

  // Synchronize writes to localStorage & global database
  useEffect(() => {
    if (!username || !isLoaded || !currentUser) return;
    
    // Save to namespaced keys
    localStorage.setItem(getStorageKey('buys'), JSON.stringify(state.buys));
    localStorage.setItem(getStorageKey('sells'), JSON.stringify(state.sells));
    localStorage.setItem(getStorageKey('funds'), JSON.stringify(state.funds));
    localStorage.setItem(getStorageKey('alternatives'), JSON.stringify(state.alternatives));
    localStorage.setItem(getStorageKey('cash'), JSON.stringify(state.cash));
    localStorage.setItem(getStorageKey('watchlist'), JSON.stringify(state.watchlist));
    localStorage.setItem(getStorageKey('dividends'), JSON.stringify(state.dividends));

    // Save to user object in global database
    const updatedPortfolio = {
      buys: state.buys,
      sells: state.sells,
      funds: state.funds,
      alternatives: state.alternatives,
      cash: state.cash,
      watchlist: state.watchlist,
      dividends: state.dividends
    };

    const currentPortfolioStr = JSON.stringify(currentUser.portfolio || {});
    const updatedPortfolioStr = JSON.stringify(updatedPortfolio);

    if (currentPortfolioStr !== updatedPortfolioStr) {
      updateUserPortfolio(currentUser.id, updatedPortfolio);
    }
    
    // Dispatch changed event for GitHub Cloud Sync
    window.dispatchEvent(new Event('trcapital-db-changed'));
  }, [state, username, isLoaded, currentUser, updateUserPortfolio]);

  // Re-fetch Live stock prices and Mutual Fund NAVs
  const refreshAllData = useCallback(async () => {
    if (!username || loadingPrices || !isLoaded) return;
    setLoadingPrices(true);

    try {
      const stockTickers = new Set<string>();
      state.buys.forEach(b => {
        stockTickers.add(b.ticker);
        (b.subsequentPurchases || []).forEach(sub => stockTickers.add(sub.ticker));
      });
      state.sells.forEach(s => stockTickers.add(s.ticker));
      state.watchlist.forEach(w => stockTickers.add(w.ticker));

      const stockUpdates: Record<string, { currentPrice: number; currentPE: number; stockName: string; industry: string; isStale: boolean }> = {};
      
      await Promise.all(
        Array.from(stockTickers).map(async (ticker) => {
          try {
            const data = await fetchStock(ticker);
            stockUpdates[ticker] = {
              currentPrice: data.currentPrice,
              currentPE: data.currentPE,
              stockName: data.stockName,
              industry: data.industry,
              isStale: data.isStale
            };
          } catch (e) {
            console.error(`Error fetching ticker ${ticker} during refresh`, e);
          }
        })
      );

      const updatedBuys = state.buys.map(buy => {
        const update = stockUpdates[buy.ticker];
        const currentPrice = update ? update.currentPrice : buy.currentPrice;
        const currentPE = update ? update.currentPE : buy.currentPE;
        const stockName = update ? update.stockName : buy.stockName;
        const industry = update ? update.industry : buy.industry;

        const updatedSubsequent = (buy.subsequentPurchases || []).map(sub => {
          const subUpdate = stockUpdates[sub.ticker];
          const subPrice = subUpdate ? subUpdate.currentPrice : sub.currentPrice;
          const subPE = subUpdate ? subUpdate.currentPE : sub.currentPE;
          const subName = subUpdate ? subUpdate.stockName : sub.stockName;
          const subIndustry = subUpdate ? subUpdate.industry : sub.industry;
          
          return {
            ...sub,
            currentPrice: subPrice,
            currentPE: subPE,
            stockName: subName,
            industry: subIndustry,
            currentValue: sub.quantity * subPrice,
            pctToTarget: subPrice > 0 ? ((sub.targetPrice - subPrice) / subPrice) * 100 : 0
          };
        });

        return {
          ...buy,
          currentPrice,
          currentPE,
          stockName,
          industry,
          currentValue: buy.quantity * currentPrice,
          pctToTarget: currentPrice > 0 ? ((buy.targetPrice - currentPrice) / currentPrice) * 100 : 0,
          subsequentPurchases: updatedSubsequent
        };
      });

      const updatedWatchlist = state.watchlist.map(item => {
        const update = stockUpdates[item.ticker];
        if (!update) return item;
        return {
          ...item,
          currentPrice: update.currentPrice,
          currentPE: update.currentPE,
          stockName: update.stockName,
          lastUpdated: new Date().toISOString()
        };
      });

      const schemeCodes = Array.from(new Set(state.funds.map(f => f.schemeCode)));
      const mfUpdates: Record<string, { currentNAV: number; aum: number; schemeName: string }> = {};

      await Promise.all(
        schemeCodes.map(async (code) => {
          try {
            const data = await fetchMFDetails(code);
            mfUpdates[code] = {
              currentNAV: data.currentNAV,
              aum: data.aum,
              schemeName: data.schemeName
            };
          } catch (e) {
            console.error(`Error fetching MF scheme ${code} during refresh`, e);
          }
        })
      );

      const updatedFunds = state.funds.map(fund => {
        const update = mfUpdates[fund.schemeCode];
        if (!update) return fund;
        const currentNAV = update.currentNAV;
        const currentValue = fund.units * currentNAV;
        const unrealizedPnL = currentValue - fund.investedValue;
        const unrealizedPnLPct = fund.investedValue > 0 ? (unrealizedPnL / fund.investedValue) * 100 : 0;
        
        return {
          ...fund,
          schemeName: update.schemeName,
          currentNAV,
          aum: update.aum,
          currentValue,
          unrealizedPnL,
          unrealizedPnLPct
        };
      });

      dispatch({
        type: 'UPDATE_PRICES',
        payload: {
          buys: updatedBuys,
          watchlist: updatedWatchlist,
          funds: updatedFunds
        }
      });

      const now = new Date();
      setLastUpdated(now);
      localStorage.setItem(getStorageKey('last_updated'), now.toISOString());
    } catch (e) {
      console.error('Failed to complete background portfolio price update', e);
    } finally {
      setLoadingPrices(false);
    }
  }, [state, username, isLoaded, fetchStock, fetchMFDetails]);

  // Set up auto-refresh loop (5 minutes)
  useEffect(() => {
    if (!username) {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      return;
    }

    refreshAllData();

    refreshIntervalRef.current = setInterval(() => {
      refreshAllData();
    }, 300000);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [username]);

  // Equity Buys Mutators
  const addBuy = (buy: Omit<EquityBuy, 'totalBuyValue' | 'currentValue' | 'pctToTarget' | 'currentPE' | 'isPartialSold'>) => {
    const totalBuyValue = (buy.quantity * buy.avgBuyPrice) + buy.fees;
    const currentPrice = buy.currentPrice || buy.avgBuyPrice;
    const currentValue = buy.quantity * currentPrice;
    const pctToTarget = currentPrice > 0 ? ((buy.targetPrice - currentPrice) / currentPrice) * 100 : 0;

    const newBuy: EquityBuy = {
      ...buy,
      totalBuyValue,
      currentPrice,
      currentValue,
      pctToTarget,
      currentPE: 0,
      isPartialSold: false,
      subsequentPurchases: []
    };

    dispatch({ type: 'ADD_BUY', payload: newBuy });
  };

  const updateBuy = (id: string, updatedFields: Partial<EquityBuy>) => {
    dispatch({ type: 'UPDATE_BUY', payload: { id, fields: updatedFields } });
  };

  const deleteBuy = (id: string) => {
    dispatch({ type: 'DELETE_BUY', payload: id });
  };

  const addSubsequentPurchase = (parentBuyId: string, purchase: Omit<EquityBuy, 'totalBuyValue' | 'currentValue' | 'pctToTarget' | 'currentPE' | 'isPartialSold'>) => {
    const totalBuyValue = (purchase.quantity * purchase.avgBuyPrice) + purchase.fees;
    const currentPrice = purchase.currentPrice || purchase.avgBuyPrice;
    const currentValue = purchase.quantity * currentPrice;
    const pctToTarget = currentPrice > 0 ? ((purchase.targetPrice - currentPrice) / currentPrice) * 100 : 0;

    const newSub: EquityBuy = {
      ...purchase,
      totalBuyValue,
      currentPrice,
      currentValue,
      pctToTarget,
      currentPE: 0,
      isPartialSold: false,
      subsequentPurchases: []
    };

    dispatch({ type: 'ADD_SUBSEQUENT_PURCHASE', payload: { parentId: parentBuyId, sub: newSub } });
  };

  // Equity Sells Mutators
  const addSell = (sell: Omit<EquitySell, 'totalSellValue' | 'realizedPnL' | 'realizedPnLPct'>) => {
    const linkedBuy = state.buys.find(b => b.transactionId === sell.linkedBuyId);
    if (!linkedBuy) return;

    const totalSellValue = (sell.quantity * sell.avgSellPrice) - sell.fees;
    const proRatedBuyCost = (sell.quantity / linkedBuy.quantity) * linkedBuy.totalBuyValue;
    const realizedPnL = totalSellValue - proRatedBuyCost;
    const realizedPnLPct = proRatedBuyCost > 0 ? (realizedPnL / proRatedBuyCost) * 100 : 0;

    const newSell: EquitySell = {
      ...sell,
      totalSellValue,
      realizedPnL,
      realizedPnLPct
    };

    dispatch({ type: 'ADD_SELL', payload: newSell });
  };

  const updateSell = (id: string, fields: Partial<EquitySell>) => {
    dispatch({ type: 'UPDATE_SELL', payload: { id, fields } });
  };

  const deleteSell = (id: string) => {
    dispatch({ type: 'DELETE_SELL', payload: id });
  };

  // Mutual Funds Mutators
  const addFund = (fund: Omit<MutualFund, 'currentValue' | 'investedValue' | 'unrealizedPnL' | 'unrealizedPnLPct' | 'realizedPnL'>) => {
    const investedValue = fund.units * fund.buyNAV;
    const currentNAV = fund.currentNAV || fund.buyNAV;
    const currentValue = fund.units * currentNAV;
    const unrealizedPnL = currentValue - investedValue;
    const unrealizedPnLPct = investedValue > 0 ? (unrealizedPnL / investedValue) * 100 : 0;

    const newFund: MutualFund = {
      ...fund,
      investedValue,
      currentNAV,
      currentValue,
      unrealizedPnL,
      unrealizedPnLPct,
      realizedPnL: 0
    };

    dispatch({ type: 'ADD_FUND', payload: newFund });
  };

  const updateFund = (id: string, fields: Partial<MutualFund>) => {
    dispatch({ type: 'UPDATE_FUND', payload: { id, fields } });
  };

  const deleteFund = (id: string) => {
    dispatch({ type: 'DELETE_FUND', payload: id });
  };

  const redeemFund = (id: string, unitsToRedeem: number, redeemNAV: number) => {
    dispatch({ type: 'REDEEM_FUND', payload: { id, units: unitsToRedeem, nav: redeemNAV } });
  };

  // Alternative Investments Mutators
  const addAlternative = (alt: Omit<AlternativeInvestment, 'unrealizedPnL' | 'unrealizedPnLPct'>) => {
    const unrealizedPnL = alt.currentValue - alt.investedAmount;
    const unrealizedPnLPct = alt.investedAmount > 0 ? (unrealizedPnL / alt.investedAmount) * 100 : 0;

    const newAlt: AlternativeInvestment = {
      ...alt,
      unrealizedPnL,
      unrealizedPnLPct
    };

    dispatch({ type: 'ADD_ALTERNATIVE', payload: newAlt });
  };

  const updateAlternative = (id: string, fields: Partial<AlternativeInvestment>) => {
    dispatch({ type: 'UPDATE_ALTERNATIVE', payload: { id, fields } });
  };

  const deleteAlternative = (id: string) => {
    dispatch({ type: 'DELETE_ALTERNATIVE', payload: id });
  };

  // Cash Ledger Mutators
  const addCash = (entry: CashEntry) => {
    dispatch({ type: 'ADD_CASH', payload: entry });
  };

  const deleteCash = (id: string) => {
    dispatch({ type: 'DELETE_CASH', payload: id });
  };

  // Watchlist Mutators
  const addToWatchlist = async (tickerInput: string): Promise<boolean> => {
    let ticker = tickerInput.trim().toUpperCase();
    if (!ticker.endsWith('.NS') && !ticker.endsWith('.BO')) {
      ticker = `${ticker}.NS`;
    }

    if (state.watchlist.some(w => w.ticker === ticker)) return false;

    try {
      const stock = await fetchStock(ticker);
      const newEntry: WatchlistEntry = {
        ticker,
        stockName: stock.stockName,
        currentPrice: stock.currentPrice,
        currentPE: stock.currentPE,
        range52W: '₹' + (stock.currentPrice * 0.8).toFixed(0) + ' - ₹' + (stock.currentPrice * 1.2).toFixed(0),
        lastUpdated: new Date().toISOString()
      };
      dispatch({ type: 'ADD_TO_WATCHLIST', payload: newEntry });
      return true;
    } catch (e) {
      console.error('Failed to add ticker to watchlist', e);
      return false;
    }
  };

  const removeFromWatchlist = (ticker: string) => {
    dispatch({ type: 'REMOVE_FROM_WATCHLIST', payload: ticker });
  };

  // Dividend Mutators
  const addDividend = (dividend: DividendEntry) => {
    dispatch({ type: 'ADD_DIVIDEND', payload: dividend });
    
    addCash({
      id: dividend.id,
      date: dividend.date,
      type: 'credit',
      amount: dividend.amount,
      description: `Dividend received from ${dividend.ticker}`
    });
  };

  const deleteDividend = (id: string) => {
    dispatch({ type: 'DELETE_DIVIDEND', payload: id });
    deleteCash(id);
  };

  return (
    <PortfolioContext.Provider
      value={{
        buys: state.buys,
        sells: state.sells,
        funds: state.funds,
        alternatives: state.alternatives,
        cash: state.cash,
        watchlist: state.watchlist,
        dividends: state.dividends,
        dispatch,
        addBuy,
        updateBuy,
        deleteBuy,
        addSubsequentPurchase,
        addSell,
        updateSell,
        deleteSell,
        addFund,
        updateFund,
        deleteFund,
        redeemFund,
        addAlternative,
        updateAlternative,
        deleteAlternative,
        addCash,
        deleteCash,
        addToWatchlist,
        removeFromWatchlist,
        addDividend,
        deleteDividend,
        refreshAllData,
        loadingPrices,
        lastUpdated
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
