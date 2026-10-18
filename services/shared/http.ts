import express from 'express';
import type { Registry } from 'prom-client';

export function startControlServer(port: number, registry: Registry, configure?: (app: express.Express) => void): void {
  const app = express();
  app.use(express.json());
  app.get('/healthz', (_request, response) => response.status(200).json({ status: 'ok' }));
  app.get('/readyz', (_request, response) => response.status(200).json({ status: 'ready' }));
  app.get('/metrics', async (_request, response) => {
    response.set('Content-Type', registry.contentType);
    response.end(await registry.metrics());
  });
  configure?.(app);
  app.listen(port, () => console.log(JSON.stringify({ event: 'control_server_started', port })));
}
