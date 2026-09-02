import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 5);
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((msg, duration) => showToast(msg, 'success', duration), [showToast]);
  const error = useCallback((msg, duration) => showToast(msg, 'error', duration), [showToast]);
  const warning = useCallback((msg, duration) => showToast(msg, 'warning', duration), [showToast]);
  const info = useCallback((msg, duration) => showToast(msg, 'info', duration), [showToast]);

  const getToastStyle = (type) => {
    switch (type) {
      case 'success':
        return {
          bg: 'var(--surface-color)',
          border: '#10b981',
          color: '#10b981',
          icon: <CheckCircle2 size={18} color="#10b981" />
        };
      case 'error':
        return {
          bg: 'var(--surface-color)',
          border: '#ef4444',
          color: '#ef4444',
          icon: <AlertCircle size={18} color="#ef4444" />
        };
      case 'warning':
        return {
          bg: 'var(--surface-color)',
          border: '#f59e0b',
          color: '#f59e0b',
          icon: <AlertTriangle size={18} color="#f59e0b" />
        };
      default:
        return {
          bg: 'var(--surface-color)',
          border: 'var(--primary-color)',
          color: 'var(--primary-color)',
          icon: <Info size={18} color="var(--primary-color)" />
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}

      {/* Floating Toast Notification Container */}
      <aside
        aria-label="Bildirimler"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          pointerEvents: 'none',
          maxWidth: '380px',
          width: 'calc(100% - 40px)'
        }}
      >
        {toasts.map((t) => {
          const config = getToastStyle(t.type);
          return (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                backgroundColor: config.bg,
                borderLeft: `4px solid ${config.border}`,
                borderTop: '1px solid var(--border-color)',
                borderRight: '1px solid var(--border-color)',
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                animation: 'slideInRight 0.25s ease-out forwards',
                fontSize: '0.875rem',
                fontWeight: '500',
                lineHeight: '1.4'
              }}
            >
              <div style={{ flexShrink: 0 }}>{config.icon}</div>
              <div style={{ flex: 1, wordBreak: 'break-word' }}>{t.message}</div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  flexShrink: 0
                }}
                aria-label="Bildirimi Kapat"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
