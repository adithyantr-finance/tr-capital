import React, { useState, useEffect, useMemo } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { getActiveHoldings } from '../../utils/calculations';
import { generateId } from '../../utils/idGenerator';
import { useToast } from '../shared/Toast';
import { X, FileText, Plus, Trash } from 'lucide-react';

interface AddSellFormProps {
  isOpen: boolean;
  onClose: () => void;
  editTransactionId?: string;
}

export const AddSellForm: React.FC<AddSellFormProps> = ({ isOpen, onClose, editTransactionId }) => {
  const { addSell, updateSell, deleteSell, buys, sells } = usePortfolio();
  const { showToast } = useToast();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedTicker, setSelectedTicker] = useState('');
  const [selectedBuyId, setSelectedBuyId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [avgSellPrice, setAvgSellPrice] = useState('');
  const [fees, setFees] = useState('');
  const [dividends, setDividends] = useState('0');
  const [sellPE, setSellPE] = useState('');
  const [notes, setNotes] = useState('');
  
  const [pdfs, setPdfs] = useState<{ name: string; base64: string; date: string }[]>([]);

  // 1. Resolve active holdings (buy lots that have quantity > 0)
  const activeHoldings = useMemo(() => {
    return getActiveHoldings(buys, sells);
  }, [buys, sells]);

  // Unique list of active tickers for selector dropdown, including the currently edited ticker
  const activeTickers = useMemo(() => {
    const tickers = new Set(activeHoldings.map(h => h.ticker));
    if (editTransactionId) {
      const currentSell = sells.find(s => s.transactionId === editTransactionId);
      if (currentSell) {
        tickers.add(currentSell.ticker);
      }
    }
    return Array.from(tickers);
  }, [activeHoldings, editTransactionId, sells]);

  // Active buy lots for the currently selected ticker
  const relevantBuyLots = useMemo(() => {
    if (!selectedTicker) return [];
    const lots = activeHoldings.filter(h => h.ticker === selectedTicker);
    
    // If editing, make sure the linked buy ID is included in options
    if (editTransactionId) {
      const currentSell = sells.find(s => s.transactionId === editTransactionId);
      if (currentSell && currentSell.ticker === selectedTicker) {
        const alreadyIn = lots.some(l => l.originalBuyId === currentSell.linkedBuyId);
        if (!alreadyIn) {
          const buyLot = buys.find(b => b.transactionId === currentSell.linkedBuyId);
          if (buyLot) {
            const otherSellsQty = sells
              .filter(s => s.linkedBuyId === buyLot.transactionId && s.transactionId !== editTransactionId)
              .reduce((sum, s) => sum + s.quantity, 0);
            
            const remaining = buyLot.quantity - otherSellsQty;
            lots.push({
              ticker: buyLot.ticker,
              stockName: buyLot.stockName,
              industry: buyLot.industry,
              avgBuyPrice: buyLot.avgBuyPrice,
              currentPrice: buyLot.currentPrice,
              currentPE: buyLot.currentPE || 0,
              originalBuyId: buyLot.transactionId,
              qty: remaining,
              totalInvested: remaining * buyLot.avgBuyPrice + (remaining / buyLot.quantity) * buyLot.fees,
              currentValue: remaining * buyLot.currentPrice,
              unrealizedPnL: remaining * buyLot.currentPrice - (remaining * buyLot.avgBuyPrice + (remaining / buyLot.quantity) * buyLot.fees),
              unrealizedPnLPct: 0,
              targetPrice: buyLot.targetPrice,
              pctToTarget: buyLot.pctToTarget,
              holdingDuration: buyLot.holdingDuration,
              opinion: buyLot.opinion,
              contactNotes: buyLot.contactNotes || [],
              isPartialSold: otherSellsQty > 0,
              subsequentPurchases: buyLot.subsequentPurchases || []
            });
          }
        }
      }
    }
    return lots;
  }, [selectedTicker, activeHoldings, editTransactionId, sells, buys]);

  // If ticker changes, reset selected buy lot
  useEffect(() => {
    setSelectedBuyId('');
    setQuantity('');
  }, [selectedTicker]);

  // Extract selected buy lot detail
  const activeBuyLot = useMemo(() => {
    if (!selectedBuyId) return null;
    return relevantBuyLots.find(l => l.originalBuyId === selectedBuyId) || null;
  }, [selectedBuyId, relevantBuyLots]);

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

  const [lastEditedAt, setLastEditedAt] = useState<string | undefined>(undefined);

  // Load existing sell data if editing
  useEffect(() => {
    if (!isOpen) return;

    if (editTransactionId) {
      const item = sells.find(s => s.transactionId === editTransactionId);
      if (item) {
        setDate(item.date);
        setSelectedTicker(item.ticker);
        setSelectedBuyId(item.linkedBuyId);
        setQuantity(String(item.quantity));
        setAvgSellPrice(String(item.avgSellPrice));
        setFees(String(item.fees));
        setDividends(String(item.dividendsReceived));
        setSellPE(String(item.sellPE || ''));
        setNotes(item.partialSellNotes || '');
        setLastEditedAt((item as any).lastEditedAt);

        const parsedPdfs = (item.contactNotes || []).map(serialized => {
          const parts = serialized.split('::');
          if (parts.length < 3) {
            return { name: 'Attached Sell Note.pdf', date: item.date, base64: serialized };
          }
          return { name: parts[0], date: parts[1], base64: parts[2] };
        });
        setPdfs(parsedPdfs);
      }
    } else {
      setDate(new Date().toISOString().slice(0, 10));
      setSelectedTicker('');
      setSelectedBuyId('');
      setQuantity('');
      setAvgSellPrice('');
      setFees('');
      setDividends('0');
      setSellPE('');
      setNotes('');
      setPdfs([]);
      setLastEditedAt(undefined);
    }
  }, [editTransactionId, sells, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTicker || !selectedBuyId || !quantity || !avgSellPrice) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const sellQty = Number(quantity);
    const currentSell = editTransactionId ? sells.find(s => s.transactionId === editTransactionId) : null;
    const currentSellQty = currentSell ? currentSell.quantity : 0;
    const maxQty = (activeBuyLot ? activeBuyLot.qty : 0) + (editTransactionId && activeBuyLot?.originalBuyId === selectedBuyId ? currentSellQty : 0);

    if (sellQty > maxQty) {
      showToast(`Sell quantity (${sellQty}) exceeds available buy lot balance (${maxQty})`, 'error');
      return;
    }

    const payload = {
      transactionId: editTransactionId || generateId('EQ'),
      linkedBuyId: selectedBuyId,
      date,
      ticker: selectedTicker,
      quantity: sellQty,
      avgSellPrice: Number(avgSellPrice),
      fees: Number(fees || 0),
      dividendsReceived: Number(dividends || 0),
      totalSellValue: sellQty * Number(avgSellPrice) - Number(fees || 0),
      sellPE: Number(sellPE || 0),
      isPartialSell: sellQty < maxQty,
      partialSellNotes: notes,
      contactNotes: pdfs.map(p => `${p.name}::${p.date}::${p.base64}`),
      lastEditedAt: new Date().toISOString()
    };

    if (editTransactionId) {
      updateSell(editTransactionId, payload);
      showToast('Sell transaction updated successfully!');
    } else {
      addSell(payload);
      showToast('Sell transaction recorded successfully!');
    }

    // Reset Form
    setSelectedTicker('');
    setSelectedBuyId('');
    setQuantity('');
    setAvgSellPrice('');
    setFees('');
    setDividends('0');
    setSellPE('');
    setNotes('');
    setPdfs([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-[#000000]/70 z-40 animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 bottom-0 w-[640px] bg-surface border-l border-border z-50 flex flex-col p-8 overflow-y-auto select-none animate-slide-left">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
          <div>
            <h3 className="text-[16px] font-bold text-cream uppercase tracking-wider">
              {editTransactionId ? 'Edit Sell Transaction' : 'Add Sell Transaction'}
            </h3>
            {editTransactionId && lastEditedAt && (
              <p className="text-[9px] text-hint font-mono mt-0.5">
                Last edited: {new Date(lastEditedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at {new Date(lastEditedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <p className="text-[11px] text-muted mt-1">
              {editTransactionId ? `Modifying record: ${editTransactionId}` : 'Exit or scale down an active equity position'}
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

            {/* Ticker Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                Select Active Ticker *
              </label>
              <select
                value={selectedTicker}
                onChange={(e) => setSelectedTicker(e.target.value)}
                disabled={!!editTransactionId}
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors uppercase disabled:opacity-50"
                required
              >
                <option value="">-- Choose Stock --</option>
                {activeTickers.map(ticker => (
                  <option key={ticker} value={ticker}>{ticker}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedTicker && (
            <div className="grid grid-cols-1 gap-4">
              {/* Linked Buy Lot Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Link to Buy Transaction *
                </label>
                <select
                value={selectedBuyId}
                onChange={(e) => setSelectedBuyId(e.target.value)}
                disabled={!!editTransactionId}
                className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors font-mono disabled:opacity-50"
                required
              >
                  <option value="">-- Choose Buy Lot --</option>
                  {relevantBuyLots.map(lot => (
                    <option key={lot.originalBuyId} value={lot.originalBuyId}>
                      {lot.originalBuyId} | Buy Price: ₹{lot.avgBuyPrice} | Remaining Qty: {lot.qty}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeBuyLot && (
            <>
              <div className="grid grid-cols-3 gap-4">
                {/* Quantity */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Quantity to Sell *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={activeBuyLot.qty}
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder={`Max ${activeBuyLot.qty}`}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                    required
                  />
                </div>

                {/* Avg Sell Price */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Avg Sell Price (INR) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={avgSellPrice}
                    onChange={(e) => setAvgSellPrice(e.target.value)}
                    placeholder="e.g. 2800.00"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                    required
                  />
                </div>

                {/* Fees */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Fees (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fees}
                    onChange={(e) => setFees(e.target.value)}
                    placeholder="Brokerage + STT"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Dividends */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Dividends Received (INR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={dividends}
                    onChange={(e) => setDividends(e.target.value)}
                    placeholder="Total dividends"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                  />
                </div>

                {/* Sell PE */}
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    PE at Exit
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={sellPE}
                    onChange={(e) => setSellPE(e.target.value)}
                    placeholder="Exit P/E ratio"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* Partial Sell Notes */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Exit Analysis / Sale Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record your exit rationale and post-mortem analysis of this trade..."
                  className="w-full h-24 px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-sans resize-none focus:border-primary transition-colors"
                />
              </div>

              {/* PDF upload */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Attach Exit Research (PDFs)
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
            </>
          )}

          {/* Delete Transaction if in Edit Mode */}
          {editTransactionId && (
            <div className="pt-6 border-t border-border mt-8 flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete this sell record? This cannot be undone.`)) {
                    deleteSell(editTransactionId);
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
              disabled={!activeBuyLot}
              className="px-5 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] rounded text-[13px] font-bold uppercase tracking-wider transition-colors shadow-lg shadow-primary/5 disabled:opacity-40"
            >
              {editTransactionId ? 'Save Changes' : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
export default AddSellForm;
