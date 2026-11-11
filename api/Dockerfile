# Build context is the repository root so the API can read the shared form definitions.
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY api/src ./src
COPY src/app/sections/volunteer/disclaimer.json src/app/sections/volunteer/volunteer-options.json /app/src/app/sections/volunteer/
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/server.js"]
