FROM node:20-alpine

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY zenaipex-frontend/package.json zenaipex-frontend/package-lock.json ./
RUN npm ci

COPY zenaipex-frontend/ ./
RUN npm run build

EXPOSE 10000

CMD ["sh", "-c", "npm start -- --hostname 0.0.0.0 --port ${PORT:-10000}"]
