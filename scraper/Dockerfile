FROM node:20-alpine

WORKDIR /app

# Install Tesseract dependencies for OCR if needed
RUN apk add --no-cache tesseract-ocr

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "app.js"]
