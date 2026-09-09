import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

const ToastContext = createContext<(message: string) => void>(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 1600);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className={`pointer-events-none above-nav fixed left-1/2 z-[100] mb-12 -translate-x-1/2 rounded-full bg-text px-4 py-2 text-xs font-extrabold text-bg shadow-card transition-all duration-200 ${
          message ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
        }`}
      >
        {message}
      </div>
    </ToastContext.Provider>
  );
}
