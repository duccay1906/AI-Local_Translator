Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\Works\XavisTech\AI_Translate"
WshShell.Run "C:\Windows\System32\cmd.exe /c D:\Works\XavisTech\AI_Translate\scripts\start_update_server.bat", 0, False