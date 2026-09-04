FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run lint && npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src/types ./src/types
COPY --from=build /app/server/db/migrations ./server/db/migrations
COPY --from=build /app/docker-entrypoint.cjs ./docker-entrypoint.cjs
RUN mkdir -p /var/lib/pngee/storage && chown -R node:node /app /var/lib/pngee
USER node
EXPOSE 3000
CMD ["node", "docker-entrypoint.cjs"]
