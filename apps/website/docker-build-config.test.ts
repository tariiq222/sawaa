import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const websiteDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = resolve(websiteDirectory, "../..");

function readRepositoryFile(path: string) {
  return readFileSync(resolve(repositoryDirectory, path), "utf8");
}

describe("website web-chat build flag", () => {
  it("defaults closed and injects the public flag before next build", () => {
    const dockerfile = readRepositoryFile("apps/website/Dockerfile");

    expect(dockerfile).toContain("ARG NEXT_PUBLIC_WEB_CHAT_ENABLED=false");
    expect(dockerfile).toContain(
      "ENV NEXT_PUBLIC_WEB_CHAT_ENABLED=$NEXT_PUBLIC_WEB_CHAT_ENABLED",
    );
    expect(
      dockerfile.indexOf(
        "ENV NEXT_PUBLIC_WEB_CHAT_ENABLED=$NEXT_PUBLIC_WEB_CHAT_ENABLED",
      ),
    ).toBeLessThan(dockerfile.indexOf("RUN pnpm --filter=website run build"));
  });

  it("passes a closed-by-default build arg in website compose definitions", () => {
    const productionCompose = readRepositoryFile(
      "docker/openship/compose.yml",
    );
    const websiteCompose = readRepositoryFile(
      "docker/docker-compose.sawa-website.yml",
    );

    expect(productionCompose).toContain(
      "NEXT_PUBLIC_WEB_CHAT_ENABLED: ${NEXT_PUBLIC_WEB_CHAT_ENABLED:-false}",
    );
    expect(websiteCompose).toContain(
      'NEXT_PUBLIC_WEB_CHAT_ENABLED: "${NEXT_PUBLIC_WEB_CHAT_ENABLED:-false}"',
    );
  });

  it("documents the closed default for production and standalone website builds", () => {
    expect(readRepositoryFile("apps/website/.env.example")).toContain(
      "NEXT_PUBLIC_WEB_CHAT_ENABLED=false",
    );
    expect(readRepositoryFile("docker/.env.prod.example")).toContain(
      "NEXT_PUBLIC_WEB_CHAT_ENABLED=false",
    );
  });
});

describe("website runtime memory guard", () => {
  function websiteService() {
    const compose = readRepositoryFile("docker/openship/compose.yml");
    const start = compose.indexOf("\n  website:\n");
    const end = compose.indexOf("\nnetworks:", start);
    expect(start).toBeGreaterThan(-1);
    return compose.slice(start, end);
  }

  it("caps the OpenShip website container so a memory leak restarts it instead of starving the host", () => {
    expect(websiteService()).toContain("mem_limit: 1536m");
  });

  it("bounds the V8 heap below the container cap and limits glibc malloc arenas", () => {
    const service = websiteService();
    expect(service).toContain('NODE_OPTIONS: "--max-old-space-size=1024"');
    expect(service).toContain('MALLOC_ARENA_MAX: "2"');
  });
});
