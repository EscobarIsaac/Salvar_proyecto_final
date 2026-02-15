#!/bin/bash

echo "🚀 Iniciando Sistema de Autenticación Segura..."
echo ""

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor, instala Docker Desktop."
    exit 1
fi

# Verificar Docker Compose
if ! command -v docker compose &> /dev/null; then
    echo "❌ Docker Compose no está disponible."
    exit 1
fi

echo "✅ Docker verificado"
echo ""

# Copiar archivos de entorno si no existen
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env..."
    cp .env.example .env
    echo "⚠️  Por favor, edita .env con tus configuraciones antes de continuar."
fi

if [ ! -f frontend/.env ]; then
    echo "📝 Creando archivo frontend/.env..."
    cp frontend/.env.example frontend/.env
fi

echo ""
echo "🔨 Construyendo contenedores..."
docker compose build

echo ""
echo "🚀 Levantando servicios..."
docker compose up -d

echo ""
echo "✅ Sistema iniciado correctamente!"
echo ""
echo "📡 Servicios disponibles:"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo "   MongoDB:  localhost:27017"
echo ""
echo "📋 Para ver los logs:"
echo "   docker compose logs -f"
echo ""
echo "🛑 Para detener:"
echo "   docker compose down"
