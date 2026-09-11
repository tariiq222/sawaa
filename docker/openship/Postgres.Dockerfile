# PostgreSQL image for the Sawaa OpenShip runtime.
# The extension package is installed in the image so restored databases and
# Prisma migrations do not depend on mutable host packages.
FROM postgres:18

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-18-pgvector \
 && rm -rf /var/lib/apt/lists/*
