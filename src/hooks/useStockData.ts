import { useState, useCallback } from 'react';

export interface StockInfo {
  ticker: string;
  stockName: string;
  industry: string;
  currentPrice: number;
  currentPE: number;
  isStale: boolean;
  lotSize?: number;
}

// Simple fallback mock data for offline mode or CORS failures
const MOCK_STOCK_DATA: Record<string, Partial<StockInfo>> = {
  'RELIANCE.NS': { stockName: 'Reliance Industries Limited', industry: 'Oil & Gas / Retail', currentPrice: 2450.50, currentPE: 26.4 },
  'TCS.NS': { stockName: 'Tata Consultancy Services Limited', industry: 'Information Technology', currentPrice: 3210.00, currentPE: 28.1 },
  'INFY.NS': { stockName: 'Infosys Limited', industry: 'Information Technology', currentPrice: 1420.25, currentPE: 24.2 },
  'HDFCBANK.NS': { stockName: 'HDFC Bank Limited', industry: 'Banking & Financials', currentPrice: 1580.80, currentPE: 19.5 },
  'ICICIBANK.NS': { stockName: 'ICICI Bank Limited', industry: 'Banking & Financials', currentPrice: 930.40, currentPE: 17.8 },
  'ITC.NS': { stockName: 'ITC Limited', industry: 'FMCG / Tobacco', currentPrice: 425.10, currentPE: 25.6 },
  'TATASTEEL.NS': { stockName: 'Tata Steel Limited', industry: 'Metals & Mining', currentPrice: 110.35, currentPE: 12.3 },
  'SBIN.NS': { stockName: 'State Bank of India', industry: 'Banking & Financials', currentPrice: 575.20, currentPE: 9.8 },
  'BHARTIARTL.NS': { stockName: 'Bharti Airtel Limited', industry: 'Telecommunications', currentPrice: 835.90, currentPE: 45.2 },
  'LTIM.NS': { stockName: 'LTIMindtree Limited', industry: 'Information Technology', currentPrice: 4850.00, currentPE: 33.1 },
};

