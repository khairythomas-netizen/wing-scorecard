import { CompassIcon, HomeIcon, ListIcon, PlusIcon, UserIcon } from './Icons';

export type TabId = 'feed' | 'discover' | 'rate' | 'rankings' | 'profile';

const TABS: { id: TabId; label: string; Icon: typeof HomeIcon }[] = [
  { id: 'feed', label: 'Feed', Icon: HomeIcon },
  { id: 'discover', label: 'Discover', Icon: CompassIcon },
  { id: 'rate', label: 'Rate', Icon: PlusIcon },
  { id: 'rankings', label: 'Rankings', Icon: ListIcon },
  { id: 'profile', label: 'Profile', Icon: UserIcon },
];

export function BottomNav({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed bottom-0 left-1/2 z-50 grid w-full max-w-[600px] -translate-x-1/2 grid-cols-5 border-t border-line bg-[var(--glass)] px-2 pt-1.5 backdrop-blur-xl"
    >
      {TABS.map(({ id, label, Icon }) => {
        const on = active === id;
        // Rate is the primary action, so it sits proud of the bar.
        const isRate = id === 'rate';
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-current={on ? 'page' : undefined}
            className={`grid place-items-center gap-0.5 pb-2 text-[9px] font-bold ${
              on && !isRate ? 'text-text' : 'text-muted'
            }`}
          >
            {isRate ? (
              <span
                className={`-mt-4 grid h-[42px] w-[42px] place-items-center rounded-[14px] bg-gradient-to-br from-orange to-gold text-white shadow-glow transition-transform ${
                  on ? 'scale-105' : ''
                }`}
              >
                <Icon className="h-6 w-6" />
              </span>
            ) : (
              <Icon className="h-[22px] w-[22px]" />
            )}
            <span className={isRate && on ? 'text-text' : undefined}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
