import React, { useMemo } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { getActiveHoldings, formatINR, calculateHealthScore } from '../../utils/calculations';
import { exportPortfolioToExcel } from '../../utils/excelExport';
import { useToast } from '../shared/Toast';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Award, 
  FileDown, 
  AlertTriangle,
  Calendar,
  Layers,
  CircleDot
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';

const MOCK_STOCK_BETAS: Record<string, number> = {
  'RELIANCE.NS': 1.15,
  'TCS.NS': 0.85,
  'INFY.NS': 0.95,
  'HDFCBANK.NS': 1.10,
  'ICICIBANK.NS': 1.20,
  'ITC.NS': 0.65,
  'TATASTEEL.NS': 1.45,
  'SBIN.NS': 1.25,
  'BHARTIARTL.NS': 0.90,
  'LTIM.NS': 1.05,
};

export const Dashboard: React.FC = () => {
  const { buys, sells, funds, alternatives, cash, dividends } = usePortfolio();
  const { showToast } = useToast();

  const activeHoldings = useMemo(() => getActiveHoldings(buys, sells), [buys, sells]);

  // --- Core Calculations ---
  
  // 1. Cash Balance
  const cashBalance = useMemo(() => {
    return cash.reduce((sum, c) => sum + (c.type === 'credit' ? c.amount : -c.amount), 0);
  }, [cash]);

  // 2. Portfolio values
  const portfolioSummary = useMemo(() => {
    const totalEquitiesInvested = activeHoldings.reduce((sum, h) => sum + h.totalInvested, 0);
    const totalEquitiesCurrent = activeHoldings.reduce((sum, h) => sum + h.currentValue, 0);

    const totalMFInvested = funds.reduce((sum, f) => sum + f.investedValue, 0);
    const totalMFCurrent = funds.reduce((sum, f) => sum + f.currentValue, 0);

    const totalAltInvested = alternatives.reduce((sum, a) => sum + a.investedAmount, 0);
    const totalAltCurrent = alternatives.reduce((sum, a) => sum + a.currentValue, 0);

    const totalInvested = totalEquitiesInvested + totalMFInvested + totalAltInvested + cashBalance;
    const totalCurrentValue = totalEquitiesCurrent + totalMFCurrent + totalAltCurrent + cashBalance;
    const unrealizedPnL = totalCurrentValue - totalInvested;
    const unrealizedPnLPct = totalInvested > 0 ? (unrealizedPnL / totalInvested) * 100 : 0;

    const realizedPnLEquity = sells.reduce((sum, s) => sum + s.realizedPnL, 0);
    const realizedPnLMF = funds.reduce((sum, f) => sum + (f.realizedPnL || 0), 0);
    const totalRealizedPnL = realizedPnLEquity + realizedPnLMF;

    return {
      totalInvested,
      totalCurrentValue,
      unrealizedPnL,
      unrealizedPnLPct,
      totalRealizedPnL,
      totalEquitiesCurrent,
      totalMFCurrent,
      totalAltCurrent
    };
  }, [activeHoldings, funds, alternatives, cashBalance, sells]);

  // 3. Win Rate of Closed Trades
  const closedTradeStats = useMemo(() => {
    // A buy trade is "closed" if total sold qty >= buy quantity
    const closedBuys = buys.filter(b => {
      const linkedSells = sells.filter(s => s.linkedBuyId === b.transactionId);
      const totalSold = linkedSells.reduce((sum, s) => sum + s.quantity, 0);
      return totalSold >= b.quantity;
    });

    const wins = closedBuys.filter(b => {
      const linkedSells = sells.filter(s => s.linkedBuyId === b.transactionId);
      const totalSellsValue = linkedSells.reduce((sum, s) => sum + s.totalSellValue, 0);
      const stockDivs = dividends.filter(d => d.ticker === b.ticker).reduce((sum, d) => sum + d.amount, 0);
      
      // Profitable if total realized sale + dividends exceeds original purchase cost
      return (totalSellsValue + stockDivs) > b.totalBuyValue;
    });

    const winRate = closedBuys.length > 0 ? (wins.length / closedBuys.length) * 100 : 0;

    return {
      totalClosed: closedBuys.length,
      wins: wins.length,
      winRate
    };
  }, [buys, sells, dividends]);

  // 4. Biggest Profit / Loss Trades (Realized + Unrealized)
  const extremeTrades = useMemo(() => {
    let biggestProfit = { ticker: 'N/A', amount: 0, pct: 0 };
    let biggestLoss = { ticker: 'N/A', amount: 0, pct: 0 };

    // Check active holdings (Unrealized)
    activeHoldings.forEach(h => {
      if (h.unrealizedPnL > biggestProfit.amount) {
        biggestProfit = { ticker: h.ticker, amount: h.unrealizedPnL, pct: h.unrealizedPnLPct };
      }
      if (h.unrealizedPnL < biggestLoss.amount) {
        biggestLoss = { ticker: h.ticker, amount: h.unrealizedPnL, pct: h.unrealizedPnLPct };
      }
    });

    // Check closed sales (Realized)
    sells.forEach(s => {
      if (s.realizedPnL > biggestProfit.amount) {
        biggestProfit = { ticker: s.ticker, amount: s.realizedPnL, pct: s.realizedPnLPct };
      }
      if (s.realizedPnL < biggestLoss.amount) {
        biggestLoss = { ticker: s.ticker, amount: s.realizedPnL, pct: s.realizedPnLPct };
      }
    });

    return { biggestProfit, biggestLoss };
  }, [activeHoldings, sells]);

  // 5. Single Largest Holding
  const largestHolding = useMemo(() => {
    let largest = { ticker: 'N/A', invested: 0, pnl: 0 };
    
    // Find largest from active equities
    activeHoldings.forEach(h => {
      if (h.totalInvested > largest.invested) {
        largest = { ticker: h.ticker, invested: h.totalInvested, pnl: h.unrealizedPnL };
      }
    });
    
    // Check mutual funds as well
    funds.forEach(f => {
      if (f.investedValue > largest.invested) {
        largest = { ticker: f.schemeName, invested: f.investedValue, pnl: f.unrealizedPnL };
      }
    });

    return largest;
  }, [activeHoldings, funds]);

  // 6. Sector Concentration (Active Equities)
  const sectorConcentration = useMemo(() => {
    const sectors: Record<string, number> = {};
    activeHoldings.forEach(h => {
      const sector = h.industry || 'Unknown';
      sectors[sector] = (sectors[sector] || 0) + h.currentValue;
    });

    let topSector = 'N/A';
    let topVal = 0;
    Object.entries(sectors).forEach(([sector, val]) => {
      if (val > topVal) {
        topVal = val;
        topSector = sector;
      }
    });

    const totalEquityVal = activeHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const topPct = totalEquityVal > 0 ? (topVal / totalEquityVal) * 100 : 0;

    return {
      sectorName: topSector,
      percentage: topPct
    };
  }, [activeHoldings]);

  // 7. Portfolio Beta (Weighted average of equities)
  const portfolioBeta = useMemo(() => {
    const totalEquityVal = activeHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    if (totalEquityVal === 0) return 1.0;

    let weightedBetaSum = 0;
    activeHoldings.forEach(h => {
      const beta = MOCK_STOCK_BETAS[h.ticker] || 1.0; // fallback beta
      const weight = h.currentValue / totalEquityVal;
      weightedBetaSum += weight * beta;
    });

    return parseFloat(weightedBetaSum.toFixed(2));
  }, [activeHoldings]);

  // 8. Cash Drag %
  const cashDrag = useMemo(() => {
    if (portfolioSummary.totalCurrentValue === 0) return 0;
    return (cashBalance / portfolioSummary.totalCurrentValue) * 100;
  }, [cashBalance, portfolioSummary.totalCurrentValue]);

  // 9. Portfolio Inception Age
  const portfolioAge = useMemo(() => {
    const dates: number[] = [];
    buys.forEach(b => dates.push(new Date(b.date).getTime()));
    sells.forEach(s => dates.push(new Date(s.date).getTime()));
    funds.forEach(f => dates.push(new Date(f.dateOfBuy).getTime()));
    alternatives.forEach(a => dates.push(new Date(a.dateOfInvestment).getTime()));
    cash.forEach(c => dates.push(new Date(c.date).getTime()));

    if (dates.length === 0) return '0 days';
    const earliest = Math.min(...dates);
    const diffTime = Math.abs(new Date().getTime() - earliest);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    const yrs = Math.floor(diffDays / 365);
    const remainingMths = Math.floor((diffDays % 365) / 30);
    return `${yrs} year${yrs > 1 ? 's' : ''} ${remainingMths} mth${remainingMths > 1 ? 's' : ''}`;
  }, [buys, sells, funds, alternatives, cash]);

  // 10. Portfolio Health Score
  const healthScore = useMemo(() => {
    let categoriesCount = 0;
    if (activeHoldings.length > 0) categoriesCount++;
    if (funds.length > 0) categoriesCount++;
    if (alternatives.length > 0) categoriesCount++;
    if (cashBalance > 0) categoriesCount++;

    let maxHoldingPct = 0;
    const totalVal = portfolioSummary.totalCurrentValue;
    if (totalVal > 0) {
      activeHoldings.forEach(h => {
        const pct = (h.currentValue / totalVal) * 100;
        if (pct > maxHoldingPct) maxHoldingPct = pct;
      });
      funds.forEach(f => {
        const pct = (f.currentValue / totalVal) * 100;
        if (pct > maxHoldingPct) maxHoldingPct = pct;
      });
      alternatives.forEach(a => {
        const pct = (a.currentValue / totalVal) * 100;
        if (pct > maxHoldingPct) maxHoldingPct = pct;
      });
    }

    // Custom helper import (statically imported at top)

    return calculateHealthScore({
      categoriesCount,
      maxHoldingPct,
      cashDragPct: cashDrag,
      winRate: closedTradeStats.winRate,
      hasClosedTrades: closedTradeStats.totalClosed > 0
    });
  }, [activeHoldings, funds, alternatives, cashBalance, cashDrag, closedTradeStats, portfolioSummary.totalCurrentValue]);

  // --- Chart Datasets ---

  // Allocation Pie Dataset
  const allocationData = useMemo(() => {
    const totalVal = portfolioSummary.totalCurrentValue;
    if (totalVal === 0) return [];
    
    return [
      { name: 'Equities', value: activeHoldings.reduce((sum, h) => sum + h.currentValue, 0) },
      { name: 'Mutual Funds', value: funds.reduce((sum, f) => sum + f.currentValue, 0) },
      { name: 'Alternatives', value: alternatives.reduce((sum, a) => sum + a.currentValue, 0) },
      { name: 'Cash Ledger', value: Math.max(0, cashBalance) }
    ].filter(item => item.value > 0);
  }, [activeHoldings, funds, alternatives, cashBalance, portfolioSummary.totalCurrentValue]);

  // Top 5 Holdings Bar Dataset
  const topHoldingsData = useMemo(() => {
    const items: { name: string; value: number }[] = [];
    
    activeHoldings.forEach(h => {
      items.push({ name: h.ticker, value: h.currentValue });
    });
    funds.forEach(f => {
      items.push({ name: f.schemeName.slice(0, 15) + '...', value: f.currentValue });
    });
    alternatives.forEach(a => {
      items.push({ name: a.name.slice(0, 15) + '...', value: a.currentValue });
    });

    return items
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [activeHoldings, funds, alternatives]);

  // Color arrays for chart visuals
  const PIE_COLORS = ['#C8A96E', '#4A9EFF', '#A0A0B0', '#22C55E'];

  const handleExport = () => {
    try {
      exportPortfolioToExcel(buys, sells, funds, alternatives, cash, dividends);
      showToast('Portfolio exported to Excel successfully!');
    } catch (e) {
      showToast('Export failed.', 'error');
    }
  };

  return (
    <div className="space-y-6 select-text">
      {/* Top Bar Call-To-Action */}
      <div className="flex items-center justify-between select-none">
        <div>
          <h2 className="text-xl font-bold font-sans text-cream">Terminal Overview</h2>
          <p className="text-[12px] text-muted">Aggregated financial metrics and real-time allocations</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-quick-buy'));
            }}
            className="flex items-center gap-2 px-4 py-2 bg-elevated border border-border hover:bg-[#1E1E2E] text-cream font-bold rounded text-[12px] uppercase tracking-wider transition-colors cursor-pointer"
          >
            + Record Buy
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-colors shadow-lg shadow-primary/5 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            Export to Excel
          </button>
        </div>
      </div>

      {/* Cash Drag Trigger Warning Alert */}
      {cashDrag > 20 && (
        <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/40 text-danger rounded select-none animate-pulse-gold">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-[13px] font-sans font-semibold">
            High Cash Drag Warning: Cash accounts for {cashDrag.toFixed(1)}% of your portfolio. Consider allocating capital to equity or mutual funds to mitigate inflation drag.
          </div>
        </div>
      )}

      {/* Row 1 Summary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 select-none">
        {/* Invested */}
        <div className="bg-surface border border-border rounded p-5 relative overflow-hidden group hover:border-primary/60 transition-colors">
          <div className="absolute top-0 right-0 w-1 bg-primary h-full"></div>
          <span className="text-[11px] text-muted uppercase font-bold tracking-widest font-sans">Total Capital Invested</span>
          <h3 className="text-xl font-bold font-mono text-cream mt-2 tracking-wide">
            {formatINR(portfolioSummary.totalInvested)}
          </h3>
          <span className="text-[10px] text-[#505065] font-mono mt-1 block">INR Valuation</span>
        </div>

        {/* Current Holding Value */}
        <div className="bg-surface border border-border rounded p-5 relative overflow-hidden group hover:border-secondary/60 transition-colors">
          <div className="absolute top-0 right-0 w-1 bg-secondary h-full"></div>
          <span className="text-[11px] text-muted uppercase font-bold tracking-widest font-sans">Current Holding Value</span>
          <h3 className="text-xl font-bold font-mono text-cream mt-2 tracking-wide">
            {formatINR(portfolioSummary.totalCurrentValue)}
          </h3>
          <span className="text-[10px] text-[#505065] font-mono mt-1 block">Live API Resolution</span>
        </div>

        {/* Unrealized PnL */}
        <div className="bg-surface border border-border rounded p-5 relative overflow-hidden group hover:border-[#22C55E]/60 transition-colors">
          <div className="absolute top-0 right-0 w-1 bg-success h-full"></div>
          <span className="text-[11px] text-muted uppercase font-bold tracking-widest font-sans">Unrealized P&L</span>
          <h3 className={`text-xl font-bold font-mono mt-2 tracking-wide flex items-center gap-1.5
            ${portfolioSummary.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}
          >
            {portfolioSummary.unrealizedPnL >= 0 ? '+' : ''}
            {formatINR(portfolioSummary.unrealizedPnL)}
          </h3>
          <span className={`text-[11px] font-semibold font-sans mt-1 block flex items-center gap-1
            ${portfolioSummary.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}
          >
            {portfolioSummary.unrealizedPnL >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {portfolioSummary.unrealizedPnLPct.toFixed(2)}% Return
          </span>
        </div>

        {/* Realized PnL */}
        <div className="bg-surface border border-border rounded p-5 relative overflow-hidden group hover:border-[#4A9EFF]/60 transition-colors">
          <div className="absolute top-0 right-0 w-1 bg-[#4A9EFF] h-full"></div>
          <span className="text-[11px] text-muted uppercase font-bold tracking-widest font-sans">Realized Net Gains</span>
          <h3 className={`text-xl font-bold font-mono mt-2 tracking-wide
            ${portfolioSummary.totalRealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}
          >
            {portfolioSummary.totalRealizedPnL >= 0 ? '+' : ''}
            {formatINR(portfolioSummary.totalRealizedPnL)}
          </h3>
          <span className="text-[10px] text-[#505065] font-mono mt-1 block">Closed Trades Ledger</span>
        </div>
      </div>

      {/* Row 2 Circular Gauges & Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Closed Win Rate Ring */}
        <div className="bg-surface border border-border rounded p-5 flex flex-col items-center justify-center text-center relative hover:border-primary/40 transition-colors select-none">
          <span className="text-[10px] text-muted uppercase font-bold tracking-widest mb-3">Closed Win Rate</span>
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="#2A2A3A" strokeWidth="6" fill="transparent" />
              <circle 
                cx="48" cy="48" r="40" stroke="#C8A96E" strokeWidth="6" fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * closedTradeStats.winRate) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[16px] font-bold font-mono text-cream">{closedTradeStats.winRate.toFixed(0)}%</span>
              <span className="text-[9px] text-[#505065] font-semibold uppercase">{closedTradeStats.wins}/{closedTradeStats.totalClosed} Sells</span>
            </div>
          </div>
        </div>

        {/* Portfolio Health Score Gauge */}
        <div className="bg-surface border border-border rounded p-5 flex flex-col items-center justify-center text-center relative hover:border-primary/40 transition-colors select-none">
          <span className="text-[10px] text-muted uppercase font-bold tracking-widest mb-3">Health Diversification</span>
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="#2A2A3A" strokeWidth="6" fill="transparent" />
              <circle 
                cx="48" cy="48" r="40" 
                stroke={healthScore >= 70 ? '#22C55E' : healthScore >= 45 ? '#C8A96E' : '#EF4444'} 
                strokeWidth="6" fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * healthScore) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[18px] font-bold font-mono text-cream">{healthScore}</span>
              <span className="text-[9px] text-hint font-semibold uppercase">Composite</span>
            </div>
          </div>
        </div>

        {/* Extreme Profit / Loss */}
        <div className="bg-surface border border-border rounded p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
          <span className="text-[10px] text-muted uppercase font-bold tracking-widest mb-3 select-none">Extreme Performers</span>
          <div className="space-y-3">
            <div>
              <span className="text-[10px] text-[#505065] uppercase font-bold font-sans">Biggest Gain</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[13px] text-primary font-bold font-mono">{extremeTrades.biggestProfit.ticker}</span>
                <span className="text-[12px] text-success font-mono font-semibold">
                  +{extremeTrades.biggestProfit.pct.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="border-t border-border/40 pt-2">
              <span className="text-[10px] text-[#505065] uppercase font-bold font-sans">Biggest Drop</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[13px] text-primary font-bold font-mono">{extremeTrades.biggestLoss.ticker}</span>
                <span className="text-[12px] text-danger font-mono font-semibold">
                  {extremeTrades.biggestLoss.pct.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Single Largest Holding */}
        <div className="bg-surface border border-border rounded p-5 flex flex-col justify-between hover:border-primary/40 transition-colors">
          <span className="text-[10px] text-muted uppercase font-bold tracking-widest mb-3 select-none">Largest Concentration</span>
          <div className="space-y-1">
            <span className="text-[11px] text-hint font-semibold uppercase">Holding Ticker</span>
            <div className="text-[13px] text-primary font-bold font-mono truncate">{largestHolding.ticker}</div>
            
            <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-2 select-none">
              <span className="text-[10px] text-muted font-sans font-medium">Invested:</span>
              <span className="text-[12px] text-cream font-mono font-bold">
                {formatINR(largestHolding.invested)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 Recharts Plots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Allocation Pie Chart */}
        <div className="bg-surface border border-border rounded p-6 flex flex-col justify-between h-[340px]">
          <h4 className="text-[13px] font-bold text-[#E8DCC8] uppercase tracking-wider mb-4 flex items-center gap-1.5 select-none">
            <CircleDot className="w-4 h-4 text-primary" />
            Portfolio Capital Allocation
          </h4>
          <div className="flex-1 w-full relative">
            {allocationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {allocationData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any) => [formatINR(Number(value)), 'Value']}
                    contentStyle={{ backgroundColor: '#1A1A26', borderColor: '#2A2A3A', color: '#F0F0F5' }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-[12px] text-cream font-sans font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[#505065] text-[13px] select-none">
                No active asset classes found.
              </div>
            )}
          </div>
        </div>

        {/* Top 5 Holdings Bar Chart */}
        <div className="bg-surface border border-border rounded p-6 flex flex-col justify-between h-[340px]">
          <h4 className="text-[13px] font-bold text-[#E8DCC8] uppercase tracking-wider mb-4 flex items-center gap-1.5 select-none">
            <Layers className="w-4 h-4 text-primary" />
            Top 5 Holdings By Valuation
          </h4>
          <div className="flex-1 w-full relative">
            {topHoldingsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topHoldingsData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="#A0A0B0" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value: any) => [formatINR(Number(value)), 'Current Value']}
                    contentStyle={{ backgroundColor: '#1A1A26', borderColor: '#2A2A3A', color: '#F0F0F5' }}
                  />
                  <Bar dataKey="value" fill="#C8A96E" radius={[0, 4, 4, 0]}>
                    {topHoldingsData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill="#C8A96E" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[#505065] text-[13px] select-none">
                No holdings added yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 4 Additional Advanced Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 select-none">
        {/* Portfolio Age */}
        <div className="bg-surface border border-border rounded p-5 hover:border-primary/40 transition-colors flex items-center gap-4">
          <div className="p-3 rounded bg-elevated text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans">Portfolio Age</span>
            <div className="text-[15px] font-bold text-cream mt-1 font-mono">{portfolioAge}</div>
          </div>
        </div>

        {/* Sector Concentration */}
        <div className="bg-surface border border-border rounded p-5 hover:border-primary/40 transition-colors flex items-center gap-4">
          <div className="p-3 rounded bg-elevated text-primary">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans">Sector Concentration</span>
            <div className="text-[14px] font-bold text-cream mt-1 truncate font-mono">
              {sectorConcentration.sectorName} ({sectorConcentration.percentage.toFixed(0)}%)
            </div>
          </div>
        </div>

        {/* Portfolio Beta */}
        <div className="bg-surface border border-border rounded p-5 hover:border-primary/40 transition-colors flex items-center gap-4">
          <div className="p-3 rounded bg-elevated text-primary">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans">Portfolio Beta</span>
            <div className="text-[15px] font-bold text-cream mt-1 font-mono">{portfolioBeta}</div>
          </div>
        </div>

        {/* Cash Drag */}
        <div className="bg-surface border border-border rounded p-5 hover:border-primary/40 transition-colors flex items-center gap-4">
          <div className="p-3 rounded bg-elevated text-primary">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans">Cash Drag %</span>
            <div className="text-[15px] font-bold text-cream mt-1 font-mono">{cashDrag.toFixed(1)}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
