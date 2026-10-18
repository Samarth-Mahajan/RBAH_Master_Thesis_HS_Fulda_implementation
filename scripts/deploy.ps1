param([switch]$CreateCluster, [string]$ClusterName = 'rbah')

$ErrorActionPreference = 'Stop'
if ($CreateCluster) { kind create cluster --name $ClusterName --config infra/kind/rbah-kind.yaml }
& "$PSScriptRoot/build-images.ps1" -ClusterName $ClusterName
kubectl apply -k infra/k8s
kubectl -n rbah rollout status deployment/inventory
kubectl -n rbah rollout status deployment/pricing
kubectl -n rbah rollout status deployment/order-none
kubectl -n rbah rollout status deployment/order-static
kubectl -n rbah rollout status deployment/order-rbah

# After this succeeds, install kube-prometheus-stack, then apply the ServiceMonitors
# and Grafana dashboard using the commands in README.md.
