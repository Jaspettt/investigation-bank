FROM golang:1.25-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal
COPY web ./web

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/credit-mvp ./cmd/api

FROM alpine:3.21

RUN addgroup -S app && adduser -S -G app app && apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=build /out/credit-mvp /app/credit-mvp
COPY web /app/web

RUN mkdir -p /app/uploads /app/data && chown -R app:app /app

USER app

ENV APP_ENV=prod
ENV ADDR=:8080
ENV DB_DRIVER=auto
ENV DATABASE_URL=file:/app/data/credit_mvp.db?_foreign_keys=on

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1

ENTRYPOINT ["/app/credit-mvp"]
