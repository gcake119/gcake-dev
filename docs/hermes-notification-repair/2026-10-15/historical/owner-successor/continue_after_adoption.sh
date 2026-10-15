#!/bin/bash
set -euo pipefail
if [ "$(/usr/bin/id -un)" = hermes ]; then
 exec /usr/bin/env -i HOME=/Users/hermes HERMES_HOME=/Users/hermes/.hermes PATH=/usr/bin:/bin /bin/bash -c 'set -euo pipefail
set -a
. /Users/hermes/.config/gcake-rss/live.env
. /Users/hermes/.config/gcake-rss/publication-monitor.env
set +a
exec /usr/local/share/gcake-hermes-runtime/releases/f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c/runtime/bin/python3.11 -I -B -S -c '"'"'import sys,runpy;sys.path.insert(0,"/usr/local/share/gcake-hermes-runtime/tools");from production_entry import ProductionStore
with ProductionStore().lease("live") as payload:
 if payload.name!='"'"'"'"'"'"'"'"'f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c'"'"'"'"'"'"'"'"':raise ValueError("selected-successor-drift")
 runpy.run_path(str(payload/"library/owner_continue.py"),run_name="__main__")'"'"''
else
 exec /usr/bin/sudo -u hermes /usr/bin/env -i HOME=/Users/hermes HERMES_HOME=/Users/hermes/.hermes PATH=/usr/bin:/bin /bin/bash -c 'set -euo pipefail
set -a
. /Users/hermes/.config/gcake-rss/live.env
. /Users/hermes/.config/gcake-rss/publication-monitor.env
set +a
exec /usr/local/share/gcake-hermes-runtime/releases/f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c/runtime/bin/python3.11 -I -B -S -c '"'"'import sys,runpy;sys.path.insert(0,"/usr/local/share/gcake-hermes-runtime/tools");from production_entry import ProductionStore
with ProductionStore().lease("live") as payload:
 if payload.name!='"'"'"'"'"'"'"'"'f36ad05d1ea2fe93fe82712008904ae1cbe7cc4b9b606833fae07aa8bbaf753c'"'"'"'"'"'"'"'"':raise ValueError("selected-successor-drift")
 runpy.run_path(str(payload/"library/owner_continue.py"),run_name="__main__")'"'"''
fi
