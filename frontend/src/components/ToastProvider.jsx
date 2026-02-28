/**
 * KisanCall — Toast Notification System
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Saved!');
 *   toast.error('Something went wrong');
 *   toast.info('Call accepted');
 *   toast.warning('No experts online');
 */
import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef({});

    const dismiss = useCallback((id) => {
        setToasts((prev) => prev.map((t) => t.id === id ? { ...t, leaving: true } : t));
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 350);
    }, []);

    const show = useCallback((message, type = 'info', duration = 4000) => {
        const id = ++idCounter;
        setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
        if (duration > 0) {
            timers.current[id] = setTimeout(() => dismiss(id), duration);
        }
        return id;
    }, [dismiss]);

    const toast = {
        success: (msg, dur) => show(msg, 'success', dur),
        error: (msg, dur) => show(msg, 'error', dur ?? 6000),
        info: (msg, dur) => show(msg, 'info', dur),
        warning: (msg, dur) => show(msg, 'warning', dur),
        dismiss,
    };

    const ICONS = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const COLORS = {
        success: { bg: 'rgba(22,163,74,0.18)', border: 'rgba(34,197,94,0.4)', color: '#4ade80' },
        error: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', color: '#fca5a5' },
        info: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.4)', color: '#93c5fd' },
        warning: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', color: '#fbbf24' },
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            {/* Toast container */}
            <div style={{
                position: 'fixed', bottom: '1.5rem', right: '1.5rem',
                display: 'flex', flexDirection: 'column', gap: '0.65rem',
                zIndex: 9999, pointerEvents: 'none', maxWidth: '360px', width: 'calc(100vw - 3rem)',
            }}>
                {toasts.map((t) => {
                    const c = COLORS[t.type];
                    return (
                        <div
                            key={t.id}
                            style={{
                                background: c.bg,
                                border: `1px solid ${c.border}`,
                                borderRadius: '12px',
                                padding: '0.85rem 1rem',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.6rem',
                                backdropFilter: 'blur(20px)',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                                pointerEvents: 'all',
                                cursor: 'pointer',
                                animation: t.leaving
                                    ? 'toastOut 0.35s ease forwards'
                                    : 'toastIn 0.35s ease forwards',
                            }}
                            onClick={() => dismiss(t.id)}
                        >
                            <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '0.05rem' }}>
                                {ICONS[t.type]}
                            </span>
                            <span style={{ color: c.color, fontSize: '0.9rem', lineHeight: 1.5, fontWeight: 500 }}>
                                {t.message}
                            </span>
                        </div>
                    );
                })}
            </div>
            <style>{`
                @keyframes toastIn {
                    from { opacity: 0; transform: translateX(24px) scale(0.96); }
                    to   { opacity: 1; transform: translateX(0) scale(1); }
                }
                @keyframes toastOut {
                    from { opacity: 1; transform: translateX(0) scale(1); }
                    to   { opacity: 0; transform: translateX(24px) scale(0.96); }
                }
            `}</style>
        </ToastContext.Provider>
    );
}

export const useToast = () => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be inside ToastProvider');
    return ctx;
};
