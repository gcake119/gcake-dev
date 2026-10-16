#!/bin/sh
# Fixed public-only acceptance; Hermes delivers stdout without an AI agent.
exec /usr/bin/env -i PATH=/usr/bin:/bin LC_ALL=en_US.UTF-8 /usr/bin/python3 -I /Users/hermes/.hermes/scripts/gcake-first-post-release-check-20261012.py --max-wait 1200
