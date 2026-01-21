#!/bin/bash

# Simple Docker Compose startup script for Inheritance

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Print functions
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# Show help
show_help() {
    echo ""
    echo -e "${GREEN}🚀 Inheritance - Docker Startup${NC}"
    echo ""
    echo "Usage: ./start.sh [MODE] [OPTIONS]"
    echo ""
    echo "MODE:"
    echo "  dev, development    Development mode (uses .env.local)"
    echo "  prod, production    Production mode (uses .env)"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help       Show this help"
    echo "  -d, --detach     Run in background (detached mode)"
    echo "  -r, --rebuild    Force rebuild Docker images"
    echo "  -c, --no-cache   Rebuild without cache"
    echo "  --down           Stop all containers"
    echo ""
    echo "Examples:"
    echo "  ./start.sh dev           # Development mode"
    echo "  ./start.sh prod -d       # Production mode in background"
    echo "  ./start.sh dev -r        # Rebuild and run"
    echo "  ./start.sh prod -c -d    # Rebuild without cache, detached"
    echo "  ./start.sh --down        # Stop containers"
    echo ""
}

# Default values
ENV_FILE=".env"
MODE_NAME="Production"
DETACHED=""
REBUILD=""
NO_CACHE=false
DO_DOWN=false

# Parse arguments
for arg in "$@"; do
    case $arg in
        -h|--help)
            show_help
            exit 0
            ;;
        dev|development)
            ENV_FILE=".env.local"
            MODE_NAME="Development"
            ;;
        prod|production)
            ENV_FILE=".env"
            MODE_NAME="Production"
            ;;
        -d|--detach)
            DETACHED="-d"
            ;;
        -r|--rebuild)
            REBUILD="--build"
            ;;
        -c|--no-cache)
            NO_CACHE=true
            ;;
        --down)
            DO_DOWN=true
            ;;
    esac
done

# Check if env file exists, create from template if not
if [ ! -f "$ENV_FILE" ]; then
    if [ -f ".env.example" ]; then
        info "Creating $ENV_FILE from template..."
        cp .env.example "$ENV_FILE"
        warning "Please edit $ENV_FILE and set your configuration"
    else
        error "Environment file $ENV_FILE not found!"
        exit 1
    fi
fi

# Read configuration from env file
read_env_var() {
    local var_name=$1
    local default_value=$2
    local value=$(grep "^${var_name}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    echo "${value:-$default_value}"
}

PROJECT_NAME=$(read_env_var "PROJECT_NAME" "inheritance")
NGINX_PORT=$(read_env_var "NGINX_PORT" "7000")
BACKEND_IMAGE=$(read_env_var "BACKEND_IMAGE" "inheritance-backend")
FRONTEND_IMAGE=$(read_env_var "FRONTEND_IMAGE" "inheritance-frontend")

# Build compose arguments with project name (-p ensures unique project)
COMPOSE_ARGS="-p $PROJECT_NAME --env-file $ENV_FILE -f docker-compose.yml"

if [ "$MODE_NAME" = "Development" ]; then
    COMPOSE_ARGS="$COMPOSE_ARGS -f docker-compose.dev.yml"
fi

# Handle --down
if [ "$DO_DOWN" = true ]; then
    info "Stopping containers for project: $PROJECT_NAME"
    docker compose $COMPOSE_ARGS down
    success "Containers stopped"
    exit 0
fi

# Display configuration
echo ""
info "Configuration from $ENV_FILE:"
echo "  PROJECT_NAME:   $PROJECT_NAME"
echo "  NGINX_PORT:     $NGINX_PORT"
echo "  BACKEND_IMAGE:  $BACKEND_IMAGE"
echo "  FRONTEND_IMAGE: $FRONTEND_IMAGE"
echo ""

# Stop existing containers first
info "Stopping existing containers for project: $PROJECT_NAME"
docker compose $COMPOSE_ARGS down 2>/dev/null || true

# Handle --no-cache (build without cache first)
if [ "$NO_CACHE" = true ]; then
    echo ""
    info "Building images without cache..."
    docker compose $COMPOSE_ARGS build --no-cache
    REBUILD="" # Don't use --build since we already built
fi

# Start containers
echo ""
info "Starting $PROJECT_NAME ($MODE_NAME mode)"
info "Command: docker compose $COMPOSE_ARGS up $REBUILD $DETACHED"
echo ""

docker compose $COMPOSE_ARGS up $REBUILD $DETACHED

if [ -n "$DETACHED" ]; then
    echo ""
    success "Containers started in background"
    echo ""
    echo -e "🌐 Access: ${GREEN}http://localhost:${NGINX_PORT}${NC}"
    echo ""
    info "Use './start.sh --down' to stop"
fi