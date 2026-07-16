#!/bin/sh
set -eu

# Daily Postgres backup uploaded to Google Drive via rclone.
# Uses /tmp only during the run, then deletes the dump (nothing kept on VPS).
#
# Required:
#   - rclone remote named "gdrive" (or set RCLONE_REMOTE below)
#   - docker compose running in APP_DIR
#   - .env with POSTGRES_USER / POSTGRES_DB
#
# Optional env overrides:
#   APP_DIR, RCLONE_REMOTE, LOG_FILE
#
# Cron (daily at midnight):
#   chmod +x scripts/install-backup-cron.sh
#   ./scripts/install-backup-cron.sh

APP_DIR="${APP_DIR:-/opt/apps/fin-track-server}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive:fin-track-server-backups}"
LOG_FILE="${LOG_FILE:-$APP_DIR/logs/backup.log}"

mkdir -p "$(dirname "$LOG_FILE")"
cd "$APP_DIR"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a
  . ./.env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-finance_tracker}"
DATE_LABEL="$(date +%d-%m-%Y)"
FILENAME="fin-track-vps-${DATE_LABEL}.dump"
TMPFILE="$(mktemp /tmp/fin-track-vps-XXXXXX.dump)"
REMOTE_DIR="${RCLONE_REMOTE%/}"
REMOTE_PATH="${REMOTE_DIR}/${FILENAME}"

cleanup() {
  rm -f "$TMPFILE"
}
trap cleanup EXIT INT TERM

{
  echo "=== Backup started at $(date -Is) ==="
  echo "Database: $POSTGRES_DB"
  echo "Remote: $REMOTE_PATH"

  if ! docker compose ps --status running --services | grep -qx db; then
    echo "ERROR: db service is not running"
    exit 1
  fi

  echo "Creating dump in temporary file: $TMPFILE"
  docker compose exec -T db pg_dump \
    -U "$POSTGRES_USER" \
    -Fc \
    -d "$POSTGRES_DB" \
    > "$TMPFILE"

  if [ ! -s "$TMPFILE" ]; then
    echo "ERROR: dump file is empty"
    exit 1
  fi

  echo "Dump size: $(du -h "$TMPFILE" | awk '{print $1}')"
  echo "Ensuring remote folder exists: $REMOTE_DIR"
  rclone mkdir "$REMOTE_DIR" 2>/dev/null || true

  echo "Uploading to Google Drive as $FILENAME..."
  rclone copyto "$TMPFILE" "$REMOTE_PATH" -v

  echo "Remote listing:"
  rclone ls "$REMOTE_DIR/"

  echo "=== Backup finished at $(date -Is) ==="
} >>"$LOG_FILE" 2>&1
