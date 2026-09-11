import { useEffect, useMemo, useRef, useState } from 'react';
import { ScoreBadge } from '../../components/ScoreBadge';
import { Sheet } from '../../components/Sheet';
import { useQuery, useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { parsePriceToCents } from '../../lib/format';
import {
  CORE_MAX,
  COOK_SLIDER_CENTER,
  EXPERIENCE_MAX,
  calculateScore,
  type BonusEntry,
} from '../../lib/scoring';
import type { Breading, Place, WingStyle } from '../../lib/types';
import { BonusEditor, newBonusRow } from './BonusEditor';
import { CookSlider } from './CookSlider';
import { HeatPicker } from './HeatPicker';
import { MetricSlider } from './MetricSlider';
import { PhotoPicker, type DraftPhoto } from './PhotoPicker';
import { RestaurantPicker } from './RestaurantPicker';

interface Draft {
  photos: DraftPhoto[];
  place: Place | null;
  orderText: string;
  flavourName: string;
  priceText: string;
  caption: string;
  heat: 1 | 2 | 3 | 4 | 5 | null;
  style: WingStyle;
  breading: Breading;
  cookPosition: number;
  flavour: number;
  sauce: number;
  value: number;
  size: number;
  eye: number;
  sides: number;
  ratio: number;
  drink: number;
  towelette: boolean;
  napkins: boolean;
  sauceOptions: number;
  atmosphere: number;
  bonuses: BonusEntry[];
}

const emptyDraft = (): Draft => ({
  photos: [],
  place: null,
  orderText: '',
  flavourName: '',
  priceText: '',
  caption: '',
  heat: null,
  // Descriptive defaults: most wings are bone-in and non-breaded.
  style: 'bone_in',
  breading: 'non_breaded',
  cookPosition: COOK_SLIDER_CENTER,
  flavour: 1,
  sauce: 0.5,
  value: 0.5,
  size: 0.3,
  eye: 0.3,
  sides: 0.3,
  ratio: 0.1,
  drink: 0.2,
  towelette: false,
  napkins: false,
  sauceOptions: 0.1,
  atmosphere: 0.2,
  bonuses: [newBonusRow()],
});

export function RateScreen({ onPublished }: { onPublished: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [d, setD] = useState<Draft>(emptyDraft);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [touched, setTouched] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const scoreSection = useRef<HTMLDivElement>(null);
  const [scoringInView, setScoringInView] = useState(false);

  // The running-score bar is pinned, so anything it floats over is unreadable.
  // Reveal it once the scoring section has been reached and keep it from then
  // on: while the user is still filling in photo and details there is no score
  // worth showing, but once they are scoring it should never flicker away.
  useEffect(() => {
    const check = () => {
      const el = scoreSection.current;
      if (!el) return;
      const reached = el.getBoundingClientRect().top < window.innerHeight * 0.85;
      setScoringInView((was) => was || reached);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const flavours = useQuery([], (s) => s.getFlavours());

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const result = useMemo(
    () =>
      calculateScore({
        cookPosition: d.cookPosition,
        flavour: d.flavour,
        sauce: d.sauce,
        value: d.value,
        size: d.size,
        eye: d.eye,
        sides: d.sides,
        ratio: d.ratio,
        drink: d.drink,
        towelette: d.towelette,
        napkins: d.napkins,
        sauceOptions: d.sauceOptions,
        atmosphere: d.atmosphere,
        bonuses: d.bonuses,
      }),
    [d],
  );

  const priceCents = parsePriceToCents(d.priceText);

  // Every one of these is a hard product requirement for a review.
  const missing: string[] = [];
  if (!d.photos.length) missing.push('a main photo');
  if (!d.place) missing.push('a restaurant');
  if (!d.orderText.trim()) missing.push('what you ordered');
  if (!d.flavourName.trim()) missing.push('a sauce or flavour');

  if (d.heat == null) missing.push('a heat rating');
  const valid = missing.length === 0;

  // Two independent reasons to show the pinned bar. `valid` is the safety net:
  // if the scroll listener ever fails to fire, a complete review must still be
  // publishable rather than stranding the button off-screen forever.
  const showScoreBar = scoringInView || valid;

  const publish = async () => {
    setTouched(true);
    if (!valid || !d.place || d.heat == null) {
      toast(`Still need ${missing[0]}`);
      return;
    }
    setPublishing(true);
    try {
      await store.createReview({
        place: d.place,
        flavourName: d.flavourName,
        orderText: d.orderText.trim(),
        priceCents,
        currency: 'CAD',
        heat: d.heat,
        style: d.style,
        breading: d.breading,
        scores: { ...result.components, cookPosition: d.cookPosition },
        bonuses: d.bonuses.filter((b) => b.amount > 0),
        caption: d.caption.trim(),
        photos: d.photos.map((p) => ({ url: p.url, file: p.file, kind: p.kind })),
        visibility: 'public',
      });
      setD(emptyDraft());
      setTouched(false);
      toast('Published to your feed');
      onPublished();
    } catch (err) {
      // Uploads and inserts both fail here; keep the draft so nothing is lost.
      toast(err instanceof Error ? err.message : 'Could not publish');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="pb-28">
      <header className="px-4 pb-3 pt-4">
        <h1 className="text-[28px] font-black leading-none tracking-tight">Rate wings</h1>
        <p className="mt-1.5 text-xs text-muted">Photo first. Score second.</p>
      </header>

      <div className="space-y-3 px-4">
        <PhotoPicker photos={d.photos} onChange={(p) => set('photos', p)} />

        <FieldGroup label="Restaurant" required>
          <RestaurantPicker value={d.place} onChange={(p) => set('place', p)} />
        </FieldGroup>

        <Field label="What did you order?" required>
          <TextInput
            value={d.orderText}
            onChange={(v) => set('orderText', v)}
            placeholder="20-wing combo, boneless + fries…"
          />
        </Field>

        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
          <Field label="Sauce / flavour" required>
            <TextInput
              value={d.flavourName}
              onChange={(v) => set('flavourName', v)}
              placeholder="Hot honey"
              list="wingz-flavours"
            />
            <datalist id="wingz-flavours">
              {(flavours.data ?? []).map((f) => (
                <option key={f.id} value={f.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Price" hint="optional">
            <TextInput
              value={d.priceText}
              onChange={(v) => set('priceText', v)}
              placeholder="$24"
              inputMode="decimal"
            />
          </Field>
        </div>

        <Field label="Caption / notes">
          <textarea
            value={d.caption}
            onChange={(e) => set('caption', e.target.value)}
            placeholder="Anything worth remembering?"
            rows={3}
            className="w-full resize-none rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-muted focus:border-orange"
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Choice
            label="Style"
            value={d.style}
            options={[
              ['bone_in', 'Bone-in'],
              ['boneless', 'Boneless'],
            ]}
            onChange={(v) => set('style', v)}
          />
          <Choice
            label="Breading"
            value={d.breading}
            options={[
              ['non_breaded', 'Non-breaded'],
              ['breaded', 'Breaded'],
            ]}
            onChange={(v) => set('breading', v)}
          />
        </div>

        <HeatPicker value={d.heat} onChange={(h) => set('heat', h)} />
      </div>

      <div ref={scoreSection} />
      <SectionBar title="Core score" detail={`${CORE_MAX.toFixed(1)} points`} />
      <div className="px-4">
        <CookSlider position={d.cookPosition} onChange={(p) => set('cookPosition', p)} />
        <MetricSlider label="Flavour" value={d.flavour} max={2} onChange={(v) => set('flavour', v)} />
        <MetricSlider label="Sauce consistency" value={d.sauce} max={1} onChange={(v) => set('sauce', v)} />
        <MetricSlider label="Value" hint="for the money" value={d.value} max={1} onChange={(v) => set('value', v)} />
        <MetricSlider label="Size & meatiness" value={d.size} max={0.5} onChange={(v) => set('size', v)} />
        <MetricSlider label="Eye test" hint="how good it looks" value={d.eye} max={0.5} onChange={(v) => set('eye', v)} />
        <MetricSlider label="Sides & dips" value={d.sides} max={0.5} onChange={(v) => set('sides', v)} />
        <MetricSlider label="Flats : drums" value={d.ratio} max={0.2} onChange={(v) => set('ratio', v)} />
        <MetricSlider label="Drink" value={d.drink} max={0.3} onChange={(v) => set('drink', v)} rounded="bottom" />
      </div>

      <SectionBar title="Experience" detail={`${EXPERIENCE_MAX.toFixed(1)} point`} />
      <div className="grid grid-cols-2 gap-2 px-4">
        <YesNo label="Moist towelette" value={d.towelette} weight={0.2} onChange={(v) => set('towelette', v)} />
        <YesNo label="Napkins" value={d.napkins} weight={0.2} onChange={(v) => set('napkins', v)} />
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <CompactSlider label="Sauce options" value={d.sauceOptions} max={0.2} onChange={(v) => set('sauceOptions', v)} />
          <CompactSlider label="Atmosphere" value={d.atmosphere} max={0.4} onChange={(v) => set('atmosphere', v)} />
        </div>
      </div>

      <div className="px-4 pt-4">
        <BonusEditor bonuses={d.bonuses} onChange={(b) => set('bonuses', b)} />
      </div>

      {touched && !valid && (
        <p className="px-4 pt-3 text-center text-[11px] font-semibold text-danger">
          Still need {missing.join(', ')}.
        </p>
      )}

      {/* Pinned above the nav, but held back until the user reaches the
          scoring section — a translucent bar floating over the photo and
          details fields makes them unreadable. */}
      <div className={`above-nav fixed left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-[568px] -translate-x-1/2 items-center justify-between gap-3 rounded-xl2 border border-line bg-[var(--glass)] px-4 py-3 shadow-card backdrop-blur-xl transition-all duration-200 ${
          showScoreBar
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0'
        }`}>
        <button
          type="button"
          onClick={() => setShowBreakdown(true)}
          className="text-left"
          aria-label="Show score breakdown"
        >
          <ScoreBadge score={result.final} size="lg" />
          <p className="mt-1 text-[10px] font-semibold text-muted">
            {result.base.toFixed(1)} base · +{result.bonus.toFixed(1)} bonus ·{' '}
            <span className="underline decoration-dotted">breakdown</span>
          </p>
        </button>
        <button
          type="button"
          onClick={() => void publish()}
          disabled={publishing}
          className={`rounded-xl px-5 py-3 text-sm font-black text-white transition-opacity ${
            valid ? 'bg-gradient-to-br from-orange to-gold shadow-glow' : 'bg-muted opacity-60'
          } disabled:opacity-60`}
        >
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
      </div>

      <Sheet open={showBreakdown} onClose={() => setShowBreakdown(false)} title="Score breakdown">
        <BreakdownRows result={result} bonuses={d.bonuses} />
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

/**
 * For composite controls. A <label> would forward taps on anything inside it
 * to its first form control, which reopens the restaurant dropdown mid-tap.
 */
function FieldGroup({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 ml-1 block text-[11px] font-bold text-muted">
        {label} {required && <span className="text-orange">*</span>}
      </span>
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 ml-1 block text-[11px] font-bold text-muted">
        {label} {required && <span className="text-orange">*</span>}
        {hint && <span className="ml-1 font-semibold normal-case opacity-70">({hint})</span>}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
  list,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: 'decimal' | 'text';
  list?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      list={list}
      className="w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-muted focus:border-orange"
    />
  );
}

/** A two-way descriptive toggle. Like heat, these never affect the score. */
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-3">
      <p className="text-[11px] font-bold text-muted">{label}</p>
      <div className="mt-2 flex gap-1.5">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={`flex-1 rounded-lg border py-2 text-[11px] font-bold transition-colors ${
              value === v
                ? 'border-transparent bg-orange text-white'
                : 'border-line bg-surface2 text-muted'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionBar({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-end justify-between px-5 pb-2 pt-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">{title}</span>
      <span className="text-[10px] text-muted">{detail}</span>
    </div>
  );
}

function YesNo({
  label,
  value,
  weight,
  onChange,
}: {
  label: string;
  value: boolean;
  weight: number;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-extrabold">{label}</span>
        <span className="text-[12px] font-black tabular-nums">
          {(value ? weight : 0).toFixed(1)}
        </span>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {([false, true] as const).map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={`flex-1 rounded-lg border py-1.5 text-[11px] font-bold transition-colors ${
              value === v
                ? 'border-transparent bg-orange text-white'
                : 'border-line bg-surface2 text-muted'
            }`}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompactSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-extrabold">{label}</span>
        <span className="text-[12px] font-black tabular-nums">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="metric-range mt-3"
      />
    </div>
  );
}

const CORE_ROWS: [string, keyof ReturnType<typeof calculateScore>['components'], number][] = [
  ['Cook', 'cook', 3],
  ['Flavour', 'flavour', 2],
  ['Sauce consistency', 'sauce', 1],
  ['Value', 'value', 1],
  ['Size & meatiness', 'size', 0.5],
  ['Eye test', 'eye', 0.5],
  ['Sides & dips', 'sides', 0.5],
  ['Flats : drums', 'ratio', 0.2],
  ['Drink', 'drink', 0.3],
];

const EXP_ROWS: [string, keyof ReturnType<typeof calculateScore>['components'], number][] = [
  ['Moist towelette', 'towelette', 0.2],
  ['Napkins', 'napkins', 0.2],
  ['Sauce options', 'sauceOptions', 0.2],
  ['Atmosphere', 'atmosphere', 0.4],
];

export function BreakdownRows({
  result,
  bonuses,
}: {
  result: ReturnType<typeof calculateScore>;
  bonuses: BonusEntry[];
}) {
  const row = ([label, key, max]: (typeof CORE_ROWS)[number]) => (
    <div key={key} className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[13px] font-bold tabular-nums">
        {result.components[key].toFixed(1)}
        <span className="ml-1 text-[11px] font-semibold text-muted">/ {max}</span>
      </span>
    </div>
  );

  const scored = bonuses.filter((b) => b.amount > 0);

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between rounded-xl2 bg-surface2 px-4 py-3">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Final</span>
        <ScoreBadge score={result.final} size="md" />
      </div>

      <Group title="Core" total={result.core} max={CORE_MAX}>
        {CORE_ROWS.map(row)}
      </Group>
      <Group title="Experience" total={result.experience} max={EXPERIENCE_MAX}>
        {EXP_ROWS.map(row)}
      </Group>

      <Group title="Bonus" total={result.bonus} max={0.5}>
        {scored.length === 0 ? (
          <p className="py-1.5 text-[13px] text-muted">No bonus applied.</p>
        ) : (
          scored.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="min-w-0 truncate text-[13px] text-muted">
                {b.reason.trim() || 'Bonus'}
              </span>
              <span className="shrink-0 text-[13px] font-bold tabular-nums text-orange">
                +{b.amount.toFixed(1)}
              </span>
            </div>
          ))
        )}
      </Group>
    </div>
  );
}

function Group({
  title,
  total,
  max,
  children,
}: {
  title: string;
  total: number;
  max: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <div className="mb-1 flex items-baseline justify-between border-b border-line pb-1.5">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">{title}</h3>
        <span className="text-[12px] font-black tabular-nums">
          {total.toFixed(1)}
          <span className="ml-1 text-[10px] font-semibold text-muted">/ {max}</span>
        </span>
      </div>
      {children}
    </section>
  );
}
