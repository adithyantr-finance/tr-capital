import React, { useState, useMemo } from 'react';
import { usePortfolio } from '../../context/PortfolioContext';
import { useAuth } from '../../context/AuthContext';
import { formatINR, formatDate } from '../../utils/calculations';
import { generateId } from '../../utils/idGenerator';
import { useToast } from '../shared/Toast';
import { useSync } from '../../context/SyncContext';
import { 
  Trash2, 
  Award, 
  User as UserIcon, 
  DollarSign, 
  ListPlus,
  RefreshCw,
  Camera,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react';

interface SettingsProps {}

export const Settings: React.FC<SettingsProps> = () => {
  const { 
    watchlist, 
    addToWatchlist, 
    removeFromWatchlist,
    dividends,
    addDividend,
    deleteDividend,
    buys
  } = usePortfolio();
  const { currentUser, updateUserProfile } = useAuth();
  const { showToast } = useToast();

  const [activeSubTab, setActiveSubTab] = useState<'watchlist' | 'dividends' | 'profile' | 'sync'>('watchlist');
  
  // Watchlist states
  const [newTicker, setNewTicker] = useState('');
  const [addingTicker, setAddingTicker] = useState(false);

  // Dividend states
  const [divDate, setDivDate] = useState(new Date().toISOString().slice(0, 10));
  const [divTicker, setDivTicker] = useState('');
  const [divAmount, setDivAmount] = useState('');
  const [divDesc, setDivDesc] = useState('');

  // GitHub Cloud Sync states
  const { 
    githubToken,
    githubRepo,
    isSyncEnabled,
    syncStatus,
    lastSyncedAt,
    enableSync,
    disableSync,
    pullFromCloud,
    pushToCloud
  } = useSync();

  const [inputToken, setInputToken] = useState(githubToken);
  const [inputRepo, setInputRepo] = useState(githubRepo);
  const [showToken, setShowToken] = useState(false);
  const [isSyncingAction, setIsSyncingAction] = useState(false);

  // Sync inputs with GitHub credentials updates
  React.useEffect(() => {
    setInputToken(githubToken);
    setInputRepo(githubRepo);
  }, [githubToken, githubRepo, activeSubTab]);

  // Profile editing states
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [profilePic, setProfilePic] = useState(currentUser?.profilePicture || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Sync profile fields with currentUser updates
  React.useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName);
      setEditUsername(currentUser.username);
      setEmail(currentUser.email || '');
      setProfilePic(currentUser.profilePicture || '');
      setPassword('');
      setConfirmPassword('');
    }
  }, [currentUser, activeSubTab]);

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image file is too large (max 5MB).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 128;
        const MAX_HEIGHT = 128;
        let width = img.width;
        let height = img.height;

        let startX = 0;
        let startY = 0;
        let size = Math.min(width, height);
        
        startX = (width - size) / 2;
        startY = (height - size) / 2;

        canvas.width = MAX_WIDTH;
        canvas.height = MAX_HEIGHT;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, startX, startY, size, size, 0, 0, MAX_WIDTH, MAX_HEIGHT);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setProfilePic(dataUrl);
          showToast('Profile picture uploaded & optimized!');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!displayName.trim()) {
      showToast('Display Name cannot be empty.', 'error');
      return;
    }

    const cleanUsername = editUsername.trim().toLowerCase();
    if (!cleanUsername) {
      showToast('Username cannot be empty.', 'error');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      showToast('Username can only contain letters, numbers, and underscores.', 'error');
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    if (password) {
      if (password.length < 6) {
        showToast('Password must be at least 6 characters long.', 'error');
        return;
      }
      if (password !== confirmPassword) {
        showToast('Passwords do not match.', 'error');
        return;
      }
    }

    setIsSavingProfile(true);

    try {
      const isUsernameChanging = cleanUsername !== currentUser.username;
      
      const payload: any = {
        displayName: displayName.trim(),
        username: cleanUsername,
        email: email.trim(),
        profilePicture: profilePic
      };

      if (password) {
        payload.password = password;
      }

      const res = await updateUserProfile(payload);
      if (res.success) {
        showToast('Profile settings updated successfully!');
        if (isUsernameChanging) {
          showToast(`Username updated to "${cleanUsername}". Data successfully migrated.`);
        }
        setPassword('');
        setConfirmPassword('');
      } else {
        showToast(res.error || 'Failed to update profile settings.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('An unexpected error occurred during profile update.', 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleConfigureSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim() || !inputRepo.trim()) {
      showToast('Please enter both your GitHub token and repository path.', 'error');
      return;
    }

    setIsSyncingAction(true);
    const res = await enableSync(inputToken, inputRepo);
    setIsSyncingAction(false);

    if (res.success) {
      showToast('GitHub Cloud Sync enabled successfully!');
    } else {
      showToast(res.error || 'Failed to verify or connect to GitHub.', 'error');
    }
  };

  const handleForcePull = async () => {
    if (!confirm('Warning: Pulling from GitHub will overwrite all local settings and portfolios in this browser with the cloud database. Proceed?')) {
      return;
    }

    setIsSyncingAction(true);
    const res = await pullFromCloud();
    setIsSyncingAction(false);

    if (res.success) {
      showToast('Cloud database pulled and merged successfully!');
    } else {
      showToast(res.error || 'Failed to pull cloud database.', 'error');
    }
  };

  const handleForcePush = async () => {
    if (!confirm('Warning: Pushing to GitHub will overwrite the cloud database file on the db-sync branch with your local browser data. Proceed?')) {
      return;
    }

    setIsSyncingAction(true);
    const res = await pushToCloud();
    setIsSyncingAction(false);

    if (res.success) {
      showToast('Local database committed and pushed to GitHub!');
    } else {
      showToast(res.error || 'Failed to push local database to cloud.', 'error');
    }
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
        <button
          onClick={() => setActiveSubTab('sync')}
          className={`px-6 py-2.5 font-sans font-bold text-[12px] uppercase tracking-wider transition-colors border-b-2
            ${activeSubTab === 'sync' 
              ? 'border-primary text-primary' 
              : 'border-transparent text-muted hover:text-cream'
            }`}
        >
          Cloud Sync
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
        )}        {/* 3. PROFILE SETTINGS */}
        {activeSubTab === 'profile' && currentUser && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 select-text">
            {/* Left Column: Avatar & Metadata */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-surface border border-border rounded p-6 flex flex-col items-center text-center">
                {/* Profile Picture Upload Container */}
                <div className="relative group cursor-pointer w-24 h-24 rounded-full overflow-hidden border-2 border-border hover:border-primary transition-all duration-300 shadow-lg shadow-black/40">
                  {profilePic ? (
                    <img 
                      src={profilePic} 
                      alt="Profile Avatar" 
                      className="w-full h-full object-cover animate-in fade-in" 
                    />
                  ) : (
                    <div className="w-full h-full bg-elevated text-primary flex items-center justify-center font-sans font-bold text-3xl uppercase">
                      {displayName.trim().charAt(0) || currentUser.username.charAt(0)}
                    </div>
                  )}
                  {/* Hover Camera Overlay */}
                  <label htmlFor="avatar-upload" className="absolute inset-0 bg-[#000000]/70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer">
                    <Camera className="w-5 h-5 text-primary mb-1 animate-pulse" />
                    <span className="text-[9px] text-cream uppercase font-bold tracking-wider">Change</span>
                  </label>
                  <input 
                    type="file" 
                    id="avatar-upload" 
                    accept="image/*" 
                    onChange={handleImageChange} 
                    className="hidden" 
                  />
                </div>

                <h3 className="text-[15px] font-bold text-cream mt-4 font-sans">{displayName || currentUser.displayName}</h3>
                <span className="text-[12px] text-muted font-mono mb-6">@{editUsername || currentUser.username}</span>

                <div className="w-full space-y-3.5 text-[12px] text-left border-t border-border/40 pt-5 mb-6">
                  <div className="flex justify-between">
                    <span className="text-muted">Account ID:</span>
                    <span className="text-cream font-mono font-bold">{currentUser.id.substring(0, 8)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Registered On:</span>
                    <span className="text-cream font-mono font-bold">{formatDate(currentUser.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Persistence Status:</span>
                    <span className="text-primary font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      Secure Mode
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning note */}
              <div className="p-4 bg-[#0A0A0F]/80 border border-border/80 rounded leading-relaxed text-[12px] text-muted shadow-inner select-none">
                <strong className="text-cream block mb-1">Local Storage Database:</strong>
                This profile is stored fully client-side inside namespaced localStorage buckets. Deleting browser caches, cleaning app files or logging out does NOT delete your data, but clearing cookies/site-data will reset it. Export regular backups in the <strong>Import / Export</strong> tab.
              </div>
            </div>

            {/* Right Column: Update Settings Form */}
            <div className="lg:col-span-2">
              <form onSubmit={handleProfileUpdate} className="bg-surface border border-border rounded p-6 space-y-5">
                <h3 className="text-[13px] font-bold text-cream uppercase tracking-wider border-b border-border/40 pb-3 flex items-center gap-2 select-none">
                  <UserIcon className="w-4 h-4 text-primary" />
                  Edit Profile Credentials
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                      Display Name *
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Enter display name"
                      className="w-full px-3 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="Enter username"
                      className="w-full px-3 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] font-mono transition-colors focus:border-primary focus:outline-none lowercase"
                      required
                    />
                    <p className="text-[10px] text-hint mt-1.5 leading-normal select-none">
                      Note: Changing username will automatically migrate your portfolio keys.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-hint select-none">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. adithyan@domain.com"
                      className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-border/40 my-6 pt-4">
                  <h4 className="text-[11px] font-bold text-cream uppercase tracking-wider mb-4 select-none">
                    Update Security Password (Optional)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Leave blank to keep current"
                          className="w-full pl-3 pr-10 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-hint hover:text-cream cursor-pointer border-0 bg-transparent animate-in fade-in"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2 select-none">
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="w-full pl-3 pr-10 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-hint hover:text-cream cursor-pointer border-0 bg-transparent animate-in fade-in"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-3 select-none">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-all shadow-lg hover:shadow-primary/10 disabled:opacity-50 cursor-pointer border-0 outline-none"
                  >
                    {isSavingProfile ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving Profile...
                      </>
                    ) : (
                      'Save Profile Settings'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 4. GITHUB CLOUD SYNC TAB */}
        {activeSubTab === 'sync' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 select-text animate-in fade-in duration-200">
            {/* Left Column: Sync status & Toggle */}
            <div className="lg:col-span-1 space-y-6 select-none">
              <div className="bg-surface border border-border rounded p-6 flex flex-col items-center text-center">
                {/* Sync status indicator */}
                <div className={`p-4 rounded-full border mb-4 
                  ${isSyncEnabled 
                    ? 'bg-success/10 border-success/30 text-success' 
                    : 'bg-muted/10 border-border text-muted'
                  }`}
                >
                  <RefreshCw className={`w-8 h-8 ${syncStatus === 'syncing' ? 'animate-spin text-primary' : ''}`} />
                </div>

                <h3 className="text-[15px] font-bold text-cream mt-2 font-sans">GitHub Cloud Sync</h3>
                <span className="text-[12px] text-muted mb-6">
                  {isSyncEnabled ? 'Cloud Sync is Active' : 'Cloud Sync is Idle'}
                </span>

                <div className="w-full space-y-3.5 text-[12px] text-left border-t border-border/40 pt-5 mb-6">
                  <div className="flex justify-between">
                    <span className="text-muted">Status:</span>
                    <span className={`font-bold uppercase tracking-wider text-[10px] flex items-center gap-1
                      ${syncStatus === 'success' ? 'text-success' : ''}
                      ${syncStatus === 'syncing' ? 'text-primary' : ''}
                      ${syncStatus === 'error' ? 'text-danger' : ''}
                      ${syncStatus === 'idle' ? 'text-muted' : ''}
                    `}>
                      <span className={`w-1.5 h-1.5 rounded-full 
                        ${syncStatus === 'success' ? 'bg-success animate-pulse' : ''}
                        ${syncStatus === 'syncing' ? 'bg-primary animate-ping' : ''}
                        ${syncStatus === 'error' ? 'bg-danger animate-pulse' : ''}
                        ${syncStatus === 'idle' ? 'bg-muted' : ''}
                      `}></span>
                      {syncStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Last Synced:</span>
                    <span className="text-cream font-mono font-bold">
                      {lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Branch:</span>
                    <span className="text-primary font-mono font-bold uppercase tracking-wide text-[10px]">db-sync</span>
                  </div>
                </div>

                {isSyncEnabled && (
                  <button
                    onClick={disableSync}
                    className="w-full py-2 bg-danger/10 hover:bg-danger/20 border border-danger/30 hover:border-danger text-danger font-bold rounded text-[12px] uppercase tracking-wider transition-colors cursor-pointer outline-none"
                  >
                    Disconnect Sync
                  </button>
                )}
              </div>

              {/* Instructions */}
              <div className="p-5 bg-surface border border-border rounded leading-relaxed text-[12px] text-muted space-y-3">
                <strong className="text-cream block border-b border-border/40 pb-2 uppercase text-[11px] tracking-wider">
                  How to setup Cloud Sync:
                </strong>
                <ol className="list-decimal pl-4 space-y-2">
                  <li>Go to your GitHub Settings ➔ Developer Settings ➔ <strong>Personal Access Tokens</strong> (Fine-grained).</li>
                  <li>Click <strong>Generate new token</strong>. Set token name e.g., <code>TR-Capital-Sync</code>.</li>
                  <li>Under <strong>Repository access</strong>, select "Only select repositories" and choose <code>tr-capital</code>.</li>
                  <li>Under <strong>Permissions</strong>, grant <strong>Contents</strong>: Read & Write.</li>
                  <li>Generate token, copy the secret PAT value, and paste it here with your repository path.</li>
                </ol>
              </div>
            </div>

            {/* Right Column: Connection Form & Actions */}
            <div className="lg:col-span-2 space-y-6">
              {/* Form */}
              <form onSubmit={handleConfigureSync} className="bg-surface border border-border rounded p-6 space-y-5">
                <h3 className="text-[13px] font-bold text-cream uppercase tracking-wider border-b border-border/40 pb-3 flex items-center gap-2 select-none">
                  <RefreshCw className="w-4 h-4 text-primary" />
                  Configure Repository Database
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                      GitHub Repository Path *
                    </label>
                    <input
                      type="text"
                      value={inputRepo}
                      onChange={(e) => setInputRepo(e.target.value)}
                      placeholder="e.g. adithyantr-finance/tr-capital"
                      disabled={isSyncEnabled}
                      className="w-full px-3 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] font-mono transition-colors focus:border-primary focus:outline-none disabled:opacity-60"
                      required
                    />
                    <p className="text-[10px] text-hint mt-1.5">
                      Input your GitHub username and repo name in the format: <code>owner/repo</code>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                      Personal Access Token (PAT) *
                    </label>
                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={inputToken}
                        onChange={(e) => setInputToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        disabled={isSyncEnabled}
                        className="w-full pl-3 pr-10 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] font-mono transition-colors focus:border-primary focus:outline-none disabled:opacity-60"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        disabled={isSyncEnabled}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-hint hover:text-cream cursor-pointer border-0 bg-transparent disabled:opacity-30"
                      >
                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {!isSyncEnabled && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSyncingAction}
                      className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-all shadow-lg disabled:opacity-50 cursor-pointer border-0 outline-none"
                    >
                      {isSyncingAction ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Verifying & Connecting...
                        </>
                      ) : (
                        'Save & Connect Sync'
                      )}
                    </button>
                  </div>
                )}
              </form>

              {/* Manual Operations (Visible only when connected) */}
              {isSyncEnabled && (
                <div className="bg-surface border border-border rounded p-6 space-y-5">
                  <h3 className="text-[13px] font-bold text-cream uppercase tracking-wider border-b border-border/40 pb-3 select-none">
                    Manual Sync Commands
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-[#0A0A0F]/60 border border-border rounded flex flex-col justify-between">
                      <div className="mb-4">
                        <strong className="text-cream text-[12px] block mb-1">Pull Database from Cloud</strong>
                        <p className="text-[11px] text-muted leading-relaxed">
                          Force retrieve the latest <code>trcapital_db.json</code> file from GitHub and merge/overwrite all local data in this browser.
                        </p>
                      </div>
                      <button
                        onClick={handleForcePull}
                        disabled={isSyncingAction}
                        className="w-full py-2 bg-elevated hover:bg-[#1A1A26] border border-border hover:border-primary text-cream hover:text-primary font-bold rounded text-[11px] uppercase tracking-wider transition-colors cursor-pointer outline-none"
                      >
                        {isSyncingAction ? 'Processing...' : 'Force Pull (Cloud ➔ Local)'}
                      </button>
                    </div>

                    <div className="p-4 bg-[#0A0A0F]/60 border border-border rounded flex flex-col justify-between">
                      <div className="mb-4">
                        <strong className="text-cream text-[12px] block mb-1">Push Database to Cloud</strong>
                        <p className="text-[11px] text-muted leading-relaxed">
                          Force commit and overwrite the database file on GitHub with your local browser's transaction portfolios.
                        </p>
                      </div>
                      <button
                        onClick={handleForcePush}
                        disabled={isSyncingAction}
                        className="w-full py-2 bg-elevated hover:bg-[#1A1A26] border border-border hover:border-primary text-cream hover:text-primary font-bold rounded text-[11px] uppercase tracking-wider transition-colors cursor-pointer outline-none"
                      >
                        {isSyncingAction ? 'Processing...' : 'Force Push (Local ➔ Cloud)'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default Settings;
