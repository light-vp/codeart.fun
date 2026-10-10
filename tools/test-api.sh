#!/usr/bin/env bash
# End-to-end test of the PHP API against a throwaway SQLite database.
# Usage: bash codeart-fun/tools/test-api.sh   (needs php with pdo_sqlite, curl, sqlite3 not required)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
tmp="$(mktemp -d)"
trap 'kill $server 2>/dev/null || true; rm -rf "$tmp"' EXIT

php -r '$p = new PDO("sqlite:" . $argv[1]); $p->exec(file_get_contents($argv[2]));' "$tmp/db.sqlite" "$here/schema-sqlite.sql"
cat > "$tmp/config.php" <<PHP
<?php return ['db' => ['dsn' => 'sqlite:$tmp/db.sqlite'], 'secure_cookies' => false];
PHP
CODEART_CONFIG="$tmp/config.php" php -S 127.0.0.1:8131 -t "$root" >"$tmp/server.log" 2>&1 &
server=$!
sleep 1

jar="$tmp/cookies"
pass=0; failn=0
req() { # method path [json]
  if [ "$1" = POST ]; then
    curl -s -o "$tmp/body" -w '%{http_code}' -b "$jar" -c "$jar" -X POST -H 'Content-Type: application/json' -H 'X-CodeArt: 1' --data "$3" "http://127.0.0.1:8131/api/$2"
  else
    curl -s -o "$tmp/body" -w '%{http_code}' -b "$jar" -c "$jar" "http://127.0.0.1:8131/api/$2"
  fi
}
expect() { # description expected-status actual-status [grep-pattern]
  if [ "$2" = "$3" ] && { [ -z "${4:-}" ] || grep -q -- "$4" "$tmp/body"; }; then pass=$((pass+1)); echo "  ✓ $1";
  else failn=$((failn+1)); echo "  ✗ $1 (status $3, body: $(cat "$tmp/body"))"; fi
}

expect "anonymous /me"                200 "$(req GET me.php)" '"user":null'
expect "progress needs sign-in"       401 "$(req GET progress.php)"
expect "POST without header is refused" 403 "$(curl -s -o "$tmp/body" -w '%{http_code}' -X POST --data '{}' http://127.0.0.1:8131/api/auth.php)"
expect "short password rejected"      400 "$(req POST auth.php '{"action":"register","email":"ada@example.com","password":"short"}')" 'at least 8'
expect "register"                     201 "$(req POST auth.php '{"action":"register","name":"Ada","email":"Ada@Example.com","password":"correct horse"}')" '"name":"Ada"'
expect "duplicate email"              409 "$(req POST auth.php '{"action":"register","email":"ada@example.com","password":"correct horse"}')"
expect "/me after register"           200 "$(req GET me.php)" '"email":"ada@example.com"'
expect "submit failing attempt"       201 "$(req POST submit.php '{"level_id":"two-sum","code":"def two_sum(): pass","passed":1,"total":3}')" '"solved":false'
expect "submit passing attempt"       201 "$(req POST submit.php '{"level_id":"two-sum","code":"def two_sum(): return 1","passed":3,"total":3}')" '"solved":true'
expect "bad level id rejected"        400 "$(req POST submit.php '{"level_id":"../x","code":"","passed":0,"total":1}')"
expect "passed > total rejected"      400 "$(req POST submit.php '{"level_id":"two-sum","code":"","passed":4,"total":3}')"
expect "draft autosave"               200 "$(req POST draft.php '{"level_id":"countdown","code":"n = 3"}')"
expect "progress shows solve + attempts" 200 "$(req GET progress.php)" '"two-sum":{"solved":true,"attempts":2'
expect "progress includes draft"      200 "$(req GET progress.php)" '"countdown":"n = 3"'
expect "submissions newest first"     200 "$(req GET 'submissions.php?level=two-sum')" '"passed":3,"total":3,.*"passed":1'
expect "sync merges local progress"   200 "$(req POST sync.php '{"solved":["swap-values"],"drafts":{"countdown":"local wins?","factorial":"x = 1"}}')" '"swap-values":{"solved":true'
expect "sync keeps server draft"      200 "$(req GET progress.php)" '"countdown":"n = 3"'
expect "sync fills missing draft"     200 "$(req GET progress.php)" '"factorial":"x = 1"'
expect "logout"                       200 "$(req POST auth.php '{"action":"logout"}')"
expect "/me after logout"             200 "$(req GET me.php)" '"user":null'
expect "wrong password"               401 "$(req POST auth.php '{"action":"login","email":"ada@example.com","password":"nope nope"}')"
expect "login"                        200 "$(req POST auth.php '{"action":"login","email":"ADA@example.com","password":"correct horse"}')" '"name":"Ada"'
expect "progress survives re-login"   200 "$(req GET progress.php)" '"two-sum":{"solved":true'
req POST auth.php '{"action":"logout"}' >/dev/null
for i in 1 2 3 4 5 6 7 8; do req POST auth.php '{"action":"login","email":"ada@example.com","password":"wrong pass"}' >/dev/null; done
expect "rate limit after repeated failures" 429 "$(req POST auth.php '{"action":"login","email":"ada@example.com","password":"correct horse"}')"
expect "lib.php is not an endpoint"   404 "$(req GET lib.php)"

echo "$pass passed, $failn failed"
[ "$failn" = 0 ] || { echo "--- server log"; cat "$tmp/server.log"; exit 1; }
