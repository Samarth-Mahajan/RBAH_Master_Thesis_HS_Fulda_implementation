import { collectDefaultMetrics, Registry } from 'prom-client';

export function createRegistry(service: string): Registry {
  const registry = new Registry();
  registry.setDefaultLabels({ service });
  collectDefaultMetrics({ register: registry });
  return registry;
}

export const nowMs = (): number => Number(process.hrtime.bigint()) / 1_000_000;

export function log(event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), event, ...fields }));
}
