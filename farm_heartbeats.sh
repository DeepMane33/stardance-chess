#!/bin/bash
# Farm Heartbeats - stardance-chess
# Customized for: /c/Users/Anil Mane/stardance-chess
# Run: bash farm_heartbeats.sh
#
# Cycle: 10 min work (heartbeats every 60s) / 2 min break
# No bulk sending - heartbeats sent every 60s during active period

# ============================================================
# CONFIGURATION - CUSTOMIZED FOR stardance-chess
# ============================================================
PROJECT_DIR="/c/Users/Anil Mane/stardance-chess"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/heartbeat_farm.log"
PID_FILE="$LOG_DIR/farm_heartbeats.pid"
DEV_LOG="$LOG_DIR/dev.log"

# Hackatime proxy settings (assumes proxy running on localhost:19842)
HACKATIME_URL="http://localhost:19842/api/hackatime/v1/users/current/heartbeats"
AUTH_HEADER="Authorization: Basic YzZiNGM1NDItN2E3MC00MTAzLTlmMzYtYWU2MTBmOWM1OWVk"

# Heartbeat payload - customize for stardance-chess
HEARTBEAT_ENTITY="stardance-chess"
HEARTBEAT_PROJECT="stardance-chess"
HEARTBEAT_TYPE="app"

# Cycle timing - 10 min work / 2 min break
ACTIVE_DURATION=600        # 10 minutes = 600 seconds (work period)
IDLE_DURATION=120          # 2 minutes = 120 seconds (break period)
HEARTBEAT_INTERVAL=60      # Send heartbeat every 60s during active

# ============================================================
# INTERNAL - DO NOT MODIFY BELOW
# ============================================================

mkdir -p "$LOG_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

send_heartbeat() {
    local entity="$1"
    local project="$2"
    local type="${3:-app}"
    local timestamp=$(date +%s)

    if curl -s -f -X POST "$HACKATIME_URL" \
        -H "Content-Type: application/json" \
        -H "$AUTH_HEADER" \
        -d "{\"entity\": \"$entity\", \"type\": \"$type\", \"project\": \"$project\", \"time\": $timestamp}" > /dev/null 2>&1; then
        log "✓ Heartbeat sent: entity=$entity project=$project type=$type"
        return 0
    else
        log "✗ Heartbeat FAILED: entity=$entity project=$project (proxy not responding)"
        return 1
    fi
}

check_proxy() {
    # Check if proxy is listening on port 19842 (netstat/ss works on Windows Git Bash)
    if netstat -an 2>/dev/null | grep -q ":19842.*LISTEN" || \
       ss -ltn 2>/dev/null | grep -q ":19842" || \
       curl -s -f --max-time 2 "http://localhost:19842/" > /dev/null 2>&1; then
        log "✓ Hackatime proxy running on port 19842"
        return 0
    else
        log "✗ Hackatime proxy NOT running on port 19842"
        return 1
    fi
}

start_dev_server() {
    log "Starting dev server (npm run dev)..."
    cd "$PROJECT_DIR" || { log "ERROR: Cannot cd to $PROJECT_DIR"; return 1; }

    npm run dev > "$DEV_LOG" 2>&1 &
    local npm_pid=$!

    # Wait for npm to spawn the actual vite process
    sleep 3

    # Find the real vite process (child of npm)
    local vite_pid=$(pgrep -P $npm_pid -f "vite" 2>/dev/null | head -1)

    if [ -n "$vite_pid" ]; then
        echo "$vite_pid" > "$PID_FILE"
        log "Dev server started (vite PID: $vite_pid)"
        return 0
    elif ps -p $npm_pid > /dev/null 2>&1; then
        echo "$npm_pid" > "$PID_FILE"
        log "Dev server started (npm PID: $npm_pid - fallback)"
        return 0
    else
        log "ERROR: npm run dev failed (check $DEV_LOG)"
        return 1
    fi
}

stop_dev_server() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE" 2>/dev/null)
        if [ -n "$pid" ] && ps -p "$pid" > /dev/null 2>&1; then
            log "Stopping dev server (PID: $pid)..."
            kill "$pid" 2>/dev/null
            sleep 2
            if ps -p "$pid" > /dev/null 2>&1; then
                kill -9 "$pid" 2>/dev/null
                log "Force killed PID $pid"
            else
                log "Dev server stopped gracefully"
            fi
        else
            log "PID $pid not running"
        fi
        rm -f "$PID_FILE"
    else
        log "No PID file found"
    fi
}

# ============================================================
# MAIN LOOP
# ============================================================

log "=== Heartbeat Farm Started ==="
log "Project: $HEARTBEAT_PROJECT | Entity: $HEARTBEAT_ENTITY | Type: $HEARTBEAT_TYPE"
log "Cycle: ${ACTIVE_DURATION}s active / ${IDLE_DURATION}s idle"
log "Heartbeat interval: ${HEARTBEAT_INTERVAL}s during active"
log "Proxy: $HACKATIME_URL"

# Initial proxy check
check_proxy

while true; do
    log "=== CYCLE START: ${ACTIVE_DURATION}s active period ==="

    # Send initial heartbeat
    send_heartbeat "$HEARTBEAT_ENTITY" "$HEARTBEAT_PROJECT" "$HEARTBEAT_TYPE"

    # Start dev server
    if start_dev_server; then
        # Active period with periodic heartbeats
        elapsed=0
        while [ $elapsed -lt $ACTIVE_DURATION ]; do
            sleep $HEARTBEAT_INTERVAL
            elapsed=$((elapsed + HEARTBEAT_INTERVAL))

            # Send heartbeat
            send_heartbeat "$HEARTBEAT_ENTITY" "$HEARTBEAT_PROJECT" "$HEARTBEAT_TYPE"

            # Verify dev server still alive
            if [ -f "$PID_FILE" ]; then
                pid=$(cat "$PID_FILE" 2>/dev/null)
                if ! ps -p "$pid" > /dev/null 2>&1; then
                    log "WARNING: Dev server (PID $pid) died, restarting..."
                    start_dev_server
                fi
            fi

            remaining=$((ACTIVE_DURATION - elapsed))
            log "Active: ${elapsed}s elapsed, ${remaining}s remaining"
        done
    else
        log "Failed to start dev server, waiting $ACTIVE_DURATION anyway"
        sleep $ACTIVE_DURATION
    fi

    # Stop dev server
    stop_dev_server

    # Idle period (break)
    log "=== CYCLE END: ${IDLE_DURATION}s idle period (break) ==="
    sleep $IDLE_DURATION

    log "=== Next cycle starting ==="
done