#!/bin/bash
# ─── BunaBingo VPS Deploy Script ─────────────────────────────────────────────
# Run once on the server: bash deploy.sh
# For updates: bash deploy.sh update
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

MODE=${1:-"full"}

# ── Preflight checks ──────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || error "Docker not installed. Run: sudo apt install docker.io -y"
docker compose version >/dev/null 2>&1 || error "Docker Compose is not installed. Please install docker-compose-v2."

# ── Update mode (git pull + rebuild) — BYPASSES ALL .env CHECKS ──────────────
if [ "$MODE" = "update" ]; then
  info "Pulling latest code..."
  git pull

  info "Rebuilding and restarting containers..."
  docker compose up --build -d

  info "Running database schema push..."
  docker compose exec -T backend npx prisma db push

  info "✅ Update complete!"
  docker compose ps
  exit 0
fi

if [ ! -f "backend/.env" ]; then
  error "Missing backend/.env — copy it from the deployment_manual.md and fill in your secrets."
fi

if [ ! -f ".env" ]; then
  warn ".env not found at root. Using defaults from docker-compose.yml."
fi

# ── Full first-time install ───────────────────────────────────────────────────
info "Starting full deployment..."

# Build images
info "Building Docker images (this may take 3-5 minutes)..."
docker compose build --no-cache

# Start services
info "Starting services..."
docker compose up -d

# Wait for backend to be healthy
info "Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if docker compose exec -T backend wget -qO- http://localhost:3001/health >/dev/null 2>&1; then
    info "Backend is healthy!"
    break
  fi
  echo -n "."
  sleep 2
done

# Run DB push
info "Syncing database schema..."
docker compose exec -T backend npx prisma db push || warn "Database push failed — please check connection"

# Summary
echo ""
info "═══════════════════════════════════════════"
info "  ☕ BunaBingo is LIVE!"
info "  Backend:  http://localhost:3001"
info "  Frontend: http://localhost:3000"
info "  Health:   http://localhost:3001/health"
info "═══════════════════════════════════════════"
echo ""
info "Useful commands:"
echo "  docker compose logs -f          # live logs"
echo "  docker compose ps               # status"
echo "  docker compose restart backend  # restart one service"
echo "  bash deploy.sh update           # pull + redeploy"
