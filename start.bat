@echo off
title ZeniaOne Voice Assistant & Tunnel Supervisor
echo ===================================================
echo   Starting ZeniaOne Backend and Ngrok Tunnel
echo   (Auto-restarts both if they crash)
echo ===================================================
cd /d D:\zeniaOne-Voice-Assistant
python start_app.py
pause
