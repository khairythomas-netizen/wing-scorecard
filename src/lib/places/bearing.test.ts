import { describe, expect, it } from 'vitest';
import { angleBetween, bearing, bestAimed, metresBetween, type StreetImage } from './bearing';

const place = { lat: 43.6532, lng: -79.3832 };

describe('street-level photo aiming', () => {
  it('computes compass bearings in the right direction', () => {
    expect(bearing(place, { lat: 43.66, lng: -79.3832 })).toBeCloseTo(0, 0); // due north
    expect(bearing(place, { lat: 43.6532, lng: -79.37 })).toBeCloseTo(90, 0); // due east
    expect(bearing(place, { lat: 43.64, lng: -79.3832 })).toBeCloseTo(180, 0); // due south
  });

  it('measures the short way around the compass', () => {
    expect(angleBetween(10, 350)).toBe(20);
    expect(angleBetween(350, 10)).toBe(20);
    expect(angleBetween(0, 180)).toBe(180);
    expect(angleBetween(90, 90)).toBe(0);
  });

  it('measures small distances sensibly', () => {
    // Roughly 111 m per thousandth of a degree of latitude.
    expect(metresBetween(place, { lat: 43.6542, lng: -79.3832 })).toBeGreaterThan(100);
    expect(metresBetween(place, { lat: 43.6542, lng: -79.3832 })).toBeLessThan(120);
  });

  it('prefers a camera pointed at the restaurant over one merely close to it', () => {
    const south = { lat: 43.6522, lng: -79.3832 }; // 110m south of the place
    const images: StreetImage[] = [
      // Right outside, but facing away down the street.
      { url: 'kerb.jpg', at: { lat: 43.6531, lng: -79.3832 }, compass: 180 },
      // Further off, but aimed north straight at it.
      { url: 'storefront.jpg', at: south, compass: 0 },
    ];
    expect(bestAimed(images, place, 1)).toEqual(['storefront.jpg']);
  });

  it('discards cameras looking somewhere else entirely', () => {
    // A wrong photo of the wrong building is worse than the placeholder.
    const images: StreetImage[] = [
      { url: 'road.jpg', at: { lat: 43.6522, lng: -79.3832 }, compass: 180 },
    ];
    expect(bestAimed(images, place, 3)).toEqual([]);
  });

  it('returns nothing when there is nothing to choose from', () => {
    expect(bestAimed([], place, 3)).toEqual([]);
  });
});
