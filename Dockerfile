# --- Build Stage ---
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build Next.js
RUN npm run build

# --- Production Stage ---
FROM node:18-alpine

WORKDIR /app

# Copy built assets
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

# Environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]
