#!/bin/bash

# Script to run Inheritance using Docker
# This script will prepare the environment and run all services via Docker Compose

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print with color
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Function to show help
show_help() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              🚀 Inheritance - Docker Setup & Start                 ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}USAGE:${NC}"
    echo "  ./start.sh [MODE] [OPTIONS]"
    echo ""
    echo -e "${YELLOW}MODE:${NC}"
    echo "  dev, development    Run in Development mode (using .env.local)"
    echo "  prod, production    Run in Production mode (using .env)"
    echo "  (no mode)           Interactive mode - manually select mode or use the last mode"
    echo ""
    echo -e "${YELLOW}OPTIONS:${NC}"
    echo "  -h, --help          Show this help"
    echo ""
    echo "  -d, --detach        Run containers in background (detached mode)"
    echo "  -r, --rebuild       Force rebuild Docker images before running"
    echo "  -y, --yes           Non-interactive mode (automatically answers 'yes' to all prompts)"
    echo "  --ask               Force interactive mode to select configuration (ignore last mode)"
    echo ""
    echo -e "${YELLOW}USAGE EXAMPLES:${NC}"
    echo "  ./start.sh                      # Interactive mode or use last mode"
    echo "  ./start.sh dev                  # Development mode"
    echo "  ./start.sh prod                 # Production mode"
    echo "  ./start.sh dev --fund           # Development mode with auto-funding wallet"
    echo "  ./start.sh dev -d               # Development mode in background"
    echo "  ./start.sh dev -f -d            # Development mode with auto-fund, in background"
    echo "  ./start.sh dev --rebuild        # Development mode with rebuild images"
    echo "  ./start.sh --ask                # Force interactive mode"
    echo "  ./start.sh dev -y               # Development mode, non-interactive"
    echo ""
    echo -e "${YELLOW}ENVIRONMENT FILES:${NC}"
    echo "  .env.local          Environment file for Development mode"
    echo "  .env                Environment file for Production mode"
    echo "  .env.example        Template environment file"
    echo ""
    echo -e "${YELLOW}PORTS USED:${NC}"
    echo ""
    echo "  ./start-local.sh         Script to run without Docker (local development)"
    echo ""
    echo -e "${YELLOW}NOTES:${NC}"
    echo "  • The last mode will be saved and reused if no arguments are provided"
    echo "  • Use --ask to select a new mode (ignoring saved mode)"
    echo ""
    echo "  • Container logs are available in the logs/ folder"
    echo ""
}

# Function to check command
check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1 installed: $(command -v $1)"
        return 0
    else
        print_error "$1 not found. Please install it first."
        return 1
    fi
}

# Function to create env file from template
setup_env_file() {
    local env_file=$1
    local template_file=".env.example"
    
    if [ ! -f "$env_file" ]; then
        if [ -f "$template_file" ]; then
            print_info "Creating file $env_file from template..."
            cp "$template_file" "$env_file"
            print_success "File $env_file successfully created"
            print_warning "Don't forget to fill DEEPSEEK_API_KEY in file $env_file"
        else
            print_warning "Template $template_file not found, creating empty $env_file..."
            touch "$env_file"
        fi
    else
        print_info "File $env_file already exists, skipping..."
    fi
}

# Function to setup logs directory
setup_logs_directory() {
    local logs_dir="logs"
    
    # All info output to stderr
    if [ ! -d "$logs_dir" ]; then
        echo -e "${BLUE}ℹ️  Creating folder $logs_dir...${NC}" >&2
        mkdir -p "$logs_dir"
        echo -e "${GREEN}✅ Folder $logs_dir successfully created${NC}" >&2
    else
        echo -e "${BLUE}ℹ️  Folder $logs_dir already exists${NC}" >&2
    fi
    
    # Create .gitkeep file if not exists (for git tracking)
    touch "$logs_dir/.gitkeep" 2>/dev/null || true
    
    # Output only directory path to stdout (without color codes or newline)
    printf "%s" "$logs_dir"
}

