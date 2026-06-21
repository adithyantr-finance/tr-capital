import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface BenchmarkComparisonProps {
  fromDate: string;
  toDate: string;
  portfolioValueSeries: { date: string; value: number }[];
}

export const BenchmarkComparison: React.FC<BenchmarkComparisonProps> = ({
  fromDate,
  toDate,
  portfolioValueSeries
}) => {
  const [nifty50Data, setNifty50Data] = useState<{ date: string; close: number }[]>([]);
  const [nifty500Data, setNifty500Data] = useState<{ date: string; close: number }[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch index data from Yahoo Finance API via Electron IPC or CORS Proxy
  useEffect(() => {
    const fetchBenchmarks = async () => {
      setLoading(true);
      setError(null);
      
      const electronApi = (window as any).electron;

      try {
        const [n50Res, n500Res] = await Promise.all([
          fetchWithCache('^NSEI', fromDate, toDate, electronApi),
          fetchWithCache('^CRSLDX', fromDate, toDate, electronApi)
        ]);

        if (n50Res && n50Res.length > 0) {
          setNifty50Data(n50Res);
        } else {
          throw new Error('Nifty 50 fetch returned empty data');
        }

        if (n500Res && n500Res.length > 0) {
          setNifty500Data(n500Res);
        } else {
          throw new Error('Nifty 500 fetch returned empty data');
        }
      } catch (err: any) {
        console.error('Failed to fetch benchmark indices', err);
        setError('Index data unavailable — check your internet connection');
        // Render fallback simulated data in background, but show warning banner
        simulateMockData();
      } finally {
        setLoading(false);
      }
    };

    fetchBenchmarks();
  }, [fromDate, toDate]);

  // Caching wrapper for API calls
  const fetchWithCache = async (
    ticker: string, 
    start: string, 
    end: string, 
    electronApi: any
  ): Promise<{ date: string; close: number }[]> => {
    const cacheKey = `trcapital_index_cache_${ticker}_${start}_${end}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const now = Date.now();
        // 24 hours TTL
        if (now - parsed.timestamp < 24 * 60 * 60 * 1000) {
          return parsed.data;
        }
      } catch (e) {
        console.warn('Cache parsing failed', e);
      }
    }

    let chartResult: any = null;

    if (electronApi && typeof electronApi.fetchIndexHistory === 'function') {
      const res = await electronApi.fetchIndexHistory(ticker, start, end);
      if (!res.success || !res.data) {
        throw new Error(res.error || `Failed to fetch index: ${ticker}`);
      }
      chartResult = res.data.chart?.result?.[0];
    } else {
      // Browser fetch via CORS proxy
      const from = Math.floor(new Date(start).getTime() / 1000);
      const to = Math.floor(new Date(end).getTime() / 1000);
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${from}&period2=${to}&interval=1d&events=history`;
      const proxiedUrl = `https://corsproxy.io/?` + encodeURIComponent(url);

      const response = await fetch(proxiedUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const res = await response.json();
      chartResult = res.chart?.result?.[0];
    }

    if (!chartResult) {
      throw new Error(`Failed to parse index chart results for: ${ticker}`);
    }

    const timestamps = chartResult.timestamp || [];
    const closePrices = chartResult.indicators?.quote?.[0]?.close || [];
    
    const data = timestamps.map((ts: number, idx: number) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      close: Number(closePrices[idx]?.toFixed(2))
    })).filter((item: any) => item.close !== null && !isNaN(item.close));

    // Cache the result
    localStorage.setItem(cacheKey, JSON.stringify({
      timestamp: Date.now(),
      data
    }));

    return data;
  };

  // Mock data simulator for offline / browser mode
  const simulateMockData = () => {
    const start = new Date(fromDate).getTime();
    const end = new Date(toDate).getTime();
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) || 30;

    const n50: { date: string; close: number }[] = [];
    const n500: { date: string; close: number }[] = [];

    let n50Price = 22000;
    let n500Price = 19000;

    for (let i = 0; i <= days; i += Math.max(1, Math.floor(days / 30))) {
      const dateObj = new Date(start);
      dateObj.setDate(dateObj.getDate() + i);
      const dateStr = dateObj.toISOString().split('T')[0];

      // Simulate a small market drift
      const n50Drift = (Math.random() - 0.47) * 0.015 * n50Price;
      const n500Drift = (Math.random() - 0.46) * 0.014 * n500Price;

      n50Price = Math.max(1000, n50Price + n50Drift);
      n500Price = Math.max(1000, n500Price + n500Drift);

      n50.push({ date: dateStr, close: Number(n50Price.toFixed(2)) });
      n500.push({ date: dateStr, close: Number(n500Price.toFixed(2)) });
    }

    setNifty50Data(n50);
    setNifty500Data(n500);
  };

  // Merge portfolio + benchmark series into rebased coordinates (Normalised to 100 at start date)
  const chartData = useMemo(() => {
    if (portfolioValueSeries.length === 0 || nifty50Data.length === 0 || nifty500Data.length === 0) {
      return [];
    }

    const portBase = portfolioValueSeries[0].value;
    const n50Base = nifty50Data[0].close;
    const n500Base = nifty500Data[0].close;

    return portfolioValueSeries.map(item => {
      // Find matching date or closest preceding date in index series
      const n50Point = nifty50Data.find(x => x.date === item.date) || 
                       nifty50Data.reduce((prev, curr) => 
                         Math.abs(new Date(curr.date).getTime() - new Date(item.date).getTime()) < 
                         Math.abs(new Date(prev.date).getTime() - new Date(item.date).getTime()) ? curr : prev
                       , nifty50Data[0]);

      const n500Point = nifty500Data.find(x => x.date === item.date) || 
                        nifty500Data.reduce((prev, curr) => 
                          Math.abs(new Date(curr.date).getTime() - new Date(item.date).getTime()) < 
                          Math.abs(new Date(prev.date).getTime() - new Date(item.date).getTime()) ? curr : prev
                        , nifty500Data[0]);

      const portfolioRebased = portBase > 0 ? (item.value / portBase) * 100 : 100;
      const n50Rebased = n50Point ? (n50Point.close / n50Base) * 100 : 100;
      const n500Rebased = n500Point ? (n500Point.close / n500Base) * 100 : 100;

      // Format date for chart X-axis
      const formattedDate = new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

      return {
        date: formattedDate,
        portfolio: Number(portfolioRebased.toFixed(2)),
        nifty50: Number(n50Rebased.toFixed(2)),
        nifty500: Number(n500Rebased.toFixed(2))
      };
    });
  }, [portfolioValueSeries, nifty50Data, nifty500Data]);

  // Compute returns and standard financial metrics
  const stats = useMemo(() => {
    if (chartData.length < 2) {
      return {
        portReturn: 0,
        n50Return: 0,
        n500Return: 0,
        alpha50: 0,
        alpha500: 0,
        portHigh: 0,
        portLow: 0,
        n50High: 0,
        n50Low: 0,
        n500High: 0,
        n500Low: 0,
        portVol: 0,
        n50Vol: 0,
        n500Vol: 0,
        portMaxDD: 0,
        n50MaxDD: 0,
        n500MaxDD: 0
      };
    }

    const last = chartData[chartData.length - 1];

    const portReturn = last.portfolio - 100;
    const n50Return = last.nifty50 - 100;
    const n500Return = last.nifty500 - 100;

    const alpha50 = portReturn - n50Return;
    const alpha500 = portReturn - n500Return;

    // High / Low relative to 100 baseline
    const portValues = chartData.map(d => d.portfolio);
    const n50Values = chartData.map(d => d.nifty50);
    const n500Values = chartData.map(d => d.nifty500);

    const portHigh = Math.max(...portValues) - 100;
    const portLow = Math.min(...portValues) - 100;
    const n50High = Math.max(...n50Values) - 100;
    const n50Low = Math.min(...n50Values) - 100;
    const n500High = Math.max(...n500Values) - 100;
    const n500Low = Math.min(...n500Values) - 100;

    // Volatility and Max Drawdown computations
    const calculateFinancialStats = (series: number[]) => {
      const returns: number[] = [];
      for (let i = 1; i < series.length; i++) {
        const prev = series[i - 1];
        if (prev > 0) returns.push((series[i] - prev) / prev);
      }

      let volatility = 0;
      if (returns.length > 1) {
        const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
        volatility = Math.sqrt(variance) * 100; // Daily standard deviation in %
      }

      let peak = -Infinity;
      let maxDrawdown = 0;
      for (let val of series) {
        if (val > peak) peak = val;
        if (peak > 0) {
          const dd = (val - peak) / peak;
          if (dd < maxDrawdown) maxDrawdown = dd;
        }
      }

      return {
        volatility: Number(volatility.toFixed(2)),
        maxDrawdown: Number((maxDrawdown * 100).toFixed(2))
      };
    };

    const portStats = calculateFinancialStats(portValues);
    const n50Stats = calculateFinancialStats(n50Values);
    const n500Stats = calculateFinancialStats(n500Values);

    return {
      portReturn,
      n50Return,
      n500Return,
      alpha50,
      alpha500,
      portHigh,
      portLow,
      n50High,
      n50Low,
      n500High,
      n500Low,
      portVol: portStats.volatility,
      n50Vol: n50Stats.volatility,
      n500Vol: n500Stats.volatility,
      portMaxDD: portStats.maxDrawdown,
      n50MaxDD: n50Stats.maxDrawdown,
      n500MaxDD: n500Stats.maxDrawdown
    };
  }, [chartData]);

  const outperformBoth = stats.alpha50 > 0 && stats.alpha500 > 0;
  const underperformOne = stats.alpha50 < 0 || stats.alpha500 < 0;

  return (
    <div className="bg-surface border border-border rounded p-6 space-y-6">
      
      {/* Title block */}
      <div className="flex flex-wrap items-center justify-between gap-4 select-none">
        <div>
          <h4 className="text-[13px] font-bold text-[#E8DCC8] uppercase tracking-wider">Benchmark Performance Comparison</h4>
          <p className="text-[11px] text-muted mt-0.5">Rebased comparison tracking Nifty 50 and Nifty 500 index returns</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/40 text-danger rounded select-none">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <div className="text-[12px] font-sans font-semibold">
            {error}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 select-none">
          <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          <span className="text-[13px] text-cream font-bold">Fetching Index Historical Data...</span>
        </div>
      ) : (
        <>
          {/* 3-Line LineChart */}
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A1A26" />
                <XAxis dataKey="date" stroke="#A0A0B0" fontSize={11} tickLine={false} />
                <YAxis stroke="#A0A0B0" fontSize={11} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => `${v.toFixed(0)}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1A1A26', borderColor: '#2A2A3A', color: '#F0F0F5' }}
                  labelStyle={{ fontWeight: 'bold', color: '#E8DCC8' }}
                  formatter={(value: any, name?: any) => {
                    const val = Number(value);
                    const diff = val - 100;
                    return [`${val.toFixed(2)} (${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%)`, String(name || '')];
                  }}
                />
                <Legend verticalAlign="bottom" height={36} />
                <Line type="monotone" dataKey="portfolio" name="TR Capital Portfolio" stroke="#C8A96E" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="nifty50" name="Nifty 50" stroke="#4A9EFF" strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="nifty500" name="Nifty 500" stroke="#A78BFA" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 3-Column Scorecard row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 select-none pt-4 border-t border-border/40">
            {/* Portfolio returns card */}
            <div className="bg-background border-2 border-primary rounded p-5 relative overflow-hidden flex flex-col justify-between h-[120px]">
              <div>
                <span className="text-[10px] text-primary uppercase font-bold tracking-widest font-sans">Your Portfolio</span>
                <h3 className={`text-2xl font-bold font-mono tracking-wide mt-2 ${stats.portReturn >= 0 ? 'text-success' : 'text-danger'}`}>
                  {stats.portReturn >= 0 ? '+' : ''}{stats.portReturn.toFixed(2)}%
                </h3>
              </div>
              <div className="text-[11px] font-semibold flex items-center gap-1">
                {stats.alpha50 >= 0 ? (
                  <span className="text-success flex items-center">▲ Alpha: +{stats.alpha50.toFixed(2)}% vs Nifty 50</span>
                ) : (
                  <span className="text-danger flex items-center">▼ Alpha: {stats.alpha50.toFixed(2)}% vs Nifty 50</span>
                )}
              </div>
            </div>

            {/* Nifty 50 index card */}
            <div className="bg-background border border-border rounded p-5 flex flex-col justify-between h-[120px]">
              <div>
                <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans">Nifty 50 (^NSEI)</span>
                <h3 className={`text-xl font-bold font-mono tracking-wide mt-2 ${stats.n50Return >= 0 ? 'text-success' : 'text-danger'}`}>
                  {stats.n50Return >= 0 ? '+' : ''}{stats.n50Return.toFixed(2)}%
                </h3>
              </div>
              <span className="text-[11px] text-[#505065] font-sans">Benchmark Index</span>
            </div>

            {/* Nifty 500 index card */}
            <div className="bg-background border border-border rounded p-5 flex flex-col justify-between h-[120px]">
              <div>
                <span className="text-[10px] text-muted uppercase font-bold tracking-widest font-sans">Nifty 500 (^CRSLDX)</span>
                <h3 className={`text-xl font-bold font-mono tracking-wide mt-2 ${stats.n500Return >= 0 ? 'text-success' : 'text-danger'}`}>
                  {stats.n500Return >= 0 ? '+' : ''}{stats.n500Return.toFixed(2)}%
                </h3>
              </div>
              <span className="text-[11px] text-[#505065] font-sans">Benchmark Index</span>
            </div>
          </div>

          {/* Performance Outperformance Banner */}
          {outperformBoth && (
            <div className="p-3 bg-success/10 border border-success/40 text-success rounded text-[12px] font-sans font-bold text-center select-none animate-pulse-gold">
              🏆 OUTPERFORMED BOTH BENCHMARKS: Your strategy beats Nifty 50 and Nifty 500 indices for this period!
            </div>
          )}
          {underperformOne && !outperformBoth && (
            <div className="p-3 bg-primary/10 border border-primary/30 text-primary rounded text-[12px] font-sans font-bold text-center select-none">
              ⚠ UNDERPERFORMED BENCHMARK: Portfolio alpha is lagging behind index returns in this time period.
            </div>
          )}

          {/* Secondary stats details table */}
          <div className="w-full overflow-x-auto rounded border border-border bg-[#0A0A0F] select-none">
            <table className="w-full border-collapse text-left text-[12px]">
              <thead className="bg-surface border-b border-border font-sans">
                <tr className="text-[#E8DCC8] uppercase text-[9px] tracking-wider font-bold">
                  <th className="py-2.5 px-4">Performance Metrics</th>
                  <th className="py-2.5 px-4 text-right">Portfolio</th>
                  <th className="py-2.5 px-4 text-right">Nifty 50</th>
                  <th className="py-2.5 px-4 text-right">Nifty 500</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-cream">
                <tr>
                  <td className="py-2 px-4 font-sans text-muted">Period Highest Return</td>
                  <td className={`py-2 px-4 text-right font-bold ${stats.portHigh >= 0 ? 'text-success' : 'text-danger'}`}>{stats.portHigh >= 0 ? '+' : ''}{stats.portHigh.toFixed(2)}%</td>
                  <td className={`py-2 px-4 text-right ${stats.n50High >= 0 ? 'text-success' : 'text-danger'}`}>{stats.n50High >= 0 ? '+' : ''}{stats.n50High.toFixed(2)}%</td>
                  <td className={`py-2 px-4 text-right ${stats.n500High >= 0 ? 'text-success' : 'text-danger'}`}>{stats.n500High >= 0 ? '+' : ''}{stats.n500High.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-sans text-muted">Period Lowest Return</td>
                  <td className={`py-2 px-4 text-right font-bold ${stats.portLow >= 0 ? 'text-success' : 'text-danger'}`}>{stats.portLow.toFixed(2)}%</td>
                  <td className={`py-2 px-4 text-right ${stats.n50Low >= 0 ? 'text-success' : 'text-danger'}`}>{stats.n50Low.toFixed(2)}%</td>
                  <td className={`py-2 px-4 text-right ${stats.n500Low >= 0 ? 'text-success' : 'text-danger'}`}>{stats.n500Low.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-sans text-muted">Volatility (Std Dev of Daily Returns)</td>
                  <td className="py-2 px-4 text-right text-primary font-bold">{stats.portVol.toFixed(2)}%</td>
                  <td className="py-2 px-4 text-right text-muted">{stats.n50Vol.toFixed(2)}%</td>
                  <td className="py-2 px-4 text-right text-muted">{stats.n500Vol.toFixed(2)}%</td>
                </tr>
                <tr>
                  <td className="py-2 px-4 font-sans text-muted">Max Period Drawdown</td>
                  <td className="py-2 px-4 text-right text-danger font-bold">{stats.portMaxDD.toFixed(2)}%</td>
                  <td className="py-2 px-4 text-right text-muted">{stats.n50MaxDD.toFixed(2)}%</td>
                  <td className="py-2 px-4 text-right text-muted">{stats.n500MaxDD.toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
export default BenchmarkComparison;
