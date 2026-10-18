# Decisions

| Decision | Chosen approach | Rationale |
| --- | --- | --- |
| Runtime | TypeScript on Node.js | Fast implementation while gRPC provides HTTP/2 stream cancellation. |
| Hedge scope | Order → Pricing only | One controlled decision point keeps causality interpretable. |
| Routing | Standard Kubernetes ClusterIP Service | Matches production-like service routing; same-replica routing is documented. |
| Static baseline | 50 ms initially | Replace with the healthy pilot-derived frozen value before final data collection. |
| RBAH window | 200 samples, warm-up 50 | Stable default; record sensitivity analysis separately if run. |
| Bound | capacity 10, refill 0.1/request, zero initial tokens | Limits the total hedge volume to 10% from startup. |

Do not alter a parameter independently for one strategy in a comparison run. Record every change in the experiment directory and thesis methodology.