# Function to start logging to file for each container
start_container_logging() {
    local env_file=$1
    local logs_dir=$2
    local services=("backend" "frontend")
    local log_pids=()
    
    print_info "Starting logging for each container to folder $logs_dir..."
    
    for service in "${services[@]}"; do
        # Ensure logs_dir is a valid path (without color codes or newline)
        logs_dir=$(echo "$logs_dir" | tr -d '\n\r' | sed 's/[[:cntrl:]]//g')
        
        # Ensure logs_dir folder exists
        if [ ! -d "$logs_dir" ]; then
            mkdir -p "$logs_dir" 2>/dev/null || {
                print_error "Failed to create logs folder: $logs_dir" >&2
                continue
            }
        fi
        
        local log_file="$logs_dir/${service}.log"
        
        # Create log file if not exists
        touch "$log_file" 2>/dev/null || {
            print_error "Failed to create log file: $log_file" >&2
            continue
        }
        
        # Run logging in background for each service
        (
            # Wait until container exists
            local max_wait=60
            local waited=0
            while [ $waited -lt $max_wait ]; do
                if docker compose $env_file ps -q "$service" 2>/dev/null | grep -q .; then
                    break
                fi
                sleep 1
                waited=$((waited + 1))
            done
            
            # If container exists, start logging
            if docker compose $env_file ps -q "$service" 2>/dev/null | grep -q .; then
                # Log with timestamp, append to file
                docker compose $env_file logs -f --tail=0 "$service" 2>&1 | while IFS= read -r line || [ -n "$line" ]; do
                    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $line" >> "$log_file" 2>/dev/null || true
                done
            else
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: Container $service not found after waiting $max_wait seconds" >> "$log_file" 2>/dev/null || true
            fi
        ) &
        
        log_pids+=($!)
        print_success "Logging for $service started -> $log_file (PID: ${log_pids[-1]})"
    done
    
    # Save PIDs to file to start later
    echo "${log_pids[@]}" > "$logs_dir/.log_pids" 2>/dev/null || true
    
    print_success "All container logging started"
    print_info "Log files available in folder $logs_dir/"
    echo ""
}

# Function to stop logging
stop_container_logging() {
    local logs_dir=$1
    
    if [ -f "$logs_dir/.log_pids" ]; then
        local pids=$(cat "$logs_dir/.log_pids")
        if [ -n "$pids" ]; then
            print_info "Stopping logging process..."
            for pid in $pids; do
                if kill -0 "$pid" 2>/dev/null; then
                    kill "$pid" 2>/dev/null && print_success "Logging PID $pid stopped" || true
                fi
            done
            rm -f "$logs_dir/.log_pids"
        fi
    fi
}

