# MinIO for CI

Upstream no longer publishes community container images or binaries. The official
[README](https://github.com/minio/minio#minio-is-now-source-only) documents source
builds. This action builds the official
[2025-10-15 release](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z)
at commit `9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a` using Go 1.24.13.
Go verifies module downloads against its checksum database. The binary cache key
includes source commit, toolchain, runner OS, and architecture; no mutable latest
image or third-party replacement is used.

The daemon binds only to the runner's loopback interface, uses disposable data and
public CI-only credentials, and must pass its health check before tests continue.
The GitHub runner cleans up the background process at job completion. Compilation
or startup failure fails the job. Changing the source or toolchain requires
updating both the build step and cache key and rechecking storage operations.

This action affects CI only. It does not change the OpenShip runtime image or
migrate stored data. Source-only distribution also means production rebuild image
availability requires a separate deployment decision; a green CI run does not
prove a fresh production image pull works.
