# Imagem do portal em etapas:
#   ferramentas → código + todas as dependências (migrations, seed, testes)
#   app         → só o servidor Next.js compilado (imagem final, enxuta, usuário sem root)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS ferramentas
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .

FROM ferramentas AS build
ENV BUILD_STANDALONE=1
RUN npm run build

FROM node:22-alpine AS app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
