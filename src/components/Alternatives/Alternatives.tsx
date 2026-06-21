import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatDate, formatINR } from '../../utils/calculations';
import { generateId } from '../../utils/idGenerator';
import { useToast } from '../shared/Toast';
import { 
  Plus, 
  Search, 
  Trash2, 
  X, 
  Edit3, 
  Coins
} from 'lucide-react';

const CATEGORIES = [
  'Gold', 'Silver', 'Real Estate', 'Crypto', 'Angel Investment',
  'Fixed Deposit', 'Bonds', 'REITs/InvITs', 'P2P Lending', 'Other'
];

export const Alternatives: React.FC = () => {
  const { alternatives, addAlternative, updateAlternative, deleteAlternative } = usePortfolio();
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
  }, [alternatives, searchTerm]);
  
  // Modals & Drawers
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isValuationOpen, setIsValuationOpen] = useState(false);
  
  // Valuation editing State
  const [activeAssetId, setActiveAssetId] = useState('');
  const [activeAssetName, setActiveAssetName] = useState('');
  const [newValuation, setNewValuation] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Gold');
  const [investedAmount, setInvestedAmount] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [dateOfInvestment, setDateOfInvestment] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const filteredAssets = useMemo(() => {
    if (!searchTerm.trim()) return alternatives;
    const term = searchTerm.toLowerCase().trim();
    return alternatives.filter(a => 
      a.name.toLowerCase().includes(term) ||
      a.category.toLowerCase().includes(term) ||
      a.id.toLowerCase().includes(term)
    );
  }, [alternatives, searchTerm]);

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

  // Sorted assets
  const sortedAssets = useMemo(() => {
    let items = [...filteredAssets];
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
  }, [filteredAssets, sortConfig]);

  const renderSortableHeader = (label: string, key: string, alignment: 'left' | 'right' | 'center' = 'left') => {
    const isSorted = sortConfig?.key === key;
    const direction = sortConfig?.direction;
    
    return (
      <th 
        onClick={() => handleSort(key)}
        className={`py-3 px-3 cursor-pointer select-none hover:bg-[#1E1E2E] transition-colors group
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

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !investedAmount || !currentValue) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const payload = {
      id: generateId('ALT'),
      name: name.trim(),
      category,
      investedAmount: Number(investedAmount),
      currentValue: Number(currentValue),
      dateOfInvestment,
      notes: notes.trim()
    };

    addAlternative(payload);
    showToast('Alternative investment recorded!');

    // Reset Form
    setName('');
    setCategory('Gold');
    setInvestedAmount('');
    setCurrentValue('');
    setDateOfInvestment(new Date().toISOString().slice(0, 10));
    setNotes('');
    setIsAddOpen(false);
  };

  const handleValuationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(newValuation);

    if (val < 0 || isNaN(val)) {
      showToast('Please enter a valid valuation amount.', 'error');
      return;
    }

    updateAlternative(activeAssetId, { currentValue: val });
    showToast(`Valuation updated for ${activeAssetName} to ₹${val.toLocaleString('en-IN')}`);
    
    // Reset valuation
    setNewValuation('');
    setActiveAssetId('');
    setActiveAssetName('');
    setIsValuationOpen(false);
  };

  const openValuationModal = (id: string, name: string, currentVal: number) => {
    setActiveAssetId(id);
    setActiveAssetName(name);
    setNewValuation(currentVal.toString());
    setIsValuationOpen(true);
  };

  return (
    <div className="space-y-6 select-text">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 select-none">
        <div>
          <h2 className="text-xl font-bold font-sans text-cream">Alternative Investments Ledger</h2>
          <p className="text-[12px] text-muted">Manage manual assets including Gold, Real Estate, Crypto, Angel Investments</p>
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
              placeholder="Search by asset name, category..."
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
          Add Alternative Asset
        </button>
      </div>

      {/* Alternatives Table */}
      <div className="relative">
        <div ref={scrollRef} className="table-scroll-wrapper rounded border border-border bg-[#0A0A0F]">
          <table className="w-full border-collapse text-left text-[13px]" style={{ minWidth: '900px' }}>
            <thead className="sticky top-0 bg-surface border-b border-border z-10 select-none">
              <tr className="text-[#E8DCC8] uppercase text-[10px] tracking-wider font-sans font-bold">
                <th className="py-3.5 px-4 sticky left-0 bg-surface z-20 cursor-pointer hover:bg-[#1E1E2E] transition-colors" style={{ left: 0 }} onClick={() => handleSort('id')}>
                  <div className="flex items-center gap-1">
                    <span>Asset ID</span>
                    <span className={`text-[10px] ${sortConfig?.key === 'id' ? 'text-primary font-bold' : 'text-hint opacity-40'}`}>
                      {sortConfig?.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                <th className="py-3.5 px-4 sticky bg-surface z-20 cursor-pointer hover:bg-[#1E1E2E] transition-colors" style={{ left: '100px' }} onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">
                    <span>Asset Name</span>
                    <span className={`text-[10px] ${sortConfig?.key === 'name' ? 'text-primary font-bold' : 'text-hint opacity-40'}`}>
                      {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                    </span>
                  </div>
                </th>
                {renderSortableHeader('Category', 'category')}
                {renderSortableHeader('Date Invested', 'dateOfInvestment')}
                {renderSortableHeader('Invested Value', 'investedAmount', 'right')}
                {renderSortableHeader('Current Value', 'currentValue', 'right')}
                {renderSortableHeader('Unrealized P&L', 'unrealizedPnL', 'right')}
                <th className="py-3.5 px-4">Notes</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedAssets.length > 0 ? (
                sortedAssets.map((asset) => {
                return (
                  <tr key={asset.id} className="hover:bg-[#1E1E2E] transition-all bg-[#12121A]">
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#A0A0B0] select-none sticky bg-[#12121A] z-[2]" style={{ left: 0 }}>{asset.id}</td>

                    {/* Name */}
                    <td className="py-3.5 px-4 font-sans font-medium text-cream sticky bg-[#12121A] z-[2]" style={{ left: '100px' }}>{asset.name}</td>

                    {/* Category Tag */}
                    <td className="py-3.5 px-4 select-none">
                      <span className="px-2 py-0.5 rounded-full bg-elevated border border-border text-[11px] text-cream font-semibold">
                        {asset.category}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 select-none whitespace-nowrap">{formatDate(asset.dateOfInvestment)}</td>

                    {/* Invested */}
                    <td className="py-3.5 px-4 text-right font-mono text-[12px]">{formatINR(asset.investedAmount, false)}</td>

                    {/* Current Value */}
                    <td className="py-3.5 px-4 text-right font-mono text-[12px] font-bold text-cream">
                      {formatINR(asset.currentValue, false)}
                    </td>

                    {/* Unrealized P&L */}
                    <td className={`py-3.5 px-4 text-right font-mono text-[12px] font-semibold
                      ${asset.unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}
                    >
                      <div>{asset.unrealizedPnL >= 0 ? '+' : ''}{formatINR(asset.unrealizedPnL, false)}</div>
                      <div className="text-[10px] font-sans">({asset.unrealizedPnL >= 0 ? '+' : ''}{asset.unrealizedPnLPct.toFixed(1)}%)</div>
                    </td>

                    {/* Notes */}
                    <td className="py-3.5 px-4 truncate max-w-[150px] text-muted">{asset.notes || '-'}</td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center select-none">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openValuationModal(asset.id, asset.name, asset.currentValue)}
                          className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-primary"
                          title="Update Valuation"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete alternative asset ${asset.name}?`)) {
                              deleteAlternative(asset.id);
                              showToast('Asset removed');
                            }
                          }}
                          className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-danger"
                          title="Delete asset"
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
                <td colSpan={10} className="py-12 text-center text-[#505065]">
                  <div className="flex flex-col items-center gap-2 select-none">
                    <span className="text-[14px] font-sans font-semibold">No alternative assets registered</span>
                    <span className="text-[12px] text-hint font-sans">Use "Add Alternative Asset" to track real estate, crypto or physical gold.</span>
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
                <h3 className="text-[16px] font-bold text-cream uppercase tracking-wider">Register Alternative Asset</h3>
                <p className="text-[11px] text-muted mt-1">Record a non-market correlated alternative holding</p>
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
              
              {/* Asset Name */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Asset Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sovereign Gold Bonds 2024"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Asset Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                  required
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Date of Investment *
                  </label>
                  <input
                    type="date"
                    value={dateOfInvestment}
                    onChange={(e) => setDateOfInvestment(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                    required
                  />
                </div>

                {/* Invested Amount */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Invested Amount (INR) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={investedAmount}
                    onChange={(e) => setInvestedAmount(e.target.value)}
                    placeholder="e.g. 150000"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Current Value */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Current Valuation (INR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    placeholder="Initial current valuation"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Transaction Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record description, maturity dates, locking periods or location..."
                  className="w-full h-24 px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-sans resize-none focus:border-primary transition-colors"
                />
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
                  className="px-5 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] rounded text-[13px] font-bold uppercase tracking-wider transition-colors shadow-lg"
                >
                  Record Asset
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* VALUATION MODAL POPUP */}
      {isValuationOpen && (
        <div className="fixed inset-0 bg-[#000000]/80 flex items-center justify-center z-50 p-6 select-none animate-fade-in">
          <div className="w-full max-w-md bg-surface border border-border rounded flex flex-col overflow-hidden">
            <div className="h-12 bg-elevated border-b border-border flex items-center justify-between px-5">
              <span className="font-sans text-[12px] font-semibold text-cream uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-primary animate-bounce" />
                Update Valuation
              </span>
              <button 
                onClick={() => setIsValuationOpen(false)} 
                className="text-muted hover:text-cream transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            
            <form onSubmit={handleValuationSubmit} className="p-6 space-y-4 select-text">
              <div className="text-[12px] text-muted leading-relaxed select-none">
                Adjusting asset value for: <strong className="text-cream font-sans">{activeAssetName}</strong>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  New Valuation (INR) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={newValuation}
                  onChange={(e) => setNewValuation(e.target.value)}
                  placeholder="Enter valuation"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 select-none">
                <button
                  type="button"
                  onClick={() => setIsValuationOpen(false)}
                  className="px-4 py-2 bg-elevated border border-border hover:bg-[#1E1E2E] rounded text-cream text-[12px] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] rounded text-[12px] font-bold uppercase tracking-wider transition-colors shadow-lg"
                >
                  Save Valuation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Alternatives;
