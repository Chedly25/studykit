#!/usr/bin/env bash
# Bulk-upload public/library/ to the studieskit-library R2 bucket.
# Idempotent: re-running just overwrites existing objects.
# Parallel: 6 uploads at a time.
set -e

BUCKET="studieskit-library"
ROOT="$(cd "$(dirname "$0")/.." && pwd)/public/library"

upload_one() {
  local path="$1"
  local key="${path#$ROOT/}"
  local ct
  case "$path" in
    *.pdf)  ct="application/pdf" ;;
    *.json) ct="application/json" ;;
    *.html) ct="text/html; charset=utf-8" ;;
    *)      ct="application/octet-stream" ;;
  esac
  wrangler r2 object put "${BUCKET}/${key}" --file="$path" --content-type="$ct" --remote 2>&1 | tail -1
}
export -f upload_one
export ROOT BUCKET

find "$ROOT" -type f | xargs -P 6 -I {} bash -c 'upload_one "$@"' _ {}
echo
echo "Upload complete."
