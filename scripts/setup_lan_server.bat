@echo off
chcp 65001 >nul
echo =====================================================================
echo   CAU HINH MAY CHU GPU LAN - AI LOCAL TRANSLATOR (LM STUDIO SERVER)
echo =====================================================================
echo.

:: 1. Mo cong Firewall TCP 1234 (Can quyen Administrator)
echo [1/4] Dang mo cong TCP 1234 tren Windows Firewall cho mang LAN...
netsh advfirewall firewall delete rule name="LM Studio LAN Server (TCP 1234)" >nul 2>&1
netsh advfirewall firewall add rule name="LM Studio LAN Server (TCP 1234)" dir=in action=allow protocol=TCP localport=1234 >nul 2>&1
if %errorlevel% equ 0 (
    echo       -^> Da mo cong Firewall 1234 thanh cong!
) else (
    echo       -^> [Luu y] Hay chuot phai vao file nay chon "Run as administrator" de mo Firewall!
)

:: 2. Cai dat script tu khoi dong khi bat may chu
echo [2/4] Dang cai dat Auto-Start khi khoi dong Windows...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
copy /Y "%~dp0autostart_lan_server.vbs" "%STARTUP_FOLDER%\autostart_lan_server.vbs" >nul
echo       -^> Da copy autostart_lan_server.vbs vao Startup!

:: 3. Khoi dong ngay LM Studio Server o che do LAN (0.0.0.0:1234)
echo [3/4] Dang khoi dong LM Studio LAN Server (--bind 0.0.0.0 --port 1234 --cors)...
cscript //nologo "%~dp0autostart_lan_server.vbs"
echo       -^> Da bat LM Studio Server va nap Model vao GPU!

:: 4. Hien thi dia chi IP LAN cua may chu
echo.
echo [4/4] HOAN TAT! Tren cac may tram (Client) trong mang LAN, hay nhap URL sau vao Settings:
echo ---------------------------------------------------------------------
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address" /C:"IPv4"') do (
    for /f "tokens=* delims= " %%b in ("%%a") do (
        echo   👉  http://%%b:1234
    )
)
echo ---------------------------------------------------------------------
echo.
pause
