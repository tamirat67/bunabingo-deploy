# 🚀 BunaBingo Bot Deployment Manual (Ubuntu VPS)

This comprehensive guide details the step-by-step instructions to configure, launch, and maintain the optimized, high-performance **Buna Bingo Bot** platform inside Docker containers on a live Ubuntu Virtual Private Server (VPS).

---

## 🏗️ Architecture Design Overview

```
                   [ 🌎 Global Telegram & Web Clients ]
                                  │
                                  ▼
                     [ 🛡️ Nginx Reverse Proxy (SSL) ]
                     ├── api.bunatechhub.net  → Port 3001 (backend)
                     └── bunatechhub.net      → Port 3000 (frontend)
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[ 🐳 Docker: buna-backend ]                      [ 🐳 Docker: buna-frontend ]
  Node.js API + Socket.io Server                   Next.js Web Client (Mini-App)
  Active Telegram Bot Worker                       Ultra-fast sessionStorage caching
  Auto CBE/Telebirr Scrapers                       Shared B-I-N-G-O columns
  Prisma Client Generation                         Ergonomic FAB + Add Board
         │
         └───────────── [ 🛢️ Neon Serverless PostgreSQL ] (External Cloud DB)
```

---

## 📋 1. System & Dependencies Preparation

First, SSH into your Ubuntu VPS as a root or sudo privileged user, update package indices, and install the Docker engine:

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Docker and Docker Compose
sudo apt install docker.io docker-compose -y

# 3. Enable and start Docker service automatically on system boot
sudo systemctl enable --now docker

# 4. Add your current user to the docker group (to run commands without sudo)
sudo usermod -aG docker $USER
```
*Note: After adding yourself to the docker group, logout and log back in, or run `newgrp docker` to apply.*

---

## 📂 2. Get the Source Code

Clone your repository branch directly into your server home directory:

```bash
# Clone the repository
git clone https://github.com/tamirat67/bunabingo-deploy.git
cd bunabingo-deploy
```

---

## 🔑 3. Create Live Production Environment Files

Create the two essential production environment files locally inside the project to connect your bot, payment validators, and database.

### 📁 A. Backend Env: `backend/.env`
Create this file at `~/bunabingo-deploy/backend/.env`:

```env
# ── Neon Database Connection (Using Pooled Connection URL)
DATABASE_URL="postgresql://neondb_owner:npg_gT4s6LNJFqhy@ep-blue-violet-ap6k9k4v-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:npg_gT4s6LNJFqhy@ep-blue-violet-ap6k9k4v.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"

# ── App Ports & Production Node Env
PORT=3001
NODE_ENV=production

# ── Telegram Bot Configurations (Bot Token + Live Host Webhook)
BOT_TOKEN="8263717692:AAGOMupsaToz9jXoXanTA0VgBJN_qC7igxo"
TELEGRAM_BOT_TOKEN="8263717692:AAGOMupsaToz9jXoXanTA0VgBJN_qC7igxo"
WEBHOOK_URL="https://api.bunatechhub.net"
MINI_APP_URL="https://bunatechhub.net"

# ── Financial Limits & Engine Host (Automated Scraper)
HOUSE_EDGE_PERCENT=25
MIN_WITHDRAWAL=200
MAX_WITHDRAWAL=10000

# Scraper & Engine Configs (BUNA Engine Core Host)
BUNA_ENGINE_HOST="http://rexhetmfgnf.aabte.com.et"
BUNA_ENGINE_KEY="9f7a2d8e4c6b1a0f9e8d7c6b5a43210fe9"

