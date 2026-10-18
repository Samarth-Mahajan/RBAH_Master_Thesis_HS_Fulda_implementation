import { describe, expect, it } from 'vitest';
import { executeHedge, RollingPercentileWindow, TokenBucket } from '../src/index.js';

describe('RollingPercentileWindow', () => {
  it('keeps only the configured recent values', () => {
    const window = new RollingPercentileWindow(3);
    [10, 20, 30, 40].forEach((value) => window.add(value));
    expect(window.size).toBe(3);
    expect(window.percentile(95)).toBe(40);
    expect(window.percentile(50)).toBe(30);
  });
});

describe('TokenBucket', () => {
  it('bounds hedges and refills per eligible request', () => {
    const bucket = new TokenBucket(2, 0.1, 1);
    expect(bucket.tryConsume()).toBe(true);
    expect(bucket.tryConsume()).toBe(false);
    for (let i = 0; i < 10; i += 1) bucket.completeEligibleRequest();
    expect(bucket.tokens).toBeCloseTo(1);
  });
});

describe('executeHedge', () => {
  it('returns the hedge and cancels a slow primary', async () => {
    let primaryCancelled = false;
    const result = await executeHedge({
      primary: { result: new Promise<string>((resolve) => setTimeout(() => resolve('primary'), 50)), cancel: () => { primaryCancelled = true; } },
      hedge: () => ({ result: Promise.resolve('hedge'), cancel: () => undefined }),
      thresholdMs: 1,
      allowHedge: () => true
    });
    expect(result).toMatchObject({ value: 'hedge', winner: 'hedge', hedgeFired: true, cancelled: 'primary' });
    expect(primaryCancelled).toBe(true);
  });
});
