@echo off
title SINCRONIZADOR BIDIRECCIONAL EN TIEMPO REAL - CONTROL DOCENTE - Copia.xlsx
color 0B
echo ============================================================================
echo   SINCRONIZADOR BIDIRECCIONAL EN TIEMPO REAL (24/7)
echo   Cuenta vinculada: tayron.salinas@upn.edu.pe (CONTROL DOCENTE - Copia.xlsx)
echo   Web en vivo     : https://control-doc.pages.dev
echo ============================================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Add-Type -AssemblyName System.Windows.Forms; " ^
  "$up = [Environment]::GetFolderPath('UserProfile'); " ^
  "$candidates = @( " ^
  "  (Join-Path $up 'OneDrive - Universidad Privada del Norte\CONTROL DOCENTE - Copia.xlsx'), " ^
  "  (Join-Path $up 'OneDrive - EDUCORP PERU\CONTROL DOCENTE - Copia.xlsx'), " ^
  "  (Join-Path $up 'OneDrive\CONTROL DOCENTE - Copia.xlsx'), " ^
  "  (Join-Path (Get-Location) 'CONTROL DOCENTE - Copia.xlsx') " ^
  "); " ^
  "$target = $null; " ^
  "foreach ($c in $candidates) { if (Test-Path $c) { $target = $c; break } }; " ^
  "if (-not $target) { " ^
  "  Write-Host 'Selecciona tu archivo CONTROL DOCENTE - Copia.xlsx (o cancela para usar CONTROL DOCENTE.xlsx)...' -ForegroundColor Cyan; " ^
  "  $dlg = New-Object System.Windows.Forms.OpenFileDialog; " ^
  "  $dlg.Title = 'Selecciona tu archivo CONTROL DOCENTE - Copia.xlsx en OneDrive'; " ^
  "  $dlg.Filter = 'Archivo Maestro Excel (*.xlsx)|*.xlsx'; " ^
  "  $dlg.FileName = 'CONTROL DOCENTE - Copia.xlsx'; " ^
  "  $dlg.InitialDirectory = $up; " ^
  "  if ($dlg.ShowDialog() -eq 'OK') { $target = $dlg.FileName } else { $target = Join-Path (Get-Location) 'CONTROL DOCENTE.xlsx' }; " ^
  "}; " ^
  "& node 'sync-onedrive-realtime.js' $target"
