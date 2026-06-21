import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../shared/Toast';
import { ShieldCheck, User as UserIcon, Lock } from 'lucide-react';

interface LoginProps {
  onNavigateToRegister: () => void;
}

export const Login: React.FC<LoginProps> = ({ onNavigateToRegister }) => {
  const { login } = useAuth();
  const { showToast } = useToast();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await login(username, password);
      if (res.success) {
        showToast('Login successful. Welcome back!');
      } else {
        setError(res.error || 'Invalid credentials.');
        showToast(res.error || 'Login failed.', 'error');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 select-none font-sans">
      <div className="w-full max-w-[420px] bg-surface border border-border rounded-lg shadow-2xl p-8 flex flex-col items-center">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="text-primary w-10 h-10 animate-pulse-gold rounded-full" />
          <h1 className="text-2xl font-bold tracking-wider text-primary">TR Capital</h1>
        </div>
        
        <p className="text-[13px] text-muted text-center mb-8 font-medium">
          Personal Investment & Wealth Tracking System
        </p>

        {error && (
          <div className="w-full mb-5 p-3 rounded bg-danger/10 border border-danger/40 text-danger text-[12px] font-medium leading-relaxed">
            {error}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-hint">
                <UserIcon className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. adithyan"
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-hint">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[13px] transition-colors tracking-wide uppercase mt-2 shadow-lg hover:shadow-primary/10"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Register Redirect */}
        <div className="mt-8 pt-6 border-t border-border w-full text-center">
          <p className="text-[12px] text-muted font-medium">
            Don't have an account?{' '}
            <button
              onClick={onNavigateToRegister}
              className="text-primary hover:text-primary-hover font-semibold transition-colors underline underline-offset-4"
            >
              Create Account
            </button>
          </p>
        </div>
      </div>
      
      {/* Security Disclaimer */}
      <span className="text-[10px] text-hint font-mono uppercase tracking-widest mt-6">
        Secure SHA-256 Client-Side Protocol
      </span>
    </div>
  );
};
export default Login;
