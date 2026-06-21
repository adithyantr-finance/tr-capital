import React from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  LineChart, 
  Briefcase, 
  Wallet, 
  PieChart, 
  FileSpreadsheet, 
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isCollapsed, 
  onToggle 
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'equity', label: 'Equity Portfolio', icon: TrendingUp },
    { id: 'mutual_funds', label: 'Mutual Funds', icon: Briefcase },
    { id: 'alternatives', label: 'Alternative Investments', icon: PieChart },
    { id: 'cash', label: 'Cash & Liquidity', icon: Wallet },
    { id: 'analytics', label: 'Performance Analytics', icon: LineChart },
    { id: 'import_export', label: 'Import / Export', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside 
      className={`fixed top-0 bottom-0 left-0 bg-surface border-r border-border flex flex-col z-30 transition-all duration-200 select-none overflow-x-hidden`}
      style={{ width: isCollapsed ? '60px' : '220px' }}
    >
      {/* App Branding Header - Monogram or Wordmark */}
      <div 
        className="h-16 flex items-center px-4 border-b border-border select-none shrink-0" 
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-2 mx-auto md:mx-0">
          <ShieldCheck className="text-primary w-6 h-6 animate-pulse-gold rounded-full shrink-0" />
          {!isCollapsed && (
            <span className="font-sans font-bold text-lg tracking-wider text-primary animate-in fade-in duration-200">
              TR Capital
            </span>
          )}
          {isCollapsed && (
            <span className="font-sans font-black text-sm tracking-wider text-primary animate-in fade-in duration-200">
              TR
            </span>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-6 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center px-4 py-3 text-left font-sans text-[14px] font-medium tracking-wide transition-all border-l-2 group relative cursor-pointer
                    ${isActive 
                      ? 'bg-elevated text-primary border-primary' 
                      : 'text-cream border-transparent hover:text-primary hover:bg-elevated/40 hover:border-primary/50'
                    }`}
                >
                  <Icon className={`w-4 h-4 transition-colors shrink-0 ${isCollapsed ? 'mx-auto' : 'mr-3'} ${isActive ? 'text-primary' : 'text-[#A0A0B0]'}`} />
                  
                  {!isCollapsed && (
                    <span className="animate-in fade-in duration-200 truncate">{item.label}</span>
                  )}
                  
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#1A1A26] border border-border rounded text-[12px] text-cream font-bold pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-300 shadow-2xl z-50 whitespace-nowrap">
                      {item.label}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sidebar Toggle Button at Bottom */}
      <div className="border-t border-border/40 shrink-0">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-elevated/40 text-[#A0A0B0] hover:text-primary transition-colors font-sans text-[12px] font-bold uppercase tracking-wider cursor-pointer"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 mx-auto" />
          ) : (
            <>
              <span>Collapse</span>
              <ChevronLeft className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Footer System Diagnostics status */}
      <div className="p-4 border-t border-border bg-background/50 shrink-0 select-none">
        {!isCollapsed ? (
          <div className="flex flex-col gap-1 animate-in fade-in duration-200">
            <span className="text-[10px] text-hint font-mono uppercase tracking-widest">Platform Status</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-ping"></div>
              <span className="text-[11px] text-muted font-sans font-medium">Fully Client-Side</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center animate-in fade-in duration-200">
            <div className="w-2 h-2 rounded-full bg-success animate-ping"></div>
          </div>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;
