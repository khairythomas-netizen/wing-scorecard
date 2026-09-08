import { useEffect, useRef } from 'react';
import { CameraIcon, CloseIcon } from '../../components/Icons';

export interface DraftPhoto {
  id: string;
  url: string;
  kind: 'wing' | 'menu' | 'bill' | 'sauce' | 'sides' | 'interior' | 'other';
}

const KINDS: DraftPhoto['kind'][] = ['wing', 'menu', 'bill', 'sauce', 'sides', 'interior'];

/**
 * The photo is the post, so the main image is required and dominates the form.
 * Extra angles, the menu, the bill and the sides are optional context.
 */
export function PhotoPicker({
  photos,
  onChange,
}: {
  photos: DraftPhoto[];
  onChange: (photos: DraftPhoto[]) => void;
}) {
  const mainInput = useRef<HTMLInputElement>(null);
  const extraInput = useRef<HTMLInputElement>(null);
  const created = useRef<Set<string>>(new Set());

  // Object URLs leak until revoked, and a review form can churn through many.
  useEffect(() => {
    const urls = created.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const toDraft = (file: File, kind: DraftPhoto['kind']): DraftPhoto => {
    const url = URL.createObjectURL(file);
    created.current.add(url);
    return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, url, kind };
  };

  const main = photos[0];
  const extras = photos.slice(1);

  const setMain = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const next = toDraft(file, 'wing');
    onChange(main ? [next, ...extras] : [next]);
  };

  const addExtras = (files: FileList | null) => {
    if (!files?.length) return;
    const room = Math.max(0, 9 - photos.length);
    const next = Array.from(files).slice(0, room).map((f) => toDraft(f, 'wing'));
    onChange([...photos, ...next]);
  };

  const remove = (id: string) => onChange(photos.filter((p) => p.id !== id));

  const setKind = (id: string, kind: DraftPhoto['kind']) =>
    onChange(photos.map((p) => (p.id === id ? { ...p, kind } : p)));

  return (
    <div>
      <button
        type="button"
        onClick={() => mainInput.current?.click()}
        className="relative grid h-52 w-full place-items-center overflow-hidden rounded-xl2 border border-dashed border-line bg-surface text-center"
      >
        {main ? (
          <>
            <img src={main.url} alt="Main wing photo" className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute bottom-3 right-3 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
              Change photo
            </span>
          </>
        ) : (
          <span className="px-6">
            <CameraIcon className="mx-auto mb-2 h-8 w-8 text-muted" />
            <span className="block text-sm font-extrabold">
              Main wing photo <span className="text-orange">*</span>
            </span>
            <span className="mt-1 block text-[11px] text-muted">
              This is the post. Make it a good one.
            </span>
          </span>
        )}
      </button>
      <input
        ref={mainInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          setMain(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="hide-scrollbar mt-2 flex gap-2 overflow-x-auto pb-1">
        {extras.map((p) => (
          <div key={p.id} className="relative shrink-0">
            <img src={p.url} alt="" className="h-20 w-20 rounded-xl object-cover" />
            <button
              type="button"
              onClick={() => remove(p.id)}
              aria-label="Remove photo"
              className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-black/75 text-white"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
            <select
              value={p.kind}
              onChange={(e) => setKind(p.id, e.target.value as DraftPhoto['kind'])}
              aria-label="Photo type"
              className="mt-1 w-20 rounded-lg border border-line bg-surface px-1 py-1 text-[10px] font-semibold capitalize text-muted"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
        ))}

        {photos.length > 0 && photos.length < 9 && (
          <button
            type="button"
            onClick={() => extraInput.current?.click()}
            className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-dashed border-line bg-surface text-2xl text-muted"
            aria-label="Add another photo"
          >
            +
          </button>
        )}
      </div>
      <input
        ref={extraInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addExtras(e.target.files);
          e.target.value = '';
        }}
      />

      {photos.length > 1 && (
        <p className="px-1 text-[10px] text-muted">
          Tag the extras so menus, bills and sides stay useful later.
        </p>
      )}
    </div>
  );
}
