@echo off
chcp 65001 > nul
echo ========================================================
echo   SINCRONIZACION AUTOMATICA - CONTROL DOCENTE UPN
echo   GitHub: https://github.com/Tayron211/Steel-upn1
echo   Cloudflare: https://control-doc.pages.dev
echo ========================================================
echo.

set "MSG=%~1"
if "%MSG%"=="" set "MSG=Actualizacion de sistema"

echo [1/3] Compilando frontend para produccion...
call npm.cmd run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo la compilacion. Revisa los errores.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Sincronizando repositorio en GitHub...
git add .
git commit -m "%MSG%"
git push origin main

echo.
echo [3/3] Desplegando en vivo a Cloudflare Edge...
call npx.cmd wrangler pages deploy dist --project-name=control-doc --branch=main

echo.
echo ========================================================
echo   SINCRONIZACION COMPLETADA CON EXITO!
echo   Web en vivo: https://control-doc.pages.dev
echo ========================================================
echo.
if "%~1"=="" pause
