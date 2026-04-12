#!/bin/sh
set -e

MASTER_PORT="${HBASE_MASTER_PORT:-16000}"
RS_PORT="${HBASE_RS_PORT:-16020}"
MASTER_PID_FILE="${HBASE_PID_DIR:-/tmp}/hbase--master.pid"
RS_PID_FILE="${HBASE_PID_DIR:-/tmp}/hbase--regionserver.pid"

mkdir -p /data/hbase /data/hbase-wal
chown -R hbase /data/hbase /data/hbase-wal || true

daemon_pid_is_running() {
  pid_file="$1"
  [ -f "$pid_file" ] || return 1
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  [ -n "$pid" ] || return 1
  kill -0 "$pid" >/dev/null 2>&1
}

wait_for_pid_file() {
  pid_file="$1"
  label="$2"
  attempts=0
  max_attempts=60
  while true; do
    if daemon_pid_is_running "$pid_file"; then
      return 0
    fi
    attempts=$((attempts + 1))
    if [ "$attempts" -ge "$max_attempts" ]; then
      echo "${label} failed to start (PID file: ${pid_file})"
      return 1
    fi
    sleep 2
  done
}

stop_all() {
  /opt/hbase/bin/hbase-daemon.sh stop regionserver || true
  /opt/hbase/bin/hbase-daemon.sh stop master || true
}

monitor_daemons() {
  sleep 2
  while true; do
    if ! daemon_pid_is_running "$MASTER_PID_FILE"; then
      echo "HBase master exited unexpectedly."
      exit 1
    fi

    if ! daemon_pid_is_running "$RS_PID_FILE"; then
      echo "HBase regionserver exited unexpectedly."
      exit 1
    fi
    sleep 5
  done
}

trap 'stop_all; exit 0' INT TERM

echo "Starting HBase in pseudo-distributed mode (master + regionserver)..."
echo "Using external ZooKeeper at shared-zookeeper:2181"

/opt/hbase/bin/hbase-daemon.sh start master
if ! wait_for_pid_file "$MASTER_PID_FILE" "HBase master"; then
  echo "HBase master failed before becoming ready."
  stop_all
  exit 1
fi

/opt/hbase/bin/hbase-daemon.sh start regionserver
if ! wait_for_pid_file "$RS_PID_FILE" "HBase regionserver"; then
  echo "HBase regionserver failed before becoming ready."
  stop_all
  exit 1
fi

monitor_daemons
