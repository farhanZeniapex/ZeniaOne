@echo off
title ZeniaOne Render Keep-Alive Pinger
echo ========================================================
echo  Starting ZeniaOne Smart Keep-Alive (Runs Every 8 Mins)
echo  Keeps https://zeniaone-backend.onrender.com warm!
echo ========================================================
python "%~dp0keep_alive_pinger.py"
pause

