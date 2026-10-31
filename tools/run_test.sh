#!/bin/bash
# Usage: tools/run_test.sh compare2     (runs tests/run/compare2_run.js inside the app, headless)
# Needs: xvfb (sudo apt install xvfb) and npm install done. Saved files go to ./test_out
cd "$(dirname "$0")/.."
mkdir -p test_out
REDLINE_TEST_DIR="$PWD/test_out" REDLINE_SELFTEST="$PWD/tests/run/$1_run.js" REDLINE_SHOT="$PWD/test_out/screenshot.png" \
  xvfb-run -a -s "-screen 0 1600x1000x24" ./node_modules/electron/dist/electron --no-sandbox --disable-gpu --disable-dev-shm-usage . 2>&1 | grep -E "SELFTEST|CONSOLE-ERR"
