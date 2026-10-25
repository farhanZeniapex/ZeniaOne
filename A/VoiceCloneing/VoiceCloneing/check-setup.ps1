$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$EnvFile = Join-Path $ProjectRoot ".env"
$EnvLines = if (Test-Path $EnvFile) { Get-Content -LiteralPath $EnvFile } else { @() }

$Checks = [ordered]@{
    "Python environment" = Test-Path -LiteralPath $Python
    "Ollama installed" = [bool](Get-Command ollama -ErrorAction SilentlyContinue)
    "Cloudflared installed" = [bool](Get-Command cloudflared -ErrorAction SilentlyContinue)
    "Sarvam key configured" = [bool]($EnvLines | Where-Object { $_ -match '^SARVAM_API_KEY=.+$' })
    "Sarvam voice created" = Test-Path (Join-Path $ProjectRoot "data\sarvam-voice.json")
}

$Checks.GetEnumerator() | ForEach-Object {
    $Label = if ($_.Value) { "READY" } else { "MISSING" }
    "{0,-26} {1}" -f $_.Key, $Label
}
