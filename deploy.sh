#!/bin/bash
# ============================================
# Burmese Digital Store - VPS Deployment Script
# Run this on your DigitalOcean droplet (Ubuntu)
# Usage: bash deploy.sh
# ============================================

set -e

APP_DIR="/var/www/burmese-digital-store"
REPO_URL="https://github.com/blackcoder436-droid/Burmese-Digital-Store.git"
NODE_VERSION="20"

echo "=========================================="
echo "  Burmese Digital Store - VPS Deployment"
echo "=========================================="

# --- Step 1: System Update ---
echo ""
echo "[1/8] Updating system packages..."
apt update && apt upgrade -y

# --- Step 2: Install Node.js 20 LTS ---
echo ""
echo "[2/8] Installing Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
fi
echo "Node.js: $(node -v)"
echo "npm: $(npm -v)"

# --- Step 3: Install PM2 globally ---
echo ""
echo "[3/8] Installing PM2..."
npm install -g pm2

# --- Step 4: Clone repository ---
echo ""
echo "[4/8] Cloning repository..."
if [ -d "$APP_DIR" ]; then
    echo "Directory exists. Pulling latest changes..."
    cd "$APP_DIR"
    git pull origin main
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# --- Step 5: Install dependencies ---
echo ""
echo "[5/8] Installing dependencies..."
npm ci --production=false

# --- Step 6: Create .env.local ---
echo ""
echo "[6/8] Setting up environment..."
if [ ! -f "$APP_DIR/.env.local" ]; then
    echo "Creating .env.local — You MUST edit this file with your production values!"
    cat > "$APP_DIR/.env.local" << 'ENVEOF'
# ============================================
# Production Environment Variables
# EDIT ALL VALUES BELOW before starting the app
# ============================================

# MongoDB Atlas (direct connection)
MONGODB_URI=mongodb://YOUR_USER:YOUR_PASS@YOUR_HOSTS/burmese-digital-store?ssl=true&replicaSet=YOUR_RS&authSource=admin&retryWrites=true&w=majority

# JWT Secret (MUST be unique per deployment)
JWT_SECRET=CHANGE_THIS_TO_YOUR_GENERATED_SECRET

# App URL
NEXT_PUBLIC_APP_URL=https://burmesedigital.store
NEXT_PUBLIC_APP_NAME=Burmese Digital Store

# Admin Seed Secret
ADMIN_SECRET=CHANGE_THIS_TO_YOUR_ADMIN_SECRET
# Keep disabled in production except first bootstrap window
ENABLE_ADMIN_SEED=false

# 3x-UI VPN Panel
XUI_USERNAME=YOUR_XUI_USERNAME
XUI_PASSWORD=YOUR_XUI_PASSWORD

# SSRF hardening: allowlist for outbound VPN panel domains
VPN_SERVER_ALLOWED_HOSTS=burmesedigital.store

# Resend Email
RESEND_API_KEY=re_YOUR_RESEND_KEY
EMAIL_FROM=noreply@burmesedigital.store
EMAIL_FROM_NAME=Burmese Digital Store

# Rate limiting hardening
# In production, keep fail-closed true so sensitive endpoints don't run unthrottled
RATE_LIMIT_FAIL_CLOSED=true
ENVEOF
    echo ""
    echo "⚠️  IMPORTANT: Edit $APP_DIR/.env.local with your real values!"
    echo "   Run: nano $APP_DIR/.env.local"
    echo ""
    read -p "Press Enter after you have edited .env.local..."
fi

# --- Step 7: Build the app ---
echo ""
echo "[7/8] Building Next.js app..."
cd "$APP_DIR"
npm run build

# --- Step 8: Start with PM2 ---
echo ""
echo "[8/8] Starting app with PM2..."
pm2 delete burmese-digital-store 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# --- Step 9: Set up Nginx reverse proxy ---
echo ""
echo "[BONUS] Setting up Nginx reverse proxy..."
apt install -y nginx

cat > /etc/nginx/sites-available/burmesedigital.store << 'NGINXEOF'
server {
    listen 80;
    server_name burmesedigital.store www.burmesedigital.store;
    server_tokens off;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Reverse proxy to Next.js app
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;

        # File upload limit (for payment screenshots, avatars)
        client_max_body_size 10M;
    }

    # Deny hidden files
    location ~ /\.(?!well-known).* {
        deny all;
    }

    # Static files & uploads
    location /uploads/ {
        alias /var/www/burmese-digital-store/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXEOF

# Enable site
ln -sf /etc/nginx/sites-available/burmesedigital.store /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test & reload
nginx -t && systemctl reload nginx
systemctl enable nginx

echo ""
echo "=========================================="
echo "  ✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "  App:    http://burmesedigital.store"
echo "  PM2:    pm2 status / pm2 logs"
echo "  Nginx:  systemctl status nginx"
echo ""
echo "  IMPORTANT TLS HARDENING:"
echo "    Configure an origin certificate (Let's Encrypt or Cloudflare Origin Cert)"
echo "    and set Cloudflare SSL mode to 'Full (strict)'."
echo "    Do NOT use 'Flexible' in production."
echo ""
echo "  To redeploy after code changes:"
echo "    cd $APP_DIR && git pull && npm ci && npm run build && pm2 restart burmese-digital-store"
echo ""
