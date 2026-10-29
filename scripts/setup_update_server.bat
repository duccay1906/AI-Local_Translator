@echo off
chcp 65001 >nul
title THIET LAP MAY CHU CAP PHAT CAP NHAT LAN - AI LOCAL TRANSLATOR
echo =====================================================================
echo   CAU HINH MAY CHU CAP PHAT CAP NHAT LAN (PORT 8080)
echo =====================================================================
echo.

:: 1. Mo cong Firewall TCP 8080 (Can quyen Administrator)
echo [1/3] Dang mo cong TCP 8080 tren Windows Firewall cho mang LAN...
netsh advfirewall firewall delete rule name="AI Local Translator Update Server (TCP 8080)" >nul 2>&1
netsh advfirewall firewall add rule name="AI Local Translator Update Server (TCP 8080)" dir=in action=allow protocol=TCP localport=8080 >nul 2>&1
if %errorlevel% equ 0 (
    echo       -^> Da mo cong Firewall 8080 thanh cong!
) else (
    echo       -^> [Luu y] Hay chuot phai vao file nay chon "Run as administrator" neu muon mo Firewall tu dong!
)

:: 2. Cai dat script tu khoi dong server khi bat may chu
echo.
echo [2/3] Dang cai dat Auto-Start khi khoi dong Windows...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /Y "%~dp0autostart_update_server.vbs" "%STARTUP_FOLDER%\autostart_update_server.vbs" >nul
echo       -^> Da copy autostart_update_server.vbs vao Startup (Server se tu bat ngam moi khi mo may)!

:: 3. Khoi dong ngay Update Server
echo.
echo [3/3] Dang khoi dong Update Server...
start "" "%~dp0start_update_server.bat"
echo       -^> Server dang chay tren cong 8080!

echo.
echo =====================================================================
echo HOAN TAT! Dia chi kiem tra cap nhat cho cac may trong mang LAN:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address" /C:"IPv4"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do (
        echo   👉  http://%%b:8080/updates/version.json
    )
)
echo =====================================================================
echo.
pause
