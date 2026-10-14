import { describe, expect, it } from 'vitest';
import { Rng } from './rng.js';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('can resume from a saved seed', () => {
    const a = new Rng(7);
    a.next();
    const resumed = new Rng(a.seed);
    expect(resumed.next()).toBe(a.next());
  });

  it('keeps int() within bounds', () => {
    const rng = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(3, 8);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(8);
    }
  });
});
