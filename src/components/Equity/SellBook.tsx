import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatDate, formatINR } from '../../utils/calculations';
import { useToast } from '../shared/Toast';
import { PDFViewer } from '../shared/PDFViewer';
import { AddSellForm } from './AddSellForm';
import { 
  Copy, 
  Search, 
  Plus, 
  FileText, 
  Trash2, 
  ExternalLink,
  Info,
  X,
  Edit3
} from 'lucide-react';

export const SellBook: React.FC = () => {
  const { sells, buys, deleteSell } = usePortfolio();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'date', direction: 'desc' });

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const clearSort = () => {
    setSortConfig({ key: 'date', direction: 'desc' });
  };

  const [editTransactionId, setEditTransactionId] = useState<string | undefined>(undefined);

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
  }, [sells, searchTerm]);

  // PDF Viewer state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [activePdfBase64, setActivePdfBase64] = useState('');
  const [activePdfName, setActivePdfName] = useState('');

  // Rationale Modal state
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [activeRationale, setActiveRationale] = useState('');
  const [activeRationaleTicker, setActiveRationaleTicker] = useState('');

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    showToast(`Copied ID to clipboard: ${id}`);
  };

  const openPdfViewer = (serializedPdf: string) => {
    try {
      const parts = serializedPdf.split('::');
      if (parts.length < 3) {
        setActivePdfName('Attached Sell Note.pdf');
        setActivePdfBase64(serializedPdf);
      } else {
        const [name, _, base64] = parts;
        setActivePdfName(name);
        setActivePdfBase64(base64);
      }
      setPdfViewerOpen(true);
    } catch (e) {
      showToast('Failed to open PDF document.', 'error');
    }
  };

  const openRationaleModal = (ticker: string, text: string) => {
    setActiveRationaleTicker(ticker);
    setActiveRationale(text);
    setRationaleOpen(true);
  };

  // Filtered sells based on search term
  const filteredSells = useMemo(() => {
    if (!searchTerm.trim()) return sells;
    const term = searchTerm.toLowerCase().trim();
    return sells.filter(s => 
      s.ticker.toLowerCase().includes(term) ||
      s.transactionId.toLowerCase().includes(term) ||
      s.linkedBuyId.toLowerCase().includes(term)
    );
  }, [sells, searchTerm]);

  // Sorted sells
  const sortedSells = useMemo(() => {
    let items = [...filteredSells];
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
  }, [filteredSells, sortConfig]);

  const renderSortableHeader = (label: string, key: string, alignment: 'left' | 'right' | 'center' = 'left') => {
    const isSorted = sortConfig?.key === key;
    const direction = sortConfig?.direction;
    
    return (
      <th 
        onClick={() => handleSort(key)}
        className={`py-3 px-4 cursor-pointer select-none hover:bg-[#1E1E2E] transition-colors group
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

  return (
    <div className="space-y-4 select-text">
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
              placeholder="Search by ticker, transaction ID..."
              className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded text-cream placeholder-hint text-[13px] font-sans focus:border-primary transition-colors"
            />
          </div>
          {sortConfig && (sortConfig.key !== 'date' || sortConfig.direction !== 'desc') && (
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
          Record Sell Trade
        </button>
      </div>

      {/* Sell Ledger Table */}
      <div className="relative">
        <div ref={scrollRef} className="table-scroll-wrapper rounded border border-border bg-[#0A0A0F]">
          <table className="w-full border-collapse text-left text-[13px]" style={{ minWidth: '1400px' }}>
            <thead className="sticky top-0 bg-surface border-b border-border z-10 select-none">
              <tr className="text-[#E8DCC8] uppercase text-[10px] tracking-wider font-sans font-bold">
                <th className="py-3 px-4 sticky left-0 bg-surface z-20 cursor-pointer hover:bg-[#1E1E2E]" style={{ left: 0 }} onClick={() => handleSort('transactionId')}>
                  <div className="flex items-center gap-1">
                    <span>Transaction ID</span>
                    <span className="text-[10px]">{sortConfig?.key === 'transactionId' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}</span>
                  </div>
                </th>
                <th className="py-3 px-4 sticky bg-surface z-20 cursor-pointer hover:bg-[#1E1E2E]" style={{ left: '100px' }} onClick={() => handleSort('date')}>
                  <div className="flex items-center gap-1">
                    <span>Date</span>
                    <span className="text-[10px]">{sortConfig?.key === 'date' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}</span>
                  </div>
                </th>
                {renderSortableHeader('Linked Buy ID', 'linkedBuyId')}
                {renderSortableHeader('Ticker', 'ticker')}
                {renderSortableHeader('Qty Sold', 'quantity', 'right')}
                {renderSortableHeader('Avg Sell', 'avgSellPrice', 'right')}
                {renderSortableHeader('Fees', 'fees', 'right')}
                {renderSortableHeader('Total Realized', 'totalSellValue', 'right')}
                {renderSortableHeader('Dividends', 'dividendsReceived', 'right')}
                <th className="py-3 px-4 text-right">Buy PE</th>
                {renderSortableHeader('Sell PE', 'sellPE', 'right')}
                {renderSortableHeader('Realized P&L', 'realizedPnL', 'right')}
                <th className="py-3 px-4 text-center">Exits Notes</th>
                <th className="py-3 px-4 text-center">Docs</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-border font-sans">
            {sortedSells.length > 0 ? (
              sortedSells.map((sell) => {
                // Find linked buy PE
                const linkedBuy = buys.find(b => b.transactionId === sell.linkedBuyId);
                const buyPE = linkedBuy ? linkedBuy.currentPE || 'N/A' : 'N/A';

                return (
                  <tr key={sell.transactionId} className="hover:bg-[#1E1E2E] transition-all bg-[#12121A]">
                    {/* Sell ID */}
                    <td className="py-3 px-4 font-mono text-[11px] text-[#A0A0B0] select-none sticky bg-[#12121A] z-[2]" style={{ left: 0 }}>
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[85px]">{sell.transactionId}</span>
                        <button onClick={() => handleCopyId(sell.transactionId)} className="hover:text-primary p-0.5">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 select-none whitespace-nowrap sticky bg-[#12121A] z-[2]" style={{ left: '100px' }}>{formatDate(sell.date)}</td>

                    {/* Linked Buy ID */}
                    <td className="py-3 px-4 font-mono text-[11px] text-[#A0A0B0] select-none">
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[85px]">{sell.linkedBuyId}</span>
                        <button onClick={() => handleCopyId(sell.linkedBuyId)} className="hover:text-primary p-0.5">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Ticker */}
                    <td className="py-3 px-4 select-none font-mono font-bold text-primary">
                      <a 
                        href={`https://www.nseindia.com/get-quotes/equity?symbol=${sell.ticker.replace('.NS', '').replace('.BO', '')}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline flex items-center gap-0.5"
                      >
                        {sell.ticker}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-4 text-right font-mono text-[12px]">{sell.quantity}</td>

                    {/* Avg Sell */}
                    <td className="py-3 px-4 text-right font-mono text-[12px]">{formatINR(sell.avgSellPrice, false)}</td>

                    {/* Fees */}
                    <td className="py-3 px-4 text-right font-mono text-[12px]">{formatINR(sell.fees, false)}</td>

                    {/* Total Realized value */}
                    <td className="py-3 px-4 text-right font-mono text-[12px]">{formatINR(sell.totalSellValue, false)}</td>

                    {/* Dividends */}
                    <td className="py-3 px-4 text-right font-mono text-[12px]">{formatINR(sell.dividendsReceived, false)}</td>

                    {/* Buy PE */}
                    <td className="py-3 px-4 text-right font-mono text-[12px]">{buyPE}</td>

                    {/* Sell PE */}
                    <td className="py-3 px-4 text-right font-mono text-[12px]">{sell.sellPE || 'N/A'}</td>

                    {/* Realized P&L */}
                    <td className={`py-3 px-4 text-right font-mono text-[12px] font-semibold
                      ${sell.realizedPnL >= 0 ? 'text-success' : 'text-danger'}`}
                    >
                      <div>{sell.realizedPnL >= 0 ? '+' : ''}{formatINR(sell.realizedPnL, false)}</div>
                      <div className="text-[10px] font-sans">({sell.realizedPnL >= 0 ? '+' : ''}{sell.realizedPnLPct.toFixed(1)}%)</div>
                    </td>

                    {/* Exit Notes */}
                    <td className="py-3 px-4 text-center select-none">
                      {sell.partialSellNotes ? (
                        <button 
                          onClick={() => openRationaleModal(sell.ticker, sell.partialSellNotes)}
                          className="text-primary hover:text-primary-hover p-1"
                          title="View Exit Notes"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[#505065]">-</span>
                      )}
                    </td>

                    {/* PDF Document Viewer */}
                    <td className="py-3 px-4 text-center select-none">
                      {sell.contactNotes && sell.contactNotes.length > 0 ? (
                        <div className="relative inline-block group">
                          <button className="text-primary hover:text-primary-hover p-1">
                            <FileText className="w-4 h-4" />
                          </button>
                          {/* File list */}
                          <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-elevated border border-border rounded shadow-2xl p-2 z-20 min-w-[200px] text-left">
                            <span className="text-[10px] text-hint uppercase tracking-wider block border-b border-border/40 pb-1 mb-1 font-sans font-bold">Research Docs</span>
                            <div className="space-y-1">
                              {sell.contactNotes.map((serialized, pdfIdx) => {
                                const [name] = serialized.split('::');
                                return (
                                  <button
                                    key={pdfIdx}
                                    onClick={() => openPdfViewer(serialized)}
                                    className="w-full text-left truncate text-[11px] text-cream hover:text-primary transition-colors flex items-center gap-1.5"
                                  >
                                    <FileText className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[#505065]">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center select-none">
                      <div className="flex items-center justify-center gap-1">
                        {/* Edit */}
                        <button
                          onClick={() => {
                            setEditTransactionId(sell.transactionId);
                            setIsAddOpen(true);
                          }}
                          className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-primary"
                          title="Edit Transaction"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => {
                            if (confirm(`Delete sell record ${sell.transactionId}? This will restore outstanding balance of the linked buy.`)) {
                              deleteSell(sell.transactionId);
                              showToast('Sell transaction removed');
                            }
                          }}
                          className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-danger"
                          title="Delete record"
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
                <td colSpan={15} className="py-12 text-center text-[#505065]">
                  <div className="flex flex-col items-center gap-2 select-none">
                    <span className="text-[14px] font-sans font-semibold">No closed trades recorded</span>
                    <span className="text-[12px] text-hint font-sans">Use the "Record Sell Trade" trigger to liquidate active equity positions.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
        {showScrollHint && <div className="scroll-hint-right" />}
      </div>

      {/* Forms & viewers */}
      <AddSellForm 
        isOpen={isAddOpen} 
        onClose={() => {
          setIsAddOpen(false);
          setEditTransactionId(undefined);
        }} 
        editTransactionId={editTransactionId}
      />

      <PDFViewer 
        isOpen={pdfViewerOpen} 
        onClose={() => setPdfViewerOpen(false)} 
        pdfBase64={activePdfBase64} 
        fileName={activePdfName} 
      />

      {/* Exit notes modal */}
      {rationaleOpen && (
        <div className="fixed inset-0 bg-[#000000]/80 flex items-center justify-center z-50 p-6 select-none animate-fade-in">
          <div className="w-full max-w-xl bg-surface border border-border rounded flex flex-col overflow-hidden">
            <div className="h-12 bg-elevated border-b border-border flex items-center justify-between px-5">
              <span className="font-sans text-[12px] font-semibold text-cream uppercase tracking-wider">
                {activeRationaleTicker} — Post-Mortem Exit Rationale
              </span>
              <button 
                onClick={() => setRationaleOpen(false)} 
                className="text-muted hover:text-cream transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="p-6 bg-[#0A0A0F] max-h-96 overflow-y-auto text-[13px] text-cream font-sans leading-relaxed select-text whitespace-pre-wrap">
              {activeRationale}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SellBook;
