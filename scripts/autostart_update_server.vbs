' Script chay ngam Server cap nhat LAN 192.168.1.12:8080 khong hien cua so den CMD
Set WshShell = CreateObject("WScript.Shell")
projectDir = "D:\Works\XavisTech\AI_Translate"
batPath = projectDir & "\scripts\start_update_server.bat"

WshShell.CurrentDirectory = projectDir
WshShell.Run "cmd.exe /c """ & batPath & """", 0, False
