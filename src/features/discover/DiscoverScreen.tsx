import { useState } from 'react';
import type { Theme } from '../../hooks/useTheme';
import { MapMode } from './MapMode';
import { SwipeMode } from './SwipeMode';

/**
 * No page title here. On a phone the map is the screen, and a heading plus a
 * subtitle pushed it a third of the way down for no information anyone needed
 * twice.
 */
export function DiscoverScreen({ theme }: { theme: Theme }) {
  const [mode, setMode] = useState<'map' | 'swipe'>('map');

  return (
    <div>
      <div className="mx-4 mb-2 mt-2 grid grid-cols-2 gap-1 rounded-xl2 bg-surface2 p-1">
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
