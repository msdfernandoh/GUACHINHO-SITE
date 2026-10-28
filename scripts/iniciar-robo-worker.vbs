' Script silencioso para iniciar o Robô Worker Daemon do Gauchinho em background sem janela visível
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(currentDir)
nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then
  nodeExe = "node"
End If

WshShell.CurrentDirectory = projectDir
WshShell.Run """" & nodeExe & """ """ & currentDir & "\robo-worker-daemon.mjs""", 0, False
