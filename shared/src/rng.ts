/**
 * Small seeded PRNG (mulberry32). Game state stores the seed so a game can be
 * replayed from its action log.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with the given probability. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Roughly normal value around 0 with the given spread (sum of uniforms). */
  noise(spread: number): number {
    return (this.next() + this.next() + this.next() - 1.5) * spread;
  }

  /** Current internal state, for saving. */
  get seed(): number {
    return this.state;
  }
}
