/**
 * Client-side image preparation.
 *
 * Phone cameras produce 3-4 MB JPEGs. Uploading those raw meant a six-post
 * feed pulled tens of megabytes, which is what made the feed and profile slow
 * to load. Downscaling before upload cuts that by roughly 10x, and costs a
 * fraction of a second on the device.
 */

/** Longest edge, in pixels. Comfortably sharp on a 3x phone screen. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;
/** Below this there is nothing worth recompressing. */
const SKIP_UNDER_BYTES = 300 * 1024;

export interface PreparedImage {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

/**
 * Downscale and re-encode. Returns the original untouched when it is already
 * small, or when anything goes wrong — a failed optimisation must never cost
 * someone their photo.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const originalBytes = file.size;

  if (file.size < SKIP_UNDER_BYTES && !file.type.includes('heic')) {
    return { file, width: 0, height: 0, originalBytes };
  }

  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { file, width: 0, height: 0, originalBytes };
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    );
    if (!blob || blob.size >= file.size) {
      // Re-encoding made it bigger, which happens with small or flat images.
      return { file, width, height, originalBytes };
    }

    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return {
      file: new File([blob], `${name}.jpg`, { type: 'image/jpeg' }),
      width,
      height,
      originalBytes,
    };
  } catch {
    return { file, width: 0, height: 0, originalBytes };
  }
}

/**
 * Rewrite a Supabase Storage URL to request a resized copy.
 *
 * The stored originals are full-resolution: asking for a display-sized
 * variant takes a 3.5 MB photo down to roughly 280 KB. This also covers
 * photos uploaded before downscaling existed, which the upload path alone
 * cannot fix.
 *
 * Anything that is not a Supabase public object URL — an Unsplash seed image,
 * a local blob: preview — is returned untouched.
 */
export function sized(url: string | undefined, width: number): string | undefined {
  if (!url) return url;
  const marker = '/storage/v1/object/public/';
  if (!url.includes(marker)) return url;
  const rendered = url.replace(marker, '/storage/v1/render/image/public/');
  const sep = rendered.includes('?') ? '&' : '?';
  // resize=contain keeps the whole frame; the CSS decides the crop.
  return `${rendered}${sep}width=${width}&quality=75&resize=contain`;
}

/** Widths matched to where each image is actually displayed. */
export const IMAGE_WIDTHS = {
  feed: 900,
  detail: 900,
  swipe: 900,
  grid: 320,
  thumb: 200,
  avatar: 120,
} as const;
