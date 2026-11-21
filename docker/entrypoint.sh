#!/bin/sh
# Starts Raftaar. Runs as root only long enough to make the data folder writable (bind mounts are often created
# root-owned), then drops to an unprivileged user: PUID/PGID if set, so files in ./data/files belong to you.
set -e
uid="${PUID:-10001}"
gid="${PGID:-10001}"
mkdir -p "$STORAGE_DIR"
chown -R "$uid:$gid" "$STORAGE_DIR" 2>/dev/null || true
exec setpriv --reuid="$uid" --regid="$gid" --clear-groups java -XX:AOTCache=/app/app.aot $JAVA_OPTS -jar /app/app.jar
