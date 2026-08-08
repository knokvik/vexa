# Vexa — production image (monorepo)
FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/intelligence/package.json packages/intelligence/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @vexa/web build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Persist CRM JSON by mounting a volume at /app/apps/web/data
CMD ["pnpm", "--filter", "@vexa/web", "start"]
