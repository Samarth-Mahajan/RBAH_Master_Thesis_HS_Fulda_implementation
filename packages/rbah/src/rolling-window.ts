/** Fixed-size numeric ring buffer with a nearest-rank percentile. */
export class RollingPercentileWindow {
  private readonly values: number[] = [];

  public constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('capacity must be a positive integer');
  }

  public add(value: number): void {
    if (!Number.isFinite(value) || value < 0) throw new Error('latency must be a finite non-negative number');
    if (this.values.length === this.capacity) this.values.shift();
    this.values.push(value);
  }

  public get size(): number { return this.values.length; }

  public percentile(percentile: number): number | undefined {
    if (this.values.length === 0) return undefined;
    if (percentile <= 0 || percentile > 100) throw new Error('percentile must be in (0, 100]');
    const sorted = [...this.values].sort((a, b) => a - b);
    return sorted[Math.ceil((percentile / 100) * sorted.length) - 1];
  }
}
