import { useMemo, useRef, useState } from 'react';
import { HeatMeter } from '../../components/HeatMeter';
import { CloseIcon, HeartIcon } from '../../components/Icons';
import { useQuery, useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { formatPrice } from '../../lib/format';
import { formatScore } from '../../lib/scoring';
import { Spinner } from '../../components/States';
import type { FeedItem } from '../../lib/types';

/**
 * Swiping right saves that exact restaurant AND flavour to Want to Try, which
 * is what makes the list useful later — "Bird Bar" alone would lose the reason
 * the card was appealing in the first place.
 */
export function SwipeMode() {
  const store = useStore();
  const toast = useToast();
  const poolQuery = useQuery([], (s) => s.publicPosts());
  const pool = useMemo(() => poolQuery.data ?? [], [poolQuery.data]);
  const [cursor, setCursor] = useState(0);
  const [drag, setDrag] = useState(0);
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null);
  const start = useRef<number | null>(null);

  const deck = useMemo(() => pool.slice(cursor, cursor + 3), [pool, cursor]);
  const top = deck[0];

  const commit = (dir: 'left' | 'right', item: FeedItem) => {
    if (dir === 'right') {
      if (!item.wantToTry) {
        void store.toggleWantToTry(item.place.id, item.flavour.id, item.review.id);
      }
      toast(`${item.flavour.name} at ${item.place.displayName} → Want to Try`);
    }
    setExiting(dir);
    window.setTimeout(() => {
      setCursor((c) => c + 1);
      setDrag(0);
      setExiting(null);
    }, 220);
  };

  if (poolQuery.data === undefined) return <Spinner label="Finding wings" />;

  if (!top) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-sm font-bold">That is everything for now.</p>
        <p className="mt-1.5 text-xs text-muted">New wings appear as people post them.</p>
        {cursor > 0 && (
          <button
            onClick={() => setCursor(0)}
            className="mt-5 rounded-xl border border-line bg-surface px-5 py-2.5 text-xs font-extrabold"
          >
            Start over
          </button>
        )}
      </div>
    );
  }

  const offset = exiting ? (exiting === 'right' ? 520 : -520) : drag;
  const rotation = offset / 22;

  return (
    <div className="px-3">
      <div className="relative h-[62vh] min-h-[430px]">
        {deck
          .slice()
          .reverse()
          .map((item, revIndex) => {
            const depth = deck.length - 1 - revIndex;
            const isTop = depth === 0;
            return (
              <div
                key={item.review.id}
                className="absolute inset-0 overflow-hidden rounded-xl3 bg-surface shadow-card"
                style={{
                  transform: isTop
                    ? `translateX(${offset}px) rotate(${rotation}deg)`
                    : `scale(${1 - depth * 0.04}) translateY(${depth * 10}px)`,
                  transition: exiting || drag === 0 ? 'transform .22s ease-out' : 'none',
                  zIndex: 10 - depth,
                  opacity: depth > 1 ? 0 : 1,
                }}
                onPointerDown={(e) => {
                  if (!isTop) return;
                  start.current = e.clientX;
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!isTop || start.current == null) return;
                  setDrag(e.clientX - start.current);
                }}
                onPointerUp={() => {
                  if (!isTop || start.current == null) return;
                  start.current = null;
                  if (Math.abs(drag) > 110) commit(drag > 0 ? 'right' : 'left', item);
                  else setDrag(0);
                }}
              >
                <img
                  src={item.review.photos[0]?.url}
                  alt=""
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-t from-black/90 to-transparent" />

                {isTop && Math.abs(drag) > 30 && (
                  <div
                    className={`absolute top-8 rounded-xl border-4 px-4 py-1.5 text-xl font-black uppercase tracking-wide ${
                      drag > 0
                        ? 'left-6 -rotate-12 border-green text-green'
                        : 'right-6 rotate-12 border-danger text-danger'
                    }`}
                    style={{ opacity: Math.min(1, (Math.abs(drag) - 30) / 70) }}
                  >
                    {drag > 0 ? 'Want' : 'Pass'}
                  </div>
                )}

                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-2xl font-black leading-tight">
                        {item.place.displayName}
                      </h3>
                      <p className="mt-1 truncate text-[13px] font-semibold text-white/85">
                        {item.flavour.name} · {formatPrice(item.review.priceCents, item.review.currency)}
                      </p>
                      <p className="truncate text-[12px] text-white/70">{item.review.orderText}</p>
                      <p className="mt-0.5 truncate text-[12px] text-white/70">
                        {item.place.city} · @{item.author.username}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-3xl font-black leading-none tabular-nums">
                        {formatScore(item.review.finalScore)}
                      </p>
                      <p className="text-[10px] font-bold text-white/70">/ 10</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    <HeatMeter value={item.review.heat} size={13} showValue={false} />
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <div className="mt-4 flex justify-center gap-6">
        <button
          onClick={() => commit('left', top)}
          aria-label="Pass"
          className="grid h-16 w-16 place-items-center rounded-full border border-line bg-surface text-danger shadow-card active:scale-95"
        >
          <CloseIcon className="h-7 w-7" />
        </button>
        <button
          onClick={() => commit('right', top)}
          aria-label="Want to try"
          className="grid h-16 w-16 place-items-center rounded-full border border-line bg-surface text-green shadow-card active:scale-95"
        >
          <HeartIcon className="h-7 w-7" />
        </button>
      </div>

      <p className="pt-3 text-center text-[11px] text-muted">
        Swipe right to save it to Want to Try.
      </p>
    </div>
  );
}
