import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../shared/Toast';
import { X, Lock, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface ChangePasswordProps {
  onClose: () => void;
}

export const ChangePassword: React.FC<ChangePasswordProps> = ({ onClose }) => {
  const { changePassword } = useAuth();
  const { showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Field errors
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [newError, setNewError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Reset errors
    setCurrentError(null);
    setNewError(null);
    setConfirmError(null);
    setGeneralError(null);

    let hasError = false;

    if (!currentPassword) {
      setCurrentError('Current password is required.');
      hasError = true;
    }

    if (newPassword.length < 8) {
      setNewError('Password must be at least 8 characters.');
      hasError = true;
    }

    if (newPassword === currentPassword) {
      setNewError('New password cannot be the same as current password.');
      hasError = true;
    }

    if (newPassword !== confirmPassword) {
      setConfirmError('Passwords do not match.');
      hasError = true;
    }

    if (hasError) return;

    setLoading(true);

    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setSuccess(true);
        showToast('Password changed successfully!');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setGeneralError(res.error || 'Failed to change password.');
        showToast(res.error || 'Failed to change password.', 'error');
      }
    } catch (err) {
      setGeneralError('An unexpected error occurred.');
      showToast('An unexpected error occurred.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full shadow-2xl relative flex flex-col font-sans text-cream">
        
        {/* Close Button */}
        {!success && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-elevated rounded border border-transparent hover:border-border text-[#A0A0B0] hover:text-[#F0F0F5] transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 text-success animate-bounce" />
            <h3 className="text-[16px] font-bold text-cream">Security Password Updated</h3>
            <p className="text-[12px] text-muted max-w-xs leading-relaxed">
              Your security password has been securely updated in local vaults. Terminal reloading session...
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-5 border-b border-border/40 pb-3">
              <Lock className="text-primary w-5 h-5" />
              <h3 className="text-[14px] font-bold text-[#E8DCC8] uppercase tracking-wider">
                Change Security Password
              </h3>
            </div>

            {generalError && (
              <div className="mb-4 p-3 rounded bg-danger/10 border border-danger/40 text-danger text-[12px] font-medium flex items-start gap-2 select-text leading-relaxed">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{generalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 select-text">
              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (currentError) setCurrentError(null);
                  }}
                  className={`w-full px-3 py-2 bg-background border rounded text-cream text-[13px] focus:border-primary transition-colors ${
                    currentError ? 'border-danger' : 'border-border'
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
                {currentError && (
                  <span className="block text-danger text-[11px] mt-1 font-sans">{currentError}</span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  New Password (min 8 characters)
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (newError) setNewError(null);
                  }}
                  className={`w-full px-3 py-2 bg-background border rounded text-cream text-[13px] focus:border-primary transition-colors ${
                    newError ? 'border-danger' : 'border-border'
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
                {newError && (
                  <span className="block text-danger text-[11px] mt-1 font-sans">{newError}</span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-cream uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmError) setConfirmError(null);
                  }}
                  className={`w-full px-3 py-2 bg-background border rounded text-cream text-[13px] focus:border-primary transition-colors ${
                    confirmError ? 'border-danger' : 'border-border'
                  }`}
                  placeholder="••••••••"
                  disabled={loading}
                  required
                />
                {confirmError && (
                  <span className="block text-danger text-[11px] mt-1 font-sans">{confirmError}</span>
                )}
              </div>

              <div className="flex items-center gap-3 select-none pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 bg-elevated border border-border hover:bg-[#1E1E2E] rounded text-cream text-[12px] font-bold uppercase tracking-wider transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary hover:bg-primary-hover text-[#0A0A0F] font-bold rounded text-[12px] uppercase tracking-wider transition-colors shadow-lg shadow-primary/5 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Update Password'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
export default ChangePassword;
