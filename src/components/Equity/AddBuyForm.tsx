import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { useStockData } from '../../hooks/useStockData';
import { generateId } from '../../utils/idGenerator';
import { useToast } from '../shared/Toast';
import { X, HelpCircle, FileText, Plus, Trash } from 'lucide-react';

interface AddBuyFormProps {
  isOpen: boolean;
  onClose: () => void;
  parentBuyId?: string; // If set, we are doing a DCA subsequent buy
  editTransactionId?: string; // If set, we are editing this buy transaction
}

const COMMON_TICKERS = [
  'RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS',
  'ITC.NS', 'TATASTEEL.NS', 'SBIN.NS', 'BHARTIARTL.NS', 'LTIM.NS'
];

export const AddBuyForm: React.FC<AddBuyFormProps> = ({ isOpen, onClose, parentBuyId, editTransactionId }) => {
  const { addBuy, addSubsequentPurchase, buys, updateBuy, deleteBuy } = usePortfolio();
  const { fetchStock, loading: fetchingStock } = useStockData();
  const { showToast } = useToast();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [ticker, setTicker] = useState('');
  const [stockName, setStockName] = useState('');
  const [industry, setIndustry] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgBuyPrice, setAvgBuyPrice] = useState('');
  const [fees, setFees] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [holdingDuration, setHoldingDuration] = useState('1 year');
  const [opinion, setOpinion] = useState('');
  
  // Array of { name: string, base64: string, date: string }
  const [pdfs, setPdfs] = useState<{ name: string; base64: string; date: string }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);

  const [lastEditedAt, setLastEditedAt] = useState<string | undefined>(undefined);

  // Pre-fill state when editing or parent buy lot is selected
  useEffect(() => {
    if (!isOpen) return;

    if (editTransactionId) {
      const item = buys.find(b => b.transactionId === editTransactionId);
      if (item) {
        setDate(item.date);
        setTicker(item.ticker);
        setStockName(item.stockName);
        setIndustry(item.industry);
        setQuantity(String(item.quantity));
        setAvgBuyPrice(String(item.avgBuyPrice));
        setFees(String(item.fees));
        setTargetPrice(String(item.targetPrice));
        setHoldingDuration(item.holdingDuration);
        setOpinion(item.opinion || '');
        setLastEditedAt((item as any).lastEditedAt);

        const parsedPdfs = (item.contactNotes || []).map(serialized => {
          const parts = serialized.split('::');
          if (parts.length < 3) {
            return { name: 'Attached Document.pdf', date: item.date, base64: serialized };
          }
          return { name: parts[0], date: parts[1], base64: parts[2] };
        });
        setPdfs(parsedPdfs);
      }
    } else if (parentBuyId) {
      const parent = buys.find(b => b.transactionId === parentBuyId);
      if (parent) {
        setTicker(parent.ticker);
        setStockName(parent.stockName);
        setIndustry(parent.industry);
        // Clear other fields
        setDate(new Date().toISOString().slice(0, 10));
        setQuantity('');
        setAvgBuyPrice('');
        setFees('');
        setTargetPrice('');
        setHoldingDuration('1 year');
        setOpinion('');
        setPdfs([]);
        setLastEditedAt(undefined);
      }
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setTicker('');
      setStockName('');
      setIndustry('');
      setQuantity('');
      setAvgBuyPrice('');
      setFees('');
      setTargetPrice('');
      setHoldingDuration('1 year');
      setOpinion('');
      setPdfs([]);
      setLastEditedAt(undefined);
    }
  }, [editTransactionId, parentBuyId, buys, isOpen]);

  // Autocomplete ticker filter
  useEffect(() => {
    if (parentBuyId) return; // Locked ticker
    if (ticker.trim().length >= 2) {
      const term = ticker.trim().toUpperCase();
      const filtered = COMMON_TICKERS.filter(t => t.includes(term));
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [ticker, parentBuyId]);

  const handleTickerSelect = async (selected: string) => {
    setTicker(selected);
    setSuggestions([]);
    await triggerStockResolve(selected);
  };

  const triggerStockResolve = async (tickerVal: string) => {
    try {
      const stock = await fetchStock(tickerVal);
      setStockName(stock.stockName);
      setIndustry(stock.industry);
      showToast(`Resolved: ${stock.stockName} (${stock.industry})`);
    } catch (e) {
      showToast('Ticker not found in database. Please enter manually.', 'error');
    }
  };

  // Handles base64 conversion for multiple files
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

  // Word counter
  const wordCount = opinion.trim() === '' ? 0 : opinion.trim().split(/\s+/).length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!ticker || !stockName || !quantity || !avgBuyPrice) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const payload = {
      transactionId: generateId('EQ'),
      date,
      ticker: ticker.trim().toUpperCase(),
      stockName: stockName.trim(),
      industry: industry.trim() || 'Other',
      quantity: Number(quantity),
      avgBuyPrice: Number(avgBuyPrice),
      fees: Number(fees || 0),
      targetPrice: Number(targetPrice || avgBuyPrice),
      holdingDuration,
      opinion,
      currentPrice: Number(avgBuyPrice),
      subsequentPurchases: [],
      contactNotes: pdfs.map(p => `${p.name}::${p.date}::${p.base64}`) // Save serialized PDF info
    };

    const finalPayload = payload;

    if (editTransactionId) {
      const updatedFields = {
        date,
        ticker: ticker.trim().toUpperCase(),
        stockName: stockName.trim(),
        industry: industry.trim() || 'Other',
        quantity: Number(quantity),
        avgBuyPrice: Number(avgBuyPrice),
        fees: Number(fees || 0),
        totalBuyValue: Number(quantity) * Number(avgBuyPrice) + Number(fees || 0),
        targetPrice: Number(targetPrice || avgBuyPrice),
        holdingDuration,
        opinion,
        contactNotes: pdfs.map(p => `${p.name}::${p.date}::${p.base64}`),
        lastEditedAt: new Date().toISOString()
      };
      updateBuy(editTransactionId, updatedFields);
      showToast('Buy transaction updated successfully!');
    } else if (parentBuyId) {
      addSubsequentPurchase(parentBuyId, finalPayload);
      showToast('DCA purchase added successfully!');
    } else {
      addBuy(finalPayload);
      showToast('Buy transaction recorded!');
    }

    // Reset Form
    setDate(new Date().toISOString().slice(0, 10));
    setTicker('');
    setStockName('');
    setIndustry('');
    setQuantity('');
    setAvgBuyPrice('');
    setFees('');
    setTargetPrice('');
    setHoldingDuration('1 year');
    setOpinion('');
    setPdfs([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Dark backdrop overlay */}
      <div 
        className="fixed inset-0 bg-[#000000]/70 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Right-side sliding drawer form */}
      <div className="fixed top-0 right-0 bottom-0 w-[640px] bg-surface border-l border-border z-50 flex flex-col p-8 overflow-y-auto select-none animate-slide-left">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
          <div>
            <h3 className="text-[16px] font-bold text-cream uppercase tracking-wider">
              {editTransactionId ? 'Edit Buy Transaction' : parentBuyId ? 'Add Subsequent Purchase (DCA)' : 'Add Buy Transaction'}
            </h3>
            {editTransactionId && lastEditedAt && (
              <p className="text-[9px] text-hint font-mono mt-0.5">
                Last edited: {new Date(lastEditedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date(lastEditedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <p className="text-[11px] text-muted mt-1">
              {editTransactionId ? `Modifying record: ${editTransactionId}` : 'Record a new listed equity addition to the ledger'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-muted hover:text-cream transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-5 select-text">
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                required
              />
            </div>

            {/* Ticker */}
            <div className="relative">
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Ticker Symbol *
              </label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                onBlur={() => {
                  if (ticker.trim() && !parentBuyId && !editTransactionId) {
                    triggerStockResolve(ticker);
                  }
                }}
                disabled={!!parentBuyId || !!editTransactionId}
                placeholder="e.g. RELIANCE.NS"
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors uppercase disabled:opacity-50"
                required
              />
              {/* Suggestion list */}
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 mt-1 bg-elevated border border-border rounded shadow-2xl z-10 divide-y divide-border/60 max-h-40 overflow-y-auto">
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => handleTickerSelect(s)}
                        className="w-full text-left px-4 py-2 hover:bg-surface text-primary font-mono text-[12px] transition-colors"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Stock Name */}
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Company Name *
              </label>
              <input
                type="text"
                value={stockName}
                onChange={(e) => setStockName(e.target.value)}
                placeholder="Auto-resolved or type name"
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                required
              />
            </div>

            {/* Industry */}
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Sector / Industry
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Auto-resolved or type sector"
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Quantity */}
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 100"
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                required
              />
            </div>

            {/* Price */}
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Avg Buy Price (INR) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={avgBuyPrice}
                onChange={(e) => setAvgBuyPrice(e.target.value)}
                placeholder="e.g. 2450.00"
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                required
              />
            </div>

            {/* Fees */}
            <div className="relative">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Fees (INR)
                <button
                  type="button"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="text-muted hover:text-primary transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="STT + Brokerage"
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
              />
              {/* STT/Fees breakdown tooltip */}
              {showTooltip && (
                <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-elevated border border-border rounded shadow-2xl text-[11px] text-muted leading-relaxed z-30 select-none">
                  <strong className="text-cream block mb-1">Standard Fees Breakdown:</strong>
                  - Brokerage (usually 0.05% or ₹20)<br />
                  - Securities Transaction Tax (STT): 0.1%<br />
                  - Exchange Transaction Charges: 0.00345%<br />
                  - SEBI Turnover Fees & GST: 18% of brokerage<br />
                  - Stamp Duty: 0.015%
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Target Price */}
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Target Price (INR)
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="Target price to sell"
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
              />
            </div>

            {/* Holding Duration */}
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Holding Horizon
              </label>
              <select
                value={holdingDuration}
                onChange={(e) => setHoldingDuration(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
              >
                <option value="Short Term (under 6m)">Short Term (under 6m)</option>
                <option value="Medium Term (6m-1y)">Medium Term (6m-1y)</option>
                <option value="1 year">1 Year</option>
                <option value="2 years">2 Years</option>
                <option value="Long Term (3y+)">Long Term (3y+)</option>
                <option value="Core Holding (5y+)">Core Holding (5y+)</option>
              </select>
            </div>
          </div>

          {/* Thesis Opinion Counter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider">
                Investment Thesis (Recommended ~500 words)
              </label>
              <span className={`text-[11px] font-mono ${wordCount >= 500 ? 'text-success font-bold' : 'text-hint'}`}>
                {wordCount} words
              </span>
            </div>
            <textarea
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              placeholder="Outline your detailed investment thesis, catalysts, valuation assumptions and risk factors..."
              className="w-full h-32 px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-sans resize-none focus:border-primary transition-colors"
            />
          </div>

          {/* PDF Attachment Files list */}
          <div>
            <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
              Attach Contact Notes (Research PDFs)
            </label>
            
            <div className="flex items-center justify-center border border-dashed border-border rounded p-4 text-center bg-background/50 hover:bg-background/80 transition-colors cursor-pointer relative select-none">
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={handlePdfUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="space-y-1">
                <Plus className="w-5 h-5 mx-auto text-primary" />
                <p className="text-[12px] text-cream font-medium">Click to select files or drag PDFs here</p>
                <p className="text-[10px] text-hint">Supports multiple files, up to 2MB each</p>
              </div>
            </div>

            {pdfs.length > 0 && (
              <ul className="mt-3 space-y-2 border border-border bg-[#0A0A0F] rounded p-3 select-none">
                {pdfs.map((pdf, idx) => (
                  <li key={idx} className="flex items-center justify-between text-[12px] text-cream">
                    <div className="flex items-center gap-2 truncate pr-4">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{pdf.name}</span>
                      <span className="text-[10px] text-hint font-mono shrink-0">({pdf.date})</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePdf(idx)}
                      className="text-danger hover:text-danger/80 transition-colors p-1"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Delete Transaction if in Edit Mode */}
          {editTransactionId && (
            <div className="pt-6 border-t border-border mt-8 flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete this buy record? This cannot be undone.`)) {
                    deleteBuy(editTransactionId);
                    showToast('Transaction deleted');
                    onClose();
                  }
                }}
                className="w-full py-2 bg-danger hover:bg-danger/80 text-[#F0F0F5] font-bold rounded text-[12px] uppercase tracking-wider transition-colors"
              >
                Delete Transaction
              </button>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-6 border-t border-border flex items-center justify-end gap-3 select-none">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-elevated border border-border hover:bg-[#1E1E2E] rounded text-cream text-[13px] font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={fetchingStock}
              className="px-5 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] rounded text-[13px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-primary/5 disabled:opacity-50"
            >
              {fetchingStock ? 'Resolving...' : editTransactionId ? 'Save Changes' : parentBuyId ? 'Add Subsequent' : 'Record Transaction'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
export default AddBuyForm;
