#!/bin/bash
# stardance-chess game farm: 10 min ON (dev server), 2 min OFF

CYCLE=1
WORK_MIN=10
BREAK_MIN=2

while true; do
    echo "=== GAME FARM CYCLE $CYCLE: WORK ($WORK_MIN min) ==="
    date
    
    # Start the dev server in background
    npm run dev &
    DEV_PID=$!
    
    # Run for WORK_MIN minutes
    sleep ${WORK_MIN}m
    
    # Kill the dev server
    kill $DEV_PID 2>/dev/null
    wait $DEV_PID 2>/dev/null
    
    echo "=== GAME FARM CYCLE $CYCLE: BREAK ($BREAK_MIN min) ==="
    date
    
    # Break for BREAK_MIN minutes
    sleep ${BREAK_MIN}m
    
    CYCLE=$((CYCLE + 1))
done