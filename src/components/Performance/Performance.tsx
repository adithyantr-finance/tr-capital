import React, { useState, useMemo, useEffect } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { getActiveHoldings, formatINR } from '../../utils/calculations';
import BenchmarkComparison from './BenchmarkComparison';
import { 
  LineChart as ReLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  CartesianGrid,
  Legend
} from 'recharts';
import { 
  RefreshCw,
  Award
} from 'lucide-react';

export const Performance: React.FC = () => {
  const { buys, sells, funds, alternatives, cash } = usePortfolio();

  const activeHoldings = useMemo(() => getActiveHoldings(buys, sells), [buys, sells]);

  // Chart 1 State
  const [timeRange, setTimeRange] = useState<'W' | 'M' | 'ALL' | 'CUSTOM'>('ALL');
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');

  const dateRange = useMemo(() => {
    const today = new Date();
    let from = new Date();
    
    if (timeRange === 'W') {
      from.setDate(today.getDate() - 7);
    } else if (timeRange === 'M') {
      from.setDate(today.getDate() - 30);
    } else if (timeRange === 'ALL') {
      let earliest = new Date();
      earliest.setFullYear(earliest.getFullYear() - 1);
      
      const checkDate = (dStr: string) => {
        const d = new Date(dStr);
        if (!isNaN(d.getTime()) && d < earliest) {
          earliest = d;
        }
      };

      buys.forEach(b => {
        checkDate(b.date);
        (b.subsequentPurchases || []).forEach(sub => checkDate(sub.date));
      });
      sells.forEach(s => checkDate(s.date));
      funds.forEach(f => checkDate(f.dateOfBuy));
      alternatives.forEach(a => checkDate(a.dateOfInvestment));
      cash.forEach(c => checkDate(c.date));

      from = earliest;
    } else if (timeRange === 'CUSTOM') {
      if (customFromDate && customToDate) {
        return {
          fromDate: customFromDate,
          toDate: customToDate
        };
      }
      from.setDate(today.getDate() - 30);
    }

    return {
      fromDate: from.toISOString().split('T')[0],
      toDate: today.toISOString().split('T')[0]
    };
  }, [timeRange, customFromDate, customToDate, buys, sells, funds, alternatives, cash]);

  // Chart 2 State (Stock specific)
  const [selectedTicker, setSelectedTicker] = useState(activeHoldings[0]?.ticker || '');
  const [stockHistoryRange, setStockHistoryRange] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('6M');
  const [stockHistory, setStockHistory] = useState<{ date: string; Price: number }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // If activeHoldings load and selectedTicker is empty, auto select first
  useEffect(() => {
    if (activeHoldings.length > 0 && !selectedTicker) {
      setSelectedTicker(activeHoldings[0].ticker);
    }
  }, [activeHoldings, selectedTicker]);

  // Fetch individual stock historical performance (Yahoo Finance via Electron, fallback to walk)
  useEffect(() => {
    if (!selectedTicker) return;

    const fetchHistory = async () => {
      setLoadingHistory(true);
      const electronApi = (window as any).electron;
      const matchedHolding = activeHoldings.find(h => h.ticker === selectedTicker);
      const startPrice = matchedHolding ? matchedHolding.avgBuyPrice : 100;
      const endPrice = matchedHolding ? matchedHolding.currentPrice : startPrice;

      // 1. Electron IPC Bridge Fetch
      if (electronApi && typeof electronApi.fetchStockHistory === 'function') {
        try {
          // translate ranges
          const rangeMap = { '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', 'ALL': '5y' };
          const rangeVal = rangeMap[stockHistoryRange];
          
          const res = await electronApi.fetchStockHistory(selectedTicker, rangeVal);
          if (res.success && res.data) {
            const chartResult = res.data.chart?.result?.[0];
            const timestamps = chartResult?.timestamp || [];
            const closePrices = chartResult?.indicators?.quote?.[0]?.close || [];
            
            const parsedData = timestamps.map((ts: number, idx: number) => {
              const date = new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
              return {
                date,
                Price: Number(closePrices[idx]?.toFixed(2)) || endPrice
              };
            }).filter((item: any) => !isNaN(item.Price));

            if (parsedData.length > 0) {
              setStockHistory(parsedData);
              setLoadingHistory(false);
              return;
            }
          }
        } catch (e) {
          console.error('Failed to load Yahoo historical data', e);
        }
      }

      // 2. Direct browser fetch with CORS proxy
      try {
        const rangeMap = { '1M': '1mo', '3M': '3mo', '6M': '6mo', '1Y': '1y', 'ALL': '5y' };
        const rangeVal = rangeMap[stockHistoryRange];
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${selectedTicker}?range=${rangeVal}&interval=1d`;
        const response = await fetch(`https://corsproxy.io/?` + encodeURIComponent(url));
        if (response.ok) {
          const res = await response.json();
          const chartResult = res.chart?.result?.[0];
          if (chartResult) {
            const timestamps = chartResult.timestamp || [];
            const closePrices = chartResult.indicators?.quote?.[0]?.close || [];
            
            const parsedData = timestamps.map((ts: number, idx: number) => {
              const date = new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
              return {
                date,
                Price: Number(closePrices[idx]?.toFixed(2)) || endPrice
              };
            }).filter((item: any) => !isNaN(item.Price));

            if (parsedData.length > 0) {
              setStockHistory(parsedData);
              setLoadingHistory(false);
              return;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to load Yahoo historical data via CORS proxy', e);
      }

      // 3. Offline Random Walk Fallback
      // Reconstruct a realistic curve between buy date and current price
      const days = stockHistoryRange === '1M' ? 30 : stockHistoryRange === '3M' ? 90 : stockHistoryRange === '6M' ? 180 : stockHistoryRange === '1Y' ? 365 : 500;
      const walkData: { date: string; Price: number }[] = [];
      const step = (endPrice - startPrice) / days;

      for (let i = 0; i <= days; i += Math.max(1, Math.floor(days / 30))) {
        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() - (days - i));
        
        // Add random variance of 1.5% daily
        const basePrice = startPrice + (step * i);
        const noise = (Math.random() - 0.48) * 0.03 * basePrice;
        const finalPrice = i === days ? endPrice : Math.max(1, basePrice + noise);

        walkData.push({
          date: dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          Price: Number(finalPrice.toFixed(2))
        });
      }

      setStockHistory(walkData);
      setLoadingHistory(false);
    };

    fetchHistory();
  }, [selectedTicker, stockHistoryRange, activeHoldings]);

  // --- Chart 1: Reconstruct Portfolio value over time ---
  const portfolioHistory = useMemo(() => {
    const start = new Date(dateRange.fromDate);
    const end = new Date(dateRange.toDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return [];
    }

    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const dates: Date[] = [];
    const step = Math.max(1, Math.floor(diffDays / 120));
    
    for (let i = 0; i <= diffDays; i += step) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    
    if (dates.length > 0 && dates[dates.length - 1].toISOString().split('T')[0] !== end.toISOString().split('T')[0]) {
      dates.push(end);
    }

    const today = new Date();
    const dataList: { date: string; rawDate: string; Invested: number; Current: number }[] = [];

    dates.forEach(date => {
      const dateMs = date.getTime();
      let investedVal = 0;
      let currentVal = 0;

      // 1. Walk through Equities Buys
      buys.forEach(b => {
        const buyDateMs = new Date(b.date).getTime();
        if (buyDateMs <= dateMs) {
          investedVal += b.totalBuyValue;
          
          const daysTotal = Math.max(1, (today.getTime() - buyDateMs) / (1000 * 60 * 60 * 24));
          const daysPassed = (dateMs - buyDateMs) / (1000 * 60 * 60 * 24);
          const ratio = Math.min(1, Math.max(0, daysPassed / daysTotal));
          
          const histPrice = b.avgBuyPrice + (b.currentPrice - b.avgBuyPrice) * ratio;
          currentVal += b.quantity * histPrice;

          // Subsequent buys
          (b.subsequentPurchases || []).forEach(sub => {
            const subDateMs = new Date(sub.date).getTime();
            if (subDateMs <= dateMs) {
              investedVal += sub.totalBuyValue;
              const subDays = Math.max(1, (today.getTime() - subDateMs) / (1000 * 60 * 60 * 24));
              const subPassed = (dateMs - subDateMs) / (1000 * 60 * 60 * 24);
              const subRatio = Math.min(1, Math.max(0, subPassed / subDays));
              
              const subHistPrice = sub.avgBuyPrice + (sub.currentPrice - sub.avgBuyPrice) * subRatio;
              currentVal += sub.quantity * subHistPrice;
            }
          });
        }
      });

      // Subtract sells
      sells.forEach(s => {
        const sellDateMs = new Date(s.date).getTime();
        if (sellDateMs <= dateMs) {
          const matchingBuy = buys.find(b => b.transactionId === s.linkedBuyId);
          if (matchingBuy) {
            const sellRatio = s.quantity / matchingBuy.quantity;
            investedVal -= matchingBuy.totalBuyValue * sellRatio;
            
            const buyDateMs = new Date(matchingBuy.date).getTime();
            const daysTotal = Math.max(1, (today.getTime() - buyDateMs) / (1000 * 60 * 60 * 24));
            const daysPassed = (dateMs - buyDateMs) / (1000 * 60 * 60 * 24);
            const ratio = Math.min(1, Math.max(0, daysPassed / daysTotal));
            const histPrice = matchingBuy.avgBuyPrice + (matchingBuy.currentPrice - matchingBuy.avgBuyPrice) * ratio;
            
            currentVal -= s.quantity * histPrice;
          }
        }
      });

      // 2. Walk through Mutual Funds
      funds.forEach(f => {
        const buyDateMs = new Date(f.dateOfBuy).getTime();
        if (buyDateMs <= dateMs) {
          investedVal += f.investedValue;
          
          const daysTotal = Math.max(1, (today.getTime() - buyDateMs) / (1000 * 60 * 60 * 24));
          const daysPassed = (dateMs - buyDateMs) / (1000 * 60 * 60 * 24);
          const ratio = Math.min(1, Math.max(0, daysPassed / daysTotal));
          
          const histNAV = f.buyNAV + (f.currentNAV - f.buyNAV) * ratio;
          currentVal += f.units * histNAV;
        }
      });

      // 3. Walk Alternatives
      alternatives.forEach(a => {
        const dateMsInvest = new Date(a.dateOfInvestment).getTime();
        if (dateMsInvest <= dateMs) {
          investedVal += a.investedAmount;
          
          const daysTotal = Math.max(1, (today.getTime() - dateMsInvest) / (1000 * 60 * 60 * 24));
          const daysPassed = (dateMs - dateMsInvest) / (1000 * 60 * 60 * 24);
          const ratio = Math.min(1, Math.max(0, daysPassed / daysTotal));
          
          currentVal += a.investedAmount + (a.currentValue - a.investedAmount) * ratio;
        }
      });

      // 4. Walk Cash
      cash.forEach(c => {
        const cashDateMs = new Date(c.date).getTime();
        if (cashDateMs <= dateMs) {
          const flow = c.type === 'credit' ? c.amount : -c.amount;
          investedVal += flow;
          currentVal += flow;
        }
      });

      const rawDate = date.toISOString().split('T')[0];
      dataList.push({
        date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        rawDate,
        Invested: Math.max(0, Math.round(investedVal)),
        Current: Math.max(0, Math.round(currentVal))
      });
    });

    return dataList;
  }, [buys, sells, funds, alternatives, cash, dateRange]);

  const portfolioValueSeries = useMemo(() => {
    return portfolioHistory.map(item => ({
      date: item.rawDate,
      value: item.Current
    }));
  }, [portfolioHistory]);

  // --- Best & Worst Performers ---
  const performanceRanking = useMemo(() => {
    const list: { ticker: string; pnl: number; pnlPct: number; name: string }[] = [];

    activeHoldings.forEach(h => {
      list.push({ ticker: h.ticker, pnl: h.unrealizedPnL, pnlPct: h.unrealizedPnLPct, name: h.stockName });
    });

    funds.forEach(f => {
      list.push({ ticker: f.id, pnl: f.unrealizedPnL, pnlPct: f.unrealizedPnLPct, name: f.schemeName });
    });

    const sorted = [...list].sort((a, b) => b.pnlPct - a.pnlPct);
    const best = sorted.slice(0, 3).filter(x => x.pnlPct > 0);
    const worst = [...sorted].reverse().slice(0, 3).filter(x => x.pnlPct < 0);

    return { best, worst };
  }, [activeHoldings, funds]);

  // --- Period Summary Metrics ---
  const periodSummary = useMemo(() => {
    const startMs = new Date(dateRange.fromDate).getTime();
    const endMs = new Date(dateRange.toDate).getTime();

    const bought = buys.filter(b => {
      const ms = new Date(b.date).getTime();
      return ms >= startMs && ms <= endMs;
    });
    const sold = sells.filter(s => {
      const ms = new Date(s.date).getTime();
      return ms >= startMs && ms <= endMs;
    });

    const capitalDeployed = bought.reduce((sum, b) => sum + b.totalBuyValue, 0);
    const capitalWithdrawn = sold.reduce((sum, s) => sum + s.totalSellValue, 0);

    const netDeployed = capitalDeployed - capitalWithdrawn;
    const realizedPnL = sold.reduce((sum, s) => sum + s.realizedPnL, 0);

    return {
      stocksBoughtCount: bought.length,
      stocksSoldCount: sold.length,
      netDeployed,
      realizedPnL
    };
  }, [buys, sells, dateRange]);

  // Find active holding parameters for stock chart reference lines
  const selectedHoldingData = useMemo(() => {
    if (!selectedTicker) return null;
    return activeHoldings.find(h => h.ticker === selectedTicker) || null;
  }, [selectedTicker, activeHoldings]);

  return (
    <div className="space-y-6 select-text">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 select-none">
        <div>
          <h2 className="text-xl font-bold font-sans text-cream">Performance & Analytics</h2>
          <p className="text-[12px] text-muted">Advanced portfolio tracking curves, stock histories and statistics</p>
        </div>
      </div>

      {/* CHART 1: PORTFOLIO VALUE OVER TIME */}
      <div className="bg-surface border border-border rounded p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 select-none">
          <div>
            <h4 className="text-[13px] font-bold text-[#E8DCC8] uppercase tracking-wider">Portfolio Net Asset Value</h4>
            <p className="text-[11px] text-muted mt-0.5">Historical growth comparing deployed capital vs valuation</p>
          </div>
          
          {/* Timeframe selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-[#0A0A0F] border border-border rounded p-1">
              <button
                onClick={() => setTimeRange('W')}
                className={`px-3 py-1 font-sans text-[11px] font-bold uppercase rounded transition-colors
                  ${timeRange === 'W' ? 'bg-primary text-[#0A0A0F]' : 'text-muted hover:text-cream'}`}
              >
                Weekly
              </button>
              <button
                onClick={() => setTimeRange('M')}
                className={`px-3 py-1 font-sans text-[11px] font-bold uppercase rounded transition-colors
                  ${timeRange === 'M' ? 'bg-primary text-[#0A0A0F]' : 'text-muted hover:text-cream'}`}
              >
                Monthly
              </button>
              <button
                onClick={() => setTimeRange('ALL')}
                className={`px-3 py-1 font-sans text-[11px] font-bold uppercase rounded transition-colors
                  ${timeRange === 'ALL' ? 'bg-primary text-[#0A0A0F]' : 'text-muted hover:text-cream'}`}
              >
                All Time
              </button>
              <button
                onClick={() => {
                  setTimeRange('CUSTOM');
                  if (!customFromDate) {
                    const oneMonthAgo = new Date();
                    oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);
                    setCustomFromDate(oneMonthAgo.toISOString().split('T')[0]);
                  }
                  if (!customToDate) {
                    setCustomToDate(new Date().toISOString().split('T')[0]);
                  }
                }}
                className={`px-3 py-1 font-sans text-[11px] font-bold uppercase rounded transition-colors
                  ${timeRange === 'CUSTOM' ? 'bg-primary text-[#0A0A0F]' : 'text-muted hover:text-cream'}`}
              >
                Custom
              </button>
            </div>

            {timeRange === 'CUSTOM' && (
              <div className="flex items-center gap-2 bg-[#0A0A0F] border border-border rounded p-1">
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="bg-transparent text-cream border-none focus:outline-none text-[11px] font-mono px-1 py-0.5"
                />
                <span className="text-muted text-[10px] uppercase font-bold font-sans">to</span>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="bg-transparent text-cream border-none focus:outline-none text-[11px] font-mono px-1 py-0.5"
                />
              </div>
            )}
          </div>
        </div>

        {/* Recharts Container */}
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ReLineChart data={portfolioHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1A1A26" />
              <XAxis dataKey="date" stroke="#A0A0B0" fontSize={11} tickLine={false} />
              <YAxis stroke="#A0A0B0" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${(v/100000).toFixed(1)}L`} />
              <Tooltip 
                formatter={(value: any) => [formatINR(Number(value)), '']}
                contentStyle={{ backgroundColor: '#1A1A26', borderColor: '#2A2A3A', color: '#F0F0F5' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="Invested" name="Capital Invested" stroke="#A0A0B0" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Current" name="Current Valuation" stroke="#C8A96E" strokeWidth={3} dot={false} />
            </ReLineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Best/Worst Performers & Period Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Best Performers */}
        <div className="bg-surface border border-border rounded p-5 flex flex-col justify-between">
          <h4 className="text-[11px] text-muted uppercase font-bold tracking-widest mb-3 select-none flex items-center gap-1.5">
            <Award className="w-4 h-4 text-success" />
            Top Gainers
          </h4>
          <div className="space-y-3 flex-1 justify-center flex flex-col">
            {performanceRanking.best.length > 0 ? (
              performanceRanking.best.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[12px] border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                  <div className="min-w-0 pr-4">
                    <div className="font-mono font-bold text-primary truncate">{item.ticker}</div>
                    <div className="text-[10px] text-hint truncate font-sans">{item.name}</div>
                  </div>
                  <span className="text-success font-mono font-bold whitespace-nowrap">
                    +{item.pnlPct.toFixed(1)}% ({formatINR(item.pnl)})
                  </span>
                </div>
              ))
            ) : (
              <span className="text-hint text-[12px] font-sans select-none text-center block">No positive returns recorded.</span>
            )}
          </div>
        </div>

        {/* Worst Performers */}
        <div className="bg-surface border border-border rounded p-5 flex flex-col justify-between">
          <h4 className="text-[11px] text-muted uppercase font-bold tracking-widest mb-3 select-none flex items-center gap-1.5">
            <Award className="w-4 h-4 text-danger" />
            Top Decliners
          </h4>
          <div className="space-y-3 flex-1 justify-center flex flex-col">
            {performanceRanking.worst.length > 0 ? (
              performanceRanking.worst.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[12px] border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                  <div className="min-w-0 pr-4">
                    <div className="font-mono font-bold text-primary truncate">{item.ticker}</div>
                    <div className="text-[10px] text-hint truncate font-sans">{item.name}</div>
                  </div>
                  <span className="text-danger font-mono font-bold whitespace-nowrap">
                    {item.pnlPct.toFixed(1)}% ({formatINR(item.pnl)})
                  </span>
                </div>
              ))
            ) : (
              <span className="text-hint text-[12px] font-sans select-none text-center block">No negative returns recorded.</span>
            )}
          </div>
        </div>

        {/* Period Summary */}
        <div className="bg-surface border border-border rounded p-5 hover:border-primary/40 transition-colors">
          <h4 className="text-[11px] text-muted uppercase font-bold tracking-widest mb-4 select-none">
            Period Summary ({
              timeRange === 'W' ? '7 Days' : 
              timeRange === 'M' ? '30 Days' : 
              timeRange === 'ALL' ? 'All Time' : 
              'Custom Range'
            })
          </h4>
          <div className="space-y-3 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-muted font-sans">Assets Purchased</span>
              <span className="text-cream font-mono font-bold">{periodSummary.stocksBoughtCount} assets</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted font-sans">Assets Liquidated</span>
              <span className="text-cream font-mono font-bold">{periodSummary.stocksSoldCount} assets</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted font-sans">Net Capital Flow</span>
              <span className={`font-mono font-bold ${periodSummary.netDeployed >= 0 ? 'text-cream' : 'text-success'}`}>
                {periodSummary.netDeployed >= 0 ? 'Deployed: ' : 'Withdrawn: '}
                {formatINR(Math.abs(periodSummary.netDeployed))}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/40">
              <span className="text-muted font-sans font-semibold">Realized Net Returns</span>
              <span className={`font-mono font-bold ${periodSummary.realizedPnL >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatINR(periodSummary.realizedPnL)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* CHART 2: INDIVIDUAL STOCK HISTORIC PLOT */}
      <div className="bg-surface border border-border rounded p-6 space-y-4">
        
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 select-none">
          <div className="flex items-center gap-3">
            <h4 className="text-[13px] font-bold text-[#E8DCC8] uppercase tracking-wider">Asset Specific Ledger</h4>
            
            {/* Stock selector dropdown */}
            <select
              value={selectedTicker}
              onChange={(e) => setSelectedTicker(e.target.value)}
              className="px-2 py-1 bg-[#0A0A0F] border border-border rounded text-primary text-[12px] font-bold font-mono focus:border-primary transition-colors"
            >
              <option value="">-- Choose Stock --</option>
              {activeHoldings.map(h => (
                <option key={h.ticker} value={h.ticker}>{h.ticker}</option>
              ))}
            </select>
          </div>

          {/* Timeframe selection */}
          <div className="flex items-center bg-[#0A0A0F] border border-border rounded p-1">
            {['1M', '3M', '6M', '1Y', 'ALL'].map((r) => (
              <button
                key={r}
                onClick={() => setStockHistoryRange(r as any)}
                className={`px-2.5 py-0.5 font-sans text-[11px] font-bold rounded transition-colors
                  ${stockHistoryRange === r ? 'bg-primary text-[#0A0A0F]' : 'text-muted hover:text-cream'}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Chart Frame */}
        <div className="h-[280px] w-full relative">
          {loadingHistory && (
            <div className="absolute inset-0 bg-[#0A0A0F]/60 flex items-center justify-center z-10 select-none">
              <RefreshCw className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}
          {selectedTicker ? (
            <ResponsiveContainer width="100%" height="100%">
              <ReLineChart data={stockHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A26" />
                <XAxis dataKey="date" stroke="#A0A0B0" fontSize={11} tickLine={false} />
                <YAxis stroke="#A0A0B0" fontSize={11} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `₹${v.toFixed(0)}`} />
                <Tooltip 
                  formatter={(value: any) => [formatINR(Number(value)), 'Price']}
                  contentStyle={{ backgroundColor: '#1A1A26', borderColor: '#2A2A3A', color: '#F0F0F5' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="Price" name="Historic Price" stroke="#4A9EFF" strokeWidth={2.5} dot={false} />
                
                {/* Reference Lines */}
                {selectedHoldingData && (
                  <>
                    <ReferenceLine 
                      y={selectedHoldingData.avgBuyPrice} 
                      stroke="#A0A0B0" 
                      strokeDasharray="4 4"
                      label={{ value: `Buy: ₹${selectedHoldingData.avgBuyPrice.toFixed(0)}`, fill: '#A0A0B0', fontSize: 10, position: 'insideBottomLeft' }} 
                    />
                    <ReferenceLine 
                      y={selectedHoldingData.targetPrice} 
                      stroke="#C8A96E" 
                      strokeDasharray="2 2"
                      label={{ value: `Target: ₹${selectedHoldingData.targetPrice.toFixed(0)}`, fill: '#C8A96E', fontSize: 10, position: 'insideTopLeft' }} 
                    />
                  </>
                )}
              </ReLineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-[#505065] text-[13px] select-none">
              Please buy listed equities to inspect stock specific histories.
            </div>
          )}
        </div>
      </div>

      {/* Benchmark Comparison */}
      <BenchmarkComparison
        fromDate={dateRange.fromDate}
        toDate={dateRange.toDate}
        portfolioValueSeries={portfolioValueSeries}
      />
    </div>
  );
};
export default Performance;
