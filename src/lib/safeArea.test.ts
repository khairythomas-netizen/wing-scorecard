import { describe, expect, it } from 'vitest';

describe('safe-area classes', () => {
  it('every safe-* class a component uses is actually defined', async () => {
    // The Edit Profile header shipped with `safe-top`, which was never a rule.
    // Tailwind does not complain about an unknown class, so the sheet simply
    // rendered under the iPhone status bar with no inset at all.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');

    const walk = async (dir: string): Promise<string[]> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const out = await Promise.all(
        entries.map(async (e) => {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) return walk(full);
          return full.endsWith('.tsx') ? [full] : [];
        }),
      );
      return out.flat();
    };

    const css = await fs.readFile('src/index.css', 'utf8');
    const defined = new Set([...css.matchAll(/^\s*\.([a-z-]+)\s*\{/gm)].map((m) => m[1]));

    const files = await walk('src');
    const used = new Set<string>();
    for (const file of files) {
      const body = await fs.readFile(file, 'utf8');
      for (const m of body.matchAll(/\bsafe-[a-z]+\b/g)) used.add(m[0]);
    }

    expect(used.size).toBeGreaterThan(0);
    expect([...used].filter((c) => !defined.has(c))).toEqual([]);
  });
});
