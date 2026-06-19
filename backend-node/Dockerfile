FROM node:20-alpine AS base
WORKDIR /app

# Prisma migrate/query engine + Compose healthcheck (wget) + video transcode on Alpine
RUN apk add --no-cache openssl libc6-compat wget ffmpeg

ENV FFMPEG_PATH=/usr/bin/ffmpeg

# Install dependencies (including devDeps for prisma generate at build).
COPY package*.json ./
COPY prisma ./prisma
# sharp ships platform binaries as optional deps — install musl build for node:20-alpine.
RUN npm install --omit=optional \
 && npm install --no-save --os=linux --libc=musl --cpu=x64 sharp \
 && npx prisma generate

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "node scripts/migrate-via-direct.js && node src/index.js"]
