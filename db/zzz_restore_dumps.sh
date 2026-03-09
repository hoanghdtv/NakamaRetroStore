#!/bin/bash
# Restore merged tables from binary pg_dump files.
# Named zzz_ to ensure it runs LAST in docker-entrypoint-initdb.d (alphabetical order).

set -e

DIR="$(dirname "$0")"

echo "Restoring games table from binary dump..."
pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists "$DIR/games.dump"

echo "Restoring achievements table from binary dump..."
pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists "$DIR/achievements.dump"

echo "Restoring md5 table from binary dump..."
pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists "$DIR/md5.dump"

echo "Binary restore complete."
