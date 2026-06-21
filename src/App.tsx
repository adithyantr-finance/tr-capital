import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PortfolioProvider } from './context/PortfolioContext';
import { ToastProvider } from './components/shared/Toast';
import { Sidebar } from './components/shared/Sidebar';
import { TopBar } from './components/shared/TopBar';
import { Login } from './components/Auth/Login';
import { Register } from './components/Auth/Register';
import { Dashboard } from './components/Dashboard/Dashboard';
import { EquityPortfolio } from './components/Equity/EquityPortfolio';
import { MutualFunds } from './components/MutualFunds/MutualFunds';
import { Alternatives } from './components/Alternatives/Alternatives';
import { CashLedger } from './components/Cash/CashLedger';
import { Performance } from './components/Performance/Performance';
import { ImportExport } from './components/ImportExport/ImportExport';
import { Settings } from './components/Settings/Settings';
import { ChangePassword } from './components/Auth/ChangePassword';
import { QuickBuyRecorder } from './components/Equity/QuickBuyRecorder';
import { RefreshCw } from 'lucide-react';

function AppContent() {
  const { currentUser, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [authScreen, setAuthScreen] = useState<'login' | 'register'>('login');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isQuickBuyOpen, setIsQuickBuyOpen] = useState(false);

  // Load sidebar state from localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('trcapital_sidebar_collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Synchronize localStorage from Electron export when running in the browser
  useEffect(() => {
    const isElectron = !!(window as any).electron;
    if (!isElectron) {
      const performSync = async () => {
        try {
          const res = await fetch('/exported_data.json');
          if (res.ok) {
            const data = await res.json();
            if (data && Object.keys(data).length > 0) {
              let updated = false;
              for (const key in data) {
                if (localStorage.getItem(key) !== data[key]) {
                  localStorage.setItem(key, data[key]);
                  updated = true;
                }
              }
              if (updated) {
                console.log('Synchronized Electron localStorage to browser.');
                window.location.reload();
              }
            }
          }
        } catch (e) {
          // File does not exist, ignore
        }
      };
      performSync();
    }
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev: boolean) => {
      const next = !prev;
      localStorage.setItem('trcapital_sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };

  // Keyboard shortcut Ctrl + B to open Quick Buy Recorder
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentUser) return;
      
      // Check if Ctrl + B or Cmd + B is pressed
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsQuickBuyOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  // Listen to custom open-quick-buy event (for Dashboard quick-action)
  useEffect(() => {
    const handleOpenQuickBuy = () => {
      if (currentUser) {
        setIsQuickBuyOpen(true);
      }
    };
    window.addEventListener('open-quick-buy', handleOpenQuickBuy);
    return () => window.removeEventListener('open-quick-buy', handleOpenQuickBuy);
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
        <span className="font-sans text-[12px] text-muted uppercase tracking-widest">Initializing Terminal Data...</span>
      </div>
    );
  }

  if (!currentUser) {
    return authScreen === 'login' ? (
      <Login onNavigateToRegister={() => setAuthScreen('register')} />
    ) : (
      <Register onNavigateToLogin={() => setAuthScreen('login')} />
    );
  }

  // Resolve Header Title
  const getHeaderTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard Overview';
      case 'equity': return 'Equity Portfolio';
      case 'mutual_funds': return 'Mutual Funds';
      case 'alternatives': return 'Alternative Assets';
      case 'cash': return 'Cash & Liquidity';
      case 'analytics': return 'Performance Analytics';
      case 'import_export': return 'Bulk Import & Export';
      case 'settings': return 'Terminal Settings';
      default: return 'TR Capital';
    }
  };

  return (
    <div className="min-h-screen bg-background flex text-[#F0F0F5]">
      {/* Fixed Left Sidebar Menu */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
      />

      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-col min-h-screen transition-all duration-200"
        style={{ paddingLeft: isSidebarCollapsed ? '60px' : '220px' }}
      >
        {/* Fixed Top Header bar */}
        <TopBar 
          title={getHeaderTitle()} 
          onChangePassword={() => setIsChangePasswordOpen(true)} 
          isSidebarCollapsed={isSidebarCollapsed}
        />

        {/* Content Body Router */}
        <main className="flex-1 p-8 pt-24 overflow-y-auto w-full max-w-[1600px] mx-auto animate-in fade-in duration-200">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'equity' && <EquityPortfolio />}
          {activeTab === 'mutual_funds' && <MutualFunds />}
          {activeTab === 'alternatives' && <Alternatives />}
          {activeTab === 'cash' && <CashLedger />}
          {activeTab === 'analytics' && <Performance />}
          {activeTab === 'import_export' && <ImportExport onNavigate={setActiveTab} />}
          {activeTab === 'settings' && <Settings onChangePassword={() => setIsChangePasswordOpen(true)} />}
        </main>
      </div>

      {/* persistent + Record Buy FAB */}
      <button
        onClick={() => setIsQuickBuyOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] w-12 h-12 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105 transition-all duration-200 cursor-pointer text-lg font-sans border-0 outline-none"
        title="Record Buy (Ctrl+B)"
      >
        +
      </button>

      {/* Security Change Password Modal Dialog Overlay */}
      {isChangePasswordOpen && (
        <ChangePassword onClose={() => setIsChangePasswordOpen(false)} />
      )}

      {/* Quick Buy Modal Dialog Overlay */}
      {isQuickBuyOpen && (
        <QuickBuyRecorder onClose={() => setIsQuickBuyOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <PortfolioProvider>
          <AppContent />
        </PortfolioProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
