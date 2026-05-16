# --- Build Stage ---
FROM node:18-alpine AS builder

WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm install

# Copy source and prisma schema
COPY . .
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# --- Production Stage ---
FROM node:18-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache openssl

# Copy production dependencies only
COPY package*.json ./
RUN npm install --production

# Copy built assets and prisma client
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Ensure uploads directory exists in case it was missing
RUN mkdir -p uploads
# Copy existing uploads if any
COPY --from=builder /app/uploads* ./uploads/

# Environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"]
