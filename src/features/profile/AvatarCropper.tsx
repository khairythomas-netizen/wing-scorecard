import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AVATAR_SIZE,
  centredOffset,
  clampOffset,
  clampZoom,
  coverScale,
  MAX_ZOOM,
  MIN_ZOOM,
  sourceRect,
  type Offset,
  type Size,
} from '../../lib/crop';

/**
 * Pick the part of a photo that ends up in the circle.
 *
 * Modelled on the iPhone contact photo editor: the whole photo stays visible
 * and everything outside the circle is dimmed, rather than the photo being
 * clipped to a small disc. Seeing what you are cutting off is the entire
 * point of the screen, and a clipped preview hides it.
 */
export function AvatarCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [image, setImage] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [frame, setFrame] = useState(320);
  const [working, setWorking] = useState(false);

  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; from: Offset } | null>(null);
  const pinch = useRef<{ distance: number; from: number } | null>(null);

  // The circle is as wide as the screen allows, the way Apple's is. Measured
  // rather than hard-coded so it is right on a small phone and a tablet.
  useLayoutEffect(() => {
    const measure = () => {
      const box = area.current?.getBoundingClientRect();
      if (!box) return;
      setFrame(Math.max(200, Math.min(box.width - 32, box.height - 32, 420)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    const img = new Image();
    img.onload = () => setImage({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // Re-centre whenever the photo or the circle size changes.
  useEffect(() => {
    if (image) setOffset(centredOffset(image, frame, zoom));
    // Only on a new photo or a new frame; panning must not be undone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, frame]);

  const applyZoom = (next: number) => {
    if (!image) return;
    const z = clampZoom(next);
    // Zoom about the centre of the circle, so the face you lined up stays put
    // instead of sliding towards a corner.
    const ratio = (coverScale(image, frame) * z) / (coverScale(image, frame) * zoom);
    const middle = frame / 2;
    setOffset(
      clampOffset(
        { x: middle - (middle - offset.x) * ratio, y: middle - (middle - offset.y) * ratio },
        image,
        frame,
        z,
      ),
    );
    setZoom(z);
  };

  const distanceBetween = (touches: React.TouchList) => {
    const [a, b] = [touches[0]!, touches[1]!];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const confirm = async () => {
    if (!image || !url) return;
    setWorking(true);
    try {
      const rect = sourceRect(image, frame, zoom, offset);
      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not read that image'));
        img.src = url;
      });

      ctx.drawImage(img, rect.sx, rect.sy, rect.size, rect.size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.9),
      );
      if (!blob) throw new Error('Could not prepare that image');
      onDone(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
    } finally {
      setWorking(false);
    }
  };

  const scale = image ? coverScale(image, frame) * zoom : 1;

  return (
    <div className="fixed inset-0 z-[950] flex flex-col bg-black text-white">
      <div className="safe-top flex items-center justify-between px-4 pb-3">
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 active:bg-white/20"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <h2 className="text-[17px] font-bold">Move and Scale</h2>

        <button
          onClick={() => void confirm()}
          disabled={!image || working}
          aria-label="Use photo"
          className="grid h-11 w-11 place-items-center rounded-full bg-white/10 active:bg-white/20 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5.5 5.5L20 7" />
          </svg>
        </button>
      </div>

      <div
        ref={area}
        className="relative flex flex-1 touch-none items-center justify-center overflow-hidden"
        onPointerDown={(e) => {
          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, from: offset };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !image) return;
          setOffset(
            clampOffset(
              {
                x: drag.current.from.x + (e.clientX - drag.current.x),
                y: drag.current.from.y + (e.clientY - drag.current.y),
              },
              image,
              frame,
              zoom,
            ),
          );
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            drag.current = null;
            pinch.current = { distance: distanceBetween(e.touches), from: zoom };
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length !== 2 || !pinch.current) return;
          applyZoom((pinch.current.from * distanceBetween(e.touches)) / pinch.current.distance);
        }}
        onTouchEnd={() => {
          pinch.current = null;
        }}
      >
        {/* The circle's own box. The photo is positioned against it and is
            deliberately allowed to overflow, so the parts being cropped away
            stay on screen. */}
        <div className="relative" style={{ width: frame, height: frame }}>
          {url && image && (
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none select-none"
              style={{
                left: offset.x,
                top: offset.y,
                width: image.width * scale,
                height: image.height * scale,
              }}
            />
          )}

          {/* One element does the dimming: a circle with a shadow so large it
              covers the rest of the screen, leaving the circle itself clear. */}
          <div
            className="pointer-events-none absolute inset-0 rounded-full ring-[1.5px] ring-white/70"
            style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)' }}
          />
        </div>
      </div>

      <div className="safe-bottom px-8 pb-6">
        <input
          type="range"
          aria-label="Zoom"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => applyZoom(Number(e.target.value))}
          className="metric-range w-full"
        />
        <p className="mt-2 text-center text-[12px] text-white/60">
          Drag to move, pinch or slide to zoom
        </p>
      </div>
    </div>
  );
}
