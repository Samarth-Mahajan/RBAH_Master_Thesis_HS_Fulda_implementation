import { Counter, Gauge, Histogram } from 'prom-client';
import { executeHedge, RollingPercentileWindow, TokenBucket } from '../../../packages/rbah/src/index.js';
import { startGrpcServer, unaryCall } from '../../shared/grpc.js';
import { startControlServer } from '../../shared/http.js';
import { log, nowMs, createRegistry } from '../../shared/observability.js';
import { checkout, grpc } from '../../shared/proto.js';

type Strategy = 'none' | 'static' | 'rbah';
const strategy = (process.env.HEDGE_STRATEGY ?? 'none') as Strategy;
if (!['none', 'static', 'rbah'].includes(strategy)) throw new Error('HEDGE_STRATEGY must be none, static, or rbah');
const grpcPort = Number(process.env.ORDER_GRPC_PORT ?? 50051);
const httpPort = Number(process.env.ORDER_HTTP_PORT ?? 8080);
const staticDelayMs = Number(process.env.STATIC_HEDGE_DELAY_MS ?? 50);
const window = new RollingPercentileWindow(Number(process.env.RBAH_WINDOW_SIZE ?? 200));
const warmup = Number(process.env.RBAH_WARMUP_REQUESTS ?? 50);
// Starting empty makes the 10% bound hold from the first request; warm-up traffic earns the initial tokens.
const bucket = new TokenBucket(Number(process.env.RBAH_TOKEN_CAPACITY ?? 10), Number(process.env.RBAH_REFILL_PER_REQUEST ?? 0.1), 0);
const pricing = new checkout.PricingService(process.env.PRICING_GRPC_ADDRESS ?? 'localhost:50052', grpc.credentials.createInsecure());
const registry = createRegistry('order');
const requestDuration = new Histogram({ name: 'rbah_checkout_duration_ms', help: 'End-to-end checkout latency', labelNames: ['strategy'], buckets: [5, 10, 25, 50, 75, 100, 150, 250, 500, 1000], registers: [registry] });
const hedges = new Counter({ name: 'rbah_hedge_attempts_total', help: 'Duplicate Pricing requests attempted', labelNames: ['strategy'], registers: [registry] });
const suppressed = new Counter({ name: 'rbah_hedges_suppressed_total', help: 'Hedges blocked by token bucket', registers: [registry] });
const cancellations = new Counter({ name: 'rbah_loser_cancellations_requested_total', help: 'Cancellation requests made for a losing attempt', labelNames: ['role'], registers: [registry] });
const thresholdGauge = new Gauge({ name: 'rbah_adaptive_threshold_ms', help: 'Current configured hedge threshold', labelNames: ['strategy'], registers: [registry] });
const tokenGauge = new Gauge({ name: 'rbah_token_bucket_tokens', help: 'Available RBAH hedge tokens', registers: [registry] });

function attempt(request: any, role: 'primary' | 'hedge') {
  const metadata = new grpc.Metadata();
  metadata.set('x-rbah-attempt', role);
  return unaryCall<any>((callback) => pricing.calculatePrice(request, metadata, callback));
}

function threshold(): number | undefined {
  if (strategy === 'static') return staticDelayMs;
  if (strategy === 'rbah' && window.size >= warmup) return window.percentile(95);
  return undefined;
}

const server = new grpc.Server();
server.addService(checkout.OrderService.service, {
  PlaceOrder: async (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    const request = { ...call.request, request_id: call.request.request_id || crypto.randomUUID() };
    const started = nowMs();
    const delay = threshold();
    if (delay !== undefined) thresholdGauge.labels(strategy).set(delay);
    tokenGauge.set(bucket.tokens);
    try {
      const outcome = await executeHedge({
        primary: attempt(request, 'primary'),
        hedge: () => attempt(request, 'hedge'),
        thresholdMs: delay,
        allowHedge: () => strategy === 'static' || bucket.tryConsume(),
        onHedgeFired: () => hedges.labels(strategy).inc(),
        onHedgeSuppressed: () => suppressed.inc()
      });
      const elapsedMs = nowMs() - started;
      window.add(elapsedMs);
      if (strategy === 'rbah') bucket.completeEligibleRequest();
      tokenGauge.set(bucket.tokens);
      if (outcome.cancelled) cancellations.labels(outcome.cancelled).inc();
      requestDuration.labels(strategy).observe(elapsedMs);
      const response = { ...outcome.value, hedge_strategy: strategy, hedge_fired: outcome.hedgeFired, winner: outcome.winner, elapsed_ms: elapsedMs };
      log('checkout_completed', { requestId: request.request_id, strategy, thresholdMs: delay, hedgeFired: outcome.hedgeFired, winner: outcome.winner, cancelled: outcome.cancelled, elapsedMs, pricingReplica: response.pricing_replica });
      callback(null, response);
    } catch (error) {
      if (strategy === 'rbah') bucket.completeEligibleRequest();
      tokenGauge.set(bucket.tokens);
      log('checkout_failed', { requestId: request.request_id, strategy, error: String(error) });
      callback({ code: grpc.status.UNAVAILABLE, message: String(error) });
    }
  }
});

startControlServer(httpPort, registry, (app) => app.get('/rbah/state', (_req, res) => res.json({ strategy, windowSize: window.size, thresholdMs: threshold(), tokens: bucket.tokens, warmup })));
startGrpcServer(server, grpcPort, 'order').catch((error) => { console.error(error); process.exit(1); });
