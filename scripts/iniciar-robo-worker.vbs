' Script silencioso para iniciar o Robô Worker Daemon do Gauchinho em background sem janela visível
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(currentDir)

WshShell.CurrentDirectory = projectDir
WshShell.Run "node """ & currentDir & "\robo-worker-daemon.mjs""", 0, False
