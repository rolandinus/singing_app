#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-5173}"
HOST="${HOST:-127.0.0.1}"

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Error: port must be numeric. Example: ./scripts/dev-server.sh 8080" >&2
  exit 1
fi

echo "Serving /home/roland/PhpstormProjects/singingApp on http://${HOST}:${PORT}"
echo "Open: http://${HOST}:${PORT}/singV3.html"

exec python3 -m http.server "$PORT" --bind "$HOST"
