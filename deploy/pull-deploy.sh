#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Signal Scorer Pro — Git-based server deploy script
# Runs ON the server. Pulls latest code, rebuilds, and restarts PM2.
# Usage: ssh -p 2222 root@187.127.153.105 "bash /opt/signal-scorer/deploy/pull-deploy.sh"
# ─────────────────────────────────────────────────────────────────────────────

APP_DIR="/opt/signal-scorer"
cd "$APP_DIR"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  🔄 Signal Scorer Pro — Pull & Deploy"
echo "══════════════════════════════════════════════════════════"
echo ""

# 1. Pull latest code
echo "[1/4] Pulling latest from GitHub..."
git pull origin main
echo "      ✅ Code updated"

# 2. Install/update dependencies (override NODE_ENV so devDeps like vite are included)
echo ""
echo "[2/4] Installing dependencies..."
NODE_ENV=development npm install 2>&1 | tail -3
echo "      ✅ Dependencies installed"

# 3. Build frontend
echo ""
echo "[3/4] Building frontend..."
npx vite build
echo "      ✅ Frontend built"

# 4. Restart PM2
echo ""
echo "[4/4] Restarting application..."
pm2 restart signal-scorer || pm2 start ecosystem.config.cjs
pm2 save
echo "      ✅ Application restarted"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✅ Deploy complete! App: http://$(hostname -I | awk '{print $1}'):9000"
echo "══════════════════════════════════════════════════════════"
