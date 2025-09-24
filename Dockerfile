# syntax=docker/dockerfile:1.5

FROM node:18-alpine AS base
WORKDIR /app
ENV NODE_ENV=development

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . ./
RUN npm run build

FROM node:18-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --production
COPY --from=build /app/dist ./dist
COPY .env.example ./
EXPOSE 8080
CMD ["node", "dist/server/index.js"]
