FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/api ./cmd/api

FROM alpine:3.20
RUN adduser -D -u 10001 app

# The upload folder has to exist IN THE IMAGE, owned by the user the API runs
# as. Docker copies the mount point's ownership into a named volume the first
# time it fills it; without this the volume is created root-owned, uid 10001
# cannot write to it, and every image upload fails with a permission error.
RUN mkdir -p /data/uploads && chown -R app:app /data

USER app
COPY --from=build /out/api /usr/local/bin/api
VOLUME ["/data/uploads"]
EXPOSE 8080
ENTRYPOINT ["api"]
