#!/bin/bash
# =============================================================================
# init.sh - Initialize Minecraft Platform for First Run
# =============================================================================
# This script prepares the platform for initial operation:
#   1. Validates Docker and Docker Compose installation
#   2. Creates/validates .env configuration
#   3. Creates required directories
#   4. Builds custom Docker images (mdns-publisher)
#   5. Creates Docker network and volumes
#   6. Performs initial docker-compose config validation
#
# Usage:
#   ./scripts/init.sh [options]
#
# Options:
#   --create-server NAME [TYPE]  Create initial server after setup
#   --skip-validation            Skip Docker/Compose validation
#   --skip-build                 Skip Docker image builds
#   --skip-compose-up            Only initialize, don't start services
#   -h, --help                   Show this help
#
# Example:
#   ./scripts/init.sh
#   ./scripts/init.sh --create-server myserver PAPER
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_DIR="$PLATFORM_DIR/servers/_template"
ENV_FILE="$PLATFORM_DIR/.env"
ENV_EXAMPLE="$PLATFORM_DIR/.env.example"

# Default options
VALIDATE_DOCKER=true
BUILD_IMAGES=true
START_SERVICES=true
CREATE_SERVER_NAME=""
CREATE_SERVER_TYPE="PAPER"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --create-server)
            CREATE_SERVER_NAME="$2"
            CREATE_SERVER_TYPE="${3:-PAPER}"
            shift 3
            ;;
        --skip-validation)
            VALIDATE_DOCKER=false
            shift
            ;;
        --skip-build)
            BUILD_IMAGES=false
            shift
            ;;
        --skip-compose-up)
            START_SERVICES=false
            shift
            ;;
        -h|--help)
            sed -n '/^# Usage:/,/^$/p' "$0" | sed 's/^# *//'
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}"
            exit 1
            ;;
    esac
done

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}  $1${NC}"
    echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# =============================================================================
# 1. Validate Docker and Docker Compose
# =============================================================================

if [ "$VALIDATE_DOCKER" = true ]; then
    print_header "Step 1: Validating Docker and Docker Compose"

    print_step "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. Please install Docker Engine 20.10+"
        exit 1
    fi
    DOCKER_VERSION=$(docker --version | grep -oP '\d+\.\d+' | head -1)
    print_success "Docker $DOCKER_VERSION found"

    print_step "Checking Docker Compose installation..."
    if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose not found. Please install Docker Compose v2.0+"
        exit 1
    fi
    if command -v docker compose &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version 2>&1 | grep -oP '\d+\.\d+' | head -1 || echo "unknown")
        DOCKER_COMPOSE_CMD="docker compose"
    else
        COMPOSE_VERSION=$(docker-compose --version 2>&1 | grep -oP '\d+\.\d+' | head -1 || echo "unknown")
        DOCKER_COMPOSE_CMD="docker-compose"
    fi
    print_success "Docker Compose $COMPOSE_VERSION found"

    print_step "Checking Docker daemon..."
    if ! docker info &> /dev/null; then
        print_error "Cannot connect to Docker daemon. Please ensure Docker is running"
        exit 1
    fi
    print_success "Docker daemon is running"
fi

# =============================================================================
# 2. Setup Environment File
# =============================================================================

print_header "Step 2: Setting up environment configuration"

if [ ! -f "$ENV_FILE" ]; then
    print_step "Creating .env from template..."
    if [ -f "$ENV_EXAMPLE" ]; then
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        print_success ".env created from .env.example"
    else
        print_warning ".env.example not found, creating minimal .env"
        cat > "$ENV_FILE" << 'EOF'
# Multi-Server Minecraft Management
MINECRAFT_NETWORK=minecraft-net
MINECRAFT_SUBNET=172.28.0.0/16
DEFAULT_MEMORY=4G
DEFAULT_VERSION=1.20.4
TZ=Asia/Seoul
RCON_PASSWORD=changeme
COMPOSE_PROJECT_NAME=minecraft
EOF
        print_success "Minimal .env created"
    fi
    print_warning "Please review and update .env with your settings"
else
    print_success ".env already exists"
fi

# =============================================================================
# 3. Create Required Directories
# =============================================================================

print_header "Step 3: Creating required directories"

DIRS=(
    "$PLATFORM_DIR/servers"
    "$PLATFORM_DIR/shared/plugins"
    "$PLATFORM_DIR/shared/mods"
    "$PLATFORM_DIR/worlds"
    "$PLATFORM_DIR/worlds/.locks"
    "$PLATFORM_DIR/backups/servers"
    "$PLATFORM_DIR/backups/worlds"
)

for dir in "${DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        print_step "Created: $dir"
    fi
done

print_success "All directories validated/created"

# =============================================================================
# 4. Build Custom Docker Images
# =============================================================================

