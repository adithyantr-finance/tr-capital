import React, { useState, useEffect, useMemo, useRef } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { useMFData } from '../../hooks/useMFData';
import type { MFSearchResult } from '../../hooks/useMFData';
import { formatDate, formatINR } from '../../utils/calculations';
import { useToast } from '../shared/Toast';
import { 
  Plus, 
  Search, 
  Trash2, 
  RefreshCw, 
  Activity, 
  X, 
  Sparkles
} from 'lucide-react';

export const MutualFunds: React.FC = () => {
  const { funds, addFund, redeemFund, deleteFund, refreshAllData, loadingPrices, lastUpdated } = usePortfolio();
  const { searchFunds, fetchMFDetails, loading: fetchingApi } = useMFData();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');

  const [showScrollHint, setShowScrollHint] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setShowScrollHint(el.scrollLeft < maxScroll - 5);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      handleScroll();
      window.addEventListener('resize', handleScroll);
      return () => {
        el.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [funds, searchTerm]);
  
  // Modals & Drawers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  
  // Redemption State
  const [activeFundId, setActiveFundId] = useState('');
  const [redeemUnits, setRedeemUnits] = useState('');
  const [redeemNAV, setRedeemNAV] = useState('');

  // Form Fields
  const [userIdentId, setUserIdentId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MFSearchResult[]>([]);
  const [selectedSchemeCode, setSelectedSchemeCode] = useState('');
  const [selectedSchemeName, setSelectedSchemeName] = useState('');
  const [buyDate, setBuyDate] = useState(new Date().toISOString().slice(0, 10));
  const [buyNAV, setBuyNAV] = useState('');
  const [units, setUnits] = useState('');

  // Filtered funds
  const filteredFunds = useMemo(() => {
    if (!searchTerm.trim()) return funds;
    const term = searchTerm.toLowerCase().trim();
    return funds.filter(f => 
      f.schemeName.toLowerCase().includes(term) ||
      f.id.toLowerCase().includes(term) ||
      f.schemeCode.includes(term)
    );
  }, [funds, searchTerm]);

  // Sort State & Handlers
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'currentValue', direction: 'desc' });

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const clearSort = () => {
    setSortConfig({ key: 'currentValue', direction: 'desc' });
  };

  // Sorted funds
  const sortedFunds = useMemo(() => {
    let items = [...filteredFunds];
    if (!sortConfig) return items;

    items.sort((a, b) => {
      let aVal = (a as any)[sortConfig.key];
      let bVal = (b as any)[sortConfig.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      } else {
        const cmp = (aVal as number) - (bVal as number);
        return sortConfig.direction === 'asc' ? cmp : -cmp;
      }
    });

    return items;
  }, [filteredFunds, sortConfig]);

  const renderSortableHeader = (label: string, key: string, alignment: 'left' | 'right' | 'center' = 'left') => {
    const isSorted = sortConfig?.key === key;
    const direction = sortConfig?.direction;
    
    return (
      <th 
        onClick={() => handleSort(key)}
        className={`py-3.5 px-4 cursor-pointer select-none hover:bg-[#1E1E2E] transition-colors group
          ${alignment === 'right' ? 'text-right' : alignment === 'center' ? 'text-center' : 'text-left'}
          ${isSorted ? 'border-b border-primary' : ''}`}
      >
        <div className={`flex items-center gap-1 ${alignment === 'right' ? 'justify-end' : alignment === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          <span className={`text-[10px] transition-colors ${isSorted ? 'text-primary font-bold' : 'text-hint opacity-40 group-hover:opacity-100'}`}>
            {isSorted ? (direction === 'asc' ? '↑' : '↓') : '⇅'}
          </span>
        </div>
      </th>
    );
  };

  // Handle scheme search query change
  useEffect(() => {
    const triggerSearch = async () => {
      if (searchQuery.trim().length >= 3) {
        const results = await searchFunds(searchQuery);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    };
    const timer = setTimeout(triggerSearch, 400); // debounce API calls
    return () => clearTimeout(timer);
  }, [searchQuery, searchFunds]);

  const handleSchemeSelect = async (code: number, name: string) => {
    setSelectedSchemeCode(code.toString());
    setSelectedSchemeName(name);
    setSearchQuery(name);
    setSearchResults([]);
    
    // Attempt auto-fetching current NAV for pre-fill
    try {
      const details = await fetchMFDetails(code.toString());
      setBuyNAV(details.currentNAV.toString());
      showToast(`Resolved Latest NAV: ₹${details.currentNAV}`);
    } catch (e) {
      console.warn('Failed to resolve buy NAV on selection', e);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSchemeCode || !selectedSchemeName || !buyNAV || !units) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const payload = {
      id: userIdentId.trim() || `TRC-MF-${selectedSchemeCode}-${Date.now().toString().slice(-4)}`,
      schemeName: selectedSchemeName,
      schemeCode: selectedSchemeCode,
      dateOfBuy: buyDate,
      buyNAV: Number(buyNAV),
      units: Number(units),
      aum: 0, // Will resolve on sync
      currentNAV: Number(buyNAV)
    };

    addFund(payload);
    showToast('Mutual Fund holding registered!');

    // Reset Form
    setUserIdentId('');
    setSearchQuery('');
    setSelectedSchemeCode('');
    setSelectedSchemeName('');
    setBuyNAV('');
    setUnits('');
    setBuyDate(new Date().toISOString().slice(0, 10));
    setIsAddOpen(false);
  };

  const handleRedeemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fund = funds.find(f => f.id === activeFundId);
    if (!fund) return;

    const unitsToRedeem = Number(redeemUnits);
    const navVal = Number(redeemNAV);

    if (unitsToRedeem <= 0 || isNaN(unitsToRedeem)) {
      showToast('Please enter a valid number of units.', 'error');
      return;
    }

    if (unitsToRedeem > fund.units) {
      showToast(`Redemption quantity exceeds available balance of ${fund.units} units.`, 'error');
      return;
    }

    if (navVal <= 0 || isNaN(navVal)) {
      showToast('Please enter a valid NAV.', 'error');
      return;
    }

    redeemFund(activeFundId, unitsToRedeem, navVal);
    showToast(`Successfully redeemed ${unitsToRedeem} units at NAV ₹${navVal}`);
    
    // Reset redemption
    setRedeemUnits('');
    setRedeemNAV('');
    setActiveFundId('');
    setIsRedeemOpen(false);
  };

  const openRedeemModal = (id: string, currentNAV: number) => {
    setActiveFundId(id);
    setRedeemNAV(currentNAV.toString());
    setIsRedeemOpen(true);
  };

  return (
    <div className="space-y-6 select-text">
      {/* Header and Live Sync Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 select-none">
        <div>
          <h2 className="text-xl font-bold font-sans text-cream">Mutual Funds Ledger</h2>
          <p className="text-[12px] text-muted">Track Indian mutual funds and automate daily NAV updates</p>
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-[#505065] font-sans font-medium">
              Last synced: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={refreshAllData}
            disabled={loadingPrices}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:border-primary/60 hover:text-primary rounded text-cream transition-colors text-[12px] font-semibold uppercase disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPrices ? 'animate-spin text-primary' : ''}`} />
            {loadingPrices ? 'Syncing...' : 'Sync NAVs'}
          </button>
        </div>
      </div>

      {/* Table Actions Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-4">
          <div className="relative w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by fund name, user ID..."
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded text-cream placeholder-hint text-[13px] font-sans focus:border-primary transition-colors"
            />
          </div>
          {sortConfig && (sortConfig.key !== 'currentValue' || sortConfig.direction !== 'desc') && (
            <button 
              onClick={clearSort}
              className="text-[11px] text-primary hover:underline font-bold uppercase tracking-wider"
            >
              Clear Sort
            </button>
          )}
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-colors shadow-lg shadow-primary/5"
        >
          <Plus className="w-4 h-4" />
          Add Fund holding
        </button>
      </div>

      {/* Funds Ledger Table */}
      <div className="relative">
        <div ref={scrollRef} className="table-scroll-wrapper rounded border border-border bg-[#0A0A0F]">
          <table className="w-full border-collapse text-left text-[13px]" style={{ minWidth: '1100px' }}>
            <thead className="sticky top-0 bg-surface border-b border-border z-10 select-none">
              <tr className="text-[#E8DCC8] uppercase text-[10px] tracking-wider font-sans font-bold">
                <th className="py-3.5 px-4 sticky left-0 bg-surface z-20 cursor-pointer hover:bg-[#1E1E2E] transition-colors" style={{ left: 0 }} onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-1">
                    <span>Identification ID</span>
                    <span className={`text-[10px] ${sortConfig?.key === 'id' ? 'text-primary font-bold' : 'text-hint opacity-40'}`}>
                      {sortConfig?.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="py-3.5 px-4 sticky bg-surface z-20 cursor-pointer hover:bg-[#1E1E2E] transition-colors font-sans" style={{ left: '120px' }} onClick={() => handleSort('schemeName')}>
                  <div className="flex items-center gap-1">
                    <span>Scheme Name</span>
                    <span className={`text-[10px] ${sortConfig?.key === 'schemeName' ? 'text-primary font-bold' : 'text-hint opacity-40'}`}>
                      {sortConfig?.key === 'schemeName' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                {renderSortableHeader('Date purchased', 'dateOfBuy')}
                {renderSortableHeader('Buy NAV', 'buyNAV', 'right')}
                {renderSortableHeader('Units Held', 'units', 'right')}
                {renderSortableHeader('Invested value', 'investedValue', 'right')}
                {renderSortableHeader('AUM (Cr)', 'aum', 'right')}
                {renderSortableHeader('Current NAV', 'currentNAV', 'right')}
                {renderSortableHeader('Current Value', 'currentValue', 'right')}
                {renderSortableHeader('Unrealized P&L', 'unrealizedPnL', 'right')}
                {renderSortableHeader('Realized gains', 'realizedPnL', 'right')}
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedFunds.length > 0 ? (
                sortedFunds.map((fund) => {
                return (
                  <tr key={fund.id} className="hover:bg-[#1E1E2E] transition-all bg-[#12121A]">
                    {/* User ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-primary select-none sticky bg-[#12121A] z-[2]" style={{ left: 0 }}>{fund.id}</td>

                    {/* Scheme Name */}
                    <td className="py-3.5 px-4 truncate max-w-[200px] font-sans font-medium sticky bg-[#12121A] z-[2]" style={{ left: '120px' }}>{fund.schemeName}</td>

                    {/* Buy Date */}
                    <td className="py-3.5 px-4 whitespace-nowrap select-none">{formatDate(fund.dateOfBuy)}</td>

                    {/* Buy NAV */}
                    <td className="py-3.5 px-4 text-right font-mono text-[12px]">{formatINR(fund.buyNAV, false)}</td>

                    {/* Units */}
                    <td className="py-3.5 px-4 text-right font-mono text-[12px]">{fund.units.toFixed(3)}</td>

                    {/* Invested Value */}
                    <td className="py-3.5 px-4 text-right font-mono text-[12px]">{formatINR(fund.investedValue, false)}</td>

                    {/* AUM */}
                    <td className="py-3.5 px-4 text-right font-mono text-[12px]">
                      {fund.aum > 0 ? `₹${fund.aum.toLocaleString('en-IN')}` : 'N/A'}
                    </td>

                    {/* Current NAV */}
                    <td className="py-3.5 px-4 text-right font-mono text-[12px]">{formatINR(fund.currentNAV, false)}</td>

                    {/* Current Value */}
                    <td className="py-3.5 px-4 text-right font-mono text-[12px] font-bold text-cream">
                      {formatINR(fund.currentValue, false)}
                    </td>

                    {/* Unrealized P&L */}
                    <td className={`py-3.5 px-4 text-right font-mono text-[12px] font-semibold
                      ${fund.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}
                    >
                      <div>{fund.unrealizedPnL >= 0 ? '+' : ''}{formatINR(fund.unrealizedPnL, false)}</div>
                      <div className="text-[10px] font-sans">({fund.unrealizedPnL >= 0 ? '+' : ''}{fund.unrealizedPnLPct.toFixed(1)}%)</div>
                    </td>

                    {/* Realized */}
                    <td className={`py-3.5 px-4 text-right font-mono text-[12px]
                      ${fund.realizedPnL >= 0 ? 'text-success/80' : 'text-danger/80'}`}
                    >
                      {fund.realizedPnL !== 0 ? formatINR(fund.realizedPnL, false) : '-'}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center select-none">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openRedeemModal(fund.id, fund.currentNAV)}
                          className="px-2 py-1 bg-elevated border border-border hover:border-primary/60 rounded text-[11px] font-semibold text-primary uppercase"
                          title="Redeem units"
                        >
                          Redeem
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Remove mutual fund holding ${fund.id} from ledger?`)) {
                              deleteFund(fund.id);
                              showToast('Holding deleted');
                            }
                          }}
                          className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-danger"
                          title="Delete holding"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={13} className="py-12 text-center text-[#505065]">
                  <div className="flex flex-col items-center gap-2 select-none">
                    <span className="text-[14px] font-sans font-semibold">No mutual fund holdings registered</span>
                    <span className="text-[12px] text-hint font-sans">Click on the "Add Fund holding" action to add an investment.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
        {showScrollHint && <div className="scroll-hint-right" />}
      </div>

      {/* ADD DRAWER MODAL */}
      {isAddOpen && (
        <>
          <div className="fixed inset-0 bg-[#000000]/70 z-40 animate-fade-in" onClick={() => setIsAddOpen(false)} />
          <div className="fixed top-0 right-0 bottom-0 w-[580px] bg-surface border-l border-border z-50 flex flex-col p-8 overflow-y-auto select-none animate-slide-left">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
              <div>
                <h3 className="text-[16px] font-bold text-cream uppercase tracking-wider">Register Mutual Fund</h3>
                <p className="text-[11px] text-muted mt-1">Search and record a mutual fund buy to the ledger</p>
              </div>
              <button 
                onClick={() => setIsAddOpen(false)} 
                className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-muted hover:text-cream"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddSubmit} className="flex-1 space-y-5 select-text">
              
              {/* ID */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Identification ID
                </label>
                <input
                  type="text"
                  value={userIdentId}
                  onChange={(e) => setUserIdentId(e.target.value)}
                  placeholder="e.g. HDFC_FLEXICAP_001 (auto generated if blank)"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors font-mono"
                />
              </div>

              {/* Search Dropdown */}
              <div className="relative">
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Search Fund Scheme (MFAPI India) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-hint">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type to search (e.g. Parag Parikh Flexi)"
                    className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                    required
                  />
                  {fetchingApi && (
                    <span className="absolute inset-y-0 right-3 flex items-center">
                      <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                    </span>
                  )}
                </div>
                {searchResults.length > 0 && (
                  <ul className="absolute left-0 right-0 mt-1 bg-elevated border border-border rounded shadow-2xl z-10 divide-y divide-border/60 max-h-48 overflow-y-auto select-none">
                    {searchResults.map((s) => (
                      <li key={s.schemeCode}>
                        <button
                          type="button"
                          onClick={() => handleSchemeSelect(s.schemeCode, s.schemeName)}
                          className="w-full text-left px-4 py-2 hover:bg-surface text-[12px] text-cream hover:text-primary transition-colors font-sans font-medium"
                        >
                          {s.schemeName} <span className="font-mono text-[10px] text-hint ml-1">({s.schemeCode})</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedSchemeCode && (
                <div className="p-3.5 bg-[#0A0A0F] border border-border rounded flex items-center gap-2 select-none">
                  <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                  <div className="text-[12px] text-cream">
                    Linked Scheme Code: <strong className="text-primary font-mono">{selectedSchemeCode}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Date of Purchase *
                  </label>
                  <input
                    type="date"
                    value={buyDate}
                    onChange={(e) => setBuyDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                    required
                  />
                </div>

                {/* Units */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Units Purchased *
                  </label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    placeholder="e.g. 79.742"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* NAV at buy */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    NAV at Purchase (INR) *
                  </label>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={buyNAV}
                    onChange={(e) => setBuyNAV(e.target.value)}
                    placeholder="e.g. 125.40"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6 border-t border-border flex items-center justify-end gap-3 select-none">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 bg-elevated border border-border hover:bg-[#1E1E2E] rounded text-cream text-[13px] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={fetchingApi}
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] rounded text-[13px] font-bold uppercase tracking-wider transition-colors shadow-lg disabled:opacity-50"
                >
                  Save Investment
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* REDEMPTION MODAL POPUP */}
      {isRedeemOpen && (
        <div className="fixed inset-0 bg-[#000000]/80 flex items-center justify-center z-50 p-6 select-none animate-fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded flex flex-col overflow-hidden">
            <div className="h-12 bg-elevated border-b border-border flex items-center justify-between px-5">
              <span className="font-sans text-[12px] font-semibold text-cream uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-primary" />
                Redeem Fund Units
              </span>
              <button 
                onClick={() => setIsRedeemOpen(false)} 
                className="text-muted hover:text-cream transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleRedeemSubmit} className="p-6 space-y-4 select-text">
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Units to Redeem *
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={redeemUnits}
                  onChange={(e) => setRedeemUnits(e.target.value)}
                  placeholder="Enter number of units"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Redemption NAV (INR) *
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={redeemNAV}
                  onChange={(e) => setRedeemNAV(e.target.value)}
                  placeholder="Redeem price per NAV"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 select-none">
                <button
                  type="button"
                  onClick={() => setIsRedeemOpen(false)}
                  className="px-4 py-2 bg-elevated border border-border hover:bg-[#1E1E2E] rounded text-cream text-[12px] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] rounded text-[12px] font-bold uppercase tracking-wider transition-colors shadow-lg"
                >
                  Confirm Redemption
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default MutualFunds;
