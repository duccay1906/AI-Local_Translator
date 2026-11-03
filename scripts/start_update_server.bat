@echo off
title AI Local Translator - LAN Web and Update Server (192.168.1.12:8080)
cd /d "%~dp0\.."

echo ===================================================
echo   AI Local Translator - LAN Web and Update Server
echo   Listening on: http://0.0.0.0:8080/
echo ===================================================
echo.

if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" scripts/serve-updates.js
) else (
    node scripts/serve-updates.js
)
pause
