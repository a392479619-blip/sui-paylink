FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
COPY tsconfig.base.json ./

RUN npm ci
RUN npm run build

ENV HOST=0.0.0.0
ENV SERVE_WEB_APP=true
ENV WEB_DIST_DIR=apps/web/dist

EXPOSE 8787

CMD ["npm", "start"]
