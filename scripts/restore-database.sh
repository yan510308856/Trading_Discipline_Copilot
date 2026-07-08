#!/bin/sh
set -eu

database_file="${1:-}"
if [ -z "$database_file" ] || [ ! -f "$database_file" ]; then
  echo "Usage: scripts/restore-database.sh PATH_TO_DATABASE" >&2
  exit 1
fi

docker compose up -d backend
scripts/backup-database.sh backups
docker compose stop backend
docker compose cp "$database_file" backend:/data/trading_discipline.db
docker compose start backend
echo "Database restored from $database_file"
