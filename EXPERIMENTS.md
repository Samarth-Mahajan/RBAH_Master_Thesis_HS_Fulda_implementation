# Experiment protocol

1. Run a healthy pilot, choose the static threshold, put the final value into `infra/k8s/orders.yaml`, and do not change it during the comparison.
2. Deploy once, wait for all Pods to be ready, and warm every Order strategy with at least 50 successful requests.
3. Apply exactly one profile from `experiments.json`. For Pricing faults, target one named Pricing Pod with `scripts/set-chaos.ps1`; record that Pod name. For the shared Inventory case, apply the same fault to every Inventory Pod.
4. Randomize the order of `none`, `static`, and `rbah`; run each profile/condition combination ten times with identical ghz request count, concurrency, and RPS.
5. Save ghz output and metadata with `scripts/run-experiment.ps1`. Export the relevant Prometheus range query or CSV into the same run directory before resetting chaos.
6. Compare trial medians and spread for P50/P95/P99, throughput, hedge volume, hedge wins, cancellation requested/observed, and RBAH token state.

Expected outcomes: replica-local Pricing delay is the primary tail-latency test. Shared Inventory delay is a safety test: both calls may inherit the bottleneck, so bounded hedge volume is the success criterion rather than an expected latency improvement.
