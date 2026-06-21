import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatDate, formatINR } from '../../utils/calculations';
import { useToast } from '../shared/Toast';
import { PDFViewer } from '../shared/PDFViewer';
import { AddBuyForm } from './AddBuyForm';
import { 
  Copy, 
  ChevronDown, 
  ChevronRight, 
  BookOpen, 
  FileText, 
  Trash2, 
  Plus, 
  Search,
  ExternalLink,
  Target,
  X,
  Edit3
} from 'lucide-react';

export const BuyBook: React.FC = () => {
  const { buys, deleteBuy } = usePortfolio();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBuys, setExpandedBuys] = useState<Record<string, boolean>>({});

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
  }, [buys, searchTerm]);
  
  // Modals / Drawer State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [dcaParentId, setDcaParentId] = useState<string | undefined>(undefined);
  const [editTransactionId, setEditTransactionId] = useState<string | undefined>(undefined);
  
  // PDF Viewer state
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [activePdfBase64, setActivePdfBase64] = useState('');
  const [activePdfName, setActivePdfName] = useState('');
  
  // Thesis Modal state
  const [thesisModalOpen, setThesisModalOpen] = useState(false);
  const [activeThesis, setActiveThesis] = useState('');
  const [activeThesisTicker, setActiveThesisTicker] = useState('');

  // Copy Transaction ID to clipboard helper
  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    showToast(`Copied ID to clipboard: ${id}`);
  };

  const toggleExpand = (id: string) => {
    setExpandedBuys(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const openPdfViewer = (serializedPdf: string) => {
    try {
      const parts = serializedPdf.split('::');
      if (parts.length < 3) {
        // Fallback for older non-serialized strings
        setActivePdfName('Attached Document.pdf');
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

  const openThesisModal = (ticker: string, thesis: string) => {
    setActiveThesisTicker(ticker);
    setActiveThesis(thesis);
    setThesisModalOpen(true);
  };

  // Filtered buys based on search (ticker, stock name, industry)
  const filteredBuys = useMemo(() => {
    if (!searchTerm.trim()) return buys;
    const term = searchTerm.toLowerCase().trim();
    return buys.filter(b => 
      b.ticker.toLowerCase().includes(term) ||
      b.stockName.toLowerCase().includes(term) ||
      b.industry.toLowerCase().includes(term)
    );
  }, [buys, searchTerm]);

  // Sorted buys
  const sortedBuys = useMemo(() => {
    let items = [...filteredBuys];
    if (!sortConfig) return items;

    items.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortConfig.key === 'unrealizedPnL') {
        aVal = a.currentValue - a.totalBuyValue;
        bVal = b.currentValue - b.totalBuyValue;
      } else if (sortConfig.key === 'unrealizedPnLPct') {
        aVal = a.totalBuyValue > 0 ? ((a.currentValue - a.totalBuyValue) / a.totalBuyValue) * 100 : 0;
        bVal = b.totalBuyValue > 0 ? ((b.currentValue - b.totalBuyValue) / b.totalBuyValue) * 100 : 0;
      } else if (sortConfig.key === 'pctToTarget') {
        aVal = a.pctToTarget;
        bVal = b.pctToTarget;
      } else {
        aVal = (a as any)[sortConfig.key];
        bVal = (b as any)[sortConfig.key];
      }

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
  }, [filteredBuys, sortConfig]);

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

  return (
    <div className="space-y-4 select-text">
      {/* Search & Actions Header */}
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
              placeholder="Search by ticker, name, sector..."
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
          onClick={() => {
            setDcaParentId(undefined);
            setIsAddOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-colors shadow-lg shadow-primary/5"
        >
          <Plus className="w-4 h-4" />
          Add Buy Record
        </button>
      </div>

      {/* Main Ledger Table */}
      <div className="relative">
        <div ref={scrollRef} className="table-scroll-wrapper rounded border border-border bg-[#0A0A0F]">
          <table className="w-full border-collapse text-left text-[13px]" style={{ minWidth: '1600px' }}>
            <thead className="sticky top-0 bg-surface border-b border-border z-10 select-none">
              <tr className="text-[#E8DCC8] uppercase text-[10px] tracking-wider font-sans font-bold">
                <th className="py-3 px-3 w-8 sticky left-0 bg-surface z-20" style={{ left: 0 }}></th>
                <th className="py-3 px-3 sticky bg-surface z-20 cursor-pointer hover:bg-[#1E1E2E]" style={{ left: '32px' }} onClick={() => handleSort('transactionId')}>
                  <div className="flex items-center gap-1">
                    <span>Transaction ID</span>
                    <span className="text-[10px]">{sortConfig?.key === 'transactionId' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}</span>
                  </div>
                </th>
                {renderSortableHeader('Date', 'date')}
                {renderSortableHeader('Ticker', 'ticker')}
                {renderSortableHeader('Stock Name', 'stockName')}
                {renderSortableHeader('Sector', 'industry')}
                {renderSortableHeader('Qty', 'quantity', 'right')}
                {renderSortableHeader('Avg Buy', 'avgBuyPrice', 'right')}
                {renderSortableHeader('Total Invested', 'totalBuyValue', 'right')}
                {renderSortableHeader('Live Price', 'currentPrice', 'right')}
                {renderSortableHeader('Current Value', 'currentValue', 'right')}
                {renderSortableHeader('Unrealized P&L', 'unrealizedPnL', 'right')}
                {renderSortableHeader('Target', 'targetPrice', 'right')}
                <th className="py-3 px-3 text-center">Docs</th>
                <th className="py-3 px-3 text-center">Thesis</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-border">
            {sortedBuys.length > 0 ? (
              sortedBuys.map((buy) => {
                const hasDCA = buy.subsequentPurchases && buy.subsequentPurchases.length > 0;
                const isExpanded = !!expandedBuys[buy.transactionId];
                
                // Calculate P&L metrics
                const unrealizedPnL = buy.currentValue - buy.totalBuyValue;
                const unrealizedPnLPct = buy.totalBuyValue > 0 ? (unrealizedPnL / buy.totalBuyValue) * 100 : 0;
                const withinTarget = buy.currentPrice > 0 && Math.abs(buy.pctToTarget) <= 5;

                return (
                  <React.Fragment key={buy.transactionId}>
                    {/* Primary Buy Row */}
                    <tr className="hover:bg-[#1E1E2E] transition-all bg-[#12121A]">
                      {/* Expand Arrow for DCA */}
                      <td className="py-3.5 px-3 text-center select-none sticky bg-[#12121A] z-[2]" style={{ left: 0 }}>
                        {hasDCA && (
                          <button onClick={() => toggleExpand(buy.transactionId)} className="text-muted hover:text-primary">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                      
                      {/* Copyable ID */}
                      <td className="py-3.5 px-3 font-mono text-[11px] text-[#A0A0B0] select-none sticky bg-[#12121A] z-[2]" style={{ left: '32px' }}>
                        <div className="flex items-center gap-1">
                          <span className="truncate max-w-[80px]">{buy.transactionId}</span>
                          <button onClick={() => handleCopyId(buy.transactionId)} className="hover:text-primary p-0.5">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 select-none whitespace-nowrap">{formatDate(buy.date)}</td>

                      {/* Ticker Symbol Link */}
                      <td className="py-3.5 px-3 select-none font-mono font-bold text-primary">
                        <div className="flex items-center gap-1 group">
                          <a 
                            href={`https://www.nseindia.com/get-quotes/equity?symbol=${buy.ticker.replace('.NS', '').replace('.BO', '')}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline flex items-center gap-0.5"
                          >
                            {buy.ticker}
                            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                          
                          {withinTarget && (
                            <span 
                              className="w-2 h-2 rounded-full bg-primary animate-pulse-gold inline-block" 
                              title="Within 5% of target price!"
                            />
                          )}
                        </div>
                      </td>

                      {/* Stock Name */}
                      <td className="py-3.5 px-3 truncate max-w-[120px] font-sans font-medium">{buy.stockName}</td>

                      {/* Industry */}
                      <td className="py-3.5 px-3 text-muted truncate max-w-[100px]">{buy.industry}</td>

                      {/* Qty */}
                      <td className="py-3.5 px-3 text-right font-mono text-[12px]">{buy.quantity}</td>

                      {/* Avg Buy */}
                      <td className="py-3.5 px-3 text-right font-mono text-[12px]">{formatINR(buy.avgBuyPrice, false)}</td>

                      {/* Total Invested */}
                      <td className="py-3.5 px-3 text-right font-mono text-[12px]">{formatINR(buy.totalBuyValue, false)}</td>

                      {/* Live Price */}
                      <td className="py-3.5 px-3 text-right font-mono text-[12px]">{formatINR(buy.currentPrice, false)}</td>

                      {/* Current Value */}
                      <td className="py-3.5 px-3 text-right font-mono text-[12px]">{formatINR(buy.currentValue, false)}</td>

                      {/* Unrealized P&L */}
                      <td className={`py-3.5 px-3 text-right font-mono text-[12px] font-semibold
                        ${unrealizedPnL >= 0 ? 'text-success' : 'text-danger'}`}
                      >
                        <div>{unrealizedPnL >= 0 ? '+' : ''}{formatINR(unrealizedPnL, false)}</div>
                        <div className="text-[10px] font-sans">({unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnLPct.toFixed(1)}%)</div>
                      </td>

                      {/* Target Price */}
                      <td className="py-3.5 px-3 text-right font-mono text-[12px]">
                        <div>{formatINR(buy.targetPrice, false)}</div>
                        <div className={`text-[10px] font-sans ${buy.pctToTarget >= 0 ? 'text-[#A0A0B0]' : 'text-danger'}`}>
                          {buy.pctToTarget >= 0 ? '+' : ''}{buy.pctToTarget.toFixed(0)}% to target
                        </div>
                      </td>

                      {/* Attached PDFs */}
                      <td className="py-3.5 px-3 text-center select-none">
                        {buy.contactNotes && buy.contactNotes.length > 0 ? (
                          <div className="relative inline-block group">
                            <button className="text-primary hover:text-primary-hover p-1">
                              <FileText className="w-4 h-4" />
                            </button>
                            {/* Hover file dropdown */}
                            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-elevated border border-border rounded shadow-2xl p-2 z-20 min-w-[200px] text-left">
                              <span className="text-[10px] text-hint uppercase tracking-wider block border-b border-border/40 pb-1 mb-1 font-sans">Research Docs</span>
                              <div className="space-y-1">
                                {buy.contactNotes.map((serialized, pdfIdx) => {
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

                      {/* Thesis */}
                      <td className="py-3.5 px-3 text-center select-none">
                        {buy.opinion ? (
                          <button 
                            onClick={() => openThesisModal(buy.ticker, buy.opinion)}
                            className="text-primary hover:text-primary-hover p-1"
                            title="View Stock Thesis"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[#505065]">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-center select-none">
                        <div className="flex items-center justify-center gap-1">
                          {/* Edit */}
                          <button
                            onClick={() => {
                              setEditTransactionId(buy.transactionId);
                              setIsAddOpen(true);
                            }}
                            className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-primary"
                            title="Edit Transaction"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {/* DCA subsequent purchase link */}
                          <button
                            onClick={() => {
                              setDcaParentId(buy.transactionId);
                              setIsAddOpen(true);
                            }}
                            className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-primary"
                            title="Subsequent Buy (DCA)"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (confirm(`Delete buy record ${buy.transactionId}? This will also remove the active allocation.`)) {
                                deleteBuy(buy.transactionId);
                                showToast('Transaction deleted');
                              }
                            }}
                            className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-danger"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Collapsible DCA Child Rows */}
                    {hasDCA && isExpanded && (
                      buy.subsequentPurchases.map((sub, sIdx) => {
                        const subPnL = sub.currentValue - sub.totalBuyValue;
                        const subPnLPct = sub.totalBuyValue > 0 ? (subPnL / sub.totalBuyValue) * 100 : 0;
                        return (
                          <tr key={`${buy.transactionId}-sub-${sIdx}`} className="bg-[#0F0F18] border-l-2 border-l-primary hover:bg-[#1E1E2E]/40 font-sans text-muted">
                            <td className="py-2.5 px-3 sticky bg-[#0F0F18] z-[2]" style={{ left: 0 }}></td>
                            <td className="py-2.5 px-3 font-mono text-[10px] pl-6 sticky bg-[#0F0F18] z-[2]" style={{ left: '32px' }}>
                              DCA Sub #{sIdx + 1}
                            </td>
                            <td className="py-2.5 px-3 text-[12px]">{formatDate(sub.date)}</td>
                            <td className="py-2.5 px-3 font-mono text-[12px]">{sub.ticker}</td>
                            <td className="py-2.5 px-3 text-[12px]">DCA Addition</td>
                            <td className="py-2.5 px-3 text-[12px]">Sector: Same</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[12px]">{sub.quantity}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[12px]">{formatINR(sub.avgBuyPrice, false)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[12px]">{formatINR(sub.totalBuyValue, false)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[12px]">{formatINR(sub.currentPrice, false)}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-[12px]">{formatINR(sub.currentValue, false)}</td>
                            <td className={`py-2.5 px-3 text-right font-mono text-[12px]
                              ${subPnL >= 0 ? 'text-success/80' : 'text-danger/80'}`}
                            >
                              <div>{subPnL >= 0 ? '+' : ''}{formatINR(subPnL, false)}</div>
                              <div className="text-[9px] font-sans">({subPnL >= 0 ? '+' : ''}{subPnLPct.toFixed(1)}%)</div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[12px]">{formatINR(sub.targetPrice, false)}</td>
                            {/* Sub Doc view */}
                            <td className="py-2.5 px-3 text-center">
                              {sub.contactNotes && sub.contactNotes.length > 0 ? (
                                <button 
                                  onClick={() => openPdfViewer(sub.contactNotes[0])}
                                  className="text-primary hover:text-primary-hover p-0.5"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {sub.opinion ? (
                                <button 
                                  onClick={() => openThesisModal(sub.ticker, sub.opinion)}
                                  className="text-primary hover:text-primary-hover p-0.5"
                                >
                                  <BookOpen className="w-3.5 h-3.5" />
                                </button>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-3"></td>
                          </tr>
                        );
                      })
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={16} className="py-12 text-center text-[#505065]">
                  <div className="flex flex-col items-center gap-2 select-none">
                    <span className="text-[14px] font-sans font-semibold">No purchase records registered</span>
                    <span className="text-[12px] text-hint font-sans">Use the "Add Buy Record" action to insert a transaction.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
        {showScrollHint && <div className="scroll-hint-right" />}
      </div>

      {/* Drawer and Modal Rendering */}
      <AddBuyForm 
        isOpen={isAddOpen} 
        onClose={() => {
          setIsAddOpen(false);
          setDcaParentId(undefined);
          setEditTransactionId(undefined);
        }} 
        parentBuyId={dcaParentId} 
        editTransactionId={editTransactionId}
      />

      <PDFViewer 
        isOpen={pdfViewerOpen} 
        onClose={() => setPdfViewerOpen(false)} 
        pdfBase64={activePdfBase64} 
        fileName={activePdfName} 
      />

      {/* Opinion Thesis Modal Popup */}
      {thesisModalOpen && (
        <div className="fixed inset-0 bg-[#000000]/80 flex items-center justify-center z-50 p-6 select-none animate-fade-in">
          <div className="w-full max-w-xl bg-surface border border-border rounded flex flex-col overflow-hidden">
            <div className="h-12 bg-elevated border-b border-border flex items-center justify-between px-5">
              <span className="font-sans text-[12px] font-semibold text-cream uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-primary" />
                {activeThesisTicker} — Investment Thesis
              </span>
              <button 
                onClick={() => setThesisModalOpen(false)} 
                className="text-muted hover:text-cream transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            <div className="p-6 bg-[#0A0A0F] max-h-96 overflow-y-auto text-[13px] text-cream font-sans leading-relaxed select-text whitespace-pre-wrap">
              {activeThesis}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default BuyBook;
