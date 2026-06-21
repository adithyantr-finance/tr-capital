import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  verifyTokenAndRepo,
  ensureDBSyncBranch,
  fetchDatabaseFromGitHub,
  pushDatabaseToGitHub,
  packLocalData,
  unpackLocalData
} from '../utils/githubSync';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

interface SyncContextType {
  githubToken: string;
  githubRepo: string;
  isSyncEnabled: boolean;
  syncStatus: SyncStatus;
  lastSyncedAt: Date | null;
  currentFileSha: string;
  enableSync: (token: string, repo: string) => Promise<{ success: boolean; error?: string }>;
  disableSync: () => void;
  pullFromCloud: () => Promise<{ success: boolean; error?: string }>;
  pushToCloud: (forceData?: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('trcapital_github_token') || '');
  const [githubRepo, setGithubRepo] = useState(() => localStorage.getItem('trcapital_github_repo') || '');
  const [isSyncEnabled, setIsSyncEnabled] = useState(() => localStorage.getItem('trcapital_github_enabled') === 'true');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(() => {
    const saved = localStorage.getItem('trcapital_github_last_synced');
    return saved ? new Date(saved) : null;
  });
  const [currentFileSha, setCurrentFileSha] = useState(() => localStorage.getItem('trcapital_github_file_sha') || '');

  const pushTimeoutRef = useRef<any>(null);

  // Sync state helpers to update localStorage
  const updateGithubToken = (val: string) => {
    setGithubToken(val);
    localStorage.setItem('trcapital_github_token', val);
  };

  const updateGithubRepo = (val: string) => {
    setGithubRepo(val);
    localStorage.setItem('trcapital_github_repo', val);
  };

  const updateSyncEnabled = (val: boolean) => {
    setIsSyncEnabled(val);
    localStorage.setItem('trcapital_github_enabled', String(val));
  };

  const updateFileSha = (val: string) => {
    setCurrentFileSha(val);
    localStorage.setItem('trcapital_github_file_sha', val);
  };

  const updateLastSynced = (val: Date | null) => {
    setLastSyncedAt(val);
    if (val) {
      localStorage.setItem('trcapital_github_last_synced', val.toISOString());
    } else {
      localStorage.removeItem('trcapital_github_last_synced');
    }
  };

  // Pull function: Fetches database from GitHub, updates local storage, and refreshes session
  const pullFromCloud = useCallback(async () => {
    if (!githubToken || !githubRepo) {
      return { success: false, error: 'GitHub Cloud Sync credentials are not configured.' };
    }

    setSyncStatus('syncing');

    try {
      const result = await fetchDatabaseFromGitHub(githubToken, githubRepo);
      if (!result) {
        throw new Error('Unable to retrieve data file from the repository.');
      }

      const { data, sha } = result;
      updateFileSha(sha);
      
      const hasChanges = unpackLocalData(data);
      updateLastSynced(new Date());
      setSyncStatus('success');

      if (hasChanges) {
        console.log('GitHub database changes pulled. Reloading UI...');
        // Force reload the page to refresh all active React context states with the updated storage
        window.location.reload();
      }

      return { success: true };
    } catch (e: any) {
      console.error('pullFromCloud failed:', e);
      setSyncStatus('error');
      return { success: false, error: e.message || 'An error occurred during pull operation.' };
    }
  }, [githubToken, githubRepo]);

  // Push function: Serializes local databases and commits them to the branch
  const pushToCloud = useCallback(async (forceData?: Record<string, string>) => {
    if (!githubToken || !githubRepo) {
      return { success: false, error: 'GitHub Cloud Sync credentials are not configured.' };
    }

    setSyncStatus('syncing');

    try {
      const dataToPush = forceData || packLocalData();
      
      // Before pushing, fetch the latest SHA of the file from GitHub to avoid 409 conflicts
      let shaToUse = currentFileSha;
      const latestFileMeta = await fetchDatabaseFromGitHub(githubToken, githubRepo);
      if (latestFileMeta) {
        shaToUse = latestFileMeta.sha;
      }

      const newSha = await pushDatabaseToGitHub(githubToken, githubRepo, dataToPush, shaToUse);
      if (!newSha) {
        throw new Error('Conflict detected or failed to write file to GitHub.');
      }

      updateFileSha(newSha);
      updateLastSynced(new Date());
      setSyncStatus('success');
      return { success: true };
    } catch (e: any) {
      console.error('pushToCloud failed:', e);
      setSyncStatus('error');
      return { success: false, error: e.message || 'An error occurred during push operation.' };
    }
  }, [githubToken, githubRepo, currentFileSha]);

