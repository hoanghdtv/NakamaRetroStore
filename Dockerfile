FROM node:18-alpine AS builder

WORKDIR /backend
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc

FROM heroiclabs/nakama:3.26.0

RUN mkdir -p /nakama/data/modules/build
COPY --from=builder /backend/build/index.js /nakama/data/modules/build/
COPY local.yml /nakama/data/
