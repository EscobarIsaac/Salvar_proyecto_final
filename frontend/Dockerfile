# syntax=docker/dockerfile:1
FROM node:20-bookworm-slim

WORKDIR /app

# Copia solo package.json/package-lock para instalar deps de forma reproducible
COPY package.json package-lock.json ./
RUN npm ci

# Fuerza la instalación del módulo nativo de Rollup para Linux (cuando sea necesario)
RUN npm install --force @rollup/rollup-linux-x64-gnu

# Copia el resto del código (node_modules ya está excluido por .dockerignore)
COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
