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
    echo "  -h, --help     Show this help"
    echo "  -d, --detach   Run in background (detached mode)"
    echo "  -r, --rebuild  Force rebuild Docker images"
    echo "  --down         Stop all containers"
    echo ""
    echo "Examples:"
    echo "  ./start.sh dev           # Development mode"
    echo "  ./start.sh prod -d       # Production mode in background"
    echo "  ./start.sh dev -r        # Rebuild and run"
    echo "  ./start.sh --down        # Stop containers"
    echo ""
}

# Default values
ENV_FILE=".env"
MODE_NAME="Production"
DETACHED=""
REBUILD=""
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
        --down)
            DO_DOWN=true
            ;;
    esac
done

# Handle --down
if [ "$DO_DOWN" = true ]; then
    info "Stopping containers..."
    docker compose --env-file "$ENV_FILE" down
    success "Containers stopped"
    exit 0
fi

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

# Build compose arguments
COMPOSE_ARGS="--env-file $ENV_FILE -f docker-compose.yml"

if [ "$MODE_NAME" = "Development" ]; then
    COMPOSE_ARGS="$COMPOSE_ARGS -f docker-compose.dev.yml"
fi

# Stop existing containers first
info "Stopping existing containers..."
docker compose $COMPOSE_ARGS down 2>/dev/null || true

# Start containers
echo ""
info "Starting Inheritance ($MODE_NAME mode)"
info "Environment: $ENV_FILE"
echo ""

docker compose $COMPOSE_ARGS up $REBUILD $DETACHED

if [ -n "$DETACHED" ]; then
    echo ""
    success "Containers started in background"
    
    # Get ports from env file
    NGINX_PORT=$(grep "^NGINX_PORT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "7000")
    NGINX_PORT=${NGINX_PORT:-7000}
    
    echo ""
    echo -e "🌐 Access: ${GREEN}http://localhost:${NGINX_PORT}${NC}"
    echo ""
    info "Use './start.sh --down' to stop"
fi