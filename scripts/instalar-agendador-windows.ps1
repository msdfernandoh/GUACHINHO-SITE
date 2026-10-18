<#
.SYNOPSIS
  Instalador da Automação do Robô Worker Daemon (Gauchinho Site / Consórcios).
#>

param(
  [switch]$Desinstalar
)

$ErrorActionPreference = "Continue"

$taskDaemonName = "Gauchinho-Robo-Worker-Daemon"
$projectDir = (Get-Item -Path "$PSScriptRoot\..").FullName
$startupFolder = [Environment]::GetFolderPath("Startup")
$shortcutPath = Join-Path $startupFolder "Gauchinho-Robo-Worker.lnk"
$vbsPath = Join-Path $PSScriptRoot "iniciar-robo-worker.vbs"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Gauchinho Consórcios - Automação do Robô (Windows)     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Diretório do Projeto : $projectDir" -ForegroundColor Gray
Write-Host "Pasta de Inicialização: $startupFolder" -ForegroundColor Gray
Write-Host "Modo Administrador    : $(if ($isAdmin) {'SIM'} else {'NÃO (Modo Usuário Padrão)'})" -ForegroundColor $(if ($isAdmin) {'Green'} else {'Yellow'})

if ($Desinstalar) {
  Write-Host "`n[1/2] Removendo atalho da Inicialização do Windows..." -ForegroundColor Yellow
  if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath -Force
    Write-Host "  OK: Atalho de inicialização removido." -ForegroundColor Green
  } else {
    Write-Host "  INFO: Atalho não encontrado." -ForegroundColor Gray
  }

  Write-Host "[2/2] Removendo tarefa agendada '$taskDaemonName'..." -ForegroundColor Yellow
  try {
    Unregister-ScheduledTask -TaskName $taskDaemonName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "  OK: Tarefa '$taskDaemonName' removida." -ForegroundColor Green
  } catch {
    Write-Host "  INFO: Tarefa não encontrada ou sem permissão." -ForegroundColor Gray
  }

  Write-Host "`nDesinstalação concluída com sucesso!" -ForegroundColor Green
  exit 0
}

Write-Host "`n[1/2] Configurando Inicialização Automática no Login..." -ForegroundColor Yellow

$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = $projectDir
$shortcut.Description = "Inicializador em background do Robô Worker Daemon (Gauchinho Site)"
$shortcut.Save()

Write-Host "  OK: Atalho criado em: $shortcutPath" -ForegroundColor Green

if ($isAdmin) {
  Write-Host "`n[2/2] Registrando Tarefa no Agendador do Windows..." -ForegroundColor Yellow

  $action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`"" -WorkingDirectory $projectDir
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 365) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

  Register-ScheduledTask -TaskName $taskDaemonName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
  Write-Host "  OK: Tarefa '$taskDaemonName' criada com sucesso no Agendador!" -ForegroundColor Green
} else {
  Write-Host "`n[2/2] Agendador de Tarefas do Windows (Opcional):" -ForegroundColor Gray
  Write-Host "  INFO: Para registrar como serviço do sistema no boot, execute este script como Administrador." -ForegroundColor Gray
  Write-Host "  INFO: A inicialização via Pasta Startup já está 100% ativa e pronta para o seu usuário." -ForegroundColor Green
}

Write-Host "`nInstalação concluída!" -ForegroundColor Green
Write-Host "Iniciando o worker agora em segundo plano..." -ForegroundColor Cyan
Start-Process "wscript.exe" -ArgumentList "`"$vbsPath`"" -WorkingDirectory $projectDir
Write-Host "Robô Worker Daemon rodando com sucesso!" -ForegroundColor Green
