import React, { useState } from 'react';
import { BuyBook } from './BuyBook';
import { SellBook } from './SellBook';
import { usePortfolio } from '../../context/PortfolioContext';
import { RefreshCw } from 'lucide-react';

export const EquityPortfolio: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'buy' | 'sell'>('buy');
  const { refreshAllData, loadingPrices, lastUpdated } = usePortfolio();

  const handleRefresh = async () => {
    await refreshAllData();
  };

  return (
    <div className="space-y-6 select-none">
      {/* Header and Live Sync Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-sans text-cream">Equity Ledger</h2>
          <p className="text-[12px] text-muted">Manage Indian equity buy-lots, DCA purchases and exits</p>
        </div>
        
        {/* Real-time price refresh indicators */}
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-[#505065] font-sans font-medium">
              Last synced: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loadingPrices}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:border-primary/60 hover:text-primary rounded text-cream transition-colors text-[12px] font-semibold uppercase disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingPrices ? 'animate-spin text-primary' : ''}`} />
            {loadingPrices ? 'Syncing...' : 'Sync Prices'}
          </button>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveSubTab('buy')}
          className={`px-6 py-2.5 font-sans font-bold text-[12px] uppercase tracking-wider transition-colors border-b-2
            ${activeSubTab === 'buy' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted hover:text-cream'
            }`}
        >
          Buy Book (Outstanding Lots)
        </button>
        <button
          onClick={() => setActiveSubTab('sell')}
          className={`px-6 py-2.5 font-sans font-bold text-[12px] uppercase tracking-wider transition-colors border-b-2
            ${activeSubTab === 'sell' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted hover:text-cream'
            }`}
        >
          Sell Book (Closed Sells)
        </button>
      </div>

      {/* Tab panel display */}
      <div className="min-h-[400px]">
        {activeSubTab === 'buy' ? <BuyBook /> : <SellBook />}
      </div>
    </div>
  );
};

export default EquityPortfolio;
