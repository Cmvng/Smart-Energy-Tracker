FROM node:24-bookworm-slim AS build

RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/smart-ine-tracker/package.json artifacts/smart-ine-tracker/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
RUN pnpm install --frozen-lockfile
COPY artifacts/api-server artifacts/api-server
COPY lib/api-zod lib/api-zod
COPY lib/db lib/db
RUN pnpm --filter @workspace/api-server build

FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-openpyxl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/artifacts/api-server/node_modules ./artifacts/api-server/node_modules
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
EXPOSE 3000
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
