import { describe, expect, it } from 'vitest';
import {
  centredOffset,
  clampOffset,
  clampZoom,
  coverScale,
  MAX_ZOOM,
  MIN_ZOOM,
  sourceRect,
} from './crop';

const FRAME = 300;
const wide = { width: 1200, height: 600 };
const tall = { width: 600, height: 1500 };
const square = { width: 800, height: 800 };

describe('avatar crop geometry', () => {
  it('covers the frame at zoom 1 whatever shape the photo is', () => {
    for (const image of [wide, tall, square]) {
      const scale = coverScale(image, FRAME);
      expect(image.width * scale).toBeGreaterThanOrEqual(FRAME);
      expect(image.height * scale).toBeGreaterThanOrEqual(FRAME);
    }
  });

  it('keeps zoom inside its range', () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(2.5)).toBe(2.5);
  });

  it('never lets the image be dragged off the frame', () => {
    // Dragging hard to the right and down would otherwise leave empty space
    // on the left of the circle.
    const pulled = clampOffset({ x: 500, y: 500 }, wide, FRAME, 1);
    expect(pulled.x).toBeLessThanOrEqual(0);
    expect(pulled.y).toBeLessThanOrEqual(0);

    const pushed = clampOffset({ x: -9999, y: -9999 }, wide, FRAME, 1);
    const scale = coverScale(wide, FRAME);
    expect(pushed.x).toBeCloseTo(FRAME - wide.width * scale);
    expect(pushed.y).toBeCloseTo(FRAME - wide.height * scale);
  });

  it('opens centred on the photo', () => {
    const offset = centredOffset(wide, FRAME, 1);
    const scale = coverScale(wide, FRAME);
    expect(offset.x).toBeCloseTo((FRAME - wide.width * scale) / 2);
    // A landscape photo is exactly as tall as the frame at zoom 1, so there is
    // nothing to centre vertically.
    expect(offset.y).toBeCloseTo(0);
  });

  it('reads a square out of the original that stays inside it', () => {
    for (const image of [wide, tall, square]) {
      for (const zoom of [1, 1.7, MAX_ZOOM]) {
        const rect = sourceRect(image, FRAME, zoom, centredOffset(image, FRAME, zoom));
        expect(rect.sx).toBeGreaterThanOrEqual(-0.001);
        expect(rect.sy).toBeGreaterThanOrEqual(-0.001);
        expect(rect.sx + rect.size).toBeLessThanOrEqual(image.width + 0.001);
        expect(rect.sy + rect.size).toBeLessThanOrEqual(image.height + 0.001);
      }
    }
  });

  it('crops tighter as you zoom in', () => {
    const out = sourceRect(square, FRAME, 1, centredOffset(square, FRAME, 1));
    const inClose = sourceRect(square, FRAME, 3, centredOffset(square, FRAME, 3));
    expect(inClose.size).toBeLessThan(out.size);
  });
});
