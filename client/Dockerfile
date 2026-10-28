# Bioma web: збираємо статику Vite і віддаємо nginx'ом, який заодно
# проксіює /api на сервер — так браузер бачить один origin і CORS не потрібен.
FROM node:24-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY . .

# VITE_* вшиваються у бандл під час збірки, тож це build args, а не env рантайму.
# Порожній VITE_API_URL = відносні запити на той самий origin (через nginx).
ARG VITE_DEMO_MODE=true
ARG VITE_API_URL=
ARG VITE_NEON_AUTH_URL=
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE \
    VITE_API_URL=$VITE_API_URL \
    VITE_NEON_AUTH_URL=$VITE_NEON_AUTH_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
