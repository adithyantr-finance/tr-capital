import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { useAuth } from '../../context/AuthContext';
import { formatINR, formatDate } from '../../utils/calculations';
import { generateId } from '../../utils/idGenerator';
import { useToast } from '../shared/Toast';
import { 
  Trash2, 
  Award, 
  User as UserIcon, 
  DollarSign, 
  ListPlus,
  RefreshCw,
  Lock
} from 'lucide-react';

interface SettingsProps {
  onChangePassword: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onChangePassword }) => {
  const { 
    watchlist, 
    addToWatchlist, 
    removeFromWatchlist,
    dividends,
    addDividend,
    deleteDividend,
    buys
  } = usePortfolio();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'watchlist' | 'dividends' | 'profile'>('watchlist');
  
  // Watchlist states
  const [newTicker, setNewTicker] = useState('');
  const [addingTicker, setAddingTicker] = useState(false);

  // Dividend states
  const [divDate, setDivDate] = useState(new Date().toISOString().slice(0, 10));
  const [divTicker, setDivTicker] = useState('');
  const [divAmount, setDivAmount] = useState('');
  const [divDesc, setDivDesc] = useState('');

  // Auto suggest active tickers from buy book for dividends
  const activeEquityTickers = useMemo(() => {
    return Array.from(new Set(buys.map(b => b.ticker)));
  }, [buys]);

  const handleAddWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicker.trim()) return;

    setAddingTicker(true);
    const added = await addToWatchlist(newTicker);
    setAddingTicker(false);

    if (added) {
      showToast(`Added ${newTicker.toUpperCase()} to watchlist!`);
      setNewTicker('');
    } else {
      showToast('Ticker already exists or resolution failed.', 'error');
    }
  };

  const handleAddDividend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!divTicker || !divAmount) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const amt = Number(divAmount);
    if (amt <= 0 || isNaN(amt)) {
      showToast('Amount must be a positive number.', 'error');
      return;
    }

    const payload = {
      id: generateId('DIV'),
      date: divDate,
      ticker: divTicker,
      amount: amt,
      description: divDesc.trim() || `Dividend received from ${divTicker}`
    };

    addDividend(payload);
    showToast(`Logged ₹${amt.toLocaleString('en-IN')} dividend for ${divTicker}`);

    // Reset Form
    setDivTicker('');
    setDivAmount('');
    setDivDesc('');
    setDivDate(new Date().toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-6 select-text">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 select-none">
        <div>
          <h2 className="text-xl font-bold font-sans text-cream">System Controls</h2>
          <p className="text-[12px] text-muted">Manage watchlist, track dividends, and inspect user profile</p>
        </div>
      </div>

      {/* Settings Sub Tabs Menu */}
      <div className="flex border-b border-border select-none">
        <button
          onClick={() => setActiveSubTab('watchlist')}
          className={`px-6 py-2.5 font-sans font-bold text-[12px] uppercase tracking-wider transition-colors border-b-2
            ${activeSubTab === 'watchlist' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted hover:text-cream'
            }`}
        >
          Watchlist
        </button>
        <button
          onClick={() => setActiveSubTab('dividends')}
          className={`px-6 py-2.5 font-sans font-bold text-[12px] uppercase tracking-wider transition-colors border-b-2
            ${activeSubTab === 'dividends' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted hover:text-cream'
            }`}
        >
          Dividend Tracker
        </button>
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`px-6 py-2.5 font-sans font-bold text-[12px] uppercase tracking-wider transition-colors border-b-2
            ${activeSubTab === 'profile' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted hover:text-cream'
            }`}
        >
          User Profile
        </button>
      </div>

      <div className="min-h-[400px]">
        {/* 1. WATCHLIST TAB */}
        {activeSubTab === 'watchlist' && (
          <div className="space-y-5">
            {/* Add to Watchlist Header */}
            <form onSubmit={handleAddWatchlist} className="flex gap-3 max-w-md select-none">
              <input
                type="text"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                placeholder="Enter stock ticker (e.g. TCS.NS)"
                className="flex-1 px-3 py-2 bg-surface border border-border rounded text-cream placeholder-hint text-[13px] font-sans focus:border-primary uppercase"
                required
              />
              <button
                type="submit"
                disabled={addingTicker}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {addingTicker ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ListPlus className="w-4 h-4" />
                )}
                Watch
              </button>
            </form>

            {/* Watchlist Table */}
            <div className="w-full overflow-x-auto rounded border border-border bg-[#0A0A0F]">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="sticky top-0 bg-surface border-b border-border z-10 select-none">
                  <tr className="text-[#E8DCC8] uppercase text-[10px] tracking-wider font-sans font-bold">
                    <th className="py-3 px-4">Ticker</th>
                    <th className="py-3 px-4">Stock Name</th>
                    <th className="py-3 px-4 text-right">Live Price</th>
                    <th className="py-3 px-4 text-right">Current PE</th>
                    <th className="py-3 px-4 text-center">52W Range</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {watchlist.length > 0 ? (
                    watchlist.map((item) => (
                      <tr key={item.ticker} className="hover:bg-[#1E1E2E] transition-all bg-[#12121A]">
                        <td className="py-3 px-4 font-mono font-bold text-primary select-none">{item.ticker}</td>
                        <td className="py-3 px-4 font-sans font-medium text-cream">{item.stockName}</td>
                        <td className="py-3 px-4 text-right font-mono text-[12px]">{formatINR(item.currentPrice, false)}</td>
                        <td className="py-3 px-4 text-right font-mono text-[12px]">{item.currentPE || 'N/A'}</td>
                        <td className="py-3 px-4 text-center font-mono text-[11px] text-muted">{item.range52W}</td>
                        <td className="py-3 px-4 text-center select-none">
                          <button
                            onClick={() => {
                              removeFromWatchlist(item.ticker);
                              showToast(`Removed ${item.ticker} from watchlist`);
                            }}
                            className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-danger"
                            title="Remove Ticker"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[#505065]">
                        <div className="flex flex-col items-center gap-2 select-none">
                          <span className="text-[14px] font-sans font-semibold">Watchlist is empty</span>
                          <span className="text-[12px] text-hint font-sans">Add equity tickers to track their live market metrics.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. DIVIDEND TRACKER TAB */}
        {activeSubTab === 'dividends' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Log Form card */}
            <div className="bg-surface border border-border rounded p-6 h-fit select-none">
              <h3 className="text-[13px] font-bold text-cream uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-primary" />
                Log Dividend Payout
              </h3>
              <form onSubmit={handleAddDividend} className="space-y-4 select-text">
                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Date of Payment *
                  </label>
                  <input
                    type="date"
                    value={divDate}
                    onChange={(e) => setDivDate(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Select Stock Ticker *
                  </label>
                  <select
                    value={divTicker}
                    onChange={(e) => setDivTicker(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors font-mono uppercase"
                    required
                  >
                    <option value="">-- Choose Stock --</option>
                    {activeEquityTickers.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Dividend Amount (INR) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={divAmount}
                    onChange={(e) => setDivAmount(e.target.value)}
                    placeholder="Total cash received"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] font-mono focus:border-primary transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                    Description / Note
                  </label>
                  <input
                    type="text"
                    value={divDesc}
                    onChange={(e) => setDivDesc(e.target.value)}
                    placeholder="e.g. Q3 FY24 Dividend payout"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-cream text-[13px] focus:border-primary transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-colors shadow-lg mt-2"
                >
                  Log Dividend
                </button>
              </form>
            </div>

            {/* Dividend ledger list */}
            <div className="md:col-span-2 space-y-4">
              <div className="w-full overflow-x-auto rounded border border-border bg-[#0A0A0F]">
                <table className="w-full border-collapse text-left text-[13px]">
                  <thead className="sticky top-0 bg-surface border-b border-border z-10 select-none">
                    <tr className="text-[#E8DCC8] uppercase text-[10px] tracking-wider font-sans font-bold">
                      <th className="py-3 px-4">Dividend ID</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dividends.length > 0 ? (
                      dividends.map((div) => (
                        <tr key={div.id} className="hover:bg-[#1E1E2E] transition-all bg-[#12121A]">
                          <td className="py-3 px-4 font-mono text-[11px] text-[#A0A0B0] select-none">{div.id}</td>
                          <td className="py-3 px-4 select-none whitespace-nowrap">{formatDate(div.date)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-primary select-none">{div.ticker}</td>
                          <td className="py-3 px-4 text-right font-mono text-[12px] font-bold text-success">
                            +{formatINR(div.amount, false)}
                          </td>
                          <td className="py-3 px-4 font-sans font-medium text-cream">{div.description}</td>
                          <td className="py-3 px-4 text-center select-none">
                            <button
                              onClick={() => {
                                if (confirm(`Remove this dividend payment from logs? This will also remove the cash credit.`)) {
                                  deleteDividend(div.id);
                                  showToast('Dividend entry deleted');
                                }
                              }}
                              className="p-1 hover:bg-elevated rounded border border-transparent hover:border-border text-danger"
                              title="Delete Entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-[#505065]">
                          <div className="flex flex-col items-center gap-2 select-none">
                            <span className="text-[14px] font-sans font-semibold">No dividends received</span>
                            <span className="text-[12px] text-hint font-sans">Use the logging card to enter dividend payouts.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. PROFILE SETTINGS */}
        {activeSubTab === 'profile' && currentUser && (
          <div className="max-w-xl bg-surface border border-border rounded p-6 space-y-6 select-none">
            <div className="flex items-center gap-4 border-b border-border/40 pb-5">
              <div className="p-4 rounded-full bg-elevated text-primary border border-border">
                <UserIcon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-cream font-sans">{currentUser.displayName}</h3>
                <span className="text-[12px] text-muted font-mono">{currentUser.username}</span>
              </div>
            </div>

            <div className="space-y-4 text-[13px] font-sans">
              <div className="flex justify-between border-b border-border/20 pb-2">
                <span className="text-muted">Account ID:</span>
                <span className="text-cream font-mono font-bold text-[12px]">{currentUser.id}</span>
              </div>
              <div className="flex justify-between border-b border-border/20 pb-2">
                <span className="text-muted">Member Since:</span>
                <span className="text-cream font-mono font-bold text-[12px]">{formatDate(currentUser.createdAt)}</span>
              </div>
              <div className="flex justify-between border-b border-border/20 pb-2">
                <span className="text-muted">Ledger Persistence:</span>
                <span className="text-primary font-bold uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5" />
                  Local Storage Secure Mode
                </span>
              </div>
            </div>

            <div className="pt-2 select-none">
              <button
                onClick={onChangePassword}
                className="px-4 py-2 bg-elevated border border-border hover:bg-[#1E1E2E] text-cream font-bold rounded text-[12px] uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2"
              >
                <Lock className="w-3.5 h-3.5 text-primary" />
                Change Password
              </button>
            </div>

            <div className="p-4 bg-[#0A0A0F] border border-border rounded leading-relaxed text-[12px] text-muted">
              <strong className="text-cream block mb-1">Local Storage Warning:</strong>
              This application stores all your financial data client-side in the browser/Electron localStorage layers. Clearing browser caches, cookies or deleting local app data will erase your transactions. Remember to use the <strong>Import / Export</strong> tab to back up your portfolio regularly!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default Settings;
