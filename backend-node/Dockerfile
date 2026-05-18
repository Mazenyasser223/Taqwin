FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies (including devDeps for prisma generate at build).
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=optional && npx prisma generate

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
