# Resource-Bounded Adaptive Hedging prototype

This repository implements the thesis demonstration: Order → Pricing → Inventory gRPC microservices, three comparable hedge strategies, per-Pod chaos endpoints, Prometheus metrics, Grafana panels, and ghz experiment scripts.

## Prerequisites

Install Docker Desktop with its WSL 2/Linux-container backend, then install `kubectl`, Kind, Helm, and ghz. Verify `docker version`, `kubectl version --client`, `kind version`, `helm version`, and `ghz --help` from PowerShell. Docker Desktop must be running before cluster creation.

Install project dependencies with `npm install`, then validate with:

```powershell
npm run build
npm test
```

## Local cluster

```powershell
./scripts/deploy.ps1 -CreateCluster
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack -n monitoring --create-namespace -f infra/monitoring-values.yaml
kubectl apply -f infra/k8s/servicemonitors.yaml
kubectl apply -f infra/grafana/rbah-dashboard.yaml
```

For a local smoke call, port-forward `order-none` and run ghz with the same proto/call/data arguments used in `scripts/run-experiment.ps1`.

## Chaos and evaluation

Slow one Pricing Pod: `./scripts/set-chaos.ps1 -Service pricing -Mode intermittent -DelayMs 150 -Probability 0.3 -PodName <pricing-pod>`. Reset it with `-Mode none -DelayMs 0`. Then run a stored trial, for example: `./scripts/run-experiment.ps1 -Mode rbah -Run 1`.

See [ARCHITECTURE.md](ARCHITECTURE.md), [DECISIONS.md](DECISIONS.md), and [EXPERIMENTS.md](EXPERIMENTS.md) before collecting final thesis data.
