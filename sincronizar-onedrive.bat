@echo off
title SINCRONIZADOR EN TIEMPO REAL ONEDRIVE - CONTROL DOCENTE UPN
color 0B
echo ============================================================================
echo   SINCRONIZADOR EN TIEMPO REAL CON ONEDRIVE - CONTROL DOCENTE UPN
echo   Web en vivo: https://steel-upn1.pages.dev
echo ============================================================================
echo.
echo Se abrira una ventana para que selecciones tu archivo CONTROL DOCENTE.xlsx
echo dentro de tu carpeta de OneDrive (o deja vacio para usar el de esta carpeta).
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Add-Type -AssemblyName System.Windows.Forms; " ^
  "$dlg = New-Object System.Windows.Forms.OpenFileDialog; " ^
  "$dlg.Title = 'Selecciona tu archivo CONTROL DOCENTE.xlsx en tu carpeta OneDrive'; " ^
  "$dlg.Filter = 'Archivo Maestro Excel (*.xlsx)|*.xlsx'; " ^
  "$dlg.InitialDirectory = [Environment]::GetFolderPath('UserProfile'); " ^
  "if ($dlg.ShowDialog() -eq 'OK') { $target = $dlg.FileName } else { $target = Join-Path (Get-Location) 'CONTROL DOCENTE.xlsx' }; " ^
  "Write-Host ('--> Archivo Excel vinculado en tiempo real:') -ForegroundColor Green; " ^
  "Write-Host ('    ' + $target) -ForegroundColor Yellow; " ^
  "Write-Host ''; " ^
  "Write-Host 'Escuchando cambios en https://steel-upn1.pages.dev cada 4 segundos...' -ForegroundColor Cyan; " ^
  "Write-Host '(Nota: Manten el Excel cerrado en escritorio mientras se actualiza para evitar bloqueo de archivo)' -ForegroundColor Gray; " ^
  "Write-Host ''; " ^
  "$lastHash = ''; " ^
  "while ($true) { " ^
  "  try { " ^
  "    $tmp = $target + '.tmp'; " ^
  "    Invoke-WebRequest -Uri 'https://steel-upn1.pages.dev/api/export-excel' -OutFile $tmp -UseBasicParsing -TimeoutSec 20; " ^
  "    if (Test-Path $tmp) { " ^
  "      $h = (Get-FileHash $tmp -Algorithm SHA256).Hash; " ^
  "      if ($h -ne $lastHash) { " ^
  "        Copy-Item -Path $tmp -Destination $target -Force -ErrorAction Stop; " ^
  "        $lastHash = $h; " ^
  "        $now = (Get-Date).ToString('HH:mm:ss'); " ^
  "        Write-Host ('[' + $now + '] Excel de OneDrive actualizado automaticamente con exito!') -ForegroundColor Green; " ^
  "      } " ^
  "      Remove-Item $tmp -Force -ErrorAction SilentlyContinue; " ^
  "    } " ^
  "  } catch { " ^
  "    $now = (Get-Date).ToString('HH:mm:ss'); " ^
  "    Write-Host ('[' + $now + '] Archivo abierto en Excel o esperando conexion... reintentando en 4s') -ForegroundColor DarkYellow; " ^
  "  } " ^
  "  Start-Sleep -Seconds 4; " ^
  "}"
