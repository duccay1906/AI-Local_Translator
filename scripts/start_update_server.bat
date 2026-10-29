@echo off
title AI Local Translator - LAN Update Server (192.168.1.12:8080)
cd /d "%~dp0\.."

echo ===================================================
echo   AI Local Translator - LAN Update Server
echo   Listening on: http://0.0.0.0:8080/updates
echo ===================================================
echo.

node scripts/serve-updates.js
pause
