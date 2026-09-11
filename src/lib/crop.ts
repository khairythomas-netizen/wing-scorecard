/**
 * Geometry for the circular avatar cropper.
 *
 * Kept free of React and canvas so it can be tested: the failure mode that
 * matters is a gap at the edge of the circle, which is arithmetic, not
 * rendering.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Offset {
  x: number;
  y: number;
}

/** The output avatar is square; this is its side in pixels. */
export const AVATAR_SIZE = 512;

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/**
 * The scale at which the image exactly covers the square frame. Zoom is a
 * multiplier on top of this, so zoom 1 always fills the circle no matter how
 * the photo is shaped.
 */
export function coverScale(image: Size, frame: number): number {
  return frame / Math.min(image.width, image.height);
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Hold the image against the frame. Panning past an edge would show
 * background inside the circle, so the offset is clamped rather than the drag
 * being rejected, which keeps dragging smooth at the limit.
 */
export function clampOffset(offset: Offset, image: Size, frame: number, zoom: number): Offset {
  const scale = coverScale(image, frame) * clampZoom(zoom);
  const shown = { width: image.width * scale, height: image.height * scale };
  const minX = Math.min(0, frame - shown.width);
  const minY = Math.min(0, frame - shown.height);
  return {
    x: Math.min(0, Math.max(minX, offset.x)),
    y: Math.min(0, Math.max(minY, offset.y)),
  };
}

/** Centres the image in the frame, which is where the cropper opens. */
export function centredOffset(image: Size, frame: number, zoom: number): Offset {
  const scale = coverScale(image, frame) * clampZoom(zoom);
  return {
    x: (frame - image.width * scale) / 2,
    y: (frame - image.height * scale) / 2,
  };
}

export interface SourceRect {
  sx: number;
  sy: number;
  size: number;
}

/**
 * The square of the original image that ends up inside the frame, in the
 * image's own pixels. This is what gets drawn to the output canvas.
 */
export function sourceRect(
  image: Size,
  frame: number,
  zoom: number,
  offset: Offset,
): SourceRect {
  const scale = coverScale(image, frame) * clampZoom(zoom);
  const safe = clampOffset(offset, image, frame, zoom);
  return {
    sx: -safe.x / scale,
    sy: -safe.y / scale,
    size: frame / scale,
  };
}
