#!/bin/sh
set -eu

APP_DIR="${APP_DIR:-/opt/apps/fin-track-server}"
# Every 4 hours at minute 0 (00:00, 04:00, 08:00, 12:00, 16:00, 20:00 — server local time)
CRON_SCHEDULE="${CRON_SCHEDULE:-0 */4 * * *}"
CRON_LINE="$CRON_SCHEDULE $APP_DIR/scripts/backup-postgres-to-gdrive.sh"
MARKER="# fin-track-server postgres backup"

cd "$APP_DIR"

chmod +x "$APP_DIR/scripts/backup-postgres-to-gdrive.sh"
mkdir -p "$APP_DIR/logs"

if crontab -l 2>/dev/null | grep -Fq "$MARKER"; then
  echo "Cron job already installed:"
  crontab -l | grep -F "$MARKER" -A 1
  echo ""
  echo "To change schedule, remove the lines above from crontab -e and re-run this script,"
  echo "or edit crontab -e directly."
  exit 0
fi

(
  crontab -l 2>/dev/null || true
  echo "$MARKER"
  echo "$CRON_LINE"
) | crontab -

echo "Installed backup cron:"
crontab -l | grep -F "$MARKER" -A 1
echo ""
echo "Schedule: $CRON_SCHEDULE (server local time)"
echo "Log file:  $APP_DIR/logs/backup.log"
