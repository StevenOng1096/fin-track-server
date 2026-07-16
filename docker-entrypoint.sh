#!/bin/sh
set -e

restore_database() {
  dump_file="$1"
  database_url="$2"

  case "$dump_file" in
    *.sql)
      echo "Restoring plain SQL dump with psql..."
      psql "$database_url" -v ON_ERROR_STOP=1 -f "$dump_file"
      ;;
    *)
      echo "Restoring custom-format dump with pg_restore..."
      # Exit code 1 usually means warnings only; anything higher is a real failure.
      if pg_restore \
        --dbname="$database_url" \
        --clean \
        --if-exists \
        --no-owner \
        --no-acl \
        --verbose \
        "$dump_file"; then
        return 0
      fi

      restore_exit=$?
      if [ "$restore_exit" -eq 1 ]; then
        echo "pg_restore finished with warnings (exit code 1)."
        return 0
      fi

      echo "pg_restore failed with exit code $restore_exit."
      return "$restore_exit"
    ;;
  esac
}

if [ -n "$PG_RESTORE_FILE" ] && [ -f "$PG_RESTORE_FILE" ]; then
  restore_marker="${PG_RESTORE_STATE_DIR:-/app/state}/.pg-restore-done"

  if [ "$PG_RESTORE_FORCE" = "true" ]; then
    echo "PG_RESTORE_FORCE=true — running restore again."
    rm -f "$restore_marker"
  fi

  if [ -f "$restore_marker" ]; then
    echo "Database restore already completed ($restore_marker exists). Skipping."
  else
    echo "Restoring database from $PG_RESTORE_FILE ..."
    mkdir -p "$(dirname "$restore_marker")"
    restore_database "$PG_RESTORE_FILE" "$DATABASE_URL"
    touch "$restore_marker"
    echo "Database restore completed."
  fi
elif [ -n "$PG_RESTORE_FILE" ]; then
  echo "PG_RESTORE_FILE is set but file not found: $PG_RESTORE_FILE"
  exit 1
fi

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting API server..."
exec node dist/src/main.js
