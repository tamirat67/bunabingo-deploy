# 🤖 BunaBingo Bot - Telebirr Scraper Subdomain Setup Guide

This guide walks you through setting up your own scraper service under the new subdomain **`rexhetmfgnf.bunatech.net.et`** to replace the deleted/removed third-party service.

---

## 🏗️ Overview of Changes
1. **DNS Portal**: Add an `A` record for `rexhetmfgnf.bunatech.net.et` pointing to your VPS.
2. **Docker Compose**: The scraper service is now included in [docker-compose.yml](file:///c:/Users/habti/OneDrive/Desktop/sfproject/BunaBingoBot/docker-compose.yml) on port `3005`.
3. **Backend Env**: The `BUNA_ENGINE_HOST` in [backend/.env](file:///c:/Users/habti/OneDrive/Desktop/sfproject/BunaBingoBot/backend/.env) has been updated to your new subdomain.
4. **Nginx Reverse Proxy**: Route traffic from `rexhetmfgnf.bunatech.net.et` to the Docker container port `3005`.
5. **Certbot SSL**: Secure the scraper subdomain with HTTPS.

---

## 🛠️ Step 1: Add the Subdomain in the DNS Portal

To point the subdomain `rexhetmfgnf` to your VPS:

1. **Open the DNS Editor**: Go to your Ethio Telecom DNS editor portal.
2. **Add a New Record**:
   - Scroll to the bottom of the table.
   - Click the white **`New`** button on the bottom left.
3. **Fill in the Subdomain Row**:
   - **Host**: `rexhetmfgnf` (this creates `rexhetmfgnf.bunatech.net.et`).
   - **Type**: **`A`**
   - **Value**: Your VPS IP address (e.g. `213.55.96.153`).
   - **TTL**: `86400`
4. **Save**: Click the green **`Save Changes`** button on the bottom right.

---

## 🛡️ Step 2: Configure Nginx on your VPS

Create a reverse proxy rule so Nginx routes requests for `rexhetmfgnf.bunatech.net.et` to your container running on port `3005`.

1. SSH into your VPS.
2. Open your Nginx configuration file:
   ```bash
   sudo nano /etc/nginx/sites-available/bunabingo
   ```
3. Add the following server block to the top or bottom of the file:

```nginx
# ── Telebirr Scraper Service
server {
    listen 80;
    server_name rexhetmfgnf.bunatech.net.et;

    location / {
        proxy_pass http://localhost:3005;
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

4. Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).
5. Test Nginx syntax and reload:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

---

## 🔒 Step 3: Issue SSL Certificate for the Scraper Subdomain

Secure the scraper using Certbot:

```bash
sudo certbot --nginx -d rexhetmfgnf.bunatech.net.et
```
*(Select option `2` to redirect HTTP traffic to HTTPS automatically).*

---

## 🚀 Step 4: Build & Start the Scraper Container

Since the scraper service is now defined in [docker-compose.yml](file:///c:/Users/habti/OneDrive/Desktop/sfproject/BunaBingoBot/docker-compose.yml), you can build and start it directly alongside your main bot application:

```bash
# 1. Pull changes or navigate to the directory
cd ~/bunabingo-deploy

# 2. Build and start all services (including the new scraper)
docker compose up --build -d

# 3. Verify that all 3 services are running
docker compose ps
```

---

## 🔍 Step 5: Verify Setup

Check if your new scraper is successfully running and validating:
* **Test URL**: Open `https://rexhetmfgnf.bunatech.net.et/` in your browser. It should say:
  > **Telebirr Scraper Active** (or *Telebirr Scraper API is running*)
* **Test Receipt Validation**: Run the following command from any terminal to verify the integration between the backend bot and your new scraper:
  ```bash
  curl -H "x-api-key: 9f7a2d8e4c6b1a0f9e8d7c6b5a43210fe9" https://rexhetmfgnf.bunatech.net.et/validate/TEST_TRANSACTION_ID
  ```
