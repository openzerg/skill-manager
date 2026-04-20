FROM oven/bun:alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY skill-manager/package.json skill-manager/bun.lock* ./
RUN bun install
COPY skill-manager/src/ src/
COPY skill-manager/tsconfig.json ./
RUN bun build --compile src/main.ts --outfile skill-manager
FROM alpine:latest
RUN apk add --no-cache ca-certificates libstdc++ git
WORKDIR /app
COPY --from=builder /app/skill-manager /app/skill-manager
RUN chmod +x /app/skill-manager
EXPOSE 25200
ENTRYPOINT ["/app/skill-manager"]
