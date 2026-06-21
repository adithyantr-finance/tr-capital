import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { useStockData } from '../../hooks/useStockData';
import { useAuth } from '../../context/AuthContext';
import { generateId } from '../../utils/idGenerator';
import { useToast } from '../shared/Toast';
import { X, Plus, Trash } from 'lucide-react';

interface QuickBuyRecorderProps {
  onClose: () => void;
}

export const QuickBuyRecorder: React.FC<QuickBuyRecorderProps> = ({ onClose }) => {
  const { addBuy, addSubsequentPurchase, buys } = usePortfolio();
  const { fetchStock } = useStockData();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [activeMode, setActiveMode] = useState<'quick' | 'full'>('quick');
  const tickerInputRef = useRef<HTMLInputElement>(null);

  // Form Fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tickerName, setTickerName] = useState('');
  const [suffix, setSuffix] = useState<'.NS' | '.BO'>('.NS');
  
  const [resolvedName, setResolvedName] = useState('');
  const [resolvedIndustry, setResolvedIndustry] = useState('');
  const [resolvedPE, setResolvedPE] = useState(0);
  const [resolvedPrice, setResolvedPrice] = useState(0);
  const [resolving, setResolving] = useState(false);

  const [quantity, setQuantity] = useState('');
  const [avgBuyPrice, setAvgBuyPrice] = useState('');
  const [fees, setFees] = useState('0');
  const [targetPrice, setTargetPrice] = useState('');

  // Full Entry Fields
  const [holdingDuration, setHoldingDuration] = useState('1 year');
  const [opinion, setOpinion] = useState('');
  const [pdfs, setPdfs] = useState<{ name: string; base64: string; date: string }[]>([]);
  
  // Subsequent purchase link
  const [isSubsequent, setIsSubsequent] = useState(false);
  const [parentBuyId, setParentBuyId] = useState('');

  const username = currentUser?.username || '';

  // Focus ticker on mount
  useEffect(() => {
    if (tickerInputRef.current) {
      tickerInputRef.current.focus();
    }
  }, []);

  // Format final ticker string
  const finalTicker = useMemo(() => {
    const term = tickerName.trim().toUpperCase();
    if (!term) return '';
    if (term.endsWith('.NS') || term.endsWith('.BO')) return term;
    return `${term}${suffix}`;
  }, [tickerName, suffix]);

  // Filters parent buys with the same ticker
  const parentBuyOptions = useMemo(() => {
    if (!finalTicker) return [];
    return buys.filter(b => b.ticker === finalTicker);
  }, [buys, finalTicker]);

  // Auto-resolve stock on ticker blur
  const handleTickerBlur = async () => {
    if (!tickerName.trim()) return;
    await resolveTicker(finalTicker);
  };

  const resolveTicker = async (tickerVal: string) => {
    setResolving(true);
    try {
      const stock = await fetchStock(tickerVal);
      setResolvedName(stock.stockName);
      setResolvedIndustry(stock.industry);
      setResolvedPrice(stock.currentPrice);
      setResolvedPE(stock.currentPE);
      
      // Auto-populate buy price & target price if empty
      if (!avgBuyPrice) {
        setAvgBuyPrice(stock.currentPrice.toString());
      }
      if (!targetPrice) {
        setTargetPrice((stock.currentPrice * 1.2).toFixed(2));
      }
    } catch (e) {
      showToast('Ticker not resolved. Please input details.', 'error');
    } finally {
      setResolving(false);
    }
  };

  // Computations
  const totalValue = useMemo(() => {
    const qty = Number(quantity) || 0;
    const price = Number(avgBuyPrice) || 0;
    const fee = Number(fees) || 0;
    return (qty * price) + fee;
  }, [quantity, avgBuyPrice, fees]);

  const pctToTarget = useMemo(() => {
    const target = Number(targetPrice) || 0;
    const price = Number(avgBuyPrice) || 0;
    if (price === 0) return 0;
    return ((target - price) / price) * 100;
  }, [targetPrice, avgBuyPrice]);

  // PDF uploads base64 encoder
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type !== 'application/pdf') {
        showToast('Only PDF files are supported.', 'error');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        showToast('PDF size must be under 2MB.', 'error');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setPdfs((prev) => [
          ...prev,
          {
            name: file.name,
            base64,
            date: new Date().toISOString().split('T')[0],
          },
        ]);
        showToast(`Uploaded: ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePdf = (idx: number) => {
    setPdfs((prev) => prev.filter((_, i) => i !== idx));
  };

  const wordCount = opinion.trim() === '' ? 0 : opinion.trim().split(/\s+/).length;

  const handleSave = (addAnother: boolean) => {
    if (!finalTicker || !quantity || !avgBuyPrice) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const resolvedBuyPrice = Number(avgBuyPrice);
    const resolvedQty = Number(quantity);
    const resolvedFees = Number(fees || 0);
    const resolvedTarget = Number(targetPrice || avgBuyPrice);

    const transactionId = generateId('EQ');

    const newTransactionPayload = {
      transactionId,
      date,
      ticker: finalTicker,
      stockName: resolvedName || tickerName.toUpperCase(),
      industry: resolvedIndustry || 'Other',
      quantity: resolvedQty,
      avgBuyPrice: resolvedBuyPrice,
      fees: resolvedFees,
      totalBuyValue: (resolvedQty * resolvedBuyPrice) + resolvedFees,
      targetPrice: resolvedTarget,
      pctToTarget: resolvedBuyPrice > 0 ? ((resolvedTarget - resolvedBuyPrice) / resolvedBuyPrice) * 100 : 0,
      holdingDuration,
      opinion,
      currentPrice: resolvedPrice || resolvedBuyPrice,
      currentValue: resolvedQty * (resolvedPrice || resolvedBuyPrice),
      currentPE: resolvedPE || 0,
      contactNotes: pdfs.map(p => `${p.name}::${p.date}::${p.base64}`),
      isPartialSold: false,
      subsequentPurchases: []
    };

    // Step 1: Write directly to namespaced localStorage first
    if (username) {
      const storageKey = `trcapital_user_${username}_buys`;
      try {
        const storedBuys = localStorage.getItem(storageKey);
        let buysList = storedBuys ? JSON.parse(storedBuys) : [];

        if (isSubsequent && parentBuyId) {
          buysList = buysList.map((b: any) => {
            if (b.transactionId !== parentBuyId) return b;
            const subList = b.subsequentPurchases ? [...b.subsequentPurchases, newTransactionPayload] : [newTransactionPayload];
            const newParentQty = b.quantity + resolvedQty;
            const newParentFees = b.fees + resolvedFees;
            const totalCostExclFees = (b.quantity * b.avgBuyPrice) + (resolvedQty * resolvedBuyPrice);
            const newParentAvgPrice = newParentQty > 0 ? (totalCostExclFees / newParentQty) : b.avgBuyPrice;

            return {
              ...b,
              quantity: newParentQty,
              avgBuyPrice: newParentAvgPrice,
              fees: newParentFees,
              totalBuyValue: (newParentQty * newParentAvgPrice) + newParentFees,
              currentValue: newParentQty * b.currentPrice,
              subsequentPurchases: subList
            };
          });
        } else {
          buysList = [newTransactionPayload, ...buysList];
        }
        localStorage.setItem(storageKey, JSON.stringify(buysList));
      } catch (err) {
        console.error('Failed to pre-save to localStorage', err);
      }
    }

    // Step 2: Dispatch to React context state (triggers UI re-render)
    if (isSubsequent && parentBuyId) {
      addSubsequentPurchase(parentBuyId, newTransactionPayload);
    } else {
      addBuy(newTransactionPayload);
    }

    // Step 3: Success toast
    showToast(`Buy recorded: ${finalTicker} × ${resolvedQty} @ ₹${resolvedBuyPrice.toLocaleString('en-IN')}`);

    if (addAnother) {
      // Reset Form fields
      setTickerName('');
      setQuantity('');
      setAvgBuyPrice('');
      setFees('0');
      setTargetPrice('');
      setResolvedName('');
      setResolvedIndustry('');
      setResolvedPrice(0);
      setResolvedPE(0);
      setOpinion('');
      setPdfs([]);
      setIsSubsequent(false);
      setParentBuyId('');
      if (tickerInputRef.current) {
        tickerInputRef.current.focus();
      }
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 select-none">
      <div 
        className="bg-surface border border-border rounded-lg max-w-[520px] w-full shadow-2xl relative flex flex-col font-sans text-cream overflow-hidden border-t-4 border-primary"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/40 select-none">
          <div className="flex items-center gap-2">
            <Plus className="text-primary w-5 h-5" />
            <h3 className="text-[14px] font-bold text-[#E8DCC8] uppercase tracking-wider">
              Record Buy Transaction
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-elevated rounded border border-transparent hover:border-border text-[#A0A0B0] hover:text-[#F0F0F5] transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tab Switcher */}
        <div className="p-4 bg-background/30 border-b border-border/40 select-none flex justify-center">
          <div className="flex bg-[#0A0A0F] border border-border rounded p-1 w-full max-w-[320px]">
            <button
              onClick={() => setActiveMode('quick')}
              className={`flex-1 py-1 text-center font-sans text-[11px] font-bold uppercase rounded transition-colors cursor-pointer ${
                activeMode === 'quick' ? 'bg-primary text-[#0A0A0F]' : 'text-muted hover:text-cream'
              }`}
            >
              Quick Entry
            </button>
            <button
              onClick={() => setActiveMode('full')}
              className={`flex-1 py-1 text-center font-sans text-[11px] font-bold uppercase rounded transition-colors cursor-pointer ${
                activeMode === 'full' ? 'bg-primary text-[#0A0A0F]' : 'text-muted hover:text-cream'
              }`}
            >
              Full Entry
            </button>
          </div>
        </div>

        {/* Modal Body Form - scrollable if Full Entry */}
        <div 
          className="p-5 space-y-4 select-text"
          style={{ maxHeight: activeMode === 'full' ? '60vh' : 'auto', overflowY: activeMode === 'full' ? 'auto' : 'visible' }}
        >
          {/* 1. Date Field */}
          <div>
            <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
              Transaction Date *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
              required
            />
          </div>

          {/* 2. Ticker Field with Toggle Suffix */}
          <div>
            <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
              Stock Ticker *
            </label>
            <div className="flex gap-2">
              <input
                ref={tickerInputRef}
                type="text"
                value={tickerName}
                onChange={(e) => setTickerName(e.target.value)}
                onBlur={handleTickerBlur}
                className="flex-1 px-3 py-2 bg-background border border-border rounded text-cream text-[13px] uppercase focus:border-primary transition-colors placeholder-hint"
                placeholder="e.g. RELIANCE"
                required
              />
              <div className="flex border border-border rounded overflow-hidden select-none">
                <button
                  type="button"
                  onClick={() => setSuffix('.NS')}
                  className={`px-3 py-1 font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                    suffix === '.NS' ? 'bg-primary text-[#0A0A0F]' : 'bg-elevated text-muted hover:text-cream'
                  }`}
                >
                  NSE
                </button>
                <button
                  type="button"
                  onClick={() => setSuffix('.BO')}
                  className={`px-3 py-1 font-mono text-[11px] font-bold transition-colors cursor-pointer ${
                    suffix === '.BO' ? 'bg-primary text-[#0A0A0F]' : 'bg-elevated text-muted hover:text-cream'
                  }`}
                >
                  BSE
                </button>
              </div>
            </div>
            
            {/* Auto-resolved Name Label */}
            {resolving && (
              <span className="block text-primary text-[10px] mt-1 animate-pulse font-sans">Resolving ticker properties...</span>
            )}
            {!resolving && resolvedName && (
              <span className="block text-muted text-[11px] mt-1 font-sans">
                Resolved: <strong className="text-primary font-bold">{resolvedName}</strong> ({resolvedIndustry})
              </span>
            )}
          </div>

          {/* Subsequent DCA Toggle (only if options exist) */}
          {parentBuyOptions.length > 0 && (
            <div className="p-3 bg-elevated/40 border border-border/60 rounded space-y-3 select-none">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSubsequent}
                  onChange={(e) => setIsSubsequent(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-0 focus:ring-offset-0 bg-background"
                />
                <span className="text-[12px] font-semibold text-cream">Link as DCA Subsequent Purchase</span>
              </label>
              
              {isSubsequent && (
                <div>
                  <label className="block text-[10px] font-semibold text-muted uppercase tracking-wider mb-1.5">
                    Select Parent Lot *
                  </label>
                  <select
                    value={parentBuyId}
                    onChange={(e) => setParentBuyId(e.target.value)}
                    className="w-full px-2 py-1.5 bg-background border border-border rounded text-cream text-[12px] focus:border-primary font-mono select-text"
                    required={isSubsequent}
                  >
                    <option value="">-- Choose parent lot --</option>
                    {parentBuyOptions.map(b => (
                      <option key={b.transactionId} value={b.transactionId}>
                        ID: {b.transactionId.slice(-8)} (Qty: {b.quantity} @ ₹{b.avgBuyPrice})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* 3. Quantity & Buy Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                Avg Buy Price (₹) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={avgBuyPrice}
                onChange={(e) => setAvgBuyPrice(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                required
              />
            </div>
          </div>

          {/* 4. Fees & Target Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                Brokerage/Fees (₹)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                Target Price (₹)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* 5. Live Computations */}
          <div className="p-4 bg-background/50 border border-border rounded space-y-2 select-none">
            <div className="flex justify-between text-[12px]">
              <span className="text-muted">Total Buy Value:</span>
              <span className="font-mono font-bold text-cream">
                ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-muted">% to Target:</span>
              <span className={`font-mono font-bold ${pctToTarget >= 0 ? 'text-success' : 'text-danger'}`}>
                {pctToTarget >= 0 ? '+' : ''}{pctToTarget.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* FULL ENTRY ONLY FIELDS */}
          {activeMode === 'full' && (
            <div className="space-y-4 pt-2 border-t border-border/40 animate-in fade-in duration-300">
              {/* Holding Duration */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                  Expected Holding Duration
                </label>
                <input
                  type="text"
                  value={holdingDuration}
                  onChange={(e) => setHoldingDuration(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                  placeholder="e.g. 1 year, 3 years"
                />
              </div>

              {/* Thesis/Opinion */}
              <div>
                <div className="flex justify-between items-center mb-2 select-none">
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider">
                    Investment Thesis / Opinion
                  </label>
                  <span className="text-[10px] text-muted font-mono">{wordCount} words / 500 max</span>
                </div>
                <textarea
                  value={opinion}
                  onChange={(e) => setOpinion(e.target.value)}
                  className="w-full h-24 px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors resize-none placeholder-hint"
                  placeholder="Write your research opinion..."
                />
              </div>

              {/* PDF upload */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                  Upload Contact Notes (PDF only)
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfUpload}
                  className="w-full text-[12px] text-muted file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-elevated file:text-cream hover:file:bg-border transition-all cursor-pointer"
                />
                
                {/* Uploaded PDF list */}
                {pdfs.length > 0 && (
                  <div className="mt-3 space-y-2 select-none">
                    {pdfs.map((pdf, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-[#0A0A0F] border border-border rounded text-[12px]">
                        <span className="truncate max-w-xs">{pdf.name}</span>
                        <button
                          type="button"
                          onClick={() => removePdf(idx)}
                          className="text-danger hover:text-danger/80 transition-colors p-1"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-background/50 border-t border-border/40 select-none flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-elevated border border-border hover:bg-[#1E1E2E] rounded text-cream text-[12px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="px-4 py-2 border border-primary text-primary hover:bg-primary/10 rounded text-[12px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Save & Add Another
            </button>
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="px-5 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] rounded text-[12px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-primary/5 cursor-pointer"
            >
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default QuickBuyRecorder;
