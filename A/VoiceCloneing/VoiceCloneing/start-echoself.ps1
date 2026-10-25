$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $Python)) {
    throw "Virtual environment not found. Create it with: py -3.11 -m venv .venv"
}

$Cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $Cloudflared) {
    Write-Host "Cloudflare Tunnel is not installed." -ForegroundColor Yellow
    Write-Host "Install it with: winget install --id Cloudflare.cloudflared --exact"
    Write-Host "EchoSelf will still start locally."
}

try {
    Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null
} catch {
    $Ollama = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
    if (-not (Test-Path -LiteralPath $Ollama)) { throw "Ollama is not installed." }
    Start-Process -FilePath $Ollama -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

$Server = Start-Process -FilePath $Python `
    -ArgumentList "-m", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000" `
    -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru

try {
    Start-Sleep -Seconds 3
    $Status = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/status" -TimeoutSec 5
    Write-Host "EchoSelf is running at http://127.0.0.1:8000" -ForegroundColor Green
    Write-Host "Speech provider: $($Status.provider)"
    Write-Host "Exotel stream token is stored in: $ProjectRoot\data\exotel-stream-token.txt"

    if ($Cloudflared) {
        Write-Host "Starting a temporary public tunnel. Keep this window open." -ForegroundColor Cyan
        & $Cloudflared.Source tunnel --url http://localhost:8000
    } else {
        Write-Host "Install cloudflared, then rerun this script to receive a public URL." -ForegroundColor Yellow
        Wait-Process -Id $Server.Id
    }
} finally {
    if (-not $Server.HasExited) { Stop-Process -Id $Server.Id }
}
