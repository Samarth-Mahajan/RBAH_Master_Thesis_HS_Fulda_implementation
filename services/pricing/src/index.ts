import { Counter, Histogram } from 'prom-client';
import { ChaosController } from '../../shared/chaos.js';
import { startGrpcServer, unaryCall } from '../../shared/grpc.js';
import { startControlServer } from '../../shared/http.js';
import { createRegistry, log, nowMs } from '../../shared/observability.js';
import { checkout, grpc } from '../../shared/proto.js';

const replica = process.env.HOSTNAME ?? 'pricing-local';
const grpcPort = Number(process.env.PRICING_GRPC_PORT ?? 50052);
const httpPort = Number(process.env.PRICING_HTTP_PORT ?? 8080);
const inventory = new checkout.InventoryService(process.env.INVENTORY_GRPC_ADDRESS ?? 'localhost:50053', grpc.credentials.createInsecure());
const chaos = new ChaosController();
const registry = createRegistry('pricing');
const cancellations = new Counter({ name: 'rbah_server_cancellations_observed_total', help: 'Client cancellation events observed by Pricing', registers: [registry] });
const duration = new Histogram({ name: 'rbah_pricing_duration_ms', help: 'Pricing RPC duration', buckets: [5, 25, 50, 100, 250, 500, 1000], registers: [registry] });

const server = new grpc.Server();
server.addService(checkout.PricingService.service, {
  CalculatePrice: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    const started = nowMs();
    let cancelled = false;
    let completed = false;
    const finish: grpc.sendUnaryData<any> = (error, response) => { completed = true; callback(error, response); };
    call.once('cancelled', () => {
      cancelled = true;
      if (!completed) {
        cancellations.inc();
        log('pricing_cancellation_observed', { requestId: call.request.request_id, replica });
      }
    });
    try {
      await chaos.apply();
      if (cancelled) return;
      const stock = await unaryCall<any>((done) => inventory.checkStock({ request_id: call.request.request_id, sku: call.request.sku, quantity: call.request.quantity }, done)).result;
      if (cancelled) return;
      if (!stock.available) return finish({ code: grpc.status.FAILED_PRECONDITION, message: 'stock unavailable' });
      const finalPrice = Number(call.request.base_price) * Number(call.request.quantity) * 1.19;
      duration.observe(nowMs() - started);
      finish(null, { request_id: call.request.request_id, pricing_replica: replica, inventory_replica: stock.inventory_replica, final_price: finalPrice });
    } catch (error) {
      finish({ code: grpc.status.UNAVAILABLE, message: String(error) });
    }
  }
});

startControlServer(httpPort, registry, (app) => {
  app.get('/chaos/state', (_req, res) => res.json({ replica, ...chaos.get() }));
  app.post('/chaos/profile', (req, res) => {
    try { const profile = chaos.set(req.body ?? {}); log('chaos_profile_changed', { replica, ...profile }); res.json({ replica, ...profile }); }
    catch (error) { res.status(400).json({ error: String(error) }); }
  });
});
startGrpcServer(server, grpcPort, 'pricing').catch((error) => { console.error(error); process.exit(1); });
