# syntax=docker/dockerfile:1
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* bun.lockb* ./
RUN npm install || bun install || true
COPY . .
CMD ["npm", "run", "dev", "--", "--host"]
