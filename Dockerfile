FROM node:24-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN NODE_ENV=production BASE_PATH=/ PORT=5173 pnpm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends python3 poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app /app

EXPOSE 3000
CMD ["pnpm", "start"]
