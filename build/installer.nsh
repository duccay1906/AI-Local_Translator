!macro customCheckAppRunning
  DetailPrint "Ensuring existing AI Local Translator instances are closed..."
  nsExec::Exec `taskkill /F /T /IM "AI Local Translator.exe"`
  Sleep 1000
!macroend
