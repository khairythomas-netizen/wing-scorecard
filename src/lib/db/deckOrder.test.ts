import { describe, expect, it } from 'vitest';
import { byPhotoThenDistance, effectiveDistance } from './deckOrder';

const bare = (distanceKm: number) => ({ distanceKm, photoUrl: null });
const shot = (distanceKm: number) => ({ distanceKm, photoUrl: 'wings.jpg' });

describe('swipe deck ordering', () => {
  it('brings a photographed place forward past a bare one', () => {
    const order = byPhotoThenDistance([bare(0.8), shot(1.2)]);
    expect(order[0]!.photoUrl).toBe('wings.jpg');
  });

  it('still puts the nearest first when both have photos', () => {
    const order = byPhotoThenDistance([shot(3), shot(1)]);
    expect(order.map((c) => c.distanceKm)).toEqual([1, 3]);
  });

  it('does not drag a photo across the city to the front', () => {
    // Swipe is a proximity feature. A photo is worth a detour, not a journey.
    const order = byPhotoThenDistance([bare(0.5), shot(9)]);
    expect(order[0]!.photoUrl).toBeNull();
  });

  it('sinks a card with no distance at all to the bottom', () => {
    const order = byPhotoThenDistance([{ distanceKm: null, photoUrl: null }, bare(40)]);
    expect(order[0]!.distanceKm).toBe(40);
  });

  it('halves the apparent distance of a photographed card', () => {
    expect(effectiveDistance(shot(4))).toBe(2);
    expect(effectiveDistance(bare(4))).toBe(4);
  });
});
