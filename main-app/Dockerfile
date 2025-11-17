FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run prisma:generate

EXPOSE 3001

CMD ["npm", "start"]
