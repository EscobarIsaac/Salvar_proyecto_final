@echo off
echo 🚀 Iniciando Sistema de Autenticación Segura...
echo.

REM Verificar Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker no está instalado. Por favor, instala Docker Desktop.
    pause
    exit /b 1
)

echo ✅ Docker verificado
echo.

REM Copiar archivos de entorno si no existen
if not exist .env (
    echo 📝 Creando archivo .env...
    copy .env.example .env
    echo ⚠️  Por favor, edita .env con tus configuraciones.
)

if not exist frontend\.env (
    echo 📝 Creando archivo frontend\.env...
    copy frontend\.env.example frontend\.env
)

echo.
echo 🔨 Construyendo contenedores...
docker compose build

echo.
echo 🚀 Levantando servicios...
docker compose up -d

echo.
echo ✅ Sistema iniciado correctamente!
echo.
echo 📡 Servicios disponibles:
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:8000
echo    API Docs: http://localhost:8000/docs
echo    MongoDB:  localhost:27017
echo.
echo 📋 Para ver los logs:
echo    docker compose logs -f
echo.
echo 🛑 Para detener:
echo    docker compose down
echo.
pause
