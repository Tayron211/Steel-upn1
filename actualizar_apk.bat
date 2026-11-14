@echo off
chcp 65001 > nul
echo ========================================================
echo   COMPILACION Y ACTUALIZACION DE APK NATIVA (ANDROID)
echo   Control Docente UPN · Sede Comas
echo ========================================================
echo.

set "NOTAS=%~1"
if "%NOTAS%"=="" set "NOTAS=Mejoras de rendimiento, estabilidad y nuevas funciones."

node scripts\publish_apk.js "%NOTAS%"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo la compilacion de la nueva version.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Sincronizando con GitHub y desplegando en Cloudflare Pages...
git add .
git commit -m "release(apk): nueva version compilada de APK nativa y actualizacion automatica"
git push origin main
call npx.cmd wrangler pages deploy dist --project-name=control-doc --branch=main

echo.
echo ========================================================
echo   ACTUALIZACION PUBLICADA CON EXITO!
echo   Todos los usuarios recibiran el popup de actualizacion.
echo ========================================================
echo.
if "%~1"=="" pause
