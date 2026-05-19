#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Signal Scorer Pro — Remote Server Setup Script
# Runs ON the server via SSH. Installs Node.js 20, PM2, and prepares the env.
# ─────────────────────────────────────────────────────────────────────────────

APP_DIR="/opt/signal-scorer"

echo "══════════════════════════════════════════════════════════"
echo "  Signal Scorer Pro — Server Setup"
echo "══════════════════════════════════════════════════════════"

# 1. System update
echo "[1/6] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# 2. Install Node.js 20 LTS via NodeSource
if command -v node &> /dev/null; then
  NODE_VER=$(node -v)
  echo "[2/6] Node.js already installed: $NODE_VER"
else
  echo "[2/6] Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo "      Installed: $(node -v)"
fi

# 3. Install build essentials for native modules (better-sqlite3)
echo "[3/6] Installing build tools for native modules..."
apt-get install -y -qq build-essential python3

# 4. Install PM2 globally
if command -v pm2 &> /dev/null; then
  echo "[4/6] PM2 already installed."
else
  echo "[4/6] Installing PM2..."
  npm install -g pm2
  pm2 startup systemd -u root --hp /root
fi

# 5. Create app directory and logs
echo "[5/6] Setting up application directory..."
mkdir -p "$APP_DIR/logs"

# 6. Configure firewall to allow port 9000
echo "[6/6] Configuring firewall..."
if command -v ufw &> /dev/null; then
  ufw allow 9000/tcp 2>/dev/null || true
  ufw allow 2222/tcp 2>/dev/null || true
  echo "      Port 9000 opened."
else
  echo "      ufw not found — make sure port 9000 is open in Hostinger panel."
fi

echo ""
echo "══════════════════════════════════════════════════════════"
echo "  ✅ Server setup complete!"
echo "  Node: $(node -v) | NPM: $(npm -v) | PM2: $(pm2 -v)"
echo "══════════════════════════════════════════════════════════"
