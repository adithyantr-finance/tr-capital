import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../shared/Toast';
import { ShieldCheck, User as UserIcon, Lock, Contact, ShieldAlert } from 'lucide-react';

interface RegisterProps {
  onNavigateToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onNavigateToLogin }) => {
  const { register, users } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRegistrationClosed = users.length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRegistrationClosed) {
      setError('Registration is closed. Maximum user limit reached.');
      return;
    }

    if (!username.trim() || !displayName.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await register(username, displayName, password);
      if (res.success) {
        showToast('Registration successful. Welcome to TR Capital!');
      } else {
        setError(res.error || 'Failed to register.');
        showToast(res.error || 'Registration failed.', 'error');
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
          Create Security Profile Credentials
        </p>

        {isRegistrationClosed ? (
          /* REGISTRATION CLOSED INTERFACE */
          <div className="w-full flex flex-col items-center text-center space-y-6">
            <div className="p-4 rounded-full bg-danger/10 border border-danger/30 text-danger">
              <ShieldAlert className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-[16px] font-bold text-cream uppercase tracking-wide">Registration Closed</h2>
              <p className="text-[12px] text-muted leading-relaxed">
                This local instance has reached its limit of <strong className="text-primary">5 user accounts</strong>.
                No further accounts can be created on this system.
              </p>
            </div>

            <button
              onClick={onNavigateToLogin}
              className="w-full py-2 bg-elevated border border-border hover:border-primary/60 rounded text-cream hover:text-primary transition-colors text-[13px] font-semibold uppercase tracking-wider mt-4"
            >
              Return to Login
            </button>
          </div>
        ) : (
          /* REGISTRATION FORM */
          <>
            {error && (
              <div className="w-full mb-5 p-3 rounded bg-danger/10 border border-danger/40 text-danger text-[12px] font-medium leading-relaxed">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-5">
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Display Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-hint">
                    <Contact className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Adithyan"
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary"
                    required
                  />
                </div>
              </div>

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
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary"
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
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-hint">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded text-cream placeholder-hint text-[13px] transition-colors focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[11px] text-hint font-medium">Account Slot Limit Usage:</span>
                <span className="text-[12px] text-cream font-mono font-bold">{users.length} / 5 used</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[13px] transition-colors tracking-wide uppercase mt-2 shadow-lg"
              >
                {loading ? 'Registering...' : 'Create Profile'}
              </button>
            </form>

            {/* Back to Login Redirect */}
            <div className="mt-8 pt-6 border-t border-border w-full text-center">
              <p className="text-[12px] text-muted font-medium">
                Already registered?{' '}
                <button
                  onClick={onNavigateToLogin}
                  className="text-primary hover:text-primary-hover font-semibold transition-colors underline underline-offset-4"
                >
                  Sign In
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default Register;
