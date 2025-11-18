FROM node:20-alpine

WORKDIR /app

# Instalar OpenSSL necesario para Prisma
RUN apk add --no-cache openssl

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run prisma:generate

CMD ["npm", "start"]
