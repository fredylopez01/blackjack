#!/bin/bash

# Script de despliegue para Blackjack Distribuido
# Uso: ./deploy.sh

set -e

echo "Iniciando despliegue de Blackjack..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_message() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml no encontrado. Ejecuta este script desde el directorio raíz del proyecto."
    exit 1
fi

# Verificar que existe .env
if [ ! -f ".env" ]; then
    print_error "Archivo .env no encontrado."
    print_message "Copia .env.production a .env y configúralo:"
    print_message "  cp .env.production .env"
    print_message "  nano .env"
    exit 1
fi

# Pull de cambios del repositorio
print_message "Obteniendo últimos cambios del repositorio..."
git pull origin main || print_warning "No se pudo hacer git pull (¿cambios locales?)"

# Detener contenedores anteriores
print_message "Deteniendo contenedores existentes..."
docker-compose down

# Limpiar imágenes antiguas (opcional)
print_message "Limpiando imágenes antiguas..."
docker system prune -f

# Construir imágenes
print_message "Construyendo imágenes Docker..."
docker-compose build --no-cache

# Iniciar servicios
print_message "Iniciando servicios..."
docker-compose up -d

# Esperar a que los servicios estén listos
print_message "Esperando que los servicios inicien..."
sleep 10

# Verificar estado de los servicios
print_message "Verificando estado de los servicios..."
docker-compose ps

# Verificar logs de servicios críticos
print_message "Últimos logs de servicios:"
echo ""
echo "=== API Login ==="
docker-compose logs --tail=5 api-login
echo ""
echo "=== Game Engine ==="
docker-compose logs --tail=5 game-engine
echo ""
echo "=== Nginx ==="
docker-compose logs --tail=5 nginx

# Resumen
echo ""
print_message "Despliegue completado!"
echo ""
echo "Servicios disponibles:"
echo "   - Frontend:       http://$(hostname -I | awk '{print $1}')"
echo "   - RabbitMQ Admin: http://$(hostname -I | awk '{print $1}'):15672"
echo "   - Prometheus:     http://$(hostname -I | awk '{print $1}'):9090"
echo "   - Grafana:        http://$(hostname -I | awk '{print $1}'):3010"
echo ""
echo "Para ver logs en tiempo real:"
echo "   docker-compose logs -f [servicio]"
echo ""
echo "Para reiniciar un servicio:"
echo "   docker-compose restart [servicio]"
echo ""