@echo off
title SINCRONIZADOR EN TIEMPO REAL ONEDRIVE - CONTROL DOCENTE - Copia.xlsx
color 0B
echo ============================================================================
echo   SINCRONIZADOR EN TIEMPO REAL CON ONEDRIVE - CONTROL DOCENTE UPN
echo   Cuenta vinculada: tayron.salinas@upn.edu.pe (CONTROL DOCENTE - Copia.xlsx)
echo   Web en vivo: https://steel-upn1.pages.dev
echo ============================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Add-Type -AssemblyName System.Windows.Forms; " ^
  "$up = [Environment]::GetFolderPath('UserProfile'); " ^
  "$candidates = @( " ^
  "  (Join-Path $up 'OneDrive - Universidad Privada del Norte\CONTROL DOCENTE - Copia.xlsx'), " ^
  "  (Join-Path $up 'OneDrive - EDUCORP PERU\CONTROL DOCENTE - Copia.xlsx'), " ^
  "  (Join-Path $up 'OneDrive\CONTROL DOCENTE - Copia.xlsx') " ^
  "); " ^
  "$target = $null; " ^
  "foreach ($c in $candidates) { if (Test-Path $c) { $target = $c; break } }; " ^
  "if (-not $target) { " ^
  "  Write-Host 'Selecciona tu archivo CONTROL DOCENTE - Copia.xlsx en tu carpeta OneDrive...' -ForegroundColor Cyan; " ^
  "  $dlg = New-Object System.Windows.Forms.OpenFileDialog; " ^
  "  $dlg.Title = 'Selecciona tu archivo CONTROL DOCENTE - Copia.xlsx en OneDrive'; " ^
  "  $dlg.Filter = 'Archivo Maestro Excel (*.xlsx)|*.xlsx'; " ^
  "  $dlg.FileName = 'CONTROL DOCENTE - Copia.xlsx'; " ^
  "  $dlg.InitialDirectory = $up; " ^
  "  if ($dlg.ShowDialog() -eq 'OK') { $target = $dlg.FileName } else { $target = Join-Path (Get-Location) 'CONTROL DOCENTE.xlsx' }; " ^
  "}; " ^
  "Write-Host ('--> Archivo Excel vinculado en tiempo real:') -ForegroundColor Green; " ^
  "Write-Host ('    ' + $target) -ForegroundColor Yellow; " ^
  "Write-Host ''; " ^
  "Write-Host 'Escuchando cambios en https://steel-upn1.pages.dev cada 4 segundos...' -ForegroundColor Cyan; " ^
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
  "        Write-Host ('[' + $now + '] CONTROL DOCENTE - Copia.xlsx actualizado automaticamente en OneDrive!') -ForegroundColor Green; " ^
  "      } " ^
  "      Remove-Item $tmp -Force -ErrorAction SilentlyContinue; " ^
  "    } " ^
  "  } catch { " ^
  "    $now = (Get-Date).ToString('HH:mm:ss'); " ^
  "    Write-Host ('[' + $now + '] Archivo abierto en Excel Desktop o esperando conexion... reintentando en 4s') -ForegroundColor DarkYellow; " ^
  "  } " ^
  "  Start-Sleep -Seconds 4; " ^
  "}"
