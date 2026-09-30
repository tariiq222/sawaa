FROM alpine:3.20
ARG MINIO_ARCH
LABEL org.opencontainers.image.source="https://github.com/minio/minio" \
      org.opencontainers.image.revision="9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a" \
      io.sawaa.ci.go="go1.24.13" \
      io.sawaa.ci.os="linux" \
      io.sawaa.ci.arch="${MINIO_ARCH}"
RUN apk add --no-cache ca-certificates
COPY minio /usr/local/bin/minio
RUN chmod 0755 /usr/local/bin/minio && minio --version
ENTRYPOINT ["/usr/local/bin/minio"]
