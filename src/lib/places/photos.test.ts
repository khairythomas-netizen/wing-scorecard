import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cachedPhotos, clearPhotoCache, resolvePhotos } from './photos';

describe('place photo cache', () => {
  beforeEach(() => clearPhotoCache());

  it('asks the provider once, then serves from cache', async () => {
    const fetcher = vi.fn().mockResolvedValue(['a.jpg']);
    expect(await resolvePhotos('p1', fetcher)).toEqual(['a.jpg']);
    expect(await resolvePhotos('p1', fetcher)).toEqual(['a.jpg']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('collapses simultaneous asks into one request', async () => {
    // The swipe deck renders several cards at once; without this each one
    // would bill a separate lookup for the same restaurant.
    const fetcher = vi.fn().mockResolvedValue(['a.jpg']);
    const [x, y, z] = await Promise.all([
      resolvePhotos('p2', fetcher),
      resolvePhotos('p2', fetcher),
      resolvePhotos('p2', fetcher),
    ]);
    expect([x, y, z]).toEqual([['a.jpg'], ['a.jpg'], ['a.jpg']]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('remembers that a place has no photos', async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    await resolvePhotos('p3', fetcher);
    await resolvePhotos('p3', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cachedPhotos('p3')).toEqual([]);
  });

  it('treats a failed lookup as no photos rather than throwing', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('quota'));
    expect(await resolvePhotos('p4', fetcher)).toEqual([]);
  });

  it('has nothing cached for a place never asked about', () => {
    expect(cachedPhotos('never')).toBeNull();
  });
});
