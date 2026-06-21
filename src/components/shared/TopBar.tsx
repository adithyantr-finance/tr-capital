import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Minus, Square, X, User as UserIcon, ChevronDown, Lock, Menu, Cloud, CloudOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';

interface TopBarProps {
  title: string;
  onChangePassword: () => void;
  isSidebarCollapsed?: boolean;
  onToggleMobile?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ title, onChangePassword, isSidebarCollapsed, onToggleMobile }) => {
  const { currentUser, logout } = useAuth();
  const { isSyncEnabled, syncStatus, lastSyncedAt } = useSync();
  const isElectron = !!(window as any).electron;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleControl = (action: 'minimize' | 'maximize' | 'close') => {
    if (isElectron) {
      (window as any).electron.windowControl(action);
    }
  };

  return (
    <header 
      className="h-16 fixed top-0 right-0 bg-surface/90 backdrop-blur border-b border-border flex items-center justify-between px-4 md:px-6 z-20 select-none transition-all duration-200"
      style={{ left: isMobile ? '0px' : (isSidebarCollapsed ? '60px' : '220px'), WebkitAppRegion: 'drag' } as any}
    >
      {/* Module Title */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {isMobile && onToggleMobile && (
          <button 
            onClick={onToggleMobile}
            className="p-1.5 hover:bg-elevated rounded border border-border text-cream cursor-pointer mr-1"
          >
            <Menu className="w-5 h-5 text-primary" />
          </button>
        )}
        <h1 className="font-sans text-[14px] md:text-[16px] font-bold text-cream tracking-wide uppercase">{title}</h1>
      </div>

      {/* User Session & System Commands */}
      <div className="flex items-center gap-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {/* Cloud Sync Status Indicator */}
        {isSyncEnabled && (
          <div 
            className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-border/40 bg-surface/50 text-[10px] font-sans font-medium text-muted animate-in fade-in select-none"
            title={lastSyncedAt ? `Last synced: ${lastSyncedAt.toLocaleTimeString()}` : 'Syncing...'}
          >
            {syncStatus === 'syncing' && (
              <>
                <Cloud className="w-3.5 h-3.5 text-primary animate-pulse" />
                <span className="text-primary text-[9px] uppercase font-bold tracking-wider animate-pulse hidden sm:inline">Syncing</span>
              </>
            )}
            {syncStatus === 'success' && (
              <>
                <Cloud className="w-3.5 h-3.5 text-success" />
                <span className="text-success text-[9px] uppercase font-bold tracking-wider hidden sm:inline">Synced</span>
              </>
            )}
            {syncStatus === 'error' && (
              <>
                <CloudOff className="w-3.5 h-3.5 text-danger animate-bounce" />
                <span className="text-danger text-[9px] uppercase font-bold tracking-wider hidden sm:inline">Offline</span>
              </>
            )}
          </div>
        )}

        {/* User Badge & Dropdown */}
        {currentUser && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1 bg-elevated hover:bg-[#1E1E2E] rounded border border-border transition-colors cursor-pointer select-none"
            >
              {currentUser.profilePicture ? (
                <img 
                  src={currentUser.profilePicture} 
                  alt={currentUser.displayName} 
                  className="w-5 h-5 rounded-full object-cover border border-border" 
                />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-primary" />
              )}
              <span className="font-sans text-[13px] text-[#F0F0F5] font-medium">
                {currentUser.displayName}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded shadow-2xl py-1.5 z-50 select-none animate-in fade-in duration-100">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onChangePassword();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left font-sans text-[13px] text-cream hover:bg-elevated hover:text-primary transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Change Password
                </button>
                <div className="border-t border-border/40 my-1"></div>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left font-sans text-[13px] text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}

        {/* Electron OS Frameless Window Buttons */}
        {isElectron && (
          <div className="flex items-center gap-1 border-l border-border pl-4">
            <button 
              onClick={() => handleControl('minimize')} 
              className="p-1.5 hover:bg-elevated rounded transition-colors text-[#A0A0B0] hover:text-[#F0F0F5] cursor-pointer"
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => handleControl('maximize')} 
              className="p-1.5 hover:bg-elevated rounded transition-colors text-[#A0A0B0] hover:text-[#F0F0F5] cursor-pointer"
              title="Maximize"
            >
              <Square className="w-3 h-3" />
            </button>
            <button 
              onClick={() => handleControl('close')} 
              className="p-1.5 hover:bg-danger/20 hover:text-danger rounded transition-colors text-[#A0A0B0] cursor-pointer"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
export default TopBar;