# Function to display all settings
display_settings() {
    local env_file=$1
    
    if [ ! -f "$env_file" ]; then
        print_warning "File $env_file not found, cannot display settings"
        return
    fi
    
    echo ""
    print_header "⚙️  Configuration Settings"
    
    # Setting categories
    local backend_vars=("BACKEND_PORT" "ARWEAVE_GATEWAY")
    local frontend_vars=("FRONTEND_PORT" "BACKEND_BASE_URL" "DEEPSEEK_API_KEY" "APP_ENV")
    
    # Helper function to display variable
    display_var() {
        local var_name=$1
        local line=$(grep "^${var_name}=" "$env_file" 2>/dev/null | head -n1)
        local var_value=""
        
        if [ -n "$line" ]; then
            # Get value after = sign
            var_value=$(echo "$line" | cut -d'=' -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed "s/^['\"]//;s/['\"]$//")
        fi
        
        # If empty or not found, show (default)
        if [ -z "$var_value" ]; then
            var_value="(default/empty)"
        fi
        
        # Mask sensitive values
        if [[ "$var_name" == *"API_KEY"* ]] || [[ "$var_name" == *"JWK"* ]] || [[ "$var_name" == *"SECRET"* ]] || [[ "$var_name" == *"PASSWORD"* ]]; then
            if [ -n "$var_value" ] && [ "$var_value" != "(default/empty)" ]; then
                local len=${#var_value}
                if [ $len -gt 12 ]; then
                    local masked_value="${var_value:0:8}...${var_value: -4}"
                else
                    local masked_value="***masked***"
                fi
                printf "  ${YELLOW}%-35s${NC} %s\n" "$var_name:" "$masked_value"
            else
                printf "  ${YELLOW}%-35s${NC} %s\n" "$var_name:" "$var_value"
            fi
        else
            # Truncate too long values
            if [ ${#var_value} -gt 60 ]; then
                var_value="${var_value:0:57}..."
            fi
            printf "  ${YELLOW}%-35s${NC} %s\n" "$var_name:" "$var_value"
        fi
    }
    
    # Backend Settings
    echo -e "${BLUE}📦 Backend Settings:${NC}"
    for var in "${backend_vars[@]}"; do
        display_var "$var"
    done
    echo ""
    
    # Frontend Settings
    echo -e "${BLUE}🌐 Frontend Settings:${NC}"
    for var in "${frontend_vars[@]}"; do
        display_var "$var"
    done
    echo ""
    
    echo -e "${BLUE}🔌 Port Information:${NC}"
    local nginx_port=$(grep "^NGINX_PORT=" "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    local frontend_port=$(grep "^FRONTEND_PORT=" "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    local backend_port=$(grep "^BACKEND_PORT=" "$env_file" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    
    printf "  ${YELLOW}%-35s${NC} %s\n" "Nginx:" "${nginx_port:-7000}"
    printf "  ${YELLOW}%-35s${NC} %s\n" "Frontend:" "${frontend_port:-7001}"
    printf "  ${YELLOW}%-35s${NC} %s\n" "Backend:" "${backend_port:-7002}"
    echo ""
    
    # Container Names
    echo -e "${BLUE}🐳 Container Names:${NC}"
    printf "  ${YELLOW}%-35s${NC} %s\n" "Backend:" "inheritance-backend"
    printf "  ${YELLOW}%-35s${NC} %s\n" "Frontend:" "inheritance-frontend"

    echo ""
}

# Save and load last mode
save_last_mode() {
    local env_file=$1
    local mode_name=$2
    local auto_fund_flag=$3
    [ -z "$env_file" ] && return
    local dir
    dir=$(dirname "$LAST_MODE_FILE")
    mkdir -p "$dir" 2>/dev/null || true
    echo "${env_file}|${mode_name}" > "$LAST_MODE_FILE" 2>/dev/null || true
}

load_last_mode() {
    if [ -f "$LAST_MODE_FILE" ]; then
        local line
        line=$(head -n1 "$LAST_MODE_FILE" 2>/dev/null || true)
        local saved_env saved_mode
        saved_env=$(echo "$line" | cut -d'|' -f1 | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        saved_mode=$(echo "$line" | cut -d'|' -f2 | tr -d '\r' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

        if [ -n "$saved_env" ] && [ -n "$saved_mode" ]; then
            ENV_FILE="$saved_env"
            MODE_NAME="$saved_mode"
            return 0
        fi
    fi
    return 1
}

# Function to select mode
select_mode() {
    echo ""
    print_info "Select mode to run application:"
    echo ""
    echo "  1) Development (uses .env.local)"
    echo "  2) Production (uses .env)"
    echo ""
    read -p "Select mode [1-2] (default: 1): " mode_choice
    
    case "${mode_choice:-1}" in
        1)
            ENV_FILE=".env.local"
            MODE_NAME="Development"
            ;;
        2)
            ENV_FILE=".env"
            MODE_NAME="Production"
            ;;
        *)
            ENV_FILE=".env.local"
            MODE_NAME="Development"
            ;;
    esac
    
    echo ""
    print_success "Mode selected: $MODE_NAME"
    print_info "Using file: $ENV_FILE"
    
    # Show all settings
    display_settings "$ENV_FILE"
}

# Main function
main() {
    print_header "🚀 Inheritance - Docker Setup & Start"
    
    # Check if user requested help
    for arg in "$@"; do
        case $arg in
            --help|-h)
                show_help
                exit 0
                ;;
        esac
    done
    
    # Check dependencies (Docker required)
    print_header "📋 Checking Dependencies"
    
    MISSING_DEPS=0
    
    if ! check_command "docker"; then
        MISSING_DEPS=1
    fi
    
    if ! check_command "docker compose"; then
        print_error "Docker Compose not found. Please install it first."
        MISSING_DEPS=1
    fi
    
    if [ $MISSING_DEPS -eq 1 ]; then
        print_error "Critical dependencies not found. Please install them first."
        exit 1
    fi
    
    # Parse arguments for funding and background
    DETACHED=false
    REBUILD=false
    FORCE_ASK=false
    NON_INTERACTIVE=false
    ARGS=()
    
    for arg in "$@"; do
        case $arg in
            --detach|-d)
                DETACHED=true
                ;;
            --rebuild|-r)
                REBUILD=true
                ;;
            --ask)
                FORCE_ASK=true
                ;;
            --yes|-y)
                NON_INTERACTIVE=true
                ;;
            *)
                ARGS+=("$arg")
                ;;
        esac
    done
    
    # Setup environment files
    print_header "📝 Setup Environment Files"
    
    setup_env_file ".env.local"
    setup_env_file ".env"
    
    # Setup logs directory
    print_header "📁 Setup Logs Directory"
    # Setup logs directory - function outputs path to stdout, info to stderr
    LOGS_DIR=$(setup_logs_directory)
    # Sanitize to ensure no control characters or newline
    LOGS_DIR=$(printf "%s" "$LOGS_DIR" | tr -d '\n\r\t' | sed 's/[[:cntrl:]]//g')
    # Fallback to default if sanitation results in empty or invalid string
    if [ -z "$LOGS_DIR" ] || [ ! -d "$LOGS_DIR" ]; then
        LOGS_DIR="logs"
        mkdir -p "$LOGS_DIR" 2>/dev/null || true
    fi
    print_info "Using logs folder: $LOGS_DIR"
    LAST_MODE_FILE="$LOGS_DIR/.last_mode"
    
    # Select mode if no arguments
    if [ ${#ARGS[@]} -eq 0 ]; then
        if [ "$FORCE_ASK" = false ] && load_last_mode; then
            print_success "Using previous mode: $MODE_NAME"
            print_info "Using file: $ENV_FILE"
            display_settings "$ENV_FILE"
        else
            select_mode
            save_last_mode "$ENV_FILE" "$MODE_NAME"
        fi
    else
        case "${ARGS[0]}" in
            dev|development)
                ENV_FILE=".env.local"
                MODE_NAME="Development"
                ;;
            prod|production)
                ENV_FILE=".env"
                MODE_NAME="Production"
                ;;
            *)
                print_error "Invalid mode: ${ARGS[0]}"
                echo "Available modes: dev, prod"

                exit 1
                ;;
        esac
        print_success "Mode: $MODE_NAME"
        print_info "Using file: $ENV_FILE"
        
        # Show all settings
        display_settings "$ENV_FILE"
        save_last_mode "$ENV_FILE" "$MODE_NAME"
    fi
    
    # Check if env file exists
    if [ ! -f "$ENV_FILE" ]; then
        print_error "File $ENV_FILE not found!"
        exit 1
    fi
    
    # Check if DEEPSEEK_API_KEY is filled
    if ! grep -q "DEEPSEEK_API_KEY=" "$ENV_FILE" || grep -q "^DEEPSEEK_API_KEY=$" "$ENV_FILE" || grep -q "^DEEPSEEK_API_KEY=\s*$" "$ENV_FILE"; then
        print_warning "DEEPSEEK_API_KEY is not set in file $ENV_FILE"
        print_info "Please edit file $ENV_FILE and fill DEEPSEEK_API_KEY before proceeding"
        echo ""
        if [ "$NON_INTERACTIVE" = true ]; then
            print_info "Non-interactive mode: proceeding without DEEPSEEK_API_KEY"
        else
            read -p "Proceed without DEEPSEEK_API_KEY? (y/N): " continue_choice
            if [[ ! "$continue_choice" =~ ^[Yy]$ ]]; then
                print_info "Setup cancelled. Edit file $ENV_FILE and run script again."
                exit 0
            fi
        fi
    fi
    
    # Prepare docker-compose files arguments
    COMPOSE_ARGS="--env-file $ENV_FILE -f docker-compose.yml"
    
    if [ "$MODE_NAME" = "Development" ]; then
        print_info "Adding development configuration (hot-reload)..."
        COMPOSE_ARGS="$COMPOSE_ARGS -f docker-compose.dev.yml"
    fi
    
    # Save latest configuration (including auto-fund option)
    save_last_mode "$ENV_FILE" "$MODE_NAME"
    
    # Function to check if port is already used by Docker container
    check_docker_port() {
        local port=$1
        # Check if there is a Docker container using this port (both running and stopped)
        local container=$(docker ps -a --format '{{.Names}}\t{{.Ports}}' 2>/dev/null | grep -E "0\.0\.0\.0:$port->|:::0:$port->|:$port->" | awk '{print $1}' | head -n1)
        if [ -n "$container" ]; then
            echo "$container"
            return 0
        fi
        # Check also with docker ps --filter (for running containers)
        container=$(docker ps --format '{{.Names}}' --filter "publish=$port" 2>/dev/null | head -n1)
        if [ -n "$container" ]; then
            echo "$container"
            return 0
        fi
        return 1
    }
    
    # Function to check if port is already used
    check_port() {
        local port=$1
        local service_name=$2
        
        # First check if there is a Docker container using this port
        local docker_container=$(check_docker_port "$port")
        if [ -n "$docker_container" ]; then
            print_warning "Port $port ($service_name) is already used by Docker container: $docker_container"
            return 1
        fi
        
        # Check if port is already used by normal process
        if command -v lsof &> /dev/null; then
            # Using lsof if available
            if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
                local pid=$(lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null | head -n1)
                local process=$(ps -p $pid -o comm= 2>/dev/null || echo "unknown")
                print_warning "Port $port ($service_name) is already used"
                print_info "  PID: $pid, Process: $process"
                return 1
            fi
        elif command -v netstat &> /dev/null; then
            # Fallback to netstat
            if netstat -tuln 2>/dev/null | grep -q ":$port "; then
                print_warning "Port $port ($service_name) is already used"
                return 1
            fi
        elif command -v ss &> /dev/null; then
            # Fallback to ss
            if ss -tuln 2>/dev/null | grep -q ":$port "; then
                print_warning "Port $port ($service_name) is already used"
                return 1
            fi
        else
            # If no tool to check port, skip check
            print_info "Port check tool not found, skipping port check $port"
            return 0
        fi
        
        return 0
    }
    
    # Function to get PID using the port
    get_port_pid() {
        local port=$1
        if command -v lsof &> /dev/null; then
            lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null | head -n1
        elif command -v netstat &> /dev/null; then
            netstat -tulnp 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | head -n1
        elif command -v ss &> /dev/null; then
            ss -tulnp 2>/dev/null | grep ":$port " | awk '{print $6}' | cut -d',' -f2 | cut -d'=' -f2 | head -n1
        fi
    }
    
    # Check ports to be used
    print_header "🔌 Port Checking"
    
    # Read ports from config
    NGINX_PORT_VAL=$(grep "^NGINX_PORT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    FRONTEND_PORT_VAL=$(grep "^FRONTEND_PORT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    BACKEND_PORT_VAL=$(grep "^BACKEND_PORT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    
    # Set defaults for later use
    NGINX_PORT_VAL=${NGINX_PORT_VAL:-7000}
    FRONTEND_PORT_VAL=${FRONTEND_PORT_VAL:-7001}
    BACKEND_PORT_VAL=${BACKEND_PORT_VAL:-7002}
    
    PORTS_TO_CHECK=("${NGINX_PORT_VAL:-7000}:Nginx" "${FRONTEND_PORT_VAL:-7001}:Frontend" "${BACKEND_PORT_VAL:-7002}:Backend")
    PORT_CONFLICTS=0
    CONFLICTED_PORTS=()
    
    for port_info in "${PORTS_TO_CHECK[@]}"; do
        IFS=':' read -r port service <<< "$port_info"
        if ! check_port "$port" "$service"; then
            PORT_CONFLICTS=1
            CONFLICTED_PORTS+=("$port:$service")
        else
            print_success "Port $port ($service) available"
        fi
    done
    
    if [ $PORT_CONFLICTS -eq 1 ]; then
        echo ""
        print_error "Some ports are already in use!"
        echo ""
        print_info "Conflicted ports:"
        DOCKER_CONTAINERS_TO_STOP=()
        for conflict in "${CONFLICTED_PORTS[@]}"; do
            IFS=':' read -r port service <<< "$conflict"
            # Check if port is used by Docker container
            local docker_container=$(check_docker_port "$port")
            if [ -n "$docker_container" ]; then
                print_info "  - Port $port ($service): Docker Container '$docker_container'"
                DOCKER_CONTAINERS_TO_STOP+=("$docker_container")
            else
                # Check if port is used by normal process
                local pid=$(get_port_pid "$port")
                if [ -n "$pid" ]; then
                    local process_info=$(ps -p $pid -o pid=,comm=,args= 2>/dev/null | head -n1)
                    print_info "  - Port $port ($service): PID $pid"
                    if [ -n "$process_info" ]; then
                        print_info "    Process: $process_info"
                    fi
                else
                    print_info "  - Port $port ($service): cannot determine source"
                fi
            fi
        done
        echo ""
        
        # If there are Docker containers using the port, recreate immediately
        if [ ${#DOCKER_CONTAINERS_TO_STOP[@]} -gt 0 ]; then
            print_warning "Some ports are used by Docker containers:"
            for container in "${DOCKER_CONTAINERS_TO_STOP[@]}"; do
                print_info "  - $container"
            done
            echo ""
            print_info "Stopping and removing Docker containers using those ports..."
            for container in "${DOCKER_CONTAINERS_TO_STOP[@]}"; do
                print_info "  Stopping container: $container"
                docker stop "$container" 2>/dev/null && print_success "  Container $container successfully stopped" || print_warning "  Failed to stop container $container"
                docker rm "$container" 2>/dev/null && print_success "  Container $container successfully removed" || print_warning "  Failed to remove container $container"
            done
            # Wait a moment to ensure port is released
            sleep 2
            print_success "Docker containers using ports successfully stopped and removed"
        fi
        
        # Check if there are still ports used by normal processes
        REMAINING_CONFLICTS=0
        for conflict in "${CONFLICTED_PORTS[@]}"; do
            IFS=':' read -r port service <<< "$conflict"
            local docker_container=$(check_docker_port "$port")
            if [ -z "$docker_container" ]; then
                local pid=$(get_port_pid "$port")
                if [ -n "$pid" ]; then
                    REMAINING_CONFLICTS=1
                fi
            fi
        done
        
        if [ $REMAINING_CONFLICTS -eq 1 ]; then
            echo ""
            local do_kill=false
            if [ "$NON_INTERACTIVE" = true ]; then
                print_info "Non-interactive mode: stopping processes using ports"
                do_kill=true
            else
                read -p "Stop processes using those ports? (y/N): " kill_choice
                if [[ "$kill_choice" =~ ^[Yy]$ ]]; then
                    do_kill=true
                fi
            fi
            if [ "$do_kill" = true ]; then
                print_info "Stopping processes using ports..."
                for conflict in "${CONFLICTED_PORTS[@]}"; do
                    IFS=':' read -r port service <<< "$conflict"
                    local docker_container=$(check_docker_port "$port")
                    if [ -z "$docker_container" ]; then
                        local pid=$(get_port_pid "$port")
                        if [ -n "$pid" ]; then
                            print_info "  Stopping PID $pid (port $port)..."
                            kill -9 $pid 2>/dev/null && print_success "  PID $pid successfully stopped" || print_warning "  Failed to stop PID $pid"
                        fi
                    fi
                done
                # Wait a moment to ensure port is released
                sleep 1
                print_success "Processes using ports successfully stopped"
            fi
        fi
        
        # Re-check if ports are still in use
        STILL_CONFLICTED=0
        for conflict in "${CONFLICTED_PORTS[@]}"; do
            IFS=':' read -r port service <<< "$conflict"
            if ! check_port "$port" "$service" >/dev/null 2>&1; then
                STILL_CONFLICTED=1
            fi
        done
        
        if [ $STILL_CONFLICTED -eq 1 ]; then
            print_warning "Ports still in use. Docker Compose might fail."
            echo ""
            if [ "$NON_INTERACTIVE" = true ]; then
                print_info "Non-interactive mode: proceeding despite port conflicts"
            else
                read -p "Proceed anyway? (y/N): " continue_choice
                if [[ ! "$continue_choice" =~ ^[Yy]$ ]]; then
                    print_info "Setup cancelled. Stop processes/containers using ports first."
                    exit 0
                fi
            fi
        fi
    fi
    
    # Clean up existing containers before running
    print_header "🧹 Cleanup Existing Containers"
    
    # Check if there are containers running from this docker-compose
    if docker compose $COMPOSE_ARGS ps -q 2>/dev/null | grep -q .; then
        print_warning "Found running containers from this docker-compose"
        print_info "Cleaning up existing containers..."
        docker compose $COMPOSE_ARGS down 2>/dev/null || true
        print_success "Existing containers successfully cleaned up"
    else
        print_info "No containers running from this docker-compose"
    fi
    
    # Check if there are containers with same name not related to docker-compose
    CONTAINER_NAMES=("inheritance-backend" "inheritance-frontend")
    FOUND_CONTAINERS=0
    
    for container_name in "${CONTAINER_NAMES[@]}"; do
        if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${container_name}$"; then
            if [ $FOUND_CONTAINERS -eq 0 ]; then
                print_warning "Found containers with same name not related to docker-compose"
                FOUND_CONTAINERS=1
            fi
            print_info "  - Container: $container_name"
        fi
    done
    
    if [ $FOUND_CONTAINERS -eq 1 ]; then
        echo ""
        print_info "Removing existing containers for recreate..."
        for container_name in "${CONTAINER_NAMES[@]}"; do
            if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${container_name}$"; then
                print_info "  Removing: $container_name"
                docker rm -f "$container_name" 2>/dev/null && print_success "  Container $container_name successfully removed" || print_warning "  Failed to remove container $container_name"
            fi
        done
        print_success "Existing containers successfully removed, ready for recreate"
    fi
    
    # Re-check ports after container cleanup
    print_header "🔍 Port Verification After Cleanup"
    FINAL_PORT_CHECK_FAILED=0
    for port_info in "${PORTS_TO_CHECK[@]}"; do
        IFS=':' read -r port service <<< "$port_info"
        if ! check_port "$port" "$service" >/dev/null 2>&1; then
            FINAL_PORT_CHECK_FAILED=1
            local docker_container=$(check_docker_port "$port")
            if [ -n "$docker_container" ]; then
                print_error "Port $port ($service) still used by container: $docker_container"
                print_info "  Attempting to force stop container..."
                docker stop "$docker_container" 2>/dev/null || true
                docker rm -f "$docker_container" 2>/dev/null || true
                sleep 1
                # Check again after cleanup
                if check_port "$port" "$service" >/dev/null 2>&1; then
                    print_success "Port $port ($service) now available"
                else
                    print_error "Port $port ($service) still used after cleanup"
                fi
            else
                print_error "Port $port ($service) still used"
            fi
        else
            print_success "Port $port ($service) available"
        fi
    done
    
    if [ $FINAL_PORT_CHECK_FAILED -eq 1 ]; then
        print_warning "Some ports are still in use. Docker Compose might fail."
        echo ""
        if [ "$NON_INTERACTIVE" = true ]; then
            print_info "Non-interactive mode: proceeding despite port conflicts"
        else
            read -p "Proceed anyway? (y/N): " final_continue_choice
            if [[ ! "$final_continue_choice" =~ ^[Yy]$ ]]; then
                print_info "Setup cancelled. Ensure all ports are available before running again."
                exit 0
            fi
        fi
    fi
    
    # Run Docker Compose
    print_header "🐳 Running Docker Compose"
    
    print_info "Mode: $MODE_NAME"
    print_info "Env file: $ENV_FILE"
    
    # If rebuild requested, manually rebuild backend image from root repo
    # so docs folder is copied (backend Dockerfile is in backend/, docs in root)
    # Save current working directory (pwd) to return to root after manual build
    ROOT_DIR="$(pwd)"
    if [ "$REBUILD" = true ]; then
        print_header "🔨 Rebuild Docker Images"
        print_info "Rebuilding backend image (including docs folder)..."
        cd "$ROOT_DIR/backend" && docker buildx build -t registry.gitlab.com/deinheritance/backend:latest -f Dockerfile .
        cd "$ROOT_DIR"
        print_success "Backend image build complete"
        echo ""
    fi
    
    echo ""
    
    print_header "🐳 Starting Docker Compose ($MODE_NAME)"
    
    # Construct base command
    COMPOSE_CMD="docker compose $COMPOSE_ARGS up"
    
    # Add build option if requested or if images don't exist
    if [ "$REBUILD" = true ]; then
        COMPOSE_CMD="$COMPOSE_CMD --build"
    fi
    
    # Add detach mode
    if [ "$DETACHED" = true ]; then
        COMPOSE_CMD="$COMPOSE_CMD -d"
        print_info "Mode: Detached (background)"
    else
        print_info "Mode: Attached (foreground)"
    fi
    
    print_info "Running: $COMPOSE_CMD"
    echo ""
    
    # Execute docker compose
    if [ "$DETACHED" = true ]; then
        eval $COMPOSE_CMD
        check_status=$?
        
        if [ $check_status -eq 0 ]; then
            echo ""
            print_success "Docker Compose started successfully"
            
            # Start logging
            start_container_logging "$COMPOSE_ARGS" "$LOGS_DIR"
            
            echo ""
            print_info "Application running in background."
            print_info "Use './start.sh stop' to stop the application."
            print_info "Use tail -f $LOGS_DIR/*.log to view logs."
            
            # Display access info
            echo ""
            print_header "Available Services"
            echo -e "  Nginx:    ${GREEN}http://localhost:${NGINX_PORT_VAL}${NC}"
            echo -e "  Frontend: ${GREEN}http://localhost:${FRONTEND_PORT_VAL}${NC}"
            echo -e "  Backend:  ${GREEN}http://localhost:${BACKEND_PORT_VAL}${NC}"
            echo ""
        else
            print_error "Failed to start Docker Compose"
            exit 1
        fi
    else
        # For attached mode
        print_info "Press Ctrl+C to stop all containers"
        print_info "Logs will also be saved in folder $LOGS_DIR/"
        echo ""
        
        eval $COMPOSE_CMD
        check_status=$?
        
        if [ $check_status -ne 0 ]; then
             print_error "Docker Compose exited with error"
             exit 1
        fi
    fi
    
    echo ""
    
    # Function for cleanup on exit
    cleanup() {
        echo ""
        print_header "🛑 Stopping all services..."
        
        # Stop logging first
        stop_container_logging "$LOGS_DIR"
        
        # Stop containers
        docker compose --env-file "$ENV_FILE" down
        exit
    }
    
    # Set trap for cleanup
    trap cleanup SIGINT SIGTERM
    

    
    # Cleanup will be called automatically on exit
}

# Run main function
main "$@"