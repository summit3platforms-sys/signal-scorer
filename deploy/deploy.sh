#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Signal Scorer Pro — Full Deploy Script (run from your Mac)
# Builds frontend, syncs to server, installs deps, starts with PM2
# ─────────────────────────────────────────────────────────────────────────────

REMOTE_USER="root"
REMOTE_HOST="187.127.153.105"
REMOTE_PORT="2222"
REMOTE_DIR="/opt/signal-scorer"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"

SSH_CMD="ssh -p $REMOTE_PORT -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST"

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  🚀 Signal Scorer Pro — Full Deployment"
echo "══════════════════════════════════════════════════════════"
echo ""

# ── Step 1: Build frontend ────────────────────────────────────────────────
echo "[1/5] Building production frontend..."
cd "$LOCAL_DIR"
npm run build
echo "      ✅ Frontend built to ./dist"

# ── Step 2: Create remote directory ───────────────────────────────────────
echo ""
echo "[2/5] Preparing server..."
$SSH_CMD "mkdir -p $REMOTE_DIR/logs"

# ── Step 3: Sync files (excludes node_modules, db, .env) ─────────────────
echo ""
echo "[3/5] Syncing project files to server..."
rsync -avz --progress \
  -e "ssh -p $REMOTE_PORT -o StrictHostKeyChecking=no" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.production' \
  --exclude='signal-scorer.db' \
  --exclude='signal-scorer.db-shm' \
  --exclude='signal-scorer.db-wal' \
  --exclude='test-*.js' \
  --exclude='testBinance*.js' \
  --exclude='testTelegram.js' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='.vscode' \
  --exclude='.idea' \
  --exclude='deploy/' \
  "$LOCAL_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
echo "      ✅ Files synced"

# ── Step 4: Upload production .env (only if missing on server) ────────────
echo ""
echo "[4/5] Checking server .env..."
ENV_EXISTS=$($SSH_CMD "test -f $REMOTE_DIR/.env && echo 'yes' || echo 'no'")
if [ "$ENV_EXISTS" = "no" ]; then
  echo "      Uploading production .env..."
  scp -P $REMOTE_PORT -o StrictHostKeyChecking=no \
    "$LOCAL_DIR/.env.production" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/.env"
  echo "      ✅ .env uploaded"
else
  echo "      ✅ .env already exists on server (skipping)"
fi

# ── Step 5: Install deps + start PM2 ─────────────────────────────────────
echo ""
echo "[5/5] Installing dependencies and starting app..."
$SSH_CMD << 'ENDSSH'
  cd /opt/signal-scorer

  # Install production dependencies (rebuilds native modules on server arch)
  echo "      Installing npm packages..."
  npm ci --omit=dev 2>&1 | tail -3

  # Start/restart via PM2
  echo "      Starting PM2..."
  pm2 delete signal-scorer 2>/dev/null || true
  pm2 start ecosystem.config.cjs
  pm2 save

  echo ""
  echo "      PM2 Status:"
  pm2 status
ENDSSH

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✅ Deployment complete!"
echo ""
echo "  🌐 App URL: http://$REMOTE_HOST:9000"
echo ""
echo "  Useful SSH commands:"
echo "    ssh -p 2222 root@$REMOTE_HOST"
echo "    pm2 logs signal-scorer"
echo "    pm2 restart signal-scorer"
echo "══════════════════════════════════════════════════════════"
