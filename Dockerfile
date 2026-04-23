# --- build stage --------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund --loglevel=error

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
# Static assets Vite ships verbatim to the dist root (favicon, robots.txt, etc.)
COPY public ./public

# Inject the API base URL at build time so the bundle knows where to talk
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# --- runtime stage ------------------------------------------------
FROM nginx:alpine

# Replace default config with one that handles SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
