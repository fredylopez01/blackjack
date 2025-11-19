#!/bin/bash

# Script de despliegue para Blackjack Distribuido
set -e

echo "Iniciando despliegue de Blackjack..."

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_message() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Verificar archivos necesarios
print_message "Verificando archivos necesarios..."

if [ ! -f ".env" ]; then
    print_error "Archivo .env no encontrado en la raíz del proyecto"
    print_info "Crea el archivo .env con las variables necesarias"
    exit 1
fi

if [ ! -f "docker-compose.yml" ]; then
    print_error "docker-compose.yml no encontrado"
    exit 1
fi

if [ ! -f "nginx/nginx.conf" ]; then
    print_error "nginx/nginx.conf no encontrado"
    exit 1
fi

# Detener contenedores existentes
print_message "Deteniendo contenedores existentes..."
docker-compose down 2>/dev/null || true

# Limpiar contenedores e imágenes huérfanas
print_message "Limpiando contenedores e imágenes antiguas..."
docker system prune -f

# Construir imágenes
print_message "Construyendo imágenes Docker..."
docker-compose build --no-cache

# Iniciar servicios
print_message "Iniciando servicios..."
docker-compose up -d

# Esperar a que los servicios estén listos
print_message "Esperando que los servicios inicien..."
sleep 15

# Verificar estado de los servicios
print_message "Verificando estado de los servicios..."
docker-compose ps

# Verificar logs de servicios críticos
print_message "Últimos logs de servicios:"
echo ""
echo "=== Frontend ==="
docker-compose logs --tail=10 frontend
echo ""
echo "=== API Login ==="
docker-compose logs --tail=10 api-login
echo ""
echo "=== Game Engine ==="
docker-compose logs --tail=10 game-engine
echo ""
echo "=== Nginx ==="
docker-compose logs --tail=10 nginx

# Verificar que el script se ejecuta en Linux (servidor)
if [ "$(uname -s)" != "Linux" ]; then
    print_error "Este script debe ejecutarse en el servidor Linux donde correrán los contenedores."
    exit 1
fi

# Obtener IP del servidor (más robusto)
if command -v hostname >/dev/null 2>&1; then
    SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$SERVER_IP" ]; then
    # Fallback a route
    SERVER_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '/src/ {print $7; exit}')
fi
if [ -z "$SERVER_IP" ]; then
    SERVER_IP="localhost"
fi

# Resumen
echo ""
print_message "Despliegue completado!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SERVICIOS DISPONIBLES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "FRONTEND:          http://${SERVER_IP}"
echo "API LOGIN:         http://${SERVER_IP}:3000"
echo "GAME ENGINE:       http://${SERVER_IP}:3002"
echo "RABBITMQ ADMIN:    http://${SERVER_IP}:15672"
echo "    Usuario: admin / Contraseña: admin123"
echo "PROMETHEUS:        http://${SERVER_IP}:9090"
echo "GRAFANA:           http://${SERVER_IP}:3010"
echo "MAIN APP (a través de Nginx): http://${SERVER_IP}  # rutas /api proxied a las réplicas internas"
echo "    Usuario: admin / Contraseña: admin123"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "COMANDOS ÚTILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Ver logs en tiempo real:"
echo "   docker-compose logs -f [servicio]"
echo ""
echo "Reiniciar un servicio:"
echo "   docker-compose restart [servicio]"
echo ""
echo "Ver estado de servicios:"
echo "   docker-compose ps"
echo ""
echo "Detener todos los servicios:"
echo "   docker-compose down"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"