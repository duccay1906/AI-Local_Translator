' ===================================================================
' AI Local Translator and LM Studio Auto-Start Script for Windows Boot
' ===================================================================
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

userProfile = WshShell.ExpandEnvironmentStrings("%USERPROFILE%")
localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")

' Duong dan cong cu CLI lms cua LM Studio
lmsExe = userProfile & "\.lmstudio\bin\lms.exe"

' Model muon tu dong nap vao VRAM khi khoi dong Windows
modelName = "gemma-3-4b-it-qat"

' 1. Khoi dong LM Studio Local Server (Chay ngam hoan toan, 0 cua so den)
If fso.FileExists(lmsExe) Then
    WshShell.Run """" & lmsExe & """ server start", 0, True
    ' 2. Tu dong nap Model vao GPU VRAM
    WshShell.Run """" & lmsExe & """ load " & modelName & " --gpu max -y", 0, True
End If

' (Tuy chon) Bo dau nhay don o dau dong duoi neu ban muon mo ca giao dien do hoa LM Studio:
' lmStudioGui = "C:\Program Files\LM Studio\LM Studio.exe"
' If fso.FileExists(lmStudioGui) Then WshShell.Run """" & lmStudioGui & """", 1, False

' 3. Khoi dong ung dung AI Local Translator
appInstalled = localAppData & "\Programs\ai-local-translator\AI Local Translator.exe"
appPortable = "D:\Works\XavisTech\AI_Translate\release\AI Local Translator 1.0.1.exe"

If fso.FileExists(appInstalled) Then
    WshShell.Run """" & appInstalled & """", 1, False
ElseIf fso.FileExists(appPortable) Then
    WshShell.Run """" & appPortable & """", 1, False
End If