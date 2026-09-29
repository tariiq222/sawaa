FROM docker:29-dind-rootless AS dockercli
FROM node:22-bookworm
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git python3 python3-venv xz-utils \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY scripts/security/requirements.txt /opt/ci/requirements.txt
RUN python3 -m venv /opt/semgrep \
    && /opt/semgrep/bin/pip install --no-cache-dir -r /opt/ci/requirements.txt
ENV PATH="/opt/semgrep/bin:${PATH}"
# Both scanners are version pinned and their release checksums are verified.
RUN set -eu; arch="$(uname -m)"; \
    case "$arch" in x86_64) leak_arch=x64; trivy_arch=64bit;; aarch64) leak_arch=arm64; trivy_arch=ARM64;; *) exit 1;; esac; \
    mkdir /tmp/scanners; cd /tmp/scanners; \
    leak_file="gitleaks_8.30.1_linux_${leak_arch}.tar.gz"; \
    curl -fSL --retry 1 "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/$leak_file" -o "$leak_file"; \
    curl -fSL --retry 1 https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt -o checksums.txt; \
    grep " $leak_file\$" checksums.txt > selected-checksum.txt; \
    sha256sum -c selected-checksum.txt; \
    tar -xzf "$leak_file" -C /usr/local/bin gitleaks; \
    trivy_file="trivy_0.72.0_Linux-${trivy_arch}.tar.gz"; \
    curl -fSL --retry 1 "https://github.com/aquasecurity/trivy/releases/download/v0.72.0/$trivy_file" -o "$trivy_file"; \
    curl -fSL --retry 1 https://github.com/aquasecurity/trivy/releases/download/v0.72.0/trivy_0.72.0_checksums.txt -o checksums.txt; \
    grep " $trivy_file\$" checksums.txt > selected-checksum.txt; \
    sha256sum -c selected-checksum.txt; \
    tar -xzf "$trivy_file" -C /usr/local/bin trivy; \
    rm -rf /tmp/scanners
WORKDIR /repo
