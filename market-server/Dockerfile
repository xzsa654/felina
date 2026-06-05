FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --production

FROM node:22-alpine
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src/ ./src/
COPY migrations/ ./migrations/
EXPOSE 3100
CMD ["node", "src/server.js"]