  // Enable sync: verifies PAT/repo, creates branch, and runs initial pull
  const enableSync = async (token: string, repo: string) => {
    const cleanRepo = repo.trim().replace(/\/$/, ''); // Remove trailing slash if any
    const cleanToken = token.trim();

    setSyncStatus('syncing');

    try {
      const isValid = await verifyTokenAndRepo(cleanToken, cleanRepo);
      if (!isValid) {
        throw new Error('Invalid token or repository path. Please check your credentials.');
      }

      const branchReady = await ensureDBSyncBranch(cleanToken, cleanRepo);
      if (!branchReady) {
        throw new Error('Failed to configure the "db-sync" branch on GitHub.');
      }

      // Save configurations
      updateGithubToken(cleanToken);
      updateGithubRepo(cleanRepo);
      updateSyncEnabled(true);

      // Perform initial merge-pull
      const pullResult = await fetchDatabaseFromGitHub(cleanToken, cleanRepo);
      if (pullResult) {
        const { data, sha } = pullResult;
        updateFileSha(sha);
        if (data && Object.keys(data).length > 0) {
          unpackLocalData(data);
        } else {
          // If repo has no db, push our current local databases as the starting seed
          const currentLocal = packLocalData();
          const seedSha = await pushDatabaseToGitHub(cleanToken, cleanRepo, currentLocal);
          if (seedSha) {
            updateFileSha(seedSha);
          }
        }
      }

      updateLastSynced(new Date());
      setSyncStatus('success');

      // Reload UI to refresh contexts
      setTimeout(() => {
        window.location.reload();
      }, 500);

      return { success: true };
    } catch (e: any) {
      console.error('enableSync failed:', e);
      setSyncStatus('error');
      return { success: false, error: e.message || 'Sync activation failed.' };
    }
  };

  // Disable sync
  const disableSync = () => {
    updateGithubToken('');
    updateGithubRepo('');
    updateSyncEnabled(false);
    updateFileSha('');
    updateLastSynced(null);
    setSyncStatus('idle');
  };

  // Perform initial auto-pull on load if enabled
  useEffect(() => {
    if (isSyncEnabled && githubToken && githubRepo) {
      pullFromCloud();
    }
  }, []);

  // Listen to local changes to perform automated background debounced pushes
  // We intercept writing to localStorage by patching or observing context state updates.
  // A clean React-way is to observe changes in the localStorage through storage events, or we can listen to standard document events.
  // To keep it simple and robust, we listen to a custom 'sync-local-change' event or check localStorage key writes.
  // In our case, we will register a window listener that contexts can dispatch. Or even simpler, check localStorage periodically or debouncing on state mutations.
  // Let's create a custom event listener that is dispatched whenever PortfolioContext or AuthContext updates data:
  useEffect(() => {
    const handleLocalDataChange = () => {
      if (!isSyncEnabled || !githubToken || !githubRepo) return;

      // Debounce the push to avoid spamming GitHub API with rapid keystrokes/clicks
      if (pushTimeoutRef.current) {
        clearTimeout(pushTimeoutRef.current);
      }

      pushTimeoutRef.current = setTimeout(() => {
        console.log('SyncContext: Auto-sync pushing local databases to GitHub...');
        pushToCloud();
      }, 3000); // 3-second debounce
    };

    window.addEventListener('trcapital-db-changed', handleLocalDataChange);
    return () => {
      window.removeEventListener('trcapital-db-changed', handleLocalDataChange);
      if (pushTimeoutRef.current) {
        clearTimeout(pushTimeoutRef.current);
      }
    };
  }, [isSyncEnabled, githubToken, githubRepo, pushToCloud]);

  // Listen to window focus events to pull concurrent updates from other devices automatically
  useEffect(() => {
    const handleFocus = () => {
      if (isSyncEnabled && githubToken && githubRepo) {
        console.log('SyncContext: Tab focused, pulling concurrent database updates...');
        pullFromCloud();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isSyncEnabled, githubToken, githubRepo, pullFromCloud]);

  return (
    <SyncContext.Provider
      value={{
        githubToken,
        githubRepo,
        isSyncEnabled,
        syncStatus,
        lastSyncedAt,
        currentFileSha,
        enableSync,
        disableSync,
        pullFromCloud,
        pushToCloud
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
