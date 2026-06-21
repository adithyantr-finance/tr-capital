import { useState, useCallback } from 'react';

export interface MFSearchResult {
  schemeCode: number;
  schemeName: string;
}

export interface MFDetails {
  schemeName: string;
  schemeCode: string;
  currentNAV: number;
  aum: number; // In Crores INR
  isStale: boolean;
}

// Fallback search results when offline
const MOCK_MF_SEARCH: MFSearchResult[] = [
  { schemeCode: 120503, schemeName: 'HDFC Flexi Cap Fund - Direct Plan - Growth' },
  { schemeCode: 119598, schemeName: 'SBI Bluechip Fund - Direct Plan - Growth' },
  { schemeCode: 120716, schemeName: 'Axis Small Cap Fund - Direct Plan - Growth' },
  { schemeCode: 147746, schemeName: 'Parag Parikh Flexi Cap Fund - Direct Plan - Growth' },
  { schemeCode: 119819, schemeName: 'Mirae Asset Large Cap Fund - Direct Plan - Growth' },
  { schemeCode: 120847, schemeName: 'Nippon India Small Cap Fund - Direct Plan - Growth' },
  { schemeCode: 122639, schemeName: 'ICICI Prudential Bluechip Fund - Direct Plan - Growth' },
];

export function useMFData() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchFunds = useCallback(async (query: string): Promise<MFSearchResult[]> => {
    if (!query || query.length < 3) return [];
    setLoading(true);
    
    const electronApi = (window as any).electron;
    
    // Attempt standard fetch first (MFAPI has open CORS)
    try {
      const response = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setLoading(false);
        // MFAPI returns an array of { schemeCode, schemeName }
        return data.slice(0, 15) as MFSearchResult[];
      }
    } catch (err) {
      console.warn('Browser search failed, checking Electron bridge', err);
    }

    // Try Electron IPC if browser fails (e.g. CORS block or offline)
    if (electronApi && typeof electronApi.fetchMFData === 'function') {
      // In Electron we can fetch through main
      // However, search is a different URL, but since MFAPI has CORS we can just use offline mock if search fails
    }

    setLoading(false);
    // Offline filter mock list
    return MOCK_MF_SEARCH.filter(f => 
      f.schemeName.toLowerCase().includes(query.toLowerCase())
    );
  }, []);

  const fetchMFDetails = useCallback(async (schemeCode: string): Promise<MFDetails> => {
    setLoading(true);
    setError(null);
    const electronApi = (window as any).electron;

    // Helper to calculate mock AUM based on scheme code
    const getMockAUM = (code: string) => {
      const numCode = parseInt(code) || 100000;
      return 5000 + (numCode % 45000); // stable deterministic mock AUM
    };

    // 1. Electron IPC Bridge
    if (electronApi && typeof electronApi.fetchMFData === 'function') {
      try {
        const res = await electronApi.fetchMFData(schemeCode);
        if (res.success && res.data) {
          const raw = res.data;
          const schemeName = raw.meta?.scheme_name || 'Unknown Fund';
          const navList = raw.data || [];
          const currentNAV = navList.length > 0 ? parseFloat(navList[0].nav) : 0;
          
          setLoading(false);
          return {
            schemeName,
            schemeCode,
            currentNAV,
            aum: getMockAUM(schemeCode),
            isStale: false
          };
        }
      } catch (err) {
        console.error('Electron IPC MF fetch failed', err);
      }
    }

    // 2. Browser Direct Fetch
    try {
      const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const raw = await response.json();
      
      const schemeName = raw.meta?.scheme_name || 'Unknown Fund';
      const navList = raw.data || [];
      const currentNAV = navList.length > 0 ? parseFloat(navList[0].nav) : 0;

      setLoading(false);
      return {
        schemeName,
        schemeCode,
        currentNAV,
        aum: getMockAUM(schemeCode),
        isStale: false
      };
    } catch (err: any) {
      console.warn('Direct fetch failed, falling back to mock database', err);
      
      // Fallback offline mock values
      const offlineMock = MOCK_MF_SEARCH.find(m => m.schemeCode.toString() === schemeCode);
      const mockNAV = 50 + (parseInt(schemeCode) % 450); // mock stable NAV

      setLoading(false);
      return {
        schemeName: offlineMock?.schemeName || `Mutual Fund (Code: ${schemeCode})`,
        schemeCode,
        currentNAV: mockNAV,
        aum: getMockAUM(schemeCode),
        isStale: true
      };
    }
  }, []);

  return { searchFunds, fetchMFDetails, loading, error };
}
