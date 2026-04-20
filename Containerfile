FROM oven/bun:alpine AS builder
WORKDIR /app
COPY skill-manager/package.json skill-manager/bun.lock* ./
COPY common/common-spec /common-spec
RUN bun install
COPY skill-manager/src/ src/
COPY skill-manager/tsconfig.json ./
RUN bun build --compile src/main.ts --outfile skill-manager

FROM alpine:latest
RUN apk add --no-cache ca-certificates git
WORKDIR /app
COPY --from=builder /app/skill-manager /app/skill-manager
RUN chmod +x /app/skill-manager
VOLUME ["/data/skills"]
EXPOSE 25200
ENTRYPOINT ["/app/skill-manager"]
