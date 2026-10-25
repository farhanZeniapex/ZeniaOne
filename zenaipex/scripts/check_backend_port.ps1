$port = 8002
$tcp = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if ($tcp) {
    $processId = $tcp.OwningProcess
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    $cim = Get-CimInstance Win32_Process -Filter "ProcessId=$processId" -ErrorAction SilentlyContinue
    
    Write-Host "[BACKEND_PORT]"
    Write-Host "port=$port"
    Write-Host "status=LISTENING"
    Write-Host "pid=$processId"
    if ($process) {
        Write-Host "process=$($process.ProcessName)"
    }
    if ($cim) {
        Write-Host "command=$($cim.CommandLine)"
    }
} else {
    Write-Host "[BACKEND_PORT]"
    Write-Host "port=$port"
    Write-Host "status=FREE"
}
