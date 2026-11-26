FROM node:22-alpine

WORKDIR /app

COPY apps/server/package.json ./
RUN npm install --no-audit --no-fund

COPY apps/server/tsconfig.json ./
COPY apps/server/src ./src

RUN npm run build

EXPOSE 3000
CMD ["node", "dist/main.js"]
