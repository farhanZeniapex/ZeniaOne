$port = 8002
$tcp = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if ($tcp) {
    $processId = $tcp.OwningProcess
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    
    if ($cim -and $cim.CommandLine -match "uvicorn main:app") {
        Write-Host "Found existing ZeniaOne backend (PID: $processId). Stopping it safely..."
        Stop-Process -Id $processId -Force
        Start-Sleep -Seconds 3
    } else {
        Write-Host "Warning: Port $port is in use by an unknown process (PID: $processId). Cannot start backend."
        exit 1
    }
}

Write-Host "Starting ZeniaOne backend and public webhook tunnel on port $port..."
# The supervisor starts/reuses ngrok before Uvicorn and restarts either side
# safely. Twilio/Exotel webhooks must reach the backend from the public internet.
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
python (Join-Path $repoRoot 'start_app.py')
