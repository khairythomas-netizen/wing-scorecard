import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

/** Bottom sheet used for score breakdowns, comments and map detail. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise safe-bottom relative max-h-[86vh] w-full max-w-[600px] overflow-y-auto rounded-t-xl3 border-t border-line bg-surface"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3.5">
          <h2 className="text-base font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 pb-8 pt-4">{children}</div>
      </div>
    </div>
  );
}
