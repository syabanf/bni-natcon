FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# URL the "Admin Dashboard" quick-access tile points to.
ARG VITE_ADMIN_URL=http://localhost:8089
ENV VITE_ADMIN_URL=$VITE_ADMIN_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
