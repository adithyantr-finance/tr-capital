import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { formatDate, formatINR } from '../../utils/calculations';
import { generateId } from '../../utils/idGenerator';
import { useToast } from '../shared/Toast';
import { 
  Plus, 
  Search, 
  Trash2, 
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  X
} from 'lucide-react';

export const CashLedger: React.FC = () => {
  const { cash, addCash, deleteCash } = usePortfolio();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);

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
  }, [cash, searchTerm]);

  // Form Fields
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryType, setEntryType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  // 1. Calculate current cash balance
  const cashBalance = useMemo(() => {
    return cash.reduce((sum, entry) => {
      return sum + (entry.type === 'credit' ? entry.amount : -entry.amount);
    }, 0);
  }, [cash]);

  // Filtered entries
  const filteredCash = useMemo(() => {
    if (!searchTerm.trim()) return cash;
    const term = searchTerm.toLowerCase().trim();
    return cash.filter(c => 
      c.description.toLowerCase().includes(term) ||
      c.type.includes(term) ||
      c.id.toLowerCase().includes(term)
    );
  }, [cash, searchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !description.trim()) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const val = Number(amount);
    if (val <= 0 || isNaN(val)) {
      showToast('Please enter a valid positive amount.', 'error');
      return;
    }

    // Safety check for overdraft
    if (entryType === 'debit' && val > cashBalance) {
      if (!confirm(`Warning: This withdrawal of ₹${val.toLocaleString('en-IN')} exceeds your cash reserves of ₹${cashBalance.toLocaleString('en-IN')}. Proceed with negative cash balance?`)) {
        return;
      }
    }

    const payload = {
      id: generateId('CASH'),
      date,
      type: entryType,
      amount: val,
      description: description.trim()
    };

    addCash(payload);
    showToast(`${entryType === 'credit' ? 'Credited' : 'Debited'} ₹${val.toLocaleString('en-IN')} successfully!`);

    // Reset Form
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-6 select-text">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 select-none">
        <div>
          <h2 className="text-xl font-bold font-sans text-cream">Cash & Liquidity Ledger</h2>
          <p className="text-[12px] text-muted">Log deposits, withdrawals, dividends, and interest payouts</p>
        </div>
      </div>

      {/* Cash Reserves Banner Card */}
      <div className="bg-surface border border-border rounded p-6 flex items-center justify-between select-none">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded bg-elevated text-primary animate-pulse-gold">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] text-muted uppercase font-bold tracking-widest font-sans">Active Liquidity reserves</span>
            <h3 className="text-2xl font-bold font-mono text-cream mt-1 tracking-wide">
              {formatINR(cashBalance)}
            </h3>
          </div>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-colors shadow-lg shadow-primary/5 animate-pulse-gold"
        >
          <Plus className="w-4 h-4" />
          Record Capital Flow
        </button>
      </div>

      {/* Search Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 select-none">
        <div className="relative w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search cash transaction logs..."
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded text-cream placeholder-hint text-[13px] font-sans focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Cash Log Table */}
      <div className="relative">
        <div ref={scrollRef} className="table-scroll-wrapper rounded border border-border bg-[#0A0A0F]">
          <table className="w-full border-collapse text-left text-[13px]" style={{ minWidth: '700px' }}>
            <thead className="sticky top-0 bg-surface border-b border-border z-10 select-none">
              <tr className="text-[#E8DCC8] uppercase text-[10px] tracking-wider font-sans font-bold">
                <th className="py-3.5 px-4 sticky left-0 bg-surface z-20" style={{ left: 0 }}>Transaction ID</th>
                <th className="py-3.5 px-4 sticky bg-surface z-20" style={{ left: '120px' }}>Date</th>
                <th className="py-3.5 px-4 text-center">Flow Direction</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
              <th className="py-3.5 px-4">Ledger Description</th>
              <th className="py-3.5 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredCash.length > 0 ? (
              filteredCash.map((entry) => {
                return (
                  <tr key={entry.id} className="hover:bg-[#1E1E2E] transition-all bg-[#12121A]">
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[#A0A0B0] select-none sticky bg-[#12121A] z-[2]" style={{ left: 0 }}>{entry.id}</td>

                    {/* Date */}
                    <td className="py-3.5 px-4 select-none whitespace-nowrap sticky bg-[#12121A] z-[2]" style={{ left: '120px' }}>{formatDate(entry.date)}</td>

                    {/* Flow Badge */}
                    <td className="py-3.5 px-4 select-none text-center">
                      {entry.type === 'credit' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-success/10 border border-success/30 text-[11px] text-success font-semibold">
                          <ArrowDownLeft className="w-3 h-3" />
                          INFLOW
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-danger/10 border border-danger/30 text-[11px] text-danger font-semibold">
                          <ArrowUpRight className="w-3 h-3" />
                          OUTFLOW
                        </span>
                      )}
                    </td>

                    {/* Amount */}
                    <td className={`py-3.5 px-4 text-right font-mono text-[12px] font-bold
                      ${entry.type === 'credit' ? 'text-success' : 'text-danger'}`}
                    >
                      {entry.type === 'credit' ? '+' : '-'}
                      {formatINR(entry.amount, false)}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 font-sans font-medium text-cream">{entry.description}</td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center select-none">
                      <button
                        onClick={() => {
                          if (confirm(`Remove this cash ledger entry: "${entry.description}"?`)) {
                            deleteCash(entry.id);
                            showToast('Cash log deleted');
                          }
                        }}
                        className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-danger"
                        title="Delete log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[#505065]">
                  <div className="flex flex-col items-center gap-2 select-none">
                    <span className="text-[14px] font-sans font-semibold">No capital flows recorded</span>
                    <span className="text-[12px] text-hint font-sans">Use "Record Capital Flow" to deposit capital into TR Capital reserves.</span>
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
          <div className="fixed top-0 right-0 bottom-0 w-[500px] bg-surface border-l border-border z-50 flex flex-col p-8 overflow-y-auto select-none animate-slide-left">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-5 border-b border-border mb-6">
              <div>
                <h3 className="text-[16px] font-bold text-cream uppercase tracking-wider">Record Capital Flow</h3>
                <p className="text-[11px] text-muted mt-1">Record a deposit, withdrawal or payout log</p>
              </div>
              <button 
                onClick={() => setIsAddOpen(false)} 
                className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-muted hover:text-cream"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 space-y-5 select-text">
              
              {/* Date */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Date of Transaction *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                  required
                />
              </div>

              {/* Type Switcher */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Capital Movement Direction *
                </label>
                <div className="grid grid-cols-2 gap-2 select-none">
                  <button
                    type="button"
                    onClick={() => setEntryType('credit')}
                    className={`py-2 rounded font-sans text-[12px] font-bold uppercase transition-all border
                      ${entryType === 'credit'
                        ? 'bg-success/15 border-success text-success'
                        : 'bg-background border-border text-muted hover:text-cream'}`}
                  >
                    INFLOW (Deposit/Dividend)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType('debit')}
                    className={`py-2 rounded font-sans text-[12px] font-bold uppercase transition-all border
                      ${entryType === 'debit'
                        ? 'bg-danger/15 border-danger text-danger'
                        : 'bg-background border-border text-muted hover:text-cream'}`}
                  >
                    OUTFLOW (Withdrawal/Fees)
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Flow Amount (INR) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Ledger Description *
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Bank Transfer, Q2 Dividend from TCS.NS"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                  required
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
                  Log Transaction
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
};
export default CashLedger;
