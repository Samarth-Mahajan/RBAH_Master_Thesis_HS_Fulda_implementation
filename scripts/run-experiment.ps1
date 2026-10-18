param(
  [ValidateSet('none','static','rbah')][string]$Mode,
  [int]$Run = 1,
  [int]$Requests = 2000,
  [int]$Concurrency = 30,
  [int]$Rate = 100
)

$ErrorActionPreference = 'Stop'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outDir = "results/$timestamp-$Mode-run$Run"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$forward = Start-Process kubectl -ArgumentList @('-n','rbah','port-forward',"svc/order-$Mode",'50051:50051') -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Milliseconds 1000
  ghz --insecure --proto proto/checkout.proto --call rbah.checkout.OrderService.PlaceOrder --data '{"sku":"SKU-1","quantity":1,"base_price":10}' --total $Requests --concurrency $Concurrency --rps $Rate --format json --output "$outDir/ghz.json" localhost:50051
  kubectl -n rbah get pods -o wide | Out-File "$outDir/pods.txt"
  kubectl version --client | Out-File "$outDir/kubectl-version.txt"
  @{ mode=$Mode; run=$Run; requests=$Requests; concurrency=$Concurrency; rate=$Rate; timestamp=$timestamp } | ConvertTo-Json | Out-File "$outDir/parameters.json"
} finally {
  Stop-Process -Id $forward.Id -Force
}
