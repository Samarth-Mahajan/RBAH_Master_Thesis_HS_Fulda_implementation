# Architecture

`OrderService` owns the client-side policy and calls the Kubernetes `pricing` Service over gRPC. Pricing calls Inventory over gRPC. All Order deployments use the same image and differ only in `HEDGE_STRATEGY` configuration.

The RBAH policy uses the P95 of its most recent 200 successful checkout latencies after a 50-request warm-up. Its bucket begins empty, has a capacity of ten, and earns 0.1 token per eligible completed request. Beginning empty makes the total hedge budget never exceed 10% of eligible traffic.

The original and hedge are independent gRPC unary calls to the same Kubernetes Service. The first successful response is returned and the losing client call invokes `.cancel()`, which sends gRPC cancellation on the HTTP/2 stream. The Order-side request metric is the authoritative record that cancellation was issued; Pricing's observed-cancellation metric is supplementary network evidence and can be delayed or absent if the response completes first.

The Kubernetes Service may route both calls to the same Pricing replica. This is intentional and must remain in the thesis limitations.
