param(
  [ValidateSet('pricing','inventory')][string]$Service = 'pricing',
  [ValidateSet('none','constant','intermittent')][string]$Mode = 'constant',
  [int]$DelayMs = 150,
  [double]$Probability = 1.0,
  [double]$FailureProbability = 0.0,
  [string]$PodName
)

$ErrorActionPreference = 'Stop'
if (-not $PodName) { $PodName = kubectl -n rbah get pod -l "app=$Service" -o jsonpath='{.items[0].metadata.name}' }
$body = @{ mode = $Mode; delayMs = $DelayMs; probability = $Probability; failureProbability = $FailureProbability } | ConvertTo-Json -Compress
$forward = Start-Process kubectl -ArgumentList @('-n','rbah','port-forward',"pod/$PodName",'18080:8080') -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Milliseconds 750
  Invoke-RestMethod -Method Post -Uri 'http://localhost:18080/chaos/profile' -ContentType 'application/json' -Body $body
} finally {
  Stop-Process -Id $forward.Id -Force
}
