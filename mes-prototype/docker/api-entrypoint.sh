#!/bin/sh
set -e

echo "MES API entrypoint — waiting for database and running bootstrap…"
node scripts/docker-bootstrap.mjs

exec "$@"
