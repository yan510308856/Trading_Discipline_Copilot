#!/bin/sh
set -eu

backup_dir="${1:-backups}"
timestamp="$(date +%Y%m%d-%H%M%S)"
container_backup="/data/trading_discipline-$timestamp.db"

mkdir -p "$backup_dir"
docker compose exec -T backend python -c "import sqlite3; source=sqlite3.connect('/data/trading_discipline.db'); target=sqlite3.connect('$container_backup'); source.backup(target); target.close(); source.close()"
docker compose cp "backend:$container_backup" "$backup_dir/trading_discipline-$timestamp.db"
docker compose exec -T backend rm "$container_backup"
echo "Database backup created at $backup_dir/trading_discipline-$timestamp.db"
