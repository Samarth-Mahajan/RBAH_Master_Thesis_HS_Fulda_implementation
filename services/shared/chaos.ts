export type ChaosMode = 'none' | 'constant' | 'intermittent';

export interface ChaosProfile {
  mode: ChaosMode;
  delayMs: number;
  probability: number;
  failureProbability: number;
}

export class ChaosController {
  private profile: ChaosProfile = { mode: 'none', delayMs: 0, probability: 1, failureProbability: 0 };

  public set(next: Partial<ChaosProfile>): ChaosProfile {
    const mode = next.mode ?? this.profile.mode;
    const delayMs = next.delayMs ?? this.profile.delayMs;
    const probability = next.probability ?? this.profile.probability;
    const failureProbability = next.failureProbability ?? this.profile.failureProbability;
    if (!['none', 'constant', 'intermittent'].includes(mode) || delayMs < 0 || probability < 0 || probability > 1 || failureProbability < 0 || failureProbability > 1) {
      throw new Error('invalid chaos profile');
    }
    this.profile = { mode: mode as ChaosMode, delayMs, probability, failureProbability };
    return this.get();
  }

  public get(): ChaosProfile { return { ...this.profile }; }

  public async apply(): Promise<void> {
    const { mode, delayMs, probability, failureProbability } = this.profile;
    if (failureProbability > 0 && Math.random() < failureProbability) throw new Error('injected failure');
    if (mode !== 'none' && Math.random() < probability && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
