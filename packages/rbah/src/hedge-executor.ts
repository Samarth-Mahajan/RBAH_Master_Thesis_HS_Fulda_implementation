export type AttemptRole = 'primary' | 'hedge';

export interface CancellableAttempt<T> {
  readonly result: Promise<T>;
  cancel(): void;
}

export interface HedgeExecution<T> {
  value: T;
  winner: AttemptRole;
  hedgeFired: boolean;
  cancelled?: AttemptRole;
}

export interface HedgeExecutorOptions<T> {
  primary: CancellableAttempt<T>;
  hedge?: () => CancellableAttempt<T>;
  thresholdMs?: number;
  allowHedge: () => boolean;
  onHedgeFired?: () => void;
  onHedgeSuppressed?: () => void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Races independent attempts, returning the first successful result and cancelling the loser. */
export async function executeHedge<T>(options: HedgeExecutorOptions<T>): Promise<HedgeExecution<T>> {
  const { primary, hedge, thresholdMs, allowHedge, onHedgeFired, onHedgeSuppressed } = options;
  if (!hedge || thresholdMs === undefined) return { value: await primary.result, winner: 'primary', hedgeFired: false };

  const first = await Promise.race([
    primary.result.then((value) => ({ kind: 'primary-result' as const, value })),
    primary.result.then(() => undefined, (error) => ({ kind: 'primary-error' as const, error })),
    sleep(thresholdMs).then(() => ({ kind: 'threshold' as const }))
  ]);
  if (first?.kind === 'primary-result') return { value: first.value, winner: 'primary', hedgeFired: false };
  if (first?.kind === 'primary-error') throw first.error;
  if (!allowHedge()) {
    onHedgeSuppressed?.();
    return { value: await primary.result, winner: 'primary', hedgeFired: false };
  }

  const duplicate = hedge();
  onHedgeFired?.();
  return new Promise<HedgeExecution<T>>((resolve, reject) => {
    let failures = 0;
    let firstError: unknown;
    const fail = (error: unknown) => {
      failures += 1;
      firstError ??= error;
      if (failures === 2) reject(firstError);
    };
    primary.result.then((value) => { duplicate.cancel(); resolve({ value, winner: 'primary', hedgeFired: true, cancelled: 'hedge' }); }, fail);
    duplicate.result.then((value) => { primary.cancel(); resolve({ value, winner: 'hedge', hedgeFired: true, cancelled: 'primary' }); }, fail);
  });
}
