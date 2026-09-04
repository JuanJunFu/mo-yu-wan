FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
# 自簽憑證供語音（HTTPS）使用
RUN apk add --no-cache openssl && mkdir -p /app/certs && \
    openssl req -x509 -newkey rsa:2048 -nodes -keyout /app/certs/key.pem -out /app/certs/cert.pem -days 3650 \
    -subj "/CN=moyu-wang" -addext "subjectAltName=DNS:localhost"
EXPOSE 3000 3443
CMD ["node", "server.js"]
