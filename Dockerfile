# Build stage: compile client and server.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: only the built files and production dependencies.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server && npm cache clean --force
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/client/dist client/dist
RUN mkdir -p data && chown node:node data
USER node
EXPOSE 3000
# Saved games live here; mount a volume to keep them across container rebuilds.
VOLUME /app/data
CMD ["node", "--disable-warning=ExperimentalWarning", "server/dist/index.js"]
