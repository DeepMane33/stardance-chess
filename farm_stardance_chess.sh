#!/bin/bash
# stardance-chess heartbeat farm: 10 min ON / 2 min OFF cycles
# Only sends heartbeats to stardance-chess project (NOT any other project)
# Runs Vite dev server during active periods, kills it during breaks

# Config
PROXY_URL="http://localhost:19842"
HEARTBEAT_ENDPOINT="/api/hackatime/v1/users/current/heartbeats"
ENTITY="stardance-chess"
PROJECT="stardance-chess"
TYPE="app"
WORK_MIN=10
BREAK_MIN=2
HEARTBEAT_INTERVAL=60  # seconds between heartbeats during active period

CYCLE=1
DEV_PID=0
HEARTBEAT_PID=0

log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

# Send a single heartbeat
send_heartbeat() {
    local timestamp=$(date +%s)
    curl -s -X POST "${PROXY_URL}${HEARTBEAT_ENDPOINT}" \
        -H "Content-Type: application/json" \
        -d "{\"entity\":\"${ENTITY}\",\"type\":\"${TYPE}\",\"project\":\"${PROJECT}\",\"time\":${timestamp}}" \
        -o /dev/null -w "%{http_code}" | grep -q "200\|201\|202" && log "✓ Heartbeat sent: entity=${ENTITY} project=${PROJECT}" || log "✗ Heartbeat FAILED"
}

# Heartbeat loop - runs during active period
heartbeat_loop() {
    local dev_pid=$DEV_PID
    while kill -0 $dev_pid 2>/dev/null; do
        send_heartbeat
        sleep $HEARTBEAT_INTERVAL
    done
    log "Dev server stopped, stopping heartbeats"
}

# Start dev server
start_dev_server() {
    log "=== FARM CYCLE $CYCLE: WORK (${WORK_MIN} min) ==="
    npm run dev > "logs/dev_${CYCLE}.log" 2>&1 &
    DEV_PID=$!
    sleep 3  # Give Vite time to start

    # Find actual Vite process (child of npm)
    VITE_PID=$(pgrep -P $DEV_PID -f "vite" 2>/dev/null | head -1)
    if [ -n "$VITE_PID" ]; then
        DEV_PID=$VITE_PID
        log "Vite dev server started (PID: $DEV_PID)"
    else
        log "Dev server started (PID: $DEV_PID)"
    fi

    # Start heartbeat loop in background
    heartbeat_loop &
    HEARTBEAT_PID=$!
}

# Stop dev server and heartbeats
stop_dev_server() {
    log "=== FARM CYCLE $CYCLE: BREAK (${BREAK_MIN} min) ==="

    # Kill heartbeat loop
    [ -n "$HEARTBEAT_PID" ] && kill $HEARTBEAT_PID 2>/dev/null && wait $HEARTBEAT_PID 2>/dev/null

    # Kill dev server and children
    if [ -n "$DEV_PID" ] && kill -0 $DEV_PID 2>/dev/null; then
        pkill -P $DEV_PID 2>/dev/null  # Kill children first
        kill $DEV_PID 2>/dev/null
        wait $DEV_PID 2>/dev/null
        log "Dev server stopped"
    fi

    DEV_PID=0
    HEARTBEAT_PID=0
}

# Verify proxy is running
verify_proxy() {
    if ! curl -s "${PROXY_URL}/api/v1/users/current" -o /dev/null -w "%{http_code}" | grep -q "200\|404"; then
        log "ERROR: Hackatime proxy NOT running on port 19842"
        log "Start it first: python \"/c/Users/Anil Mane/.wakatime/hackatime-proxy.py\""
        exit 1
    fi
    log "Hackatime proxy verified on port 19842"
}

# Cleanup on exit
cleanup() {
    log "Shutting down farm..."
    stop_dev_server
    exit 0
}
trap cleanup SIGINT SIGTERM

# Main
log "=== STAR DANCE CHESS HEARTBEAT FARM STARTED ==="
log "Project: ${PROJECT} | Entity: ${ENTITY} | Cycle: ${WORK_MIN}min ON / ${BREAK_MIN}min OFF"
verify_proxy

while true; do
    start_dev_server

    # Work period: WORK_MIN minutes
    sleep ${WORK_MIN}m

    stop_dev_server

    # Break period: BREAK_MIN minutes (NO heartbeats sent)
    sleep ${BREAK_MIN}m

    CYCLE=$((CYCLE + 1))
done