#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL is required}"

migration_url=$MIGRATION_DATABASE_URL
unset MIGRATION_DATABASE_URL
DATABASE_URL="$migration_url" npx --no-install prisma migrate deploy --schema=prisma/schema
unset migration_url

exec node dist/src/main.js