if [ "$BUILD_IMAGES" = true ]; then
    print_header "Step 4: Building custom Docker images"

    MDNS_DOCKERFILE="$PLATFORM_DIR/services/mdns-publisher/Dockerfile"
    if [ -f "$MDNS_DOCKERFILE" ]; then
        print_step "Building mdns-publisher image..."
        cd "$PLATFORM_DIR" && docker build -t mdns-publisher:latest ./services/mdns-publisher/
        print_success "mdns-publisher image built"
    else
        print_warning "mdns-publisher Dockerfile not found, skipping"
    fi
fi

# =============================================================================
# 5. Validate docker-compose.yml
# =============================================================================

print_header "Step 5: Validating Docker Compose configuration"

print_step "Validating $PLATFORM_DIR/docker-compose.yml..."
cd "$PLATFORM_DIR"
if ! $DOCKER_COMPOSE_CMD config > /dev/null 2>&1; then
    print_error "Docker Compose configuration is invalid"
    $DOCKER_COMPOSE_CMD config
    exit 1
fi
print_success "Docker Compose configuration is valid"

# =============================================================================
# 6. Create/Verify Docker Network
# =============================================================================

print_header "Step 6: Setting up Docker network and volumes"

# Source .env to get network settings
set -a
source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$') 2>/dev/null || true
set +a

NETWORK_NAME="${MINECRAFT_NETWORK:-minecraft-net}"
print_step "Checking network: $NETWORK_NAME"

if ! docker network ls | grep -q "^[^ ]*${NETWORK_NAME}"; then
    print_step "Creating network: $NETWORK_NAME"
    docker network create \
        --driver bridge \
        --subnet "${MINECRAFT_SUBNET:-172.28.0.0/16}" \
        "$NETWORK_NAME" 2>/dev/null || true
    print_success "Network created/verified"
else
    print_success "Network already exists"
fi

# =============================================================================
# 7. Create Initial Server (Optional)
# =============================================================================

if [ -n "$CREATE_SERVER_NAME" ]; then
    print_header "Step 7: Creating initial server"
    print_step "Creating server: $CREATE_SERVER_NAME ($CREATE_SERVER_TYPE)"
    
    if [ -x "$SCRIPT_DIR/create-server.sh" ]; then
        "$SCRIPT_DIR/create-server.sh" "$CREATE_SERVER_NAME" -t "$CREATE_SERVER_TYPE" --no-start
        print_success "Server created: $CREATE_SERVER_NAME"
    else
        print_error "create-server.sh not found or not executable"
        exit 1
    fi
else
    print_header "Step 7: Initial server creation"
    print_warning "No initial server requested (use --create-server NAME [TYPE] to create one)"
fi

# =============================================================================
# 8. Start Services (Optional)
# =============================================================================

if [ "$START_SERVICES" = true ]; then
    print_header "Step 8: Starting platform services"
    
    print_step "Starting Docker Compose services..."
    cd "$PLATFORM_DIR"
    $DOCKER_COMPOSE_CMD up -d mdns-publisher router 2>&1 | grep -E '(Creating|Created|Starting|Started)' || true
    
    print_success "Platform services started"
    
    # Wait for router to be ready
    print_step "Waiting for router to be ready..."
    for i in {1..30}; do
        if docker exec mc-router nc -zv localhost 25565 &> /dev/null; then
            print_success "Router is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_warning "Router startup timeout (may still be initializing)"
        fi
        sleep 1
    done
else
    print_header "Step 8: Services not started"
    print_warning "Use 'docker compose up -d' to start services manually"
fi

# =============================================================================
# 9. Summary
# =============================================================================

print_header "Initialization Complete ✓"

cat << EOF

${GREEN}Platform Status:${NC}

  📁 Configuration:  $ENV_FILE
  🐳 Network:        $NETWORK_NAME
  📂 Directories:    Created
  🖼️  Images:        Built
  
${GREEN}Next Steps:${NC}

  1. Create your first server:
     cd $PLATFORM_DIR
     ./scripts/create-server.sh myserver --type PAPER

  2. Connect to server (mDNS):
     Open Minecraft and connect to: myserver.local:25565

  3. View server status:
     ./scripts/mcctl.sh status

  4. View logs:
     ./scripts/mcctl.sh logs myserver

${YELLOW}Environment Reminder:${NC}

  ⚠️  Default RCON_PASSWORD is 'changeme' - change in .env for production!
  ⚠️  Ensure avahi-daemon is running for mDNS auto-discovery on Linux

${BLUE}Documentation:${NC}

  📖 Getting Started: Read docs/01-getting-started.md
  📖 Full Docs:       See docs/doc-list.md

EOF

print_success "Platform ready to use!"
exit 0
