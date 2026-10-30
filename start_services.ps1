# ZeniaOne Services Supervisor — Keeps both ngrok and uvicorn running
# Run: powershell -ExecutionPolicy Bypass -File start_services.ps1

$NgrokExe   = "C:\Users\kures\AppData\Roaming\npm\node_modules\ngrok\bin\ngrok.exe"
$NgrokUrl   = "nonperverse-bess-unplayfully.ngrok-free.dev"
$NgrokPort  = 8003
$BackendDir = "D:\zeniaOne-Voice-Assistant\zenaipex"
$HealthUrl  = "http://127.0.0.1:8003/health"

function Start-Ngrok {
    Write-Host "[NGROK] Starting tunnel..." -ForegroundColor Cyan
    $p = Start-Process -FilePath $NgrokExe `
        -ArgumentList "http", "--url=$NgrokUrl", "$NgrokPort" `
        -NoNewWindow -PassThru
    Start-Sleep 3
    Write-Host "[NGROK] PID $($p.Id)" -ForegroundColor Green
    return $p
}

function Start-Backend {
    Write-Host "[BACKEND] Starting uvicorn..." -ForegroundColor Cyan
    $p = Start-Process -FilePath "python" `
        -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003" `
        -WorkingDirectory $BackendDir `
        -NoNewWindow -PassThru
    Start-Sleep 4
    Write-Host "[BACKEND] PID $($p.Id)" -ForegroundColor Green
    return $p
}

function Test-Health {
    try {
        $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        return $r.StatusCode -eq 200
    } catch { return $false }
}

function Test-NgrokUp {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:4040/api/tunnels" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        return $r.StatusCode -eq 200
    } catch { return $false }
}

# Kill any existing processes on port 8003 and old ngrok instances
Write-Host "[INIT] Cleaning up old processes..." -ForegroundColor Yellow
Get-Process -Name "ngrok" -ErrorAction SilentlyContinue | Stop-Process -Force
$used = Get-NetTCPConnection -LocalPort 8003 -State Listen -ErrorAction SilentlyContinue
if ($used) { Stop-Process -Id $used.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep 2

$ngrokProc   = Start-Ngrok
$backendProc = Start-Backend

Write-Host "[SUPERVISOR] Both services started. Watching..." -ForegroundColor Yellow

while ($true) {
    Start-Sleep 15

    # Check ngrok
    if (-not (Test-NgrokUp)) {
        Write-Host "[NGROK] DOWN — restarting..." -ForegroundColor Red
        try { Stop-Process -Id $ngrokProc.Id -Force -ErrorAction SilentlyContinue } catch {}
        $ngrokProc = Start-Ngrok
    }

    # Check backend
    if (-not (Test-Health)) {
        Write-Host "[BACKEND] DOWN — restarting..." -ForegroundColor Red
        try { Stop-Process -Id $backendProc.Id -Force -ErrorAction SilentlyContinue } catch {}
        Start-Sleep 2
        # Kill anything on 8003 leftover
        $used = Get-NetTCPConnection -LocalPort 8003 -State Listen -ErrorAction SilentlyContinue
        if ($used) { Stop-Process -Id $used.OwningProcess -Force -ErrorAction SilentlyContinue }
        Start-Sleep 1
        $backendProc = Start-Backend
    } else {
        Write-Host "[OK] $(Get-Date -Format 'HH:mm:ss') — Backend healthy, Ngrok up" -ForegroundColor DarkGreen
    }
}

