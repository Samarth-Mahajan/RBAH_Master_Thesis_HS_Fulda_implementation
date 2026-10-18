import { Counter } from 'prom-client';
import { ChaosController } from '../../shared/chaos.js';
import { startGrpcServer } from '../../shared/grpc.js';
import { startControlServer } from '../../shared/http.js';
import { createRegistry, log } from '../../shared/observability.js';
import { checkout, grpc } from '../../shared/proto.js';

const replica = process.env.HOSTNAME ?? 'inventory-local';
const grpcPort = Number(process.env.INVENTORY_GRPC_PORT ?? 50053);
const httpPort = Number(process.env.INVENTORY_HTTP_PORT ?? 8080);
const chaos = new ChaosController();
const registry = createRegistry('inventory');
const cancellations = new Counter({ name: 'rbah_inventory_cancellations_observed_total', help: 'Cancellation events observed by Inventory', registers: [registry] });
const server = new grpc.Server();
server.addService(checkout.InventoryService.service, {
  CheckStock: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    let cancelled = false;
    let completed = false;
    const finish: grpc.sendUnaryData<any> = (error, response) => { completed = true; callback(error, response); };
    call.once('cancelled', () => { cancelled = true; if (!completed) cancellations.inc(); });
    try {
      await chaos.apply();
      if (!cancelled) finish(null, { request_id: call.request.request_id, inventory_replica: replica, available: true });
    } catch (error) { finish({ code: grpc.status.UNAVAILABLE, message: String(error) }); }
  }
});
startControlServer(httpPort, registry, (app) => {
  app.get('/chaos/state', (_req, res) => res.json({ replica, ...chaos.get() }));
  app.post('/chaos/profile', (req, res) => {
    try { const profile = chaos.set(req.body ?? {}); log('chaos_profile_changed', { replica, ...profile }); res.json({ replica, ...profile }); }
    catch (error) { res.status(400).json({ error: String(error) }); }
  });
});
startGrpcServer(server, grpcPort, 'inventory').catch((error) => { console.error(error); process.exit(1); });
