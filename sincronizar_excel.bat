@echo off
chcp 65001 > nul
echo ========================================================
echo   SINCRONIZAR NUEVO EXCEL (CONTROL DOCENTE.xlsx)
echo   Sube automáticamente los nuevos NRCs, docentes y aulas
echo   tanto a SQLite local como a Cloudflare D1 en vivo.
echo ========================================================
echo.

node scripts/sync_data.cjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Hubo un problema al procesar el archivo Excel.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ¿Deseas también compilar y desplegar los archivos web a Cloudflare? (S/N)
set /p RESP="Presiona S para desplegar la web, o Enter para salir: "
if /i "%RESP%"=="S" (
    call .\actualizar.bat "actualizar data desde excel"
)

echo.
echo Presiona cualquier tecla para cerrar esta ventana...
pause > nul
