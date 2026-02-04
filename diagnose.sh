#!/bin/bash

# Multi-Instance Docker Diagnostic Script
# Run this on the server to diagnose why one instance exits when another starts

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Multi-Instance Docker Diagnostic Tool${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

# 1. Show all inheritance-related containers
echo -e "${YELLOW}📦 Current Containers:${NC}"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}" | grep -E "NAME|chat|stag|inheritance" || echo "  No matching containers found"
echo ""

# 2. Show all inheritance-related images
echo -e "${YELLOW}🖼️  Current Images:${NC}"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedAt}}" | grep -E "REPOSITORY|chat|stag|inheritance" || echo "  No matching images found"
echo ""

# 3. Show all inheritance-related networks
echo -e "${YELLOW}🔗 Current Networks:${NC}"
docker network ls --format "table {{.Name}}\t{{.Driver}}\t{{.Scope}}" | grep -E "NAME|chat|stag|inheritance" || echo "  No matching networks found"
echo ""

# 4. Show Docker Compose projects
echo -e "${YELLOW}📋 Docker Compose Projects:${NC}"
docker compose ls 2>/dev/null || echo "  Unable to list compose projects"
echo ""

# 5. Check if containers are sharing resources
echo -e "${YELLOW}🔍 Checking for shared volumes:${NC}"
for container in $(docker ps -a --format "{{.Names}}" | grep -E "chat|stag|inheritance"); do
    echo "  Container: $container"
    docker inspect "$container" --format '{{range .Mounts}}    - {{.Source}} -> {{.Destination}}{{"\n"}}{{end}}' 2>/dev/null || echo "    (unable to inspect)"
done
echo ""

# 6. Check container logs for exit reason
echo -e "${YELLOW}📜 Recent exit reasons:${NC}"
for container in $(docker ps -a --filter "status=exited" --format "{{.Names}}" | grep -E "chat|stag|inheritance"); do
    echo "  Container: $container"
    EXIT_CODE=$(docker inspect "$container" --format '{{.State.ExitCode}}' 2>/dev/null)
    echo "    Exit Code: $EXIT_CODE"
    echo "    Last 5 lines of log:"
    docker logs "$container" 2>&1 | tail -5 | sed 's/^/      /'
    echo ""
done

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Diagnosis Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Review the output above"
echo "  2. Run 'docker events' in one terminal"
echo "  3. Start second instance in another terminal"
echo "  4. Watch events to see what causes container exit"
echo ""
