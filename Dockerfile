FROM node:14-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./

RUN npm ci

COPY tsconfig.json ./
COPY ./src ./src

RUN npm run build

CMD node ./dist/index.js
