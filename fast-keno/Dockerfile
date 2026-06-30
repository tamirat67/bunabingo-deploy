FROM node:20-slim

# Install OpenSSL for Prisma on Debian
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 8090 8091

CMD ["node", "dist/worker/index.js"]
