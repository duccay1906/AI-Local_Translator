@echo off
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SCRIPT_SRC=%~dp0autostart_ai_translate.vbs"

echo [1/2] Installing Auto-Start for LM Studio and AI Local Translator...
copy /Y "%SCRIPT_SRC%" "%STARTUP_FOLDER%\autostart_ai_translate.vbs" >nul

if %errorlevel% equ 0 (
    echo [2/2] Setup Successful!
    echo.
    echo When your PC boots up:
    echo  - LM Studio Server will start automatically on port 1234
    echo  - Model will be pre-loaded into GPU VRAM
    echo  - AI Local Translator will start and be ready for F8 translation!
    echo.
) else (
    echo [Error] Could not copy script to Startup folder.
)
pause