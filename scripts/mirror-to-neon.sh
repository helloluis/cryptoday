#!/usr/bin/env bash
set -euo pipefail
cd "${CRYPTODAY_DIR:-/var/www/cryptoday}"
mkdir -p data
# One owner for cron, systemd, and manual invocation alike.
exec 9>data/neon-mirror.lock
flock -n 9 || exit 0
if [[ -f .env.local ]]; then
  env_file=.env.local
else
  env_file=.env
fi
# Node parses dotenv without executing shell code or putting secrets in argv.
exec node --env-file="$env_file" dist/neon-mirror/sync-neon.js
