#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
/usr/bin/shasum -a 256 -c SHA256SUMS
readonly task_library="$PWD"
exec /usr/bin/sudo -u hermes /usr/bin/env -i HOME=/Users/hermes HERMES_HOME=/Users/hermes/.hermes PATH=/usr/bin:/bin /bin/bash -c 'set -euo pipefail
set -a
. /Users/hermes/.config/gcake-rss/live.env
set +a
exec /usr/local/share/gcake-hermes-runtime/releases/f98d49207288ae81f1cad0ece146489c1631700f946ea9146663cfab32eab66e/runtime/bin/python3.11 -I -B -S -c '"'"'import runpy,sys;sys.path.insert(0,sys.argv[1]);runpy.run_path(sys.argv[1]+"/owner_resend_once.py",run_name="__main__")'"'"' "$1"' repair-owner "$task_library"
