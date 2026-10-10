FROM ghcr.io/oblien/openship-api@sha256:38bdc73b58a7c5a4d04d6f84b1acc654c9409c008ce1c9bbb600032c87bf540d
WORKDIR /app
COPY build-context-root.patch /tmp/sawaa-build-context-root.patch
RUN echo "725d7518d7284aa273e11efdac6ebfbe479e0a155e70c9561d1f75c3ca0d1e62  packages/adapters/src/runtime/docker.ts" | sha256sum -c - \
 && git apply --check /tmp/sawaa-build-context-root.patch \
 && git apply /tmp/sawaa-build-context-root.patch \
 && rm /tmp/sawaa-build-context-root.patch
