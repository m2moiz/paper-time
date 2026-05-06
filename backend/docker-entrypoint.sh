#!/bin/sh
# paper-time backend entrypoint
# Seeds /app/data with the committed papertime.db + media on first start,
# then exports DATABASE_URL + MEDIA_DIR pointing at the volume and exec's the CMD.
set -eu

DATA_DIR="/app/data"
DB_DIR="$DATA_DIR"
MEDIA_DIR_VOL="$DATA_DIR/media/videos"

mkdir -p "$DB_DIR" "$MEDIA_DIR_VOL"

# Seed DB if volume empty. Use existence of papertime.db in volume as the sentinel.
if [ ! -f "$DB_DIR/papertime.db" ]; then
  echo "[entrypoint] seeding $DB_DIR from /app/papertime.db (and WAL siblings if present)"
  cp /app/papertime.db "$DB_DIR/papertime.db"
  [ -f /app/papertime.db-shm ] && cp /app/papertime.db-shm "$DB_DIR/" || true
  [ -f /app/papertime.db-wal ] && cp /app/papertime.db-wal "$DB_DIR/" || true
fi

# Seed media if volume media dir is empty.
if [ -z "$(ls -A "$MEDIA_DIR_VOL" 2>/dev/null)" ]; then
  if [ -d /app/media/videos ] && [ -n "$(ls -A /app/media/videos 2>/dev/null)" ]; then
    echo "[entrypoint] seeding $MEDIA_DIR_VOL from /app/media/videos"
    cp -a /app/media/videos/. "$MEDIA_DIR_VOL/"
  fi
fi

export DATABASE_URL="${DATABASE_URL:-sqlite+aiosqlite:////${DB_DIR}/papertime.db}"
export MEDIA_DIR="${MEDIA_DIR:-$MEDIA_DIR_VOL}"

echo "[entrypoint] DATABASE_URL=$DATABASE_URL"
echo "[entrypoint] MEDIA_DIR=$MEDIA_DIR"
echo "[entrypoint] STORAGE_MODE=${STORAGE_MODE:-unset} RENDER_MODE=${RENDER_MODE:-unset}"

exec "$@"
