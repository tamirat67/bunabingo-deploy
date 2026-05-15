# 🚀 BunaBingo Deployment Manual (Ubuntu VPS)

Congratulations on your new VPS! This guide will walk you through deploying your containerized platform using Docker and Nginx.

## 1. System Preparation
Login to your VPS and update the system:
```bash
sudo apt update && sudo apt upgrade -y
```

Install Docker and Docker Compose:
```bash
sudo apt install docker.io docker-compose -y
sudo systemctl start docker
sudo systemctl enable docker
```

## 2. Code Deployment
Clone your repository:
```bash
git clone https://github.com/tamirat67/bunabingo-deploy.git
cd bunabingo-deploy
```

## 3. Environment Configuration
You need to create/copy your `.env` files into each service directory:

- **Backend**: `backend/.env`
- **Frontend**: `.env.local`
- **Scraper**: `scraper/.env`

> [!IMPORTANT]
> Ensure your `DATABASE_URL` is correct. The `BUNA_ENGINE_HOST` is pre-configured to use your production scraper at `https://rexhetmfgnf.aabte.com.et`. 
> 
> If you decide to use the local Docker scraper instead, update this to `http://scraper:3000`.

## 4. Launch with Docker Compose
Build and start all services in the background:
```bash
docker-compose up --build -d
```

Check logs to ensure everything is running:
```bash
docker-compose logs -f
```

## 5. Nginx Reverse Proxy (Exposing to the Web)
Install Nginx:
```bash
sudo apt install nginx -y
```

Create a site configuration:
```bash
sudo nano /etc/nginx/sites-available/bunabingo
```

Paste this configuration (Tailored for **bunatechhub.net**):
```nginx
server {
    listen 80;
    server_name api.bunatechhub.net;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 80;
    server_name app.bunatechhub.net;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/bunabingo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL Security (Certbot)
Secure your domains with Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.bunatechhub.net -d app.bunatechhub.net
```

## 7. Database Migrations
Run your Prisma migrations inside the container:
```bash
docker-compose exec backend npx prisma migrate deploy
```

---

### 🛠️ Useful Commands
- **Stop App**: `docker-compose down`
- **Restart App**: `docker-compose restart`
- **View Logs**: `docker-compose logs -f`
- **Update Code**: `git pull && docker-compose up --build -d`
