import { useState } from 'react';
import type { Theme } from '../../hooks/useTheme';
import { MapMode } from './MapMode';
import { SwipeMode } from './SwipeMode';

export function DiscoverScreen({ theme }: { theme: Theme }) {
  const [mode, setMode] = useState<'map' | 'swipe'>('map');

  return (
    <div className="pb-4">
      <header className="px-4 pb-3 pt-4">
        <h1 className="text-[28px] font-black leading-none tracking-tight">Discover</h1>
        <p className="mt-1.5 text-xs text-muted">Find the next wings worth chasing.</p>
      </header>

      <div className="mx-4 mb-3 grid grid-cols-2 gap-1 rounded-xl2 bg-surface2 p-1">
        {(['map', 'swipe'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-xl py-2.5 text-[13px] font-extrabold capitalize transition-colors ${
              mode === m ? 'bg-surface text-text shadow-card' : 'text-muted'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'map' ? <MapMode theme={theme} /> : <SwipeMode />}
    </div>
  );
}
