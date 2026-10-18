FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/rbah/package.json packages/rbah/package.json
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/proto ./proto
ARG SERVICE
ENV SERVICE=${SERVICE}
EXPOSE 50051 50052 50053 8080
CMD ["sh", "-c", "node dist/services/${SERVICE}/src/index.js"]
