# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Variables de entorno para el build
ARG VITE_API_URL
ARG VITE_AUTH_URL
ARG VITE_WS_URL

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Build de producción
RUN npm run build

# Production stage con nginx
FROM nginx:alpine

# Copiar build al directorio de nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración personalizada de nginx para el contenedor
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponer puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]