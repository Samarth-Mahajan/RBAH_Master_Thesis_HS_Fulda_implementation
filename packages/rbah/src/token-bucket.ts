/** Token bucket refilled by completed eligible requests, not wall-clock time. */
export class TokenBucket {
  private available: number;

  public constructor(
    readonly capacity: number,
    readonly refillPerEligibleRequest: number,
    initialTokens = capacity
  ) {
    if (capacity <= 0 || refillPerEligibleRequest < 0 || initialTokens < 0) throw new Error('invalid token bucket configuration');
    this.available = Math.min(capacity, initialTokens);
  }

  public tryConsume(tokens = 1): boolean {
    if (tokens <= 0) throw new Error('tokens must be positive');
    if (this.available < tokens) return false;
    this.available -= tokens;
    return true;
  }

  public completeEligibleRequest(): void {
    this.available = Math.min(this.capacity, this.available + this.refillPerEligibleRequest);
  }

  public get tokens(): number { return this.available; }
}