export function useStockData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStock = useCallback(async (tickerInput: string): Promise<StockInfo> => {
    setLoading(true);
    setError(null);
    
    // Auto-formatting ticker
    let ticker = tickerInput.trim().toUpperCase();
    if (!ticker.endsWith('.NS') && !ticker.endsWith('.BO')) {
      // If it is a 6-digit numeric code (BSE code), append .BO
      if (/^\d{6}$/.test(ticker)) {
        ticker = `${ticker}.BO`;
      } else {
        ticker = `${ticker}.NS`; // default to NSE
      }
    }

    const electronApi = (window as any).electron;

    // 1. Electron IPC Bridge Fetch
    if (electronApi && typeof electronApi.fetchStockSummary === 'function') {
      try {
        const summaryRes = await electronApi.fetchStockSummary(ticker);
        
        if (summaryRes.success && summaryRes.data) {
          const result = summaryRes.data?.quoteSummary?.result?.[0];
          const priceObj = result?.price;
          const profileObj = result?.assetProfile;
          const detailObj = result?.summaryDetail;

          const stockName = priceObj?.longName || priceObj?.shortName || ticker.split('.')[0];
          const industry = profileObj?.industry || 'Other';
          
          const lotSize = priceObj?.lotSize ?? priceObj?.contractSize ?? result?.lotSize ?? result?.contractSize ?? 1;
          const rawPrice = Number(priceObj?.regularMarketPrice?.raw || priceObj?.regularMarketPrice || 0);
          const currentPrice = lotSize > 1 ? rawPrice / lotSize : rawPrice;
          const currentPE = detailObj?.trailingPE?.raw || detailObj?.trailingPE || detailObj?.forwardPE?.raw || 0;

          setLoading(false);
          return {
            ticker,
            stockName,
            industry,
            currentPrice,
            currentPE: Number(currentPE) || 0,
            isStale: false,
            lotSize
          };
        }
      } catch (err: any) {
        console.warn('IPC Stock fetch crashed, checking browser fallbacks', err);
      }
    }

    // Helper to fetch quoteSummary (detailed) via proxy
    const tryFetchSummary = async (sym: string, proxyFn: (url: string) => string): Promise<Partial<StockInfo> | null> => {
      try {
        const targetUrl = `https://query1.finance.yahoo.com/v11/finance/quoteSummary/${sym}?modules=summaryDetail,assetProfile,price`;
        const proxiedUrl = proxyFn(targetUrl);
        const response = await fetch(proxiedUrl);
        if (response.ok) {
          const resJson = await response.json();
          const data = resJson.contents ? JSON.parse(resJson.contents) : resJson;
          const result = data?.quoteSummary?.result?.[0];
          if (result) {
            const priceObj = result?.price;
            const profileObj = result?.assetProfile;
            const detailObj = result?.summaryDetail;
            if (priceObj?.regularMarketPrice) {
              const lotSize = priceObj?.lotSize ?? priceObj?.contractSize ?? result?.lotSize ?? result?.contractSize ?? 1;
              const rawPrice = Number(priceObj?.regularMarketPrice?.raw || priceObj?.regularMarketPrice || 0);
              const currentPrice = lotSize > 1 ? rawPrice / lotSize : rawPrice;

              return {
                stockName: priceObj?.longName || priceObj?.shortName || sym.split('.')[0],
                industry: profileObj?.industry || 'Other',
                currentPrice,
                currentPE: Number(detailObj?.trailingPE?.raw || detailObj?.trailingPE || detailObj?.forwardPE?.raw || 0),
                lotSize
              };
            }
          }
        }
      } catch (err) {
        console.warn(`Summary fetch failed for ${sym} using proxy`, err);
      }
      return null;
    };

    // Helper to fetch quote (simpler) via proxy
    const tryFetchQuote = async (sym: string, proxyFn: (url: string) => string): Promise<Partial<StockInfo> | null> => {
      try {
        const targetUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${sym}`;
        const proxiedUrl = proxyFn(targetUrl);
        const response = await fetch(proxiedUrl);
        if (response.ok) {
          const resJson = await response.json();
          const data = resJson.contents ? JSON.parse(resJson.contents) : resJson;
          const result = data?.quoteResponse?.result?.[0];
          if (result && result.regularMarketPrice) {
            const lotSize = result.lotSize ?? result.contractSize ?? 1;
            const rawPrice = Number(result.regularMarketPrice);
            const currentPrice = lotSize > 1 ? rawPrice / lotSize : rawPrice;

            return {
              stockName: result.longName || result.shortName || sym.split('.')[0],
              industry: 'Other',
              currentPrice,
              currentPE: Number(result.trailingPE || result.forwardPE || 0),
              lotSize
            };
          }
        }
      } catch (err) {
        console.warn(`Quote fetch failed for ${sym} using proxy`, err);
      }
      return null;
    };

    const proxies = [
      (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      (url: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    ];

    // 2. Direct browser fetch cascade
    // Try summary endpoint first
    for (const proxyFn of proxies) {
      const data = await tryFetchSummary(ticker, proxyFn);
      if (data) {
        setLoading(false);
        return {
          ticker,
          stockName: data.stockName || ticker.split('.')[0],
          industry: data.industry || 'Other',
          currentPrice: data.currentPrice || 0,
          currentPE: data.currentPE || 0,
          isStale: false,
          lotSize: data.lotSize
        };
      }
    }

    // Try quote endpoint next
    for (const proxyFn of proxies) {
      const data = await tryFetchQuote(ticker, proxyFn);
      if (data) {
        setLoading(false);
        return {
          ticker,
          stockName: data.stockName || ticker.split('.')[0],
          industry: data.industry || 'Other',
          currentPrice: data.currentPrice || 0,
          currentPE: data.currentPE || 0,
          isStale: false,
          lotSize: data.lotSize
        };
      }
    }

    // 3. Fallback to mock database (Offline/failure)
    try {
      const mock = MOCK_STOCK_DATA[ticker];
      if (mock) {
        setLoading(false);
        return {
          ticker,
          stockName: mock.stockName || ticker.split('.')[0],
          industry: mock.industry || 'Unknown',
          currentPrice: mock.currentPrice || 100,
          currentPE: mock.currentPE || 0,
          isStale: true,
          lotSize: 1
        };
      }

      // Generate a realistic randomized mock if ticker is unknown
      setLoading(false);
      const name = ticker.split('.')[0];
      const randomPrice = Math.floor(100 + Math.random() * 5000);
      const randomPE = Math.floor(10 + Math.random() * 40);
      return {
        ticker,
        stockName: `${name} Industries`,
        industry: 'Conglomerate',
        currentPrice: randomPrice,
        currentPE: randomPE,
        isStale: true,
        lotSize: 1
      };
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to fetch stock data');
      throw err;
    }
  }, []);

  return { fetchStock, loading, error };
}
