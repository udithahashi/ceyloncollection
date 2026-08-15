#!/bin/sh
# Nightly pg_dump with bounded retention, run inside the `backup` service in
# docker/compose.prod.yml (the postgres:17 image, so pg_dump always matches
# the server version it is dumping).
#
# A sleep loop, not cron: one process, nothing extra to install in the image,
# and every run's output is in `docker logs backup` in order. PGHOST, PGUSER,
# PGPASSWORD and PGDATABASE are read by pg_dump itself - libpq's standard
# environment variables, not something this script has to parse.
#
# The restore drill - the part that makes this an actual backup and not just
# a hope - is docs/DEPLOYMENT.md.
set -eu

BACKUP_DIR=/backups
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

run_backup() {
  timestamp=$(date -u +%Y%m%dT%H%M%SZ)
  dump_file="${BACKUP_DIR}/ceyloncollection-${timestamp}.dump"
  tmp_file="${dump_file}.tmp"

  echo "[$(date -u -Iseconds)] Starting backup: ${dump_file}"

  # Custom format (-Fc): compressed, and restorable with pg_restore --jobs for
  # a large database later, unlike a plain SQL dump. Written to a .tmp path
  # and renamed only on success, so a backup that died partway through never
  # looks like a complete one to the retention cleanup or to a restore.
  if pg_dump -Fc -f "${tmp_file}"; then
    mv "${tmp_file}" "${dump_file}"
    size=$(du -h "${dump_file}" | cut -f1)
    echo "[$(date -u -Iseconds)] Backup complete: ${dump_file} (${size})"
  else
    echo "[$(date -u -Iseconds)] Backup FAILED - see pg_dump output above" >&2
    rm -f "${tmp_file}"
    # Do not exit: a database blip tonight should not stop tomorrow's attempt.
    # The gap itself is visible in `docker logs` and in a directory listing.
    return 0
  fi

  echo "[$(date -u -Iseconds)] Pruning backups older than ${RETENTION_DAYS} days"
  find "${BACKUP_DIR}" -name 'ceyloncollection-*.dump' -mtime "+${RETENTION_DAYS}" -print -delete
}

mkdir -p "${BACKUP_DIR}"

while true; do
  run_backup
  echo "[$(date -u -Iseconds)] Sleeping ${INTERVAL_SECONDS}s until next backup"
  sleep "${INTERVAL_SECONDS}"
done
