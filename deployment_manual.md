# 🚀 BunaBingo Deployment Manual (Ubuntu VPS)

## Architecture Overview
```
VPS (Ubuntu)
 ├── Nginx (reverse proxy + SSL)
 │    ├── api.bunatechhub.net  → Docker: buna-backend  (port 3001)
 │    └── bunatechhub.net      → Docker: buna-frontend (port 3000)
 ├── Docker: buna-backend   (Node.js API + Telegram Bot)
 └── Docker: buna-frontend  (Next.js Mini App)
```

Database: **Neon PostgreSQL** (external — no local DB container needed)

---

## 1. System Preparation

SSH into your VPS, then:

```bash
sudo apt update && sudo apt upgrade -y

# Install Docker
sudo apt install docker.io docker-compose -y
sudo systemctl enable --now docker
sudo usermod -aG docker $USER   # allow running docker without sudo (re-login after)
```

---

## 2. Clone the Repository

```bash
git clone https://github.com/tamirat67/bunabingo-deploy.git
cd bunabingo-deploy
```

---

## 3. Create Environment Files

### Backend: `backend/.env`

```env
DATABASE_URL="postgresql://neondb_owner:<PASSWORD>@ep-blue-violet-ap6k9k4v-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:<PASSWORD>@ep-blue-violet-ap6k9k4v-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require"

PORT=3001
NODE_ENV=production

BOT_TOKEN=8263717692:AAGOMupsaToz9jXoXanTA0VgBJN_qC7igxo
TELEGRAM_BOT_TOKEN=8263717692:AAGOMupsaToz9jXoXanTA0VgBJN_qC7igxo
WEBHOOK_URL=https://api.bunatechhub.net
MINI_APP_URL=https://bunatechhub.net

HOUSE_EDGE_PERCENT=25
MIN_WITHDRAWAL=200
MAX_WITHDRAWAL=10000

BUNA_ENGINE_HOST=https://rexhetmfgnf.aabte.com.et
BUNA_ENGINE_KEY=9f7a2d8e4c6b1a0f9e8d7c6b5a43210fe9

JWT_SECRET=change_this_to_a_long_random_secret
```

### Frontend: `.env` (root of project)

```env
NEXT_PUBLIC_API_URL=https://api.bunatechhub.net
NEXT_PUBLIC_PUSHER_KEY=13890cf18bf6ba41dc0d
NEXT_PUBLIC_PUSHER_CLUSTER=ap2
```

> [!IMPORTANT]
> The frontend `.env` values are baked into the Next.js bundle at **build time**.
> If you change `NEXT_PUBLIC_API_URL` later, you must rebuild: `bash deploy.sh update`

---

## 4. Deploy (One Command)

```bash
bash deploy.sh
```

This will:
1. Build both Docker images
2. Start all containers in the background
3. Wait for the backend to be healthy
4. Run Prisma DB migrations automatically

For future updates after `git pull`:
```bash
bash deploy.sh update
```

---

## 5. Nginx Reverse Proxy

```bash
sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/bunabingo
```

Paste this configuration:

```nginx
# ── Backend API ───────────────────────────────────────────
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

# ── Frontend Mini App ─────────────────────────────────────
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

Enable and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/bunabingo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.bunatechhub.net -d bunatechhub.net -d www.bunatechhub.net
```

Certbot will auto-renew. Test renewal with:
```bash
sudo certbot renew --dry-run
```

---

## 7. Verify Everything is Running

```bash
# Check container status
docker-compose ps

# Check backend health
curl https://api.bunatechhub.net/health

# Live logs
docker-compose logs -f

# Only backend logs
docker-compose logs -f backend
```

---

## 🛠️ Useful Commands

| Task | Command |
|---|---|
| Full deploy | `bash deploy.sh` |
| Update after git pull | `bash deploy.sh update` |
| Stop all | `docker-compose down` |
| Restart backend only | `docker-compose restart backend` |
| View live logs | `docker-compose logs -f` |
| Run DB migration | `docker-compose exec backend npx prisma migrate deploy` |
| Open backend shell | `docker-compose exec backend sh` |
| Force rebuild | `docker-compose up --build -d` |

---

## 🔁 Auto-Restart on VPS Reboot

Docker containers already have `restart: always` set. To ensure Docker itself starts on boot:

```bash
sudo systemctl enable docker
```

---

## ⚠️ Troubleshooting

**Backend not starting?**
```bash
docker-compose logs backend
```
Check for missing `backend/.env` variables.

**Frontend shows blank page?**
```bash
docker-compose logs frontend
```
Ensure `NEXT_PUBLIC_API_URL` points to `https://api.bunatechhub.net` (with HTTPS).

**Bot not responding?**
- Verify `WEBHOOK_URL` in `backend/.env` matches `https://api.bunatechhub.net`
- Check the Telegram webhook is set: `curl https://api.bunatechhub.net/health`
- Restart backend: `docker-compose restart backend`
