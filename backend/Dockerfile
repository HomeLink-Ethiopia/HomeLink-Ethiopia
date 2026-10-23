# HomeLink Backend — Node/Express API
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Non-root user
RUN addgroup -S homelink && adduser -S homelink -G homelink && chown -R homelink:homelink /app
USER homelink
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:5000/ || exit 1
CMD ["node", "server.js"]
