FROM node:20-alpine AS base
WORKDIR /app

# Prisma migrate/query engine + Compose healthcheck (wget) on Alpine
RUN apk add --no-cache openssl libc6-compat wget

# Install dependencies (including devDeps for prisma generate at build).
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=optional && npx prisma generate

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
