' ===================================================================
' LM Studio LAN Server Auto-Start Script (For Dedicated GPU Server PC)
' ===================================================================
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

userProfile = WshShell.ExpandEnvironmentStrings("%USERPROFILE%")
localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")

' Duong dan cong cu CLI lms cua LM Studio
lmsExe = userProfile & "\.lmstudio\bin\lms.exe"

' Model muon tu dong nap vao GPU VRAM (ho tro gemma-4-e4b hoac gemma-3-4b-it-qat)
modelName = "google/gemma-4-e4b"

If fso.FileExists(lmsExe) Then
    ' 1. Dung server cu neu dang chay o che do localhost 127.0.0.1
    WshShell.Run """" & lmsExe & """ server stop", 0, True

    ' 2. Khoi dong LM Studio Server mo cong LAN (--bind 0.0.0.0 --port 1234 --cors)
    WshShell.Run """" & lmsExe & """ server start --bind 0.0.0.0 --port 1234 --cors", 0, True

    ' 3. Tu dong nap Model vao GPU VRAM voi --parallel 4 de nhieu nguoi trong LAN dich cung luc
    WshShell.Run """" & lmsExe & """ load " & modelName & " --gpu max --parallel 4 -y", 0, True
End If
