FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# URL the "Admin Dashboard" quick-access tile points to.
ARG VITE_ADMIN_URL=http://localhost:8089
ENV VITE_ADMIN_URL=$VITE_ADMIN_URL
ARG VITE_DOOR_URL=http://localhost:8087/door/login
ENV VITE_DOOR_URL=$VITE_DOOR_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
