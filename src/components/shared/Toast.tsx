import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Render Portal Stack */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full select-none pointer-events-none">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onClose={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// Component representing an individual Toast
const ToastCard: React.FC<{ toast: ToastMessage; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 3000); // 3 seconds auto dismiss
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded bg-elevated shadow-2xl border transition-all duration-300 transform translate-y-0 animate-slide-in
        ${toast.type === 'success' ? 'border-success/60 text-[#F0F0F5]' : 'border-danger/60 text-[#F0F0F5]'}`}
    >
      {toast.type === 'success' ? (
        <CheckCircle className="w-5 h-5 text-success shrink-0" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
      )}
      
      <div className="flex-1 text-[13px] font-sans font-medium leading-relaxed">
        {toast.message}
      </div>

      <button
        onClick={() => onClose(toast.id)}
        className="text-[#A0A0B0] hover:text-[#F0F0F5] transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
