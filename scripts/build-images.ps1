param([string]$ClusterName = 'rbah')

$ErrorActionPreference = 'Stop'
foreach ($service in 'order', 'pricing', 'inventory') {
  docker build --build-arg "SERVICE=$service" -t "rbah-$service`:dev" .
  kind load docker-image "rbah-$service`:dev" --name $ClusterName
}