# ── JWT Authentication Secret (Choose a long, random secure string)
JWT_SECRET="dfd827f8a12bc85e718b52c0da473e16bfa87cc14db8b89e3a6c117f2e149a1d"
```

### 📁 B. Frontend Env: `.env`
Create this file in the root project folder `~/bunabingo-deploy/.env`:

```env
# ── WebClient Build Variables (Baked into the client build)
NEXT_PUBLIC_API_URL="https://api.bunatechhub.net"
NEXT_PUBLIC_PUSHER_KEY="13890cf18bf6ba41dc0d"
NEXT_PUBLIC_PUSHER_CLUSTER="ap2"
```

> [!IMPORTANT]
> Because Next.js optimizes the frontend at compile time, environment variables prefixed with `NEXT_PUBLIC_` are baked into the static bundle during **`docker compose build`**. If you ever modify these values, you must rebuild the image with `--no-cache`.

---

## 🐳 4. Build and Spin Up Docker Containers

To build your images cleanly and run the app in the background, run:

```bash
# 1. Build backend and frontend images from scratch without using stale caching layers
docker compose build --no-cache

# 2. Run both containers in detached background mode
docker compose up -d
```

### 🗄️ 5. Run Database Migrations & Prisma Schema
Once the containers have finished booting up successfully, compile your live Prisma client and sync the schema with your database:

```bash
# Generate the Prisma Client internally in the container
docker compose exec backend npx prisma generate

# Sync structure, create indexes, and sync prisma mapping
docker compose exec backend npx prisma db push
```

---

## 🛡️ 6. Configure Nginx Reverse Proxy & SSL

Install Nginx and route traffic securely from the web to your Docker containers.

```bash
# 1. Install Nginx
sudo apt install nginx -y

# 2. Open a new configuration file for Buna Bingo
sudo nano /etc/nginx/sites-available/bunabingo
```

Paste the following configuration cleanly into Nano, then save (`Ctrl+O`) and exit (`Ctrl+X`):

```nginx
# ── Live Backend API & WebSocket Server
server {
    listen 80;
    server_name api.bunatechhub.net;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}

# ── Live Next.js Web Client (Mini App)
server {
    listen 80;
    server_name bunatechhub.net www.bunatechhub.net;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable your virtual host and reload Nginx to activate changes:

```bash
# Symlink site configuration
sudo ln -sf /etc/nginx/sites-available/bunabingo /etc/nginx/sites-enabled/

# Test syntax validity and reload
sudo nginx -t && sudo systemctl reload nginx
```

### 🔒 7. Secure Connections with Let's Encrypt SSL
Apply automatic Certbot HTTPS certificates for all subdomains:

```bash
# 1. Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# 2. Obtain and attach SSL certificates automatically
sudo certbot --nginx -d api.bunatechhub.net -d bunatechhub.net -d www.bunatechhub.net
```
*Follow the on-screen steps. Select option `2` to automatically redirect all HTTP traffic to secure HTTPS!*

---

## 📈 8. Post-Deployment Verification & Diagnostics

Use these diagnostic tools to check the status of your live system:

```bash
# View active containers and healthcheck statuses
docker compose ps

# Check the live WebSockets connection and health endpoint
curl https://api.bunatechhub.net/health

# View live consolidated container logs in real time
docker compose logs -f

# View live logs for the Telegram Bot / API backend exclusively
docker compose logs -f backend
```

---

## 🛠️ Essential Admin Operations & Commands

| Task Action | Command to Execute |
|---|---|
| **Deploy a Fresh Update** | `git pull origin main && docker compose build --no-cache && docker compose up -d` |
| **View Real-Time Backend Logs** | `docker compose logs -f backend` |
| **View Live Frontend Logs** | `docker compose logs -f frontend` |
| **Stop All Containers** | `docker compose down` |
| **Restart Backend Container Only** | `docker compose restart backend` |
| **Prisma Manual Sync** | `docker compose exec backend npx prisma db push` |
| **Open Internals Container Shell** | `docker compose exec backend sh` |

---

## 🔁 Auto-Recovery Configuration
Since we added `restart: always` directly into `docker-compose.yml`, your game app will recover instantly if a crash occurs. Ensure the Docker daemon auto-starts if your physical VPS undergoes a reboot:

```bash
sudo systemctl enable docker
```

---

> [!NOTE]
> **Scrapers & Deposits Worker:** The CBE/Telebirr auto-deposit scraper runs as a non-blocking cron task every **60 seconds**.
> **Performance Improvements:** The calling page uses client memory caches. Transitioning from the cards screen will display your boards instantly (0ms network request) with **zero loading indicators**!
