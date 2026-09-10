import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { HeatMeter } from '../../components/HeatMeter';
import { CloseIcon, HeartIcon, PinIcon } from '../../components/Icons';
import { Spinner } from '../../components/States';
import { useQuery, useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { markSwiped, resetSwiped, type SwipeCard } from '../../lib/db/swipe';
import { formatPrice } from '../../lib/format';
import { IMAGE_WIDTHS, sized } from '../../lib/images';
import { formatDistance, lastKnownLocation, requestLocation, type Coords } from '../../lib/location';
import { formatScore } from '../../lib/scoring';

/**
 * Swipe discovery.
 *
 * Two things mixed: wing places near the user, and posts from people they
 * follow. Proximity leads — the point is finding somewhere to eat tonight —
 * and swiped cards are remembered so the deck moves on rather than looping.
 */
export function SwipeMode() {
  const store = useStore();
  const toast = useToast();
  const [near, setNear] = useState<Coords | null>(lastKnownLocation);
  const [askedForLocation, setAskedForLocation] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [drag, setDrag] = useState(0);
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null);
  const start = useRef<number | null>(null);

  const deckQuery = useQuery([near?.lat, near?.lng], (s) => s.swipeDeck(near));
  const deck = useMemo(() => deckQuery.data ?? [], [deckQuery.data]);
  const visible = useMemo(() => deck.slice(cursor, cursor + 3), [deck, cursor]);
  const top = visible[0];

  useEffect(() => {
    if (near || askedForLocation) return;
    setAskedForLocation(true);
    void requestLocation().then((c) => c && setNear(c));
  }, [near, askedForLocation]);

  const commit = (dir: 'left' | 'right', card: SwipeCard) => {
    markSwiped(card.id);
    if (dir === 'right') {
      if (!card.wantToTry) {
        const flavourId = card.kind === 'friend' ? card.flavour.id : null;
        const sourceId = card.kind === 'friend' ? card.review.id : null;
        void store.toggleWantToTry(card.place.id, flavourId, sourceId);
      }
      toast(`${card.place.displayName} → Want to Try`);
    }
    setExiting(dir);
    window.setTimeout(() => {
      setCursor((c) => c + 1);
      setDrag(0);
      setExiting(null);
    }, 220);
  };

  if (deckQuery.data === undefined) return <Spinner label="Finding wings near you" />;

  if (!top) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm font-bold">
          {near ? 'That is everything nearby for now' : 'Nothing to swipe yet'}
        </p>
        <p className="mx-auto mt-1.5 max-w-[34ch] text-xs leading-relaxed text-muted">
          {near
            ? 'Follow more people, or come back once new places appear near you.'
            : 'Turn on location to discover wing places around you.'}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {!near && (
            <button
              onClick={() => void requestLocation().then((c) => c && setNear(c))}
              className="rounded-xl bg-gradient-to-br from-orange to-gold px-5 py-2.5 text-xs font-extrabold text-white shadow-glow"
            >
              Use my location
            </button>
          )}
          <button
            onClick={() => {
              resetSwiped();
              setCursor(0);
              deckQuery.refetch();
            }}
            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-xs font-extrabold"
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  const offset = exiting ? (exiting === 'right' ? 520 : -520) : drag;
  const rotation = offset / 22;

  return (
    <div className="px-3 pb-2">
      <div className="relative h-[52vh] min-h-[380px]">
        {visible
          .slice()
          .reverse()
          .map((card, revIndex) => {
            const depth = visible.length - 1 - revIndex;
            const isTop = depth === 0;
            return (
              <article
                key={card.id}
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
                  if (Math.abs(drag) > 110) commit(drag > 0 ? 'right' : 'left', card);
                  else setDrag(0);
                }}
              >
                <CardFace card={card} />
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
              </article>
            );
          })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
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
        {deck.length - cursor} left · swipe right to save to Want to Try
      </p>
    </div>
  );
}

function CardFace({ card }: { card: SwipeCard }) {
  const photo = sized(card.photoUrl ?? undefined, IMAGE_WIDTHS.swipe);

  return (
    <>
      {photo ? (
        <img src={photo} alt="" draggable={false} className="h-full w-full select-none object-cover" />
      ) : (
        // No WingZ photo for this place yet. A designed placeholder is honest;
        // pulling an image from somewhere we have no right to would not be.
        <div
          className="grid h-full w-full place-items-center"
          style={{
            background:
              'radial-gradient(120% 80% at 50% 0%, #ff8a3d 0%, #ef5a24 42%, #7a2d12 100%)',
          }}
        >
          <div className="px-8 text-center text-white">
            <PinIcon className="mx-auto h-11 w-11 opacity-90" />
            <p className="mt-3 text-2xl font-black leading-tight">{card.place.displayName}</p>
            <p className="mt-1.5 text-xs font-semibold text-white/70">
              No photos yet — be the first
            </p>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 top-1/3 bg-gradient-to-t from-black/90 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 p-5 text-white">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide backdrop-blur">
            {card.kind === 'nearby' ? 'Near you' : 'From a friend'}
          </span>
          {card.distanceKm != null && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold backdrop-blur">
              {formatDistance(card.distanceKm)}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-2xl font-black leading-tight">{card.place.displayName}</h3>
            <p className="mt-0.5 truncate text-[12px] text-white/75">
              {[card.place.formattedAddress || card.place.city, card.place.country]
                .filter(Boolean)
                .join(' · ')}
            </p>

            {card.kind === 'friend' ? (
              <div className="mt-2">
                <p className="truncate text-[13px] font-semibold text-white/90">
                  {[card.flavour.name, formatPrice(card.review.priceCents, card.review.currency)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Avatar src={card.author.avatarUrl} alt="" size={22} />
                  <span className="truncate text-[11px] text-white/75">@{card.author.username}</span>
                  <HeatMeter value={card.review.heat} size={12} showValue={false} />
                </div>
              </div>
            ) : (
              <div className="mt-2 text-[12px] text-white/80">
                {card.reviewCount > 0 ? (
                  <span className="flex items-center gap-2">
                    {card.topFlavour && <span className="truncate">{card.topFlavour}</span>}
                    {card.communityHeat != null && (
                      <HeatMeter value={card.communityHeat} size={12} showValue={false} />
                    )}
                    <span className="text-white/60">
                      {card.reviewCount} {card.reviewCount === 1 ? 'review' : 'reviews'}
                    </span>
                  </span>
                ) : (
                  <span className="text-white/60">Not rated on WingZ yet</span>
                )}
              </div>
            )}
          </div>

          {card.kind === 'friend' ? (
            <div className="shrink-0 text-right">
              <p className="text-3xl font-black leading-none tabular-nums">
                {formatScore(card.review.finalScore)}
              </p>
              <p className="text-[10px] font-bold text-white/70">/ 10</p>
            </div>
          ) : (
            card.communityScore != null && (
              <div className="shrink-0 text-right">
                <p className="text-3xl font-black leading-none tabular-nums">
                  {formatScore(card.communityScore)}
                </p>
                <p className="text-[10px] font-bold text-white/70">community</p>
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
