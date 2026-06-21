import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserPortfolio } from '../types';

interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, displayName: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateUserProfile: (profileData: {
    username?: string;
    email?: string;
    displayName?: string;
    profilePicture?: string;
    password?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateUserPortfolio: (userId: string, portfolio: UserPortfolio) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to hash password using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load users and session on mount
  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem('trcapital_users');
      if (storedUsers) {
        setUsers(JSON.parse(storedUsers));
      }

      const activeSession = localStorage.getItem('trcapital_session_user');
      if (activeSession) {
        setCurrentUser(JSON.parse(activeSession));
      }
    } catch (e) {
      console.error('Failed to parse authentication data from localStorage', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const formattedUsername = username.trim().toLowerCase();
    const user = users.find(u => u.username === formattedUsername);
    if (!user) {
      return { success: false, error: 'Invalid username or password' };
    }

    const hashedPassword = await hashPassword(password);
    if (user.passwordHash !== hashedPassword) {
      return { success: false, error: 'Invalid username or password' };
    }

    setCurrentUser(user);
    localStorage.setItem('trcapital_session_user', JSON.stringify(user));
    return { success: true };
  };

  const register = async (username: string, displayName: string, password: string) => {
    const formattedUsername = username.trim().toLowerCase();

    if (users.length >= 5) {
      return { success: false, error: 'Registration Closed: Maximum limit of 5 user accounts reached.' };
    }

    if (users.some(u => u.username === formattedUsername)) {
      return { success: false, error: 'Username is already taken' };
    }

    const hashedPassword = await hashPassword(password);
    const newUser: User = {
      id: crypto.randomUUID(),
      username: formattedUsername,
      displayName: displayName.trim(),
      passwordHash: hashedPassword,
      createdAt: new Date().toISOString()
    };

    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem('trcapital_users', JSON.stringify(updatedUsers));
    window.dispatchEvent(new Event('trcapital-db-changed'));
    
    // Auto-login upon registration
    setCurrentUser(newUser);
    localStorage.setItem('trcapital_session_user', JSON.stringify(newUser));

    return { success: true };
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('trcapital_session_user');
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!currentUser) {
      return { success: false, error: 'No user is currently logged in' };
    }
    const currentHashed = await hashPassword(currentPassword);
    if (currentUser.passwordHash !== currentHashed) {
      return { success: false, error: 'Current password is incorrect' };
    }
    const newHashed = await hashPassword(newPassword);
    const updatedUser = { ...currentUser, passwordHash: newHashed };
    
    const updatedUsers = users.map(u => u.id === currentUser.id ? updatedUser : u);
    setUsers(updatedUsers);
    localStorage.setItem('trcapital_users', JSON.stringify(updatedUsers));
    window.dispatchEvent(new Event('trcapital-db-changed'));
    
    setCurrentUser(updatedUser);
    localStorage.setItem('trcapital_session_user', JSON.stringify(updatedUser));
    
    return { success: true };
  };

  const updateUserProfile = async (profileData: {
    username?: string;
    email?: string;
    displayName?: string;
    profilePicture?: string;
    password?: string;
  }) => {
    if (!currentUser) {
      return { success: false, error: 'No user is currently logged in' };
    }

    const updatedUser = { ...currentUser };

    // 1. If username is changing, validate it
    if (profileData.username && profileData.username.trim().toLowerCase() !== currentUser.username) {
      const newUsername = profileData.username.trim().toLowerCase();
      if (users.some(u => u.username === newUsername && u.id !== currentUser.id)) {
        return { success: false, error: 'Username is already taken' };
      }
      
      // Migrate localStorage keys from old username to new username
      const oldUsername = currentUser.username;
      const keysToMigrate = ['buys', 'sells', 'funds', 'alternatives', 'cash', 'watchlist', 'dividends', 'last_updated'];
      keysToMigrate.forEach(key => {
        const oldKey = `trcapital_user_${oldUsername}_${key}`;
        const newKey = `trcapital_user_${newUsername}_${key}`;
        const val = localStorage.getItem(oldKey);
        if (val !== null) {
          localStorage.setItem(newKey, val);
          localStorage.removeItem(oldKey);
        }
      });

      updatedUser.username = newUsername;
    }

    // 2. Update email if provided
    if (profileData.email !== undefined) {
      updatedUser.email = profileData.email.trim();
    }

    // 3. Update displayName if provided
    if (profileData.displayName !== undefined) {
      updatedUser.displayName = profileData.displayName.trim();
    }

    // 4. Update profilePicture if provided
    if (profileData.profilePicture !== undefined) {
      updatedUser.profilePicture = profileData.profilePicture;
    }

    // 5. Update password if provided
    if (profileData.password) {
      const hashedPassword = await hashPassword(profileData.password);
      updatedUser.passwordHash = hashedPassword;
    }

    // Save changes to database (users array & localStorage)
    const updatedUsers = users.map(u => u.id === currentUser.id ? updatedUser : u);
    setUsers(updatedUsers);
    localStorage.setItem('trcapital_users', JSON.stringify(updatedUsers));
    window.dispatchEvent(new Event('trcapital-db-changed'));

    // Update current session
    setCurrentUser(updatedUser);
    localStorage.setItem('trcapital_session_user', JSON.stringify(updatedUser));

    return { success: true };
  };

  const updateUserPortfolio = (userId: string, portfolio: UserPortfolio) => {
    setUsers(prevUsers => {
      const updated = prevUsers.map(u => {
        if (u.id === userId) {
          return { ...u, portfolio };
        }
        return u;
      });
      localStorage.setItem('trcapital_users', JSON.stringify(updated));
      window.dispatchEvent(new Event('trcapital-db-changed'));
      return updated;
    });

    setCurrentUser(prevUser => {
      if (prevUser && prevUser.id === userId) {
        const updated = { ...prevUser, portfolio };
        localStorage.setItem('trcapital_session_user', JSON.stringify(updated));
        return updated;
      }
      return prevUser;
    });
  };

  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      users, 
      login, 
      register, 
      logout, 
      loading, 
      changePassword,
      updateUserProfile,
      updateUserPortfolio
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
