#!/bin/sh
set -e
mkdir -p /data
if [ ! -f /data/prod.db ]; then
  echo "Initializing database from seed..."
  cp /app/prisma/seed.db /data/prod.db
fi
echo "Starting app on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
