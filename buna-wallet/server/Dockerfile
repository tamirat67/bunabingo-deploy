FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Set environment
ENV NODE_ENV=production

# Expose port (default 3004 for OTP Server)
EXPOSE 3004

# Start the server
CMD ["node", "index.js"]
