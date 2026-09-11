import { useEffect, useRef, useState } from 'react';
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

const FRAME = 288;

/**
 * Pick the part of a photo that ends up in the circle.
 *
 * The mask is a real circle rather than a rounded square, because an avatar
 * that looked right while cropping and wrong once posted is the whole problem
 * this solves. Drag to move, pinch or use the slider to zoom.
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
  const [working, setWorking] = useState(false);

  const drag = useRef<{ x: number; y: number; from: Offset } | null>(null);
  const pinch = useRef<{ distance: number; from: number } | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      setImage(size);
      setOffset(centredOffset(size, FRAME, 1));
    };
    img.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const applyZoom = (next: number) => {
    if (!image) return;
    const z = clampZoom(next);
    // Zoom about the centre of the circle, so the face you lined up stays put
    // instead of sliding towards a corner.
    const before = coverScale(image, FRAME) * zoom;
    const after = coverScale(image, FRAME) * z;
    const ratio = after / before;
    const middle = FRAME / 2;
    setOffset(
      clampOffset(
        { x: middle - (middle - offset.x) * ratio, y: middle - (middle - offset.y) * ratio },
        image,
        FRAME,
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
      const rect = sourceRect(image, FRAME, zoom, offset);
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

  const scale = image ? coverScale(image, FRAME) * zoom : 1;

  return (
    <div className="fixed inset-0 z-[950] flex flex-col bg-bg">
      <div className="safe-top flex items-center justify-between border-b border-line px-4 pb-3">
        <button onClick={onCancel} className="text-[13px] font-bold text-muted">
          Cancel
        </button>
        <h2 className="text-sm font-black">Move and scale</h2>
        <button
          onClick={() => void confirm()}
          disabled={!image || working}
          className="text-[13px] font-black text-orange disabled:opacity-40"
        >
          {working ? 'Working…' : 'Use photo'}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div
          className="relative touch-none overflow-hidden rounded-full bg-surface2"
          style={{ width: FRAME, height: FRAME }}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture?.(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, from: offset };
          }}
          onPointerMove={(e) => {
            if (!drag.current || !image) return;
            const next = {
              x: drag.current.from.x + (e.clientX - drag.current.x),
              y: drag.current.from.y + (e.clientY - drag.current.y),
            };
            setOffset(clampOffset(next, image, FRAME, zoom));
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
        </div>

        <p className="mt-4 text-[11px] text-muted">Drag to move, pinch or slide to zoom</p>

        <input
          type="range"
          aria-label="Zoom"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => applyZoom(Number(e.target.value))}
          className="metric-range mt-3 w-full max-w-[288px]"
        />
      </div>
    </div>
  );
}
