#!/bin/bash
# Re-run the duration=480 config several times: cells 3/4 showed one extra stale
# frame on Path B in a single run. Is that real or run-to-run jitter?
set -u
export PLAYWRIGHT_BROWSERS_PATH=/home/user/react18-omni-POC/harness/.browsers
cd /home/user/react18-omni-POC/harness
for i in 1 2 3; do
  node run.mjs prod 480 6 >/dev/null 2>&1
  cp ../results/results-prod-duration480-cards6.json ../results/rep480-$i.json
  echo "--- repeat $i ---"
  node analyzeB.mjs ../results/rep480-$i.json | tail -5
done
