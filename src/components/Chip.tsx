import type { ReactNode } from 'react';

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors ${
        active
          ? 'border-transparent bg-text text-bg'
          : 'border-line bg-surface text-text hover:border-muted'
      }`}
    >
      {children}
    </button>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">{children}</div>
  );
}
