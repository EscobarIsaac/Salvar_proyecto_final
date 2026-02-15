# syntax=docker/dockerfile:1
FROM node:20
WORKDIR /app
# Copia solo package.json para instalar dependencias
COPY package.json ./
# Instala dependencias directamente en Linux (sin package-lock.json de Windows)
RUN npm install
# Fuerza la instalación del módulo nativo de Rollup para Linux
RUN npm install --force @rollup/rollup-linux-x64-gnu
# Copia el resto del código (node_modules ya está excluido por .dockerignore)
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
