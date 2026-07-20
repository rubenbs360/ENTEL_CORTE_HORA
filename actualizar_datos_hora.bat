@echo off
echo ===================================================
echo INICIANDO ACTUALIZACION DE METRICAS HORARIAS
echo ===================================================
echo.

echo [1/3] Procesando archivos Excel y CSV locales de corte hora...
python process_hourly_metrics.py

echo.
echo [2/3] Registrando cambios en Git...
git add data/ index.html styles.css app.js process_hourly_metrics.py REPORTERO_HORA_HORA/

:: Configurar credenciales locales en caso de que no existan para evitar el error "identity unknown"
git config user.email >nul 2>&1
if errorlevel 1 (
    git config user.email "admin@netcall.com"
    git config user.name "Netcall Admin"
)

git commit -m "Actualizacion automatica de metricas horarias"

echo.
echo [3/3] Subiendo cambios a GitHub...
:: Validar si existe un repositorio remoto configurado como "origin"
git remote get-url origin >nul 2>&1
if errorlevel 1 goto noremote

git push origin main
goto endremote

:noremote
echo.
echo [INFO] No se ha configurado un repositorio de GitHub (origin) para esta carpeta.
echo Los cambios se guardaron localmente de forma exitosa.
echo.
echo Si deseas subir esta nueva web independiente a GitHub Pages:
echo 1. Crea un repositorio vacio en tu cuenta de GitHub.
echo 2. Abre una consola en esta carpeta y corre:
echo    git remote add origin URL_DE_TU_NUEVO_REPOSITORIO
echo 3. Luego ejecuta este .bat nuevamente para subir los cambios.

:endremote

echo.
echo ===================================================
echo PROCESO COMPLETADO
echo ===================================================
echo.
pause
