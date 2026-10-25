@echo off
echo ===================================================
echo Starting Zenaipex Backend and Localtunnel (Fixed URL)
echo ===================================================

echo [1] Starting Ngrok Tunnel (https://nonperverse-bess-unplayfully.ngrok-free.dev) ...
start "Ngrok" cmd /k "npx ngrok http --domain=nonperverse-bess-unplayfully.ngrok-free.dev 8002"

echo [2] Starting Python Backend ...
cd zenaipex
python -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload
