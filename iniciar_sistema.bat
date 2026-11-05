@echo off
title Control Docente - UPN Comas (PHP & SQLite)
color 0A
echo ========================================================
echo     SISTEMA DE CONTROL DOCENTE Y OPERACIONES (PHP)
echo               UNIVERSIDAD PRIVADA DEL NORTE
echo ========================================================
echo.

:: Detect local IP address
for /f "tokens=4" %%a in ('route print ^| findstr 0.0.0.0 ^| findstr /v "0.0.0.0.*0.0.0.0"') do (
    set LOCAL_IP=%%a
)

echo [OK] Servidor Web PHP Portable Listo.
echo.
echo   * Para usar en esta PC:
echo     http://localhost:8000
echo.
echo   * Para abrir desde tu CELULAR o TABLET (en la misma red Wi-Fi):
echo     http://192.168.18.187:8000
echo.
echo ========================================================
echo.

:: Check if port 8000 is already active
netstat -ano | findstr :8000 >nul
if %errorlevel% equ 0 (
    echo El servidor ya se encuentra ACTIVO en segundo plano.
    echo Abriendo navegador...
    start http://localhost:8000
    goto :fin
)

echo Iniciando servidor en segundo plano...
start http://localhost:8000
".\php\php.exe" -S 0.0.0.0:8000 router.php

:fin
echo.
echo Presiona cualquier tecla para salir...
pause >nul
