import { useState } from 'react';
import { ChevronIcon } from '../../components/Icons';
import { EmptyState, ErrorState, Spinner } from '../../components/States';
import { useQuery, useStore } from '../../hooks/useStore';
import { useToast } from '../../hooks/useToast';
import { parsePriceToCents } from '../../lib/format';
import { calculateScore, formatScore, type BonusEntry } from '../../lib/scoring';
import type { Breading, FeedItem, WingStyle } from '../../lib/types';
import { BonusEditor, newBonusRow } from '../rate/BonusEditor';
import { CookSlider } from '../rate/CookSlider';
import { HeatPicker } from '../rate/HeatPicker';
import { MetricSlider } from '../rate/MetricSlider';

/**
 * Editing an existing review.
 *
 * Deliberately excludes the photo and the restaurant: changing those is really
 * a different review, and both carry side effects (an upload, a place lookup)
 * that do not belong behind an inline edit.
 */
export function EditPost({
  reviewId,
  onDone,
}: {
  reviewId: string;
  onDone: () => void;
}) {
  const post = useQuery([reviewId], (s) => s.feedItem(reviewId));
  if (post.error) return <ErrorState error={post.error} onRetry={post.refetch} />;
  if (post.data === undefined) return <Spinner label="Loading review" />;
  if (post.data === null) return <EmptyState title="This review is no longer available" />;
  return <Form item={post.data} onDone={onDone} />;
}

