@echo off
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

echo Removing Auto-Start...
if exist "%STARTUP_FOLDER%\autostart_ai_translate.vbs" (
    del /f /q "%STARTUP_FOLDER%\autostart_ai_translate.vbs"
    echo Auto-Start removed successfully!
) else (
    echo No auto-start configuration found in Startup folder.
)
pause