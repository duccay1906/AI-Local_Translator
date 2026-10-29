' Script chay ngam Server cap nhat LAN 192.168.1.12:8080 khong hien cua so den CMD
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

batPath = scriptDir & "\start_update_server.bat"

WshShell.CurrentDirectory = projectDir
WshShell.Run "cmd.exe /c """ & batPath & """", 0, False
