FROM ghcr.io/oblien/openship-api@sha256:38bdc73b58a7c5a4d04d6f84b1acc654c9409c008ce1c9bbb600032c87bf540d
WORKDIR /app
COPY build-context-root.patch /tmp/sawaa-build-context-root.patch
RUN echo "725d7518d7284aa273e11efdac6ebfbe479e0a155e70c9561d1f75c3ca0d1e62  packages/adapters/src/runtime/docker.ts" | sha256sum -c - \
 && git apply --check /tmp/sawaa-build-context-root.patch \
 && git apply /tmp/sawaa-build-context-root.patch \
 && rm /tmp/sawaa-build-context-root.patch

# Dockerode 4.0.9 omits BuildKit's required gRPC health service (upstream #845/#847).
COPY dockerode-session-health.patch /tmp/sawaa-dockerode-session-health.patch
RUN echo "3e2f856ba7262738dec57f8c35f9eb3d6f46689103e3a38437de30dfac6a2192  node_modules/dockerode/lib/session.js" | sha256sum -c - \
 && git apply --check --directory=node_modules/dockerode /tmp/sawaa-dockerode-session-health.patch \
 && git apply --directory=node_modules/dockerode /tmp/sawaa-dockerode-session-health.patch \
 && rm /tmp/sawaa-dockerode-session-health.patch