function Form({ item, onDone }: { item: FeedItem; onDone: () => void }) {
  const store = useStore();
  const toast = useToast();
  const { review } = item;

  const [orderText, setOrderText] = useState(review.orderText);
  const [flavourName, setFlavourName] = useState(item.flavour.name);
  const [priceText, setPriceText] = useState(
    review.priceCents == null ? '' : (review.priceCents / 100).toString(),
  );
  const [caption, setCaption] = useState(review.caption);
  const [heat, setHeat] = useState<1 | 2 | 3 | 4 | 5>(review.heat);
  const [style, setStyle] = useState<WingStyle>(review.style);
  const [breading, setBreading] = useState<Breading>(review.breading);
  const [s, setS] = useState(review.scores);
  const [bonuses, setBonuses] = useState<BonusEntry[]>(
    review.bonuses.length ? review.bonuses : [newBonusRow()],
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof s>(key: K, value: (typeof s)[K]) =>
    setS((prev) => ({ ...prev, [key]: value }));

  const result = calculateScore({
    cookPosition: s.cookPosition,
    flavour: s.flavour,
    sauce: s.sauce,
    value: s.value,
    size: s.size,
    eye: s.eye,
    sides: s.sides,
    ratio: s.ratio,
    drink: s.drink,
    towelette: s.towelette > 0,
    napkins: s.napkins > 0,
    sauceOptions: s.sauceOptions,
    atmosphere: s.atmosphere,
    bonuses,
  });

  const missing = !orderText.trim() ? 'what you ordered' : !flavourName.trim() ? 'a sauce or flavour' : null;

  const save = async () => {
    if (missing) {
      toast(`Still need ${missing}`);
      return;
    }
    setSaving(true);
    try {
      await store.updateReview(review.id, {
        orderText: orderText.trim(),
        flavourName: flavourName.trim(),
        priceCents: parsePriceToCents(priceText),
        currency: review.currency,
        heat,
        style,
        breading,
        caption: caption.trim(),
        scores: { ...result.components, cookPosition: s.cookPosition },
        bonuses: bonuses.filter((b) => b.amount > 0),
      });
      toast('Changes saved');
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full rounded-xl2 border border-line bg-surface px-3.5 py-3 text-sm outline-none placeholder:text-muted focus:border-orange';

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between px-2 py-2">
        <button onClick={onDone} className="flex items-center gap-1 px-2 py-1.5 text-[13px] font-extrabold text-muted">
          <ChevronIcon className="h-4 w-4 rotate-180" />
          Cancel
        </button>
        <h1 className="text-[13px] font-extrabold">Edit review</h1>
        <span className="w-16" />
      </div>

      <div className="space-y-3 px-4">
        <p className="rounded-xl2 border border-line bg-surface2 px-3.5 py-2.5 text-[11px] text-muted">
          Editing <span className="font-bold text-text">{item.place.displayName}</span>. The photo
          and restaurant cannot be changed — post a new review for a different visit.
        </p>

        <L label="What did you order?">
          <input value={orderText} onChange={(e) => setOrderText(e.target.value)} className={input} />
        </L>
        <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
          <L label="Sauce / flavour">
            <input value={flavourName} onChange={(e) => setFlavourName(e.target.value)} className={input} />
          </L>
          <L label="Price (optional)">
            <input
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              inputMode="decimal"
              placeholder="$24"
              className={input}
            />
          </L>
        </div>
        <L label="Caption / notes">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className={`${input} resize-none`}
          />
        </L>

        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Style" value={style} options={[['bone_in', 'Bone-in'], ['boneless', 'Boneless']]} onChange={setStyle} />
          <Toggle label="Breading" value={breading} options={[['non_breaded', 'Non-breaded'], ['breaded', 'Breaded']]} onChange={setBreading} />
        </div>

        <HeatPicker value={heat} onChange={setHeat} />
      </div>

      <Bar title="Core score" detail="9.0 points" />
      <div className="px-4">
        <CookSlider position={s.cookPosition} onChange={(p) => set('cookPosition', p)} />
        <MetricSlider label="Flavour" value={s.flavour} max={2} onChange={(v) => set('flavour', v)} />
        <MetricSlider label="Sauce consistency" value={s.sauce} max={1} onChange={(v) => set('sauce', v)} />
        <MetricSlider label="Value" hint="for the money" value={s.value} max={1} onChange={(v) => set('value', v)} />
        <MetricSlider label="Size & meatiness" value={s.size} max={0.5} onChange={(v) => set('size', v)} />
        <MetricSlider label="Eye test" hint="how good it looks" value={s.eye} max={0.5} onChange={(v) => set('eye', v)} />
        <MetricSlider label="Sides & dips" value={s.sides} max={0.5} onChange={(v) => set('sides', v)} />
        <MetricSlider label="Flats : drums" value={s.ratio} max={0.2} onChange={(v) => set('ratio', v)} />
        <MetricSlider label="Drink" value={s.drink} max={0.3} onChange={(v) => set('drink', v)} rounded="bottom" />
      </div>

      <Bar title="Experience" detail="1.0 point" />
      <div className="grid grid-cols-2 gap-2 px-4">
        <YesNo label="Moist towelette" on={s.towelette > 0} onChange={(v) => set('towelette', v ? 0.2 : 0)} />
        <YesNo label="Napkins" on={s.napkins > 0} onChange={(v) => set('napkins', v ? 0.2 : 0)} />
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <MetricSlider label="Sauce options" value={s.sauceOptions} max={0.2} onChange={(v) => set('sauceOptions', v)} rounded="bottom" />
          <MetricSlider label="Atmosphere" value={s.atmosphere} max={0.4} onChange={(v) => set('atmosphere', v)} rounded="bottom" />
        </div>
      </div>

      <div className="px-4 pt-4">
        <BonusEditor bonuses={bonuses} onChange={setBonuses} />
      </div>

      <div className="above-nav fixed left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-[568px] -translate-x-1/2 items-center justify-between gap-3 rounded-xl2 border border-line bg-[var(--glass)] px-4 py-3 shadow-card backdrop-blur-xl">
        <div>
          <p className="text-[30px] font-black leading-none tracking-tight tabular-nums">
            {formatScore(result.final)}
            <span className="ml-1 text-xs font-bold text-muted">/ 10</span>
          </p>
          <p className="mt-1 text-[10px] font-semibold text-muted">
            was {formatScore(review.finalScore)}
          </p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-gradient-to-br from-orange to-gold px-5 py-3 text-sm font-black text-white shadow-glow disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 ml-1 block text-[11px] font-bold text-muted">{label}</span>
      {children}
    </label>
  );
}

function Bar({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-end justify-between px-5 pb-2 pt-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-muted">{title}</span>
      <span className="text-[10px] text-muted">{detail}</span>
    </div>
  );
}

function Toggle<T extends string>({
  label, value, options, onChange,
}: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
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
            className={`flex-1 rounded-lg border py-2 text-[11px] font-bold ${
              value === v ? 'border-transparent bg-orange text-white' : 'border-line bg-surface2 text-muted'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function YesNo({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="rounded-xl2 border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-extrabold">{label}</span>
        <span className="text-[12px] font-black tabular-nums">{(on ? 0.2 : 0).toFixed(1)}</span>
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {[false, true].map((v) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={on === v}
            className={`flex-1 rounded-lg border py-1.5 text-[11px] font-bold ${
              on === v ? 'border-transparent bg-orange text-white' : 'border-line bg-surface2 text-muted'
            }`}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  );
}
